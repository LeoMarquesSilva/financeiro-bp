/**
 * STANDALONE ESM — Copie este arquivo para DENTRO do vios-app no servidor
 * (ex.: vios-app/ProcessoCompleto/sync-vios-to-supabase.js).
 *
 * Use este se o vios-app for todo em JS com import/export (ESM).
 * - runSync(filePath): Processo Completo (pessoas) — espera .xlsx
 * - runSyncTimeSheets(filePath): relatório de horas (timesheets) — espera .xlsx/.csv
 * - runSyncRelatorioFinanceiro(filePathOuCsvString): relatório de parcelas (relatorio_financeiro) — espera .xlsx, .csv ou string CSV
 * - runSyncPessoas(filePathOuCsvString): relatório de clientes/pessoas (pessoas) — espera .csv ou string CSV
 *
 * No vios-app:
 *   1. npm install dotenv xlsx @supabase/supabase-js
 *   2. .env com: VITE_SUPABASE_URL=... e VITE_SUPABASE_ANON_KEY=...
 *   3. Ex.: import { runSync, runSyncTimeSheets, runSyncRelatorioFinanceiro } from './sync-vios-to-supabase.js';
 *
 * Se o projeto não tiver "type": "module" no package.json, use a extensão .mjs
 * (renomeie este arquivo para .mjs) ou use o sync-vios-to-supabase.cjs com require.
 */
 
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const possibleEnv = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env'),
].find((p) => fs.existsSync(p));
if (possibleEnv) {
  dotenv.config({ path: possibleEnv });
}
 
// ========== CONFIGURAÇÃO (compatível com n8n: "Grupo do Cliente" + "Cliente") ==========
const SHEET_NAME = null;
const COLUMN_MAP = {
  grupo_cliente: ['grupo do cliente', 'grupo cliente', 'grupo_cliente'],
  razao_social: ['cliente', 'razão social', 'razao social', 'nome', 'empresa'],
  cnpj: ['cnpj', 'cnpj/cpf', 'cpf/cnpj'],
  qtd_processos: [
    'processos',
    'qtd processos',
    'quantidade processos',
    'nº processos',
    'numero processos',
    'n. processos',
    'nº de processos',
    'numero de processos',
    'quantidade',
    'qtd',
    'qtde',
    'qtde processos',
    'total processos',
    'total de processos',
    'quantidade de processos',
  ],
  horas_total: [
    'horas',
    'horas total',
    'total horas',
    'horas totais',
    'carga horária',
    'total de horas',
    'carga horaria',
    'horas total',
    'total horas em decimal',
    'tempo total',
    'soma horas',
  ],
};
const ANOS_COLUNAS = [2024, 2023, 2022, 2021];
 
/**
 * Tabela dinâmica no Excel: Linhas = Grupo do Cliente, Colunas = Situação do Processo, Valores = Contagem de CI.
 * Valores exatos da coluna "Situação do Processo" (como aparecem nas colunas da dinâmica):
 */
const SITUACAO_EXATA = [
  ['arquivado', 'arquivado'],
  ['arquivado definitivamente', 'arquivado_definitivamente'],
  ['arquivado provisoriamente', 'arquivado_provisoriamente'],
  ['ativo', 'ativo'],
  ['encerrado - ex-cliente', 'ex_cliente'],
  ['suspenso', 'suspenso'],
];
// Só usados quando o valor NÃO bate exatamente com SITUACAO_EXATA (ex.: variações com espaço/acento).
// "Ativo" não tem alias: contamos só valor exato "Ativo", para bater com a tabela dinâmica do Excel.
const SITUACAO_ALIASES = {
  arquivado: ['arquivado'],
  arquivado_definitivamente: ['arquivado definitivamente', 'definitivamente'],
  arquivado_provisoriamente: ['arquivado provisoriamente', 'provisoriamente'],
  ex_cliente: ['encerrado - ex-cliente', 'encerrado - ex cliente', 'ex-cliente', 'ex cliente'],
  encerrado: ['encerrado'],
  suspenso: ['suspenso'],
};
 
function normalizarSituacao(val) {
  if (val == null || val === '') return null;
  const s = String(val)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u2013|\u2014/g, '-');
  for (const [exata, col] of SITUACAO_EXATA) {
    if (s === exata) return col;
  }
  for (const [col, aliases] of Object.entries(SITUACAO_ALIASES)) {
    if (aliases.some((a) => s.includes(a) || a.includes(s))) return col;
  }
  return null;
}
 
function parseNumber(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}
 
/**
 * Parse para a coluna "Total de Horas em decimal": valor já em HORAS DECIMAIS (ex.: 0.25 = 15min, 2.1 = 2h06).
 * Grava como está. Na view, total_horas = SUM(total_horas_decimal) — sem dividir por 24.
 */
function parseDecimalHoursColumn(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (val instanceof Date) {
    return val.getHours() + val.getMinutes() / 60 + val.getSeconds() / 3600;
  }
  const s = String(val).trim().replace(/\s/g, '');
  if (!s) return null;
  if (/\./.test(s) && /,/.test(s)) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse para horas (coluna não-decimal): aceita segundos, HH:MM:SS, fração de dia, etc.
 */
function parseDecimalHours(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) {
    if (Number.isInteger(val) && val >= 60 && val <= 86400) return val / 3600;
    if (val > 86400) return val / 3600;
    return val;
  }
  if (val instanceof Date) {
    return val.getHours() + val.getMinutes() / 60 + val.getSeconds() / 3600;
  }
  const s = String(val).trim().replace(/\s/g, '');
  if (!s) return null;
  if (/\./.test(s) && /,/.test(s)) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }
  const n = parseFloat(s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}
 
/**
 * Converte "Total de Horas" do TimeSheets para horas decimais.
 * Aceita: número (horas decimais), "HH:MM:SS", "HH:MM", serial Excel (fração de dia) ou segundos (inteiro 60..86400).
 * Regra: inteiro em [60, 86400] = segundos (ex.: 37260 → 10:21:00 → 10,35 h); valor < 1 = fração de dia (×24).
 */
function parseHorasTimeSheet(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return null;
    if (val >= 0 && val < 1) return val * 24;
    if (Number.isInteger(val) && val >= 60 && val <= 86400) return val / 3600;
    if (val > 86400) return val / 3600;
    return val;
  }
  const s = String(val).trim();
  const match = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) || 0;
    const seg = match[3] != null ? parseInt(match[3], 10) || 0 : 0;
    return h + m / 60 + seg / 3600;
  }
  const num = parseFloat(s.replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}
 
