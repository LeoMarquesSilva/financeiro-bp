/**
 * STANDALONE ESM — Copie este arquivo para DENTRO do vios-app no servidor
 * (ex.: vios-app/ProcessoCompleto/sync-vios-to-supabase.js).
 *
 * Use este se o vios-app for todo em JS com import/export (ESM).
 * Sincroniza TODOS os clientes do escritório (VIOS Processos Completo) para a
 * tabela clientes_escritorio no Supabase. Não usa clients_inadimplencia.
 *
 * Funções exportadas:
 *   runSync(filePath)                      — Processos Completo → clientes_escritorio + contagem_ci_por_grupo
 *   runSyncTimeSheets(filePath, options)   — TimeSheets → timesheets
 *   runSyncRelatorioFinanceiro(filePath)   — CSV/Excel Relatório Financeiro → relatorio_financeiro
 *
 * No vios-app:
 *   1. npm install dotenv xlsx @supabase/supabase-js
 *   2. .env com: VITE_SUPABASE_URL=... e VITE_SUPABASE_ANON_KEY=...
 *   3. No final da ProcessoCompleto:
 *      import { runSync } from './sync-vios-to-supabase.js';
 *      await runSync(caminhoDoArquivoXlsx);
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
  grupo_cliente: ['grupo do cliente'],
  razao_social: ['cliente', 'razão social', 'razao social', 'nome', 'empresa'],
  cnpj: ['cnpj', 'cnpj/cpf'],
  qtd_processos: ['processos', 'qtd processos', 'quantidade processos', 'nº processos', 'numero processos'],
  horas_total: ['horas', 'horas total', 'total horas', 'horas totais', 'carga horária', 'total de horas', 'carga horaria'],
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
 * Parse para horas já em decimal (ex.: 1.5, 318.55, 1,5).
 * Aceita ponto ou vírgula como decimal; não remove ponto como milhares (evita 318.55 → 31855).
 * Se vier Date (Excel exportou tempo como data), converte para horas decimais (h + m/60 + s/3600).
 */
