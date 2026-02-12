/**
 * Mapeia DADOS.xlsx com os clientes da tabela clients_inadimplencia (CDI).
 * Atualiza: qtd_processos, horas_total, horas_por_ano (timesheet dos advogados).
 *
 * Estrutura esperada em DADOS.xlsx (primeira aba):
 * - Coluna Cliente / Razão Social / Cliente/Grupo (nome para casar com razao_social)
 * - Coluna QT PASTAS = quantidade de processos (qtd_processos)
 * - Coluna QT HORAS = horas total (horas_total; formato Excel duração ou "HH:MM:SS")
 * - Colunas de horas por ano: "2024", "2023", etc. (opcional)
 *
 * Uso: node scripts/map-dados-xlsx.cjs [caminho/para/DADOS.xlsx]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const FILE = process.argv[2] || path.join(__dirname, '..', 'DADOS.xlsx');

/**
 * Parse número (horas decimais ou inteiros) – para QT PASTA etc.
 */
function parseNum(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim().replace(/\s/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized = s;
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    normalized = s.replace(',', '.');
  }
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : n;
}

/** Epoch Excel (30/12/1899) para converter Date em dias serial. */
const EXCEL_EPOCH = new Date(1899, 11, 30).getTime();

/**
 * Converte valor de horas da planilha para horas decimais.
 * Na base DADOS.xlsx as colunas de horas vêm como:
 * - Número (serial Excel em dias): ex. 80,51 = 1932h16. Serial * 24 = horas decimais.
 * - Objeto Date (quando cellDates: true): dias desde 30/12/1899 * 24 = horas.
 * - String de duração "1932:16:00" (horas:minutos:segundos).
 */
function parseHoras(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) {
    return Math.round(val * 24 * 100) / 100;
  }
  if (val instanceof Date) {
    const days = (val.getTime() - EXCEL_EPOCH) / (1000 * 60 * 60 * 24);
    return Math.round(days * 24 * 100) / 100;
  }
  const s = String(val).trim();
  const m = s.match(/^\s*(\d+):(\d{1,2}):(\d{1,2})\s*$/);
  if (m) {
    const h = parseInt(m[1], 10) || 0;
    const min = parseInt(m[2], 10) || 0;
    const sec = parseInt(m[3], 10) || 0;
    return Math.round((h + min / 60 + sec / 3600) * 100) / 100;
  }
  const n = parseNum(val);
  return n != null ? Math.round(n * 100) / 100 : null;
}

/** Remove prefixo "GRUPO " para casar com CDI (onde pode vir sem "GRUPO"). */
function stripGrupo(str) {
  const s = (str || '').toString().trim();
  const upper = s.toUpperCase();
  if (upper === 'GRUPO') return '';
  if (upper.startsWith('GRUPO ')) return s.slice(6).trim();
  return s;
}

function normalizeNome(str) {
  const withoutGrupo = stripGrupo(str || '');
  return withoutGrupo
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Retorna true se o nome da planilha casa com o razao_social do banco (exato ou início). */
function matchCliente(nomePlanilha, razaoSocial) {
  const a = normalizeNome(nomePlanilha);
  const b = normalizeNome(razaoSocial);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const aFirst = a.split(/\s+/)[0];
  const bFirst = b.split(/\s+/)[0];
  if (aFirst && bFirst && aFirst === bFirst) return true;
  return false;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env');
    process.exit(1);
  }

  console.log('Lendo planilha:', FILE);
  const workbook = XLSX.readFile(FILE, { cellDates: false });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error('Nenhuma aba encontrada.');
    process.exit(1);
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length < 2) {
    console.error('Planilha vazia ou sem dados.');
    process.exit(1);
  }

  const header = (data[0] || []).map((h) => (h || '').toString().trim().toLowerCase());
  const idxCliente =
    header.findIndex((h) => /cliente|razão social|razao social|cliente\/grupo|nome/i.test(h)) >= 0
      ? header.findIndex((h) => /cliente|razão social|razao social|cliente\/grupo|nome/i.test(h))
      : 0;
  const idxProcessos = header.findIndex((h) =>
    /qt pasta|quantidade de processos|qtd processos|processos|n[º°] processos/i.test(h)
  );
  const idxHorasTotal = header.findIndex((h) =>
    /qt horas|horas total|total horas|horas totais|total de horas/i.test(h)
  );

  const yearCols = [];
  header.forEach((h, i) => {
    const m = (h || '').match(/^(?:horas?\s*)?(\d{4})$/);
    if (m) yearCols.push({ year: m[1], idx: i });
  });
  if (yearCols.length === 0) {
    const idxHorasAno = header.findIndex((h) => /horas por ano|horas\/ano/i.test(h));
    if (idxHorasAno >= 0) yearCols.push({ year: new Date().getFullYear().toString(), idx: idxHorasAno });
  }
  yearCols.sort((a, b) => b.year.localeCompare(a.year));

  console.log('Colunas detectadas:', {
    cliente: idxCliente,
    processos: idxProcessos >= 0 ? idxProcessos : '(não encontrado)',
    horasTotal: idxHorasTotal >= 0 ? idxHorasTotal : '(não encontrado)',
    anos: yearCols.map((y) => y.year),
  });

  const supabase = createClient(url, key);

  const { data: clientes, error: errClientes } = await supabase
    .from('clients_inadimplencia')
    .select('id, razao_social')
    .is('resolvido_at', null);

  if (errClientes) {
    console.error('Erro ao buscar clientes:', errClientes.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const nomePlanilha = row[idxCliente] ? String(row[idxCliente]).trim() : '';
    if (!nomePlanilha) {
      skipped++;
      continue;
    }

    const qtdProcessos = idxProcessos >= 0 ? parseNum(row[idxProcessos]) : null;
    const horasTotal = idxHorasTotal >= 0 ? parseHoras(row[idxHorasTotal]) : null;
    const horasPorAno = {};
    for (const { year, idx } of yearCols) {
      const v = parseHoras(row[idx]);
      if (v != null) horasPorAno[year] = v;
    }
    const horasPorAnoJson =
      Object.keys(horasPorAno).length > 0 ? horasPorAno : null;

    const client = (clientes || []).find((c) => matchCliente(nomePlanilha, c.razao_social));
    if (!client) {
      notFound++;
      console.log('Cliente não encontrado na base:', nomePlanilha);
      continue;
    }

    const payload = {};
    if (qtdProcessos != null) payload.qtd_processos = Math.max(0, Math.round(qtdProcessos));
    if (horasTotal != null) payload.horas_total = Math.max(0, horasTotal);
    if (horasPorAnoJson != null) payload.horas_por_ano = horasPorAnoJson;

    if (Object.keys(payload).length === 0) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('clients_inadimplencia')
      .update(payload)
      .eq('id', client.id);

    if (error) {
      console.error('Erro ao atualizar', client.razao_social, error.message);
    } else {
      updated++;
      console.log('OK:', client.razao_social, payload);
    }
  }

  console.log('\n--- Resumo ---');
  console.log('Atualizados:', updated);
  console.log('Ignorados (sem nome ou sem dados):', skipped);
  console.log('Não encontrados na base:', notFound);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