/** Converte valor da célula (Data) para string ISO YYYY-MM-DD. Aceita Date, serial Excel ou string. */
function parseDateToISO(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    const y = val.getFullYear(), m = String(val.getMonth() + 1).padStart(2, '0'), d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const br = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  return null;
}

/** Data DD/MM/YYYY → YYYY-MM-DD. 00/00/0000 ou vazio → null. */
function parseDateBR(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (!s || s === '00/00/0000') return null;
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Valor BR (9.939,84) → número. */
function parseValorBR(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function normalizeCnpj(val) {
  if (val == null || val === '') return null;
  const digits = String(val).replace(/\D/g, '');
  return digits.length >= 14 ? digits.slice(0, 14) : digits.length > 0 ? digits : null;
}
 
function findColumnIndex(headerRow, aliases) {
  const normalized = headerRow.map((h) => (h != null ? String(h).toLowerCase().trim() : ''));
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h.includes(alias.toLowerCase()) || alias.toLowerCase().includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}
 
/** Coluna "Cliente" (razão social): deve ser o cabeçalho exato "Cliente", não "Grupo do Cliente". */
function findClienteColumnIndex(headerRow) {
  const normalized = headerRow.map((h) => (h != null ? String(h).toLowerCase().trim() : ''));
  const exact = normalized.findIndex((h) => h === 'cliente');
  if (exact >= 0) return exact;
  return normalized.findIndex((h) => h === 'razão social' || h === 'razao social' || h === 'nome' || h === 'empresa');
}
 
function buildColumnIndexes(headerRow) {
  const normalized = headerRow.map((h) => (h != null ? String(h).trim() : ''));
  const indexes = {
    grupo_cliente: findColumnIndex(headerRow, COLUMN_MAP.grupo_cliente),
    razao_social: findClienteColumnIndex(headerRow),
    cnpj: findColumnIndex(headerRow, COLUMN_MAP.cnpj),
    qtd_processos: findColumnIndex(headerRow, COLUMN_MAP.qtd_processos),
    horas_total: findColumnIndex(headerRow, COLUMN_MAP.horas_total),
  };
  indexes.horas_por_ano = {};
  for (const year of ANOS_COLUNAS) {
    const idx = normalized.findIndex((h) => h === String(year) || h === `Horas ${year}` || h === year);
    if (idx >= 0) indexes.horas_por_ano[year] = idx;
  }
  const normHeader = headerRow.map((h) => (h != null ? String(h).toLowerCase().trim().replace(/\s+/g, ' ') : ''));
  const idxSituacaoExato = normHeader.findIndex((h) => h === 'situação do processo' || h === 'situacao do processo');
  indexes.situacao_processo = idxSituacaoExato >= 0 ? idxSituacaoExato : findColumnIndex(headerRow, ['situação do processo', 'situacao do processo', 'situação processo', 'situacao processo']);
  return indexes;
}
 
function rowToRecord(row, indexes) {
  // "Cliente" = razão social da empresa (cada linha = 1 empresa/CNPJ)
  const razao_social = indexes.razao_social >= 0 ? String(row[indexes.razao_social] || '').trim() : '';
  // "Grupo do Cliente" = grupo ao qual a empresa pertence (1 grupo pode ter várias empresas/CNPJs)
  const grupo = indexes.grupo_cliente >= 0 ? String(row[indexes.grupo_cliente] || '').trim() : '';
  if (!razao_social) return null;
  const cnpjRaw = indexes.cnpj >= 0 ? row[indexes.cnpj] : null;
  const cnpj = normalizeCnpj(cnpjRaw);
  const qtd_processos = indexes.qtd_processos >= 0 ? parseNumber(row[indexes.qtd_processos]) : null;
  const rawHoras = indexes.horas_total >= 0 ? row[indexes.horas_total] : null;
  const horas_total =
    rawHoras != null && rawHoras !== ''
      ? parseNumber(rawHoras) ?? parseDecimalHours(rawHoras) ?? parseHorasTimeSheet(rawHoras)
      : null;
  const horas_por_ano = {};
  for (const [year, colIdx] of Object.entries(indexes.horas_por_ano)) {
    const val = parseNumber(row[colIdx]);
    if (val != null && val > 0) horas_por_ano[year] = val;
  }
  const horasPorAnoOrNull = Object.keys(horas_por_ano).length > 0 ? horas_por_ano : null;
  return {
    grupo_cliente: grupo || null,
    razao_social,
    cnpj,
    qtd_processos: qtd_processos != null ? Math.max(0, Math.round(qtd_processos)) : null,
    horas_total: horas_total != null ? Math.max(0, horas_total) : null,
    horas_por_ano: horasPorAnoOrNull,
  };
}
 
/** Coluna "Grupo do Cliente": só cabeçalhos que contêm "grupo" e "cliente". */
function findProcessosGrupoClienteIndex(norm) {
  return norm.findIndex((h) => (h.includes('grupo') && h.includes('cliente')));
}

/** Coluna "Cliente": cabeçalho exato "cliente" ou "razão social", excluindo "grupo do cliente". */
function findProcessosClienteIndex(norm) {
  const exact = norm.findIndex((h) => h === 'cliente');
  if (exact >= 0) return exact;
  return norm.findIndex((h) => (h === 'razao social' || h === 'razão social') && !h.includes('grupo'));
}

/** Índices de colunas para ProcessoCompleto (XLSX). Cliente = coluna obrigatória. */
function buildProcessosCompletoColumnIndexes(headerRow) {
  const norm = headerRow.map((h) => (h != null ? String(h).toLowerCase().trim().replace(/\s+/g, ' ') : ''));
  const find = (aliases) => {
    for (const a of aliases) {
      const i = norm.findIndex((h) => h.length >= a.length && h.includes(a));
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    ci: find(['ci']),
    grupo_cliente: findProcessosGrupoClienteIndex(norm),
    departamento: find(['departamento']),
    area: find(['área', 'area']),
    advogado_responsavel: find(['advogado responsável', 'advogado responsavel']),
    cliente: findProcessosClienteIndex(norm),
    acao: find(['ação', 'acao']),
    acao_data_cadastro: find(['ação data do cadastro', 'acao data do cadastro', 'ação data cadastro']),
    data_cadastro: find(['data do cadastro', 'data cadastro']),
    fase_processual: find(['fase processual']),
    nro_cnj: find(['n.° cnj', 'n. cnj', 'nro cnj', 'numero cnj']),
    processo_encerrado: find(['processo encerrado']),
    situacao_processo: find(['situação do processo', 'situacao do processo']),
    motivo_encerramento: find(['motivo de encerramento', 'motivo encerramento']),
    etiquetas: find(['etiquetas']),
    data_encerramento: find(['data do encerramento', 'data encerramento']),
  };
}

function rowToProcessosCompletoRecord(row, idx) {
  const cliente = idx.cliente >= 0 ? String(row[idx.cliente] ?? '').trim() : '';
  if (!cliente) return null;
  const trim = (i) => (i >= 0 && row[i] != null && String(row[i]).trim() !== '' ? String(row[i]).trim() : null);
  const dataCadastro = idx.data_cadastro >= 0 ? parseDateToISO(row[idx.data_cadastro]) || (idx.data_cadastro >= 0 && row[idx.data_cadastro] ? parseDateBR(row[idx.data_cadastro]) : null) : null;
  const dataEncerramento = idx.data_encerramento >= 0 ? parseDateToISO(row[idx.data_encerramento]) || parseDateBR(row[idx.data_encerramento]) : null;
  return {
    ci: trim(idx.ci),
    grupo_cliente: trim(idx.grupo_cliente),
    departamento: trim(idx.departamento),
    area: trim(idx.area),
    advogado_responsavel: trim(idx.advogado_responsavel),
    cliente,
    acao: trim(idx.acao),
    acao_data_cadastro: trim(idx.acao_data_cadastro),
    data_cadastro: dataCadastro,
    fase_processual: trim(idx.fase_processual),
    nro_cnj: trim(idx.nro_cnj),
    processo_encerrado: trim(idx.processo_encerrado),
    situacao_processo: trim(idx.situacao_processo),
    motivo_encerramento: trim(idx.motivo_encerramento),
    etiquetas: trim(idx.etiquetas),
    data_encerramento: dataEncerramento,
  };
}

/**
 * Sincroniza o Excel ProcessoCompleto para a tabela processos_completo (uma linha por processo).
 * Usa upsert por CI; duplicatas no mesmo arquivo são removidas por CI (fica a última). Chama processos_completo_vinculacao_pessoa().
 * @param {string} filePath - Caminho absoluto do arquivo Processos Completo.xlsx
 * @returns {Promise<{ upserted: number, errors: number }>}
 */
export async function runSync(filePath) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env do vios-app.');
  }

  console.log('[Sync Supabase] ProcessoCompleto:', filePath);
  let workbook;
  try {
    workbook = XLSX.readFile(filePath, { cellDates: true, raw: true });
  } catch (err) {
    throw new Error('Erro ao abrir o arquivo: ' + err.message);
  }

  const sheet = SHEET_NAME && workbook.Sheets[SHEET_NAME]
    ? workbook.Sheets[SHEET_NAME]
    : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Nenhuma aba encontrada no arquivo.');

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (data.length < 2) throw new Error('Planilha sem dados (cabeçalho + pelo menos uma linha).');

  const headerRow = data[0];
  const indexes = buildProcessosCompletoColumnIndexes(headerRow);
  if (indexes.cliente < 0) {
    throw new Error('Coluna Cliente não encontrada no ProcessoCompleto.');
  }

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const rec = rowToProcessosCompletoRecord(data[i], indexes);
    if (rec) rows.push(rec);
  }

  // Uma linha por CI: evita "ON CONFLICT DO UPDATE cannot affect row a second time" no mesmo lote.
  const byCi = new Map();
  for (const r of rows) {
    byCi.set(String(r.ci ?? ''), r);
  }
  const rowsDedup = [...byCi.values()];
  if (rowsDedup.length < rows.length) {
    console.log('[Sync Supabase] processos_completo duplicatas removidas por CI:', rows.length, '->', rowsDedup.length);
  }

  console.log('[Sync Supabase] processos_completo | Linhas válidas:', rowsDedup.length);
  const supabase = createClient(url, key);

  let upserted = 0;
  let errors = 0;
  const BATCH = 200;
  for (let i = 0; i < rowsDedup.length; i += BATCH) {
    const chunk = rowsDedup.slice(i, i + BATCH);
    const { error } = await supabase
      .from('processos_completo')
      .upsert(chunk, { onConflict: 'ci' });
    if (error) {
      console.error('[Sync Supabase] processos_completo upsert error:', error.message);
      errors++;
    } else {
      upserted += chunk.length;
    }
  }

  const { data: vinculados, error: errVinc } = await supabase.rpc('processos_completo_vinculacao_pessoa');
  if (errVinc) console.warn('[Sync Supabase] Aviso vinculação processos_completo:', errVinc.message);
  else console.log('[Sync Supabase] processos_completo vinculação:', vinculados ?? 0, 'linhas.');

  console.log('[Sync Supabase] processos_completo | Upserted:', upserted, '| Erros:', errors);
  return { upserted, errors };
}
 