function parseDecimalHours(val) {
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
 * Converte "Total de Horas" do TimeSheets para horas decimais.
 * Aceita: número (horas decimais), "HH:MM:SS", "HH:MM", ou serial Excel (fração de dia).
 */
function parseHorasTimeSheet(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return null;
    if (val >= 0 && val < 1) return val * 24;
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
  const horas_total = indexes.horas_total >= 0 ? parseNumber(row[indexes.horas_total]) : null;
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

/**
 * Sincroniza o Excel com o Supabase. Chame no final da automação ProcessoCompleto.
 * @param {string} filePath - Caminho absoluto do arquivo Processos Completo.xlsx
 * @returns {Promise<{ updated: number, inserted: number, skipped: number, errors: number }>}
 */
export async function runSync(filePath) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env do vios-app (ou na pasta deste script).');
  }

  console.log('[Sync Supabase] Relatório:', filePath);
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
  const indexes = buildColumnIndexes(headerRow);
  if (indexes.razao_social < 0) {
    throw new Error('Coluna de cliente/razão social não encontrada. Ajuste COLUMN_MAP no script.');
  }

  const supabase = createClient(url, key);
  const TABLE = 'clientes_escritorio';
  const TABLE_CONTAGEM = 'contagem_ci_por_grupo';
  /** Por (grupo|cliente): agregamos qtd_processos (contagem de linhas) e soma de horas_total (relatório tem 1 linha por processo/CI). */
  const agregadoPorCliente = new Map();
  const contagemPorGrupo = new Map();
  const valoresOutros = new Set();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record = rowToRecord(row, indexes);
    if (record) {
      const key = `${record.grupo_cliente ?? ''}|${record.razao_social}`;
      if (!agregadoPorCliente.has(key)) {
        agregadoPorCliente.set(key, {
          grupo_cliente: record.grupo_cliente,
          razao_social: record.razao_social,
          cnpj: record.cnpj,
          qtd_processos: 0,
          horas_total: 0,
          horas_por_ano: record.horas_por_ano,
        });
      }
      const agg = agregadoPorCliente.get(key);
      agg.qtd_processos += record.qtd_processos != null && record.qtd_processos > 0 ? Math.round(record.qtd_processos) : 1;
      agg.horas_total += record.horas_total != null && record.horas_total > 0 ? record.horas_total : 0;
    }
    if (indexes.grupo_cliente >= 0 && indexes.situacao_processo >= 0) {
      const grupo = String(row[indexes.grupo_cliente] ?? '').trim();
      if (!grupo) continue;
      const rawSituacao = row[indexes.situacao_processo];
      const situacao = normalizarSituacao(rawSituacao);
      if (!contagemPorGrupo.has(grupo)) {
        contagemPorGrupo.set(grupo, { arquivado: 0, arquivado_definitivamente: 0, arquivado_provisoriamente: 0, ativo: 0, encerrado: 0, ex_cliente: 0, suspenso: 0, outros: 0 });
      }
      const counts = contagemPorGrupo.get(grupo);
      if (situacao && counts[situacao] !== undefined) counts[situacao]++;
      else {
        counts.outros++;
        if (rawSituacao != null && String(rawSituacao).trim() !== '') valoresOutros.add(String(rawSituacao).trim());
      }
    }
  }
  if (valoresOutros.size > 0) {
    console.log('[Sync Supabase] Situações não mapeadas (contaram em "outros"):', [...valoresOutros].slice(0, 20).join(' | '));
  }
  const skipped = data.length - 1 - agregadoPorCliente.size;
  let inserted = 0, updated = 0, errors = 0;

  for (const record of agregadoPorCliente.values()) {
    const payload = {
      grupo_cliente: record.grupo_cliente ?? null,
      razao_social: record.razao_social,
      cnpj: record.cnpj || null,
      qtd_processos: record.qtd_processos,
      horas_total: record.horas_total,
    };
    if (record.horas_por_ano && Object.keys(record.horas_por_ano).length > 0) payload.horas_por_ano = record.horas_por_ano;
    let existing = null;
    if (record.cnpj) {
      const { data: byCnpj } = await supabase.from(TABLE).select('id').eq('cnpj', record.cnpj).limit(1).maybeSingle();
      existing = byCnpj;
    }
    if (!existing && record.razao_social) {
      const { data: byNome } = await supabase.from(TABLE).select('id').ilike('razao_social', record.razao_social).limit(1).maybeSingle();
      existing = byNome;
    }

    if (existing?.id) {
      const { error } = await supabase.from(TABLE).update(payload).eq('id', existing.id);
      if (error) { console.error('Erro ao atualizar', record.razao_social, error.message); errors++; }
      else updated++;
    } else {
      const { error } = await supabase.from(TABLE).insert(payload);
      if (error) { console.error('Erro ao inserir', record.razao_social, error.message); errors++; }
      else inserted++;
    }
  }

  if (contagemPorGrupo.size > 0) {
    let contagemUpserted = 0;
    for (const [grupo, counts] of contagemPorGrupo.entries()) {
      const total_geral = counts.arquivado + counts.arquivado_definitivamente + counts.arquivado_provisoriamente + counts.ativo + counts.encerrado + counts.ex_cliente + counts.suspenso + (counts.outros ?? 0);
      const payload = { grupo_cliente: grupo, ...counts, total_geral };
      const { data: existing } = await supabase.from(TABLE_CONTAGEM).select('id').eq('grupo_cliente', grupo).limit(1).maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from(TABLE_CONTAGEM).update(payload).eq('id', existing.id);
        if (!error) contagemUpserted++;
      } else {
        const { error } = await supabase.from(TABLE_CONTAGEM).insert(payload);
        if (!error) contagemUpserted++;
      }
    }
    console.log('[Sync Supabase] contagem_ci_por_grupo | Grupos atualizados:', contagemUpserted);
  }

  console.log('[Sync Supabase] clientes_escritorio | Atualizados:', updated, '| Inseridos:', inserted, '| Ignorados:', skipped, '| Erros:', errors);
  return { updated, inserted, skipped, errors };
}