// ========== TimeSheets (relatório de horas: todas as colunas da tabela timesheets) ==========
const TIMESHEETS_COLUMNS = {
  ci: ['ci'],
  data: ['data', 'date', 'data lançamento', 'data lançamento'],
  cobrar: ['cobrar'],
  grupo_cliente: ['grupo cliente', 'grupo do cliente', 'grupo_cliente'],
  cliente: ['cliente', 'razão social', 'razao social'],
  parte_contraria: ['parte contrária', 'parte contraria'],
  area: ['área', 'area'],
  nro_processo: ['nro processo', 'nro_processo', 'numero processo', 'processo'],
  origem: ['origem'],
  ci_atendimento_processo: ['ci atendimento processo', 'ci atendimento'],
  pasta_interna_processo: ['pasta interna processo', 'pasta interna'],
  pasta_contrato: ['pasta contrato'],
  colaborador: ['colaborador'],
  tipo_apontamento: ['tipo apontamento', 'tipo de apontamento'],
  tipo_tarefa: ['tipo tarefa', 'tipo de tarefa'],
  descricao: ['descrição', 'descricao'],
  hora_inicial: ['hora inicial', 'hora inicial'],
  hora_final: ['hora final', 'hora final'],
  total_horas: ['total de horas em decimal', 'total de horas', 'total horas', 'horas', 'total_horas', 'horas totais', 'em decimal'],
  total_horas_decimal: ['total de horas em decimal', 'total horas decimal'],
  valor_hora: ['valor hora', 'valor/hora'],
  valor_total: ['valor total', 'valor total'],
  contrato: ['contrato'],
};
 
/** Normaliza cabeçalho para match: strip HTML e colapsa espaços (ex.: "Total de Horas <br><small>em decimal</small>" → "total de horas em decimal"). */
function normalizeTimeSheetsHeader(headerRow) {
  return headerRow.map((h) =>
    (h != null ? String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : '')
  );
}
 
/**
 * Retorna o índice da coluna de total de horas. Prioriza a coluna "Total de Horas em decimal"
 * (ex.: índice 19 no Adhemar.xlsx); senão cai na coluna "Total de Horas" (que pode ser data Excel).
 */
function findTotalHorasColumnIndex(normalized, headerRow) {
  for (let i = 0; i < normalized.length; i++) {
    const n = normalized[i];
    const raw = headerRow[i] != null ? String(headerRow[i]).toLowerCase() : '';
    if ((n.includes('total de horas') || n.includes('total horas')) && (n.includes('decimal') || raw.includes('decimal'))) {
      return i;
    }
  }
  return findColumnIndex(normalized, TIMESHEETS_COLUMNS.total_horas);
}

/** Coluna "Grupo Cliente": só cabeçalhos que contêm "grupo" (evita pegar a coluna "Cliente"). */
function findTimeSheetsGrupoClienteIndex(normalized) {
  return normalized.findIndex(
    (h) => h === 'grupo cliente' || h === 'grupo do cliente' || (h.includes('grupo') && h.includes('cliente'))
  );
}

/** Coluna "Cliente": cabeçalho exato "cliente" ou "razão social", excluindo "grupo cliente". */
function findTimeSheetsClienteIndex(normalized) {
  const exact = normalized.findIndex((h) => h === 'cliente' && !h.includes('grupo'));
  if (exact >= 0) return exact;
  return normalized.findIndex((h) => (h === 'razao social' || h === 'razão social') && !h.includes('grupo'));
}

function buildTimeSheetsColumnIndexes(headerRow) {
  const normalized = normalizeTimeSheetsHeader(headerRow);
  const idx = {
    data: findColumnIndex(normalized, TIMESHEETS_COLUMNS.data),
    grupo_cliente: findTimeSheetsGrupoClienteIndex(normalized),
    cliente: findTimeSheetsClienteIndex(normalized),
    total_horas: findTotalHorasColumnIndex(normalized, headerRow),
  };
  for (const [key, aliases] of Object.entries(TIMESHEETS_COLUMNS)) {
    if (idx[key] === undefined) idx[key] = findColumnIndex(normalized, aliases);
  }
  idx.total_horas_decimal = idx.total_horas_decimal >= 0 ? idx.total_horas_decimal : idx.total_horas;
  return idx;
}
 
/**
 * Sincroniza o relatório TimeSheets (Excel ou CSV) para a tabela timesheets no Supabase.
 * Usa upsert por CI (identificador único): linha já existente = atualiza; linha nova = insere.
 * Duplicatas no mesmo arquivo são removidas por CI (fica a última). Evita duplicar ao rodar diariamente.
 * @param {string} filePath - Caminho absoluto do arquivo TimeSheets (.xlsx ou .csv).
 * @returns {Promise<{ upserted: number, errors: number }>}
 */
export async function runSyncTimeSheets(filePath) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env do vios-app.');
  }
 
  console.log('[Sync Supabase] TimeSheets:', filePath);
  let workbook;
  try {
    workbook = XLSX.readFile(filePath, { cellDates: true, raw: true });
  } catch (err) {
    throw new Error('Erro ao abrir o arquivo TimeSheets: ' + err.message);
  }
 
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Nenhuma aba encontrada no TimeSheets.');
 
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (data.length < 2) throw new Error('TimeSheets sem dados (cabeçalho + pelo menos uma linha).');
 
  const headerRow = data[0];
  const idx = buildTimeSheetsColumnIndexes(headerRow);
  if (idx.data < 0 || idx.cliente < 0 || idx.total_horas < 0) {
    throw new Error('TimeSheets: colunas obrigatórias não encontradas (Data, Cliente, Total de Horas). Verifique os cabeçalhos.');
  }
 
  const rows = [];
  const headerTotalHorasRaw = idx.total_horas >= 0 && headerRow[idx.total_horas] != null ? String(headerRow[idx.total_horas]).toLowerCase() : '';
  const isDecimalHorasColumn = headerTotalHorasRaw.includes('decimal');
 
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const trimOpt = (colIdx) => (colIdx >= 0 && row[colIdx] != null ? String(row[colIdx]).trim() || null : null);
    const numOpt = (colIdx) => (colIdx >= 0 && row[colIdx] != null && row[colIdx] !== '' ? (typeof row[colIdx] === 'number' ? row[colIdx] : parseValorBR(row[colIdx])) : null);
    const dataISO = parseDateToISO(idx.data >= 0 ? row[idx.data] : null);
    const cliente = idx.cliente >= 0 ? String(row[idx.cliente] ?? '').trim() : '';
    const rawHoras = idx.total_horas >= 0 ? row[idx.total_horas] : null;
    const totalHoras = isDecimalHorasColumn ? parseDecimalHoursColumn(rawHoras) : parseHorasTimeSheet(rawHoras);
    if (!dataISO || !cliente || totalHoras == null || totalHoras < 0) continue;
    if (totalHoras > 10000) {
      console.warn('[Sync Supabase] TimeSheets: linha ignorada (total_horas absurdo):', totalHoras, '| data:', dataISO, '| cliente:', cliente);
      continue;
    }
    const th = Math.max(0, totalHoras);
    const vHora = numOpt(idx.valor_hora);
    const vTotal = numOpt(idx.valor_total);
    const rawDecimal = idx.total_horas_decimal >= 0 ? row[idx.total_horas_decimal] : null;
    const totalHorasDecimal = isDecimalHorasColumn
      ? th
      : (typeof rawDecimal === 'number' ? rawDecimal : parseValorBR(rawDecimal));
    rows.push({
      ci: trimOpt(idx.ci),
      data: dataISO,
      cobrar: trimOpt(idx.cobrar),
      grupo_cliente: idx.grupo_cliente >= 0 ? String(row[idx.grupo_cliente] ?? '').trim() || null : null,
      cliente: cliente || null,
      parte_contraria: trimOpt(idx.parte_contraria),
      area: trimOpt(idx.area),
      nro_processo: trimOpt(idx.nro_processo),
      origem: trimOpt(idx.origem),
      ci_atendimento_processo: trimOpt(idx.ci_atendimento_processo),
      pasta_interna_processo: trimOpt(idx.pasta_interna_processo),
      pasta_contrato: trimOpt(idx.pasta_contrato),
      colaborador: trimOpt(idx.colaborador),
      tipo_apontamento: trimOpt(idx.tipo_apontamento),
      tipo_tarefa: trimOpt(idx.tipo_tarefa),
      descricao: trimOpt(idx.descricao),
      hora_inicial: trimOpt(idx.hora_inicial),
      hora_final: trimOpt(idx.hora_final),
      total_horas: th,
      total_horas_decimal: totalHorasDecimal != null && !Number.isNaN(totalHorasDecimal) ? Math.round(totalHorasDecimal * 100) / 100 : th,
      valor_hora: vHora != null ? Math.round(vHora * 100) / 100 : null,
      valor_total: vTotal != null ? Math.round(vTotal * 100) / 100 : null,
      contrato: trimOpt(idx.contrato),
    });
  }

  // Uma linha por CI: evita "ON CONFLICT DO UPDATE cannot affect row a second time" no mesmo lote.
  const byCi = new Map();
  for (const r of rows) {
    const key = String(r.ci ?? '');
    byCi.set(key, r);
  }
  const rowsDedup = [...byCi.values()];
  if (rowsDedup.length < rows.length) {
    console.log('[Sync Supabase] TimeSheets duplicatas removidas por CI:', rows.length, '->', rowsDedup.length);
  }

  const supabase = createClient(url, key);
  const UPSERT_KEY = 'ci';
  let upserted = 0, errors = 0;
  const BATCH = 200;
  for (let i = 0; i < rowsDedup.length; i += BATCH) {
    const chunk = rowsDedup.slice(i, i + BATCH);
    const { error } = await supabase
      .from('timesheets')
      .upsert(chunk, { onConflict: UPSERT_KEY });
    if (error) {
      console.error('[Sync Supabase] TimeSheets upsert error:', error.message);
      errors++;
    } else {
      upserted += chunk.length;
    }
  }

  if (upserted > 0 || rowsDedup.length > 0) {
    const { data: vinculados, error: errVinculo } = await supabase.rpc('timesheets_vinculacao_pessoa');
    if (errVinculo) {
      console.warn('[Sync Supabase] Aviso ao rodar timesheets_vinculacao_pessoa:', errVinculo.message);
    } else {
      console.log('[Sync Supabase] Vínculo pessoa (timesheets):', vinculados ?? 0, 'linhas atualizadas.');
    }
  }

  console.log('[Sync Supabase] timesheets | Upserted:', upserted, '| Erros:', errors);
  return { upserted, errors };
}
 