// ========== TimeSheets (relatório de horas: Data, Grupo Cliente, Cliente, Total de Horas) ==========
const TIMESHEETS_COLUMNS = {
  data: ['data', 'date', 'data lançamento'],
  grupo_cliente: ['grupo cliente', 'grupo do cliente', 'grupo_cliente'],
  cliente: ['cliente', 'razão social', 'razao social'],
  total_horas: ['total de horas em decimal', 'total de horas', 'total horas', 'horas', 'total_horas', 'horas totais', 'em decimal'],
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

function buildTimeSheetsColumnIndexes(headerRow) {
  const normalized = normalizeTimeSheetsHeader(headerRow);
  return {
    data: findColumnIndex(normalized, TIMESHEETS_COLUMNS.data),
    grupo_cliente: findColumnIndex(normalized, TIMESHEETS_COLUMNS.grupo_cliente),
    cliente: findColumnIndex(normalized, TIMESHEETS_COLUMNS.cliente),
    total_horas: findTotalHorasColumnIndex(normalized, headerRow),
  };
}

/**
 * Sincroniza o relatório TimeSheets (Excel ou CSV) para a tabela timesheets no Supabase.
 * Colunas esperadas: Data, Grupo Cliente, Cliente, Total de Horas (decimal).
 * @param {string} filePath - Caminho absoluto do arquivo TimeSheets (.xlsx ou .csv).
 * @param {{ replaceDateRange?: boolean }} options - replaceDateRange: true (padrão) remove do Supabase as datas que existem no arquivo antes de inserir (evita duplicar ao re-rodar).
 * @returns {Promise<{ inserted: number, deleted: number, errors: number }>}
 */
export async function runSyncTimeSheets(filePath, options = {}) {
  const { replaceDateRange = true } = options;
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
  const datesInFile = new Set();
  const headerTotalHorasRaw = idx.total_horas >= 0 && headerRow[idx.total_horas] != null ? String(headerRow[idx.total_horas]).toLowerCase() : '';
  const isDecimalHorasColumn = headerTotalHorasRaw.includes('decimal');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dataISO = parseDateToISO(idx.data >= 0 ? row[idx.data] : null);
    const cliente = idx.cliente >= 0 ? String(row[idx.cliente] ?? '').trim() : '';
    const rawHoras = idx.total_horas >= 0 ? row[idx.total_horas] : null;
    const totalHoras = isDecimalHorasColumn ? parseDecimalHours(rawHoras) : parseHorasTimeSheet(rawHoras);
    if (!dataISO || !cliente || totalHoras == null || totalHoras < 0) continue;
    if (totalHoras > 10000) {
      console.warn('[Sync Supabase] TimeSheets: linha ignorada (total_horas absurdo):', totalHoras, '| data:', dataISO, '| cliente:', cliente);
      continue;
    }
    datesInFile.add(dataISO);
    rows.push({
      data: dataISO,
      grupo_cliente: idx.grupo_cliente >= 0 ? String(row[idx.grupo_cliente] ?? '').trim() || null : null,
      cliente,
      total_horas: Math.max(0, totalHoras),
    });
  }

  const supabase = createClient(url, key);
  let deleted = 0;
  if (replaceDateRange && rows.length > 0 && datesInFile.size > 0) {
    const dates = [...datesInFile];
    const { error } = await supabase.from('timesheets').delete().in('data', dates);
    if (error) console.warn('[Sync Supabase] TimeSheets: aviso ao remover período anterior:', error.message);
    else deleted = 1;
  }

  let inserted = 0, errors = 0;
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('timesheets').insert(chunk);
    if (error) {
      console.error('[Sync Supabase] TimeSheets insert error:', error.message);
      errors++;
    } else {
      inserted += chunk.length;
    }
  }

  console.log('[Sync Supabase] timesheets | Inseridos:', inserted, '| Período substituído:', !!deleted, '| Erros:', errors);
  return { inserted, deleted: deleted ? 1 : 0, errors };
}

// ========== Relatório Financeiro (CSV: CI Título, CI Parcela, Data Vencimento, Nro Título, Cliente, Descrição, Valor, Situação, Data Baixa) ==========
const RELATORIO_FINANCEIRO_COLUMNS = {
  ci_titulo: ['ci título', 'ci titulo', 'ci_titulo'],
  ci_parcela: ['ci parcela', 'ci_parcela'],
  data_vencimento: ['data vencimento', 'data_vencimento'],
  nro_titulo: ['nro título', 'nro titulo', 'nro_titulo', 'numero titulo'],
  cliente: ['cliente'],
  descricao: ['descrição', 'descricao'],
  valor: ['valor'],
  situacao: ['situação', 'situacao'],
  data_baixa: ['data baixa', 'data_baixa'],
};