// ========== Relatório Financeiro (parcelas: CI Título, CI Parcela, Data Vencimento, Nro Título, Cliente, Descrição, Valor, Situação, Data Baixa) ==========
const RELATORIO_FINANCEIRO_COLUMNS = {
  ci_titulo: ['ci título', 'ci titulo', 'ci_titulo'],
  ci_parcela: ['ci parcela', 'ci_parcela'],
  data_vencimento: ['data vencimento', 'data_vencimento'],
  data_vencimento_orig: ['data vencimento orig', 'data vencimento orig.'],
  competencia: ['competência', 'competencia'],
  tipo: ['tipo'],
  forma: ['forma'],
  nro_titulo: ['nro título', 'nro titulo', 'nro_titulo', 'numero titulo', 'nro. título', 'nro. titulo', 'nro tulo'],
  parcela: ['parcela'],
  parcelas: ['parcelas'],
  nf: ['nf'],
  cliente: ['cliente'],
  terceiro_titulo: ['terceiro do título', 'terceiro titulo', 'terceiro_titulo'],
  terceiros_itens: ['terceiros dos itens', 'terceiros itens'],
  descricao: ['descrição', 'descricao'],
  valor: ['valor'],
  valor_atualizado: ['valor atualizado'],
  valor_fluxo: ['valor fluxo'],
  valor_pago: ['valor pago'],
  valor_titulo: ['valor título', 'valor titulo'],
  situacao: ['situação', 'situacao', 'situao', 'status'],
  data_baixa: ['data baixa', 'data_baixa'],
  plano_contas: ['plano de contas', 'plano contas'],
};
 
/** Normaliza para match: remove caracteres de substituição (encoding quebrado), aspas, acentos. */
function normalizeFinanceiroHeader(cell) {
  if (cell == null) return '';
  let s = String(cell).trim().replace(/^"|"$/g, '');
  s = s.replace(/\uFFFD/g, ''); // caractere   (encoding quebrado) → vazio, para "CI T tulo" → "CI Ttulo", "Situa  o" → "Situao"
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
 
/** Normaliza texto para gravar no Supabase (NFC). */
function normalizeClienteNFC(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.trim().normalize('NFC');
}
 
function buildFinanceiroColumnIndexes(headerRow) {
  const normalized = headerRow.map(normalizeFinanceiroHeader);
 
  // Ordem fixa só quando o CSV tem exatamente 9 colunas (modelo). Se tiver mais, detectar por nome.
  if (normalized.length === 9) {
    const [c0, c1, c2, c3, c4, c5, c6, c7, c8] = normalized;
    const looksLikeModel =
      (c0.includes('ci') && (c0.includes('tulo') || c0.includes('titulo'))) &&
      (c1.includes('ci') && c1.includes('parcela')) &&
      (c2.includes('data') && c2.includes('vencimento')) &&
      (c3.includes('nro') && (c3.includes('tulo') || c3.includes('titulo'))) &&
      c4.includes('cliente') &&
      (c6.includes('valor')) &&
      (c8.includes('data') && c8.includes('baixa'));
    if (looksLikeModel) {
      return {
        ci_titulo: 0,
        ci_parcela: 1,
        data_vencimento: 2,
        nro_titulo: 3,
        cliente: 4,
        descricao: 5,
        valor: 6,
        situacao: 7,
        data_baixa: 8,
      };
    }
  }
 
  const idx = {};
  for (const [key, aliases] of Object.entries(RELATORIO_FINANCEIRO_COLUMNS)) {
    idx[key] = normalized.findIndex((h) => aliases.some((a) => h.includes(a) || a.includes(h)));
  }
  // Fallback por posição: se coluna 0 tem "ci" e "tulo", é ci_titulo (encoding quebrado)
  if (idx.ci_titulo < 0 && headerRow[0] != null) {
    const h = normalizeFinanceiroHeader(headerRow[0]);
    if (h.includes('ci') && (h.includes('tulo') || h.includes('titulo'))) idx.ci_titulo = 0;
  }
  if (idx.nro_titulo < 0) {
    const i = normalized.findIndex((h) => h.includes('nro') && (h.includes('tulo') || h.includes('titulo')));
    if (i >= 0) idx.nro_titulo = i;
  }
  if (idx.situacao < 0) {
    let i = normalized.findIndex((h) => h.includes('situ') && (h.includes('cao') || h.includes('ao')));
    if (i < 0) i = normalized.findIndex((h) => h.includes('status'));
    if (i < 0) i = normalized.findIndex((h) => h === 'situacao' || h === 'situao');
    if (i < 0) {
      i = normalized.findIndex((h) => {
        if (h.includes('Ã§') || h.includes('Ã£')) {
          try {
            const fixed = Buffer.from(h, 'latin1').toString('utf-8');
            const n = fixed.toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '');
            return n.includes('situacao') || n.includes('situao');
          } catch (_) { return false; }
        }
        return false;
      });
    }
    if (i < 0 && idx.valor >= 0 && idx.valor + 1 < normalized.length) {
      const afterValor = normalized[idx.valor + 1] || '';
      if (afterValor.includes('situ') || afterValor.includes('status') || afterValor.includes('ao')) i = idx.valor + 1;
    }
    if (i < 0 && idx.data_baixa >= 0 && idx.data_baixa >= 1) {
      const beforeDataBaixa = normalized[idx.data_baixa - 1] || '';
      if (beforeDataBaixa.includes('situ') || beforeDataBaixa.includes('status') || beforeDataBaixa.includes('ao')) i = idx.data_baixa - 1;
    }
    if (i >= 0) idx.situacao = i;
  }
  return idx;
}