/** Normaliza cabeçalho para match (lowercase, sem acentos). */
function normalizeFinanceiroHeader(cell) {
  return (cell != null ? String(cell).toLowerCase().trim().normalize('NFD').replace(/\u0300-\u036f/g, '') : '');
}

function buildFinanceiroColumnIndexes(headerRow) {
  const normalized = headerRow.map(normalizeFinanceiroHeader);
  const idx = {};
  for (const [key, aliases] of Object.entries(RELATORIO_FINANCEIRO_COLUMNS)) {
    idx[key] = normalized.findIndex((h) => aliases.some((a) => h.includes(a) || a.includes(h)));
  }
  return idx;
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
    const headerRow = lines[0].split(';').map((c) => c.trim());
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
      dataRows.push(lines[i].split(';').map((c) => c.trim()));
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
 * Sincroniza o relatório de faturamento (CSV ou Excel) para a tabela relatorio_financeiro.
 * Usa upsert por (ci_titulo, ci_parcela). Colunas: CI Título, CI Parcela, Data Vencimento, Nro Título, Cliente, Descrição, Valor, Situação, Data Baixa.
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
  } catch (err) {
    throw new Error('Erro ao abrir/processar o relatório financeiro: ' + err.message);
  }

  const idx = buildFinanceiroColumnIndexes(headerRow);
  if (idx.ci_titulo < 0 || idx.ci_parcela < 0 || idx.data_vencimento < 0 || idx.nro_titulo < 0 || idx.cliente < 0 || idx.valor < 0 || idx.situacao < 0) {
    throw new Error(
      'Relatório Financeiro: colunas obrigatórias não encontradas (CI Título, CI Parcela, Data Vencimento, Nro Título, Cliente, Valor, Situação). Verifique o cabeçalho.'
    );
  }

  const rows = [];
  for (const row of dataRows) {
    const ciTitulo = idx.ci_titulo >= 0 ? parseInt(String(row[idx.ci_titulo] ?? '').replace(/\D/g, ''), 10) : NaN;
    const ciParcela = idx.ci_parcela >= 0 ? parseInt(String(row[idx.ci_parcela] ?? '').replace(/\D/g, ''), 10) : NaN;
    const dataVencimento = parseDateBR(idx.data_vencimento >= 0 ? row[idx.data_vencimento] : null);
    const nroTitulo = idx.nro_titulo >= 0 ? String(row[idx.nro_titulo] ?? '').trim() : '';
    const cliente = idx.cliente >= 0 ? String(row[idx.cliente] ?? '').trim() : '';
    const valor = parseValorBR(idx.valor >= 0 ? row[idx.valor] : null);
    const situacao = idx.situacao >= 0 ? String(row[idx.situacao] ?? 'ABERTO').trim().toUpperCase() || 'ABERTO';

    if (Number.isNaN(ciTitulo) || Number.isNaN(ciParcela) || !dataVencimento || !nroTitulo || !cliente || valor == null) {
      continue;
    }

    const descricao = idx.descricao >= 0 ? String(row[idx.descricao] ?? '').trim() || null : null;
    const dataBaixa = parseDateBR(idx.data_baixa >= 0 ? row[idx.data_baixa] : null);

    rows.push({
      ci_titulo: ciTitulo,
      ci_parcela: ciParcela,
      data_vencimento: dataVencimento,
      nro_titulo: nroTitulo,
      cliente,
      descricao,
      valor: Math.round(valor * 100) / 100,
      situacao: situacao === 'PAGO' ? 'PAGO' : 'ABERTO',
      data_baixa: dataBaixa,
    });
  }

  const supabase = createClient(url, key);
  let upserted = 0;
  let errors = 0;
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('relatorio_financeiro')
      .upsert(chunk, { onConflict: 'ci_titulo,ci_parcela' });
    if (error) {
      console.error('[Sync Supabase] relatorio_financeiro upsert error:', error.message);
      errors++;
    } else {
      upserted += chunk.length;
    }
  }

  console.log('[Sync Supabase] relatorio_financeiro | Linhas processadas:', rows.length, '| Upserted:', upserted, '| Erros:', errors);
  return { upserted, errors };
}