/**
 * Lê CSV (separador ;) ou Excel e retorna { headerRow, dataRows }.
 * Aceita: caminho de arquivo (.csv ou .xlsx) OU string com conteúdo CSV (para uso com download em memória).
 */
function readRelatorioFinanceiroFile(filePathOrContent) {
  const isRawCsv =
    typeof filePathOrContent === 'string' &&
    (filePathOrContent.includes('\n') || filePathOrContent.includes('\r'));
  if (isRawCsv) {
    const raw = filePathOrContent;
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV do relatório financeiro sem dados (cabeçalho + pelo menos uma linha).');
    const headerRow = lines[0].split(';').map((c) => c.trim().replace(/^"|"$/g, ''));
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
      dataRows.push(lines[i].split(';').map((c) => c.trim().replace(/^"|"$/g, '')));
    }
    return { headerRow, dataRows };
  }
  const filePath = filePathOrContent;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
    return readRelatorioFinanceiroFile(raw);
  }
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Nenhuma aba encontrada no arquivo.');
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (data.length < 2) throw new Error('Planilha sem dados (cabeçalho + pelo menos uma linha).');
  const headerRow = data[0].map((c) => (c != null ? String(c).trim() : ''));
  const dataRows = data.slice(1);
  return { headerRow, dataRows };
}
 
/**
 * Sincroniza o relatório de parcelas (CSV ou Excel) para a tabela relatorio_financeiro.
 * Usa upsert por ci_titulo; duplicatas no mesmo arquivo são removidas por ci_titulo (fica a última).
 * @param {string} filePathOrCsvContent - Caminho do arquivo (.csv ou .xlsx) OU string com o conteúdo CSV (ex.: após axios.get em memória).
 * @returns {Promise<{ upserted: number, errors: number }>}
 */
export async function runSyncRelatorioFinanceiro(filePathOrCsvContent) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env do vios-app.');
  }
 
  const sourceLabel =
    typeof filePathOrCsvContent === 'string' && (filePathOrCsvContent.includes('\n') || filePathOrCsvContent.includes('\r'))
      ? '(CSV em memória)'
      : filePathOrCsvContent;
  console.log('[Sync Supabase] Relatório Financeiro:', sourceLabel);
 
  let headerRow;
  let dataRows;
  try {
    const out = readRelatorioFinanceiroFile(filePathOrCsvContent);
    headerRow = out.headerRow;
    dataRows = out.dataRows;
    console.log('[Sync Supabase] CSV lido. Linhas (sem cabeçalho):', dataRows.length, '| Cabeçalho:', headerRow.slice(0, 6).join('; ') + (headerRow.length > 6 ? '...' : ''));
  } catch (err) {
    console.error('[Sync Supabase] Erro ao ler CSV:', err.message);
    throw new Error('Erro ao abrir/processar o relatório financeiro: ' + err.message);
  }
 
  const idx = buildFinanceiroColumnIndexes(headerRow);
  console.log('[Sync Supabase] Colunas encontradas:', { ci_titulo: idx.ci_titulo, ci_parcela: idx.ci_parcela, data_vencimento: idx.data_vencimento, nro_titulo: idx.nro_titulo, cliente: idx.cliente, valor: idx.valor, situacao: idx.situacao });
  if (idx.ci_titulo < 0 || idx.ci_parcela < 0 || idx.data_vencimento < 0 || idx.nro_titulo < 0 || idx.cliente < 0 || idx.valor < 0 || idx.situacao < 0) {
    const missing = [];
    if (idx.ci_titulo < 0) missing.push('CI Título');
    if (idx.ci_parcela < 0) missing.push('CI Parcela');
    if (idx.data_vencimento < 0) missing.push('Data Vencimento');
    if (idx.nro_titulo < 0) missing.push('Nro Título');
    if (idx.cliente < 0) missing.push('Cliente');
    if (idx.valor < 0) missing.push('Valor');
    if (idx.situacao < 0) {
      missing.push('Situação');
      const norm = headerRow.map(normalizeFinanceiroHeader);
      console.error('[Sync Supabase] Cabeçalhos normalizados (para debug):', norm.map((h, i) => `[${i}]${h}`).join(' | '));
    }
    throw new Error(
      'Relatório Financeiro: colunas obrigatórias não encontradas (' + missing.join(', ') + '). Verifique o cabeçalho.'
    );
  }
 
  const supabase = createClient(url, key);
 
  const rows = [];
  for (const row of dataRows) {
    const ciTitulo = idx.ci_titulo >= 0 ? parseInt(String(row[idx.ci_titulo] ?? '').replace(/\D/g, ''), 10) : NaN;
    const ciParcela = idx.ci_parcela >= 0 ? parseInt(String(row[idx.ci_parcela] ?? '').replace(/\D/g, ''), 10) : NaN;
    const dataVencimento = parseDateBR(idx.data_vencimento >= 0 ? row[idx.data_vencimento] : null);
    const nroTitulo = idx.nro_titulo >= 0 ? String(row[idx.nro_titulo] ?? '').trim() : '';
    const cliente = idx.cliente >= 0 ? String(row[idx.cliente] ?? '').trim() : '';
    const valor = parseValorBR(idx.valor >= 0 ? row[idx.valor] : null);
    const situacaoRaw = idx.situacao >= 0 ? String(row[idx.situacao] ?? 'ABERTO').trim().toUpperCase() : '';
    const situacao = situacaoRaw || 'ABERTO';
 
    if (Number.isNaN(ciTitulo) || Number.isNaN(ciParcela) || !dataVencimento || !nroTitulo || !cliente || valor == null) {
      continue;
    }
 
    const descricao = idx.descricao >= 0 ? String(row[idx.descricao] ?? '').trim() || null : null;
    const dataBaixa = parseDateBR(idx.data_baixa >= 0 ? row[idx.data_baixa] : null);
    const dataVencimentoOrig = idx.data_vencimento_orig >= 0 ? parseDateBR(row[idx.data_vencimento_orig]) : null;
    const trimOpt = (i) => (i >= 0 && row[i] != null ? String(row[i]).trim() || null : null);
    const numOpt = (i) => (i >= 0 && row[i] != null && row[i] !== '' ? parseValorBR(row[i]) : null);

    rows.push({
      ci_titulo: ciTitulo,
      ci_parcela: ciParcela,
      data_vencimento: dataVencimento,
      data_vencimento_orig: dataVencimentoOrig,
      competencia: trimOpt(idx.competencia),
      tipo: trimOpt(idx.tipo),
      forma: trimOpt(idx.forma),
      nro_titulo: nroTitulo,
      parcela: trimOpt(idx.parcela),
      parcelas: trimOpt(idx.parcelas),
      nf: trimOpt(idx.nf),
      cliente: normalizeClienteNFC(cliente),
      terceiro_titulo: trimOpt(idx.terceiro_titulo),
      terceiros_itens: trimOpt(idx.terceiros_itens),
      descricao,
      valor: Math.round(valor * 100) / 100,
      valor_atualizado: numOpt(idx.valor_atualizado) != null ? Math.round(numOpt(idx.valor_atualizado) * 100) / 100 : null,
      valor_fluxo: numOpt(idx.valor_fluxo) != null ? Math.round(numOpt(idx.valor_fluxo) * 100) / 100 : null,
      valor_pago: numOpt(idx.valor_pago) != null ? Math.round(numOpt(idx.valor_pago) * 100) / 100 : null,
      valor_titulo: numOpt(idx.valor_titulo) != null ? Math.round(numOpt(idx.valor_titulo) * 100) / 100 : null,
      situacao: situacao === 'PAGO' ? 'PAGO' : 'ABERTO',
      data_baixa: dataBaixa,
      plano_contas: trimOpt(idx.plano_contas),
    });
  }

  // Uma linha por ci_titulo: evita "ON CONFLICT DO UPDATE cannot affect row a second time" no mesmo lote.
  const byCiTitulo = new Map();
  for (const r of rows) {
    byCiTitulo.set(String(r.ci_titulo ?? ''), r);
  }
  const rowsDedup = [...byCiTitulo.values()];
  if (rowsDedup.length < rows.length) {
    console.log('[Sync Supabase] financeiro_parcelas duplicatas removidas por ci_titulo:', rows.length, '->', rowsDedup.length);
  }

  console.log('[Sync Supabase] Linhas válidas para upsert:', rowsDedup.length);
  let upserted = 0;
  let errors = 0;
  const BATCH = 200;
  for (let i = 0; i < rowsDedup.length; i += BATCH) {
    const chunk = rowsDedup.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const { error } = await supabase
      .from('financeiro_parcelas')
      .upsert(chunk, { onConflict: 'ci_titulo' });
    if (error) {
      console.error('[Sync Supabase] financeiro_parcelas upsert error (lote ' + batchNum + '):', error.message);
      if (error.details) console.error('[Sync Supabase] details:', error.details);
      if (error.hint) console.error('[Sync Supabase] hint:', error.hint);
      console.error('[Sync Supabase] objeto completo:', JSON.stringify(error, null, 2));
      errors++;
    } else {
      upserted += chunk.length;
      if (batchNum % 5 === 0 || i + BATCH >= rowsDedup.length) {
        console.log('[Sync Supabase] Progresso: ' + upserted + '/' + rowsDedup.length + ' linhas enviadas.');
      }
    }
  }

  console.log('[Sync Supabase] financeiro_parcelas | Linhas processadas:', rowsDedup.length, '| Upserted:', upserted, '| Erros:', errors);

  if (upserted > 0 || rowsDedup.length > 0) {
    const { data: vinculados, error: errVinculo } = await supabase.rpc('financeiro_parcelas_vinculacao_pessoa');
    if (errVinculo) {
      console.warn('[Sync Supabase] Aviso ao rodar vinculação pessoa:', errVinculo.message);
    } else {
      console.log('[Sync Supabase] Vínculo pessoa (em lote):', vinculados ?? 0, 'linhas atualizadas.');
    }
  }

  return { upserted, errors };
}
 
/**
 * Normaliza nome de coluna do CSV para comparação (minúsculo, sem acento, trim).
 */
function normalizarColuna(h) {
  return String(h ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}
 
/**
 * Mapeia cabeçalho do relatório de pessoas/clientes (RelatorioPessoas) para índices.
 * Posições fixas: Coluna 1 = CI (índice 0), Coluna 4 = Nome (índice 3).
 * Demais colunas detectadas por nome normalizado.
 */
function buildPessoasColumnIndexes(headerRow) {
  const map = {
    etiquetas: ['etiquetas'],
    cpf_cnpj: ['cpf/cnpj', 'cpf_cnpj', 'cpf', 'cnpj', 'documento', 'doc'],
    nome_fantasia_apelido: ['nome fantasia', 'nome fantasia apelido', 'apelido', 'nome_fantasia_apelido'],
    tipo: ['tipo'],
    data_cadastro: ['data de cadastro', 'data cadastro', 'data_cadastro'],
    cidade: ['cidade'],
    uf: ['uf'],
    logradouro: ['logradouro'],
    nro: ['nro', 'numero', 'número'],
    complemento: ['complemento'],
    bairro: ['bairro'],
    cep: ['cep'],
    abreviacao: ['abreviação', 'abreviacao'],
    responsaveis: ['responsáveis', 'responsaveis'],
    telefone: ['telefone'],
    email: ['e-mail', 'email'],
    grupo_cliente: ['grupo cliente', 'grupo_cliente', 'grupo do cliente', 'grupo', 'grupo de clientes', 'grupo clientes', 'grupo economico', 'grupo empresarial'],
    categoria: ['categoria', 'categorias'],
    contato_1: ['contato 1', 'contato_1'],
    facebook: ['facebook'],
    instagram: ['instagram'],
    linkedin: ['linkedin'],
    site: ['site'],
  };
  const idx = { ci: 0, nome: 3 };
  for (const key of Object.keys(map)) idx[key] = -1;
  headerRow.forEach((h, i) => {
    const n = normalizarColuna(h);
    if (!n) return;
    for (const [key, aliases] of Object.entries(map)) {
      if (aliases.some((k) => n.includes(k) || k.includes(n))) idx[key] = i;
    }
  });
  return idx;
}

function getPessoasRow(row, idx) {
  const trim = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
  const nome = idx.nome >= 0 ? String(row[idx.nome] ?? '').trim() : '';
  if (!nome) return null;
  const dataCadastro = idx.data_cadastro >= 0 ? parseDateBR(row[idx.data_cadastro]) : null;
  return {
    ci: trim(row[idx.ci]),
    etiquetas: trim(row[idx.etiquetas]),
    cpf_cnpj: idx.cpf_cnpj >= 0 ? String(row[idx.cpf_cnpj] ?? '').trim().replace(/\s/g, '') || null : null,
    nome,
    nome_fantasia_apelido: trim(row[idx.nome_fantasia_apelido]),
    tipo: trim(row[idx.tipo]),
    data_cadastro: dataCadastro,
    cidade: trim(row[idx.cidade]),
    uf: trim(row[idx.uf]),
    logradouro: trim(row[idx.logradouro]),
    nro: trim(row[idx.nro]),
    complemento: trim(row[idx.complemento]),
    bairro: trim(row[idx.bairro]),
    cep: trim(row[idx.cep]),
    abreviacao: trim(row[idx.abreviacao]),
    responsaveis: trim(row[idx.responsaveis]),
    telefone: trim(row[idx.telefone]),
    email: trim(row[idx.email]),
    grupo_cliente: trim(row[idx.grupo_cliente]),
    categoria: trim(row[idx.categoria]),
    contato_1: trim(row[idx.contato_1]),
    facebook: trim(row[idx.facebook]),
    instagram: trim(row[idx.instagram]),
    linkedin: trim(row[idx.linkedin]),
    site: trim(row[idx.site]),
  };
}
 
/**
 * Lê CSV (separador ;) ou arquivo .csv e retorna { headerRow, dataRows }.
 * Usado pelo relatório de pessoas (mesmo formato que readRelatorioFinanceiroFile para CSV).
 */
function readPessoasCsvFile(filePathOrContent) {
  const isRawCsv =
    typeof filePathOrContent === 'string' &&
    (filePathOrContent.includes('\n') || filePathOrContent.includes('\r'));
  if (isRawCsv) {
    const raw = filePathOrContent;
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV do relatório de pessoas sem dados (cabeçalho + pelo menos uma linha).');
    const headerRow = lines[0].split(';').map((c) => c.trim().replace(/^"|"$/g, ''));
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
      dataRows.push(lines[i].split(';').map((c) => c.trim().replace(/^"|"$/g, '')));
    }
    return { headerRow, dataRows };
  }
  const filePath = filePathOrContent;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
    return readPessoasCsvFile(raw);
  }
  throw new Error('runSyncPessoas espera arquivo .csv ou string com conteúdo CSV.');
}
 
/**
 * Sincroniza o relatório de clientes/pessoas (CSV do VIOS) para a tabela pessoas.
 * Faz replace completo: apaga todos os registros e insere os do CSV.
 * @param {string} filePathOrCsvContent - Caminho do arquivo .csv OU string com o conteúdo CSV.
 * @returns {Promise<{ inserted: number, errors: number }>}
 */
export async function runSyncPessoas(filePathOrCsvContent) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env do vios-app.');
  }
 
  const sourceLabel =
    typeof filePathOrCsvContent === 'string' && (filePathOrCsvContent.includes('\n') || filePathOrCsvContent.includes('\r'))
      ? '(CSV em memória)'
      : filePathOrCsvContent;
  console.log('[Sync Supabase] Pessoas:', sourceLabel);
 
  let headerRow;
  let dataRows;
  try {
    const out = readPessoasCsvFile(filePathOrCsvContent);
    headerRow = out.headerRow;
    dataRows = out.dataRows;
    console.log('[Sync Supabase] CSV lido. Linhas (sem cabeçalho):', dataRows.length, '| Cabeçalho:', headerRow.slice(0, 8).join('; ') + (headerRow.length > 8 ? '...' : ''));
  } catch (err) {
    console.error('[Sync Supabase] Erro ao ler CSV:', err.message);
    throw new Error('Erro ao abrir/processar o relatório de pessoas: ' + err.message);
  }
 
  const idx = buildPessoasColumnIndexes(headerRow);
  if (idx.nome < 0) {
    console.error('[Sync Supabase] Cabeçalhos (normalizados):', headerRow.map((h, i) => `[${i}]${normalizarColuna(h)}`).join(' | '));
    throw new Error('Relatório de pessoas: coluna "Nome" (ou Cliente/Razão Social) não encontrada. Verifique o cabeçalho do CSV.');
  }
 
  const rows = [];
  for (const row of dataRows) {
    const obj = getPessoasRow(row, idx);
    if (obj) rows.push(obj);
  }

  // Uma linha por CI: evita "ON CONFLICT DO UPDATE cannot affect row a second time" no mesmo lote.
  const byKey = new Map();
  for (const r of rows) {
    const key = String(r.ci ?? '');
    byKey.set(key, r);
  }
  const rowsDedup = [...byKey.values()];
  if (rowsDedup.length < rows.length) {
    console.log('[Sync Supabase] Duplicatas removidas por CI:', rows.length, '->', rowsDedup.length);
  }

  console.log('[Sync Supabase] Linhas válidas para pessoas:', rowsDedup.length);
  const supabase = createClient(url, key);

  const UPSERT_KEY = 'ci';
  let upserted = 0;
  let errors = 0;
  const BATCH = 200;
  for (let i = 0; i < rowsDedup.length; i += BATCH) {
    const chunk = rowsDedup.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const { error } = await supabase.from('pessoas').upsert(chunk, { onConflict: UPSERT_KEY });
    if (error) {
      console.error('[Sync Supabase] pessoas upsert error (lote ' + batchNum + '):', error.message);
      errors++;
    } else {
      upserted += chunk.length;
      if (batchNum % 5 === 0 || i + BATCH >= rowsDedup.length) {
        console.log('[Sync Supabase] Progresso: ' + upserted + '/' + rowsDedup.length + ' linhas.');
      }
    }
  }

  console.log('[Sync Supabase] pessoas | Upserted:', upserted, '| Erros:', errors);
  return { upserted, errors };
}