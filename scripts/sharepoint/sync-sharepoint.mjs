#!/usr/bin/env node
/**
 * Sync diário SharePoint -> Supabase para o painel Eficiência Operacional.
 *
 * Fontes (mesmas do BI "DASHBOARD - EFICIÊNCIA OPERACIONAL - GERAL"):
 *  - Listas SharePoint (site CONTROLADORIAJURDICA): protocolos, publicações,
 *    agendamento (solicitações), treinamentos
 *  - Arquivos em bibliotecas (site Controladoria): Tarefas.csv, Historico/*.csv,
 *    Turnover BP (1).xlsx, Feriados.xlsx, Decisoes Processuais.csv,
 *    Base de Gestão de PDI.xlsx (aba Elegíveis)
 *
 * Uso:
 *   node scripts/sharepoint/sync-sharepoint.mjs                 # todas as fontes
 *   node scripts/sharepoint/sync-sharepoint.mjs --only publicacoes,tarefas
 *   node scripts/sharepoint/sync-sharepoint.mjs --dump-fields publicacoes
 *     (imprime os nomes internos dos campos do primeiro item da lista — usar para
 *      ajustar os aliases de FIELD_ALIASES na primeira execução)
 *
 * Requer .env: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
 *              VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import {
  getSiteId,
  fetchListItems,
  fetchDriveFile,
  listDriveFolder,
  expandUserField,
} from './graphClient.mjs'
import {
  mapAreaDePara,
  computeExcludente,
  mapFatalHistorico,
  mapFatalTarefas,
  metaD1PorData,
  computeVistadoD1,
  computeEficienciaSlaProtocolo,
  computeEficienciaPublicacao,
  computeAdesaoSem18,
  computeConclusaoCompleta,
  computeAdesaoApos18,
  areaNaConclusao,
  turnoverRowDedupeKey,
  resolveNomeCanonico,
  parseNumeroProcessoLista,
  toIsoDate,
  toIsoDateBrt,
  toIsoDateTime,
  parseDateOnlyBrt,
} from './transforms.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local'), override: true })

const HOSTNAME = 'bpplaw2.sharepoint.com'
const SITE_JURIDICA = '/sites/CONTROLADORIAJURDICA'
/**
 * Protocolos: recorte local após o fetch (2025+).
 * Publicações: janela rolante de 4 meses. $filter/$orderby do Graph nessa lista
 * estouram o limiar (>5k) ou voltam 400; a paginação lê a lista e só acumula a janela.
 */
const DATA_CORTE_LISTAS_GRANDES = new Date('2025-01-01T00:00:00Z')
/** Publicações: só os últimos N meses — o restante já está no SIOE e não muda. */
const PUBLICACOES_MESES_JANELA = 4

function dataCorteMesesAtras(meses) {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - meses)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Menor sp_id já gravado na janela (com 7 dias de folga) — usado para pular o histórico no Graph. */
async function resolvePublicacoesSkipAfterId(corte) {
  const folga = new Date(corte.getTime() - 7 * 86_400_000)
  const { data, error } = await supabase
    .from('sp_publicacoes')
    .select('sp_id')
    .gte('criado', folga.toISOString())
    .order('sp_id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`ler min sp_id publicações: ${error.message}`)
  const minId = Number(data?.sp_id)
  if (!Number.isFinite(minId)) return null
  return Math.max(0, minId - 1)
}
const SITE_CONTROLADORIA = '/sites/Controladoria'
const BASES_DIR = 'Núcleo de Cadastro/Bases Atualizacoes'
/** Planilha de Gestão de PDI (aba Elegíveis) — path relativo à biblioteca Documentos Compartilhados. */
const PDI_XLSX_PATH =
  'Gestão/DASHBOARDS/FECHAMENTO - LEGAL OPS/Apresentações e Indicadores/Indicadores/Base de Gestão de PDI.xlsx'

const MES_NOME_PARA_NUM = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

const LISTA_PROTOCOLOS = '4e115aab-39c5-4aab-8d5a-e905f4efd65d'
/**
 * Campos Pessoa (PROTOCOLADOPOR, CHECKADOPOR) exigem $select explícito no Graph —
 * expand genérico só traz *LookupId (protocolado_por ficava sempre null).
 */
const PROTOCOLOS_FIELD_SELECT = [
  'id',
  'Created',
  'PROTOCOLADOPOR',
  'CHECKADOPOR',
  'PROTOCOLADOEM',
  'DATADOFATAL',
  'TIPODEPROTOCOLO',
  'TIPO_x0020_DA_x0020_PE_x00c7_A',
  'SISTEMA',
  'STATUS',
  'INST_x00c2_NCIA',
  'PROTOCOLONOSAUTOS',
  'CLIENTE',
  'PARTECONTR_x00c1_RIA',
  'EFICI_x00ca_NCIA_x0020_OPERACION',
  'EFICI_x00ca_NCIA_x0020_OPERACION0',
  'INCONSIST_x00ca_NCIA_x002d_CONTR',
  'INCONSIST_x00ca_NCIA_x002d_CONTR0',
  'INCONSIST_x00ca_NCIA_x002d_JUR_x',
  'INCONSIST_x00ca_NCIA_x002d_JUR_x0',
  'URGENTE_x003f_',
].join(',')
const LISTA_PUBLICACOES = '91e8ba11-8248-4a20-9fd9-b66466144ad1'
/** Campos Pessoa (VISTADOPOR, AGENDADOPOR) exigem $select explícito no Graph — expand genérico não traz o nome. */
const PUBLICACOES_FIELD_SELECT = [
  'ID',
  'Created',
  'DISPONIBILIZADOPARAVISTAGEM',
  'VISTADO_x0020_EM',
  'VISTADOPOR',
  'AGENDADOPOR',
  'field_8',
  'field_9',
  'field_3',
  'field_2',
  'field_6',
  'field_5',
  'field_14',
  'field_15',
  'field_22',
  'field_17',
  'field_18',
  'field_19',
  'TIPODOAGENDAMENTO',
  'PRIORIDADEDEAGENDAMENTO',
  // PUBLICAÇÃO - ESOCIAL (nome interno truncado no SharePoint)
  'PUBLICA_x00c7__x00c3_O_x002d_ESO',
  'STATUSDAPUBLICA_x00c7__x00c3_O',
  'DATARECEBIMENTOKURIER',
  'INCONSIST_x00ca_NCIAS_x002d_TIPO',
  'INCONSIST_x00ca_NCIA_x002d_SUBTI',
  // CHECK (displayName) — nome interno opaco confirmado via Graph /columns
  'field_13',
].join(',')
/**
 * Lista "SOLICITAÇÃO DE AGENDAMENTOS E REAGENDAMENTOS" (BI: tabela Agendamento).
 * Flip cards TAREFAS — Qtd_Agendamentos_Atual / QtdAgendaTotal.
 */
const LISTA_AGENDAMENTO = 'd586975b-1c50-49ed-84e3-2cbe94c1e974'
/** AGENDADOPOR_x003a_ (AGENDADO POR:) exige $select — expand genérico só traz LookupId. */
const AGENDAMENTO_FIELD_SELECT = [
  'id',
  'Created',
  'DATAATUAL',
  'AGENDADOPOR_x003a_',
  'Tipo_x0020_de_x0020_Agendamento_',
  'Tipo_x0020_do_x0020_Agendamento',
  'Ades_x00e3_o_x0020_ao_x0020_Indi',
  'INCONSIST_x00ca_NCIA_x002d_JUR_x',
  'REVIS_x00c3_O_x0020__x002d__x002',
  'Status',
  '_x00c1_REA_x0020__x002f__x0020_E',
].join(',')
const LISTA_TREINAMENTOS = '30ea2880-475e-489c-8600-ae541d29faf3'
/**
 * Lista mestre de sessões de treinamento (não confundir com LISTA_TREINAMENTOS, que é a
 * lista de PRESENÇA). "Nome do Treinamento" na lista de presença é um lookup para cá — os
 * campos "Data" e "Duração" de cada presença são projeções desse lookup, não colunas próprias.
 */
const LISTA_TREINAMENTOS_SESSOES = '45c9ae19-4fa5-46ca-8c2c-5a52dae09a89'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const BATCH = 500

/**
 * Aliases de nomes de campo por fonte: o Graph devolve os nomes INTERNOS das colunas
 * do SharePoint, que podem diferir do nome de exibição (espaços somem, acentos/pontuação
 * viram sequências _xHHHH_ com o código hex do caractere, ex.: "Ç" -> "_x00c7_").
 * O helper pick() decodifica essas sequências antes de normalizar e comparar.
 * Ajustar aliases após rodar --dump-fields <fonte> se algum campo continuar batendo errado
 * (nomes internos truncados/divergentes do nome de exibição não são recuperáveis por aqui).
 */
function decodeSharePointInternalName(name) {
  return name.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function pick(fields, aliases) {
  for (const a of aliases) {
    if (fields[a] !== undefined && fields[a] !== null && fields[a] !== '') return fields[a]
  }
  const norm = (s) => decodeSharePointInternalName(s).toLowerCase().replace(/[^a-z0-9]/g, '')
  const keys = Object.keys(fields)
  for (const a of aliases) {
    const target = norm(a)
    const hit = keys.find((k) => norm(k) === target)
    if (hit && fields[hit] !== null && fields[hit] !== '') return fields[hit]
  }
  return null
}

async function upsertChunks(table, rows, onConflict) {
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict })
    if (error) throw new Error(`upsert ${table} (lote ${i / BATCH + 1}): ${error.message}`)
    upserted += chunk.length
  }
  return upserted
}

/**
 * Apaga no espelho chaves que sumiram da origem (upsert sozinho deixa órfão).
 * Se keepIds vier vazio, não apaga nada (proteção contra fetch falho).
 * `scope` limita a varredura (ex.: publicações — só a janela ainda presente na lista rotativa).
 */
async function deleteMissingIds(table, pkColumn, keepIds, scope = null) {
  const keep = new Set(
    keepIds.filter((id) => id != null && id !== '').map((id) => String(id)),
  )
  if (keep.size === 0) return 0

  const existing = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(pkColumn).range(from, from + pageSize - 1)
    if (scope?.column && scope.gte) q = q.gte(scope.column, scope.gte)
    const { data, error } = await q
    if (error) throw new Error(`ler ${table} para limpar órfãos: ${error.message}`)
    if (!data?.length) break
    for (const r of data) existing.push(r[pkColumn])
    if (data.length < pageSize) break
  }

  const orphans = existing.filter((id) => id != null && id !== '' && !keep.has(String(id)))
  let deleted = 0
  for (let i = 0; i < orphans.length; i += BATCH) {
    const chunk = orphans.slice(i, i + BATCH)
    const { error: delError, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(pkColumn, chunk)
    if (delError) throw new Error(`delete órfãos ${table}: ${delError.message}`)
    deleted += count ?? chunk.length
  }
  return deleted
}

async function replaceAll(table, rows, pkColumn) {
  const { count, error: countError } = await supabase
    .from(table)
    .select(pkColumn, { count: 'exact', head: true })
  if (countError) throw new Error(`contar ${table}: ${countError.message}`)
  const { error: delError } = await supabase.from(table).delete().not(pkColumn, 'is', null)
  if (delError) throw new Error(`delete ${table}: ${delError.message}`)
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw new Error(`insert ${table} (lote ${i / BATCH + 1}): ${error.message}`)
    inserted += chunk.length
  }
  return { upserted: inserted, deleted: count ?? 0 }
}

async function loadFeriadosSet() {
  const { data, error } = await supabase.from('sp_feriados').select('data')
  if (error) throw new Error(`ler sp_feriados: ${error.message}`)
  return new Set((data ?? []).map((r) => r.data))
}

async function loadTurnover() {
  const { data, error } = await supabase.from('sp_turnover').select('nome, area, admissao, desligamento')
  if (error) throw new Error(`ler sp_turnover: ${error.message}`)
  return data ?? []
}

/**
 * Carrega o mapa Tarefa -> Etiqueta de BASE-TIPODEPRAZO.xlsx (aba "Planilha1" — a primeira
 * aba do arquivo, "TIPO TAREFA", é só rascunho/lixo e não é a fonte usada no BI). Cabeçalho:
 * "Tarefa" / "Etiquetas do Processo/Atendimento". Usado para materializar "Etiqueta da
 * Tarefa" na tabela Nova/sp_tarefas_historico (LOOKUPVALUE no BI original).
 */
async function loadTipoDePrazoMap(siteControladoria) {
  const buffer = await fetchDriveFile(siteControladoria, `${BASES_DIR}/BASE-TIPODEPRAZO.xlsx`)
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets['Planilha1'], { header: 1, defval: null })
  const mapa = new Map()
  for (const [tarefa, etiqueta] of linhas.slice(1)) {
    if (tarefa) mapa.set(String(tarefa).trim().toUpperCase(), etiqueta ? String(etiqueta).trim() : null)
  }
  return mapa
}

/**
 * Mapa CI do processo → número limpo (sem prefixo CNJ:/Outros:), a partir de sp_processos_numero.
 * Usado para preencher nro_cnj vazio em tarefas (processos administrativos).
 */
async function loadProcessosNumeroMap() {
  const mapa = new Map()
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('sp_processos_numero')
      .select('ci, numero')
      .range(from, from + page - 1)
    if (error) throw new Error(`ler sp_processos_numero: ${error.message}`)
    const rows = data ?? []
    for (const r of rows) {
      if (r.ci != null && r.numero) mapa.set(Number(r.ci), String(r.numero))
    }
    if (rows.length < page) break
    from += page
  }
  return mapa
}

function coalesceNroCnj(nroCnjCsv, ciProcesso, numeroMap) {
  const cnj = strOrNull(nroCnjCsv)
  if (cnj) return cnj
  if (ciProcesso == null) return null
  return numeroMap.get(Number(ciProcesso)) ?? null
}

/**
 * TRIM obrigatório em Excel/CSV: remove espaços no início/fim de chaves e valores
 * textuais (evita "GERENTE ", "Nome ", etc.). String vazia → null.
 */
function trimSpreadsheetRows(rows) {
  return (rows ?? []).map((row) => {
    const out = {}
    for (const [key, value] of Object.entries(row ?? {})) {
      const k = typeof key === 'string' ? key.trim() : key
      let v = value
      if (typeof v === 'string') {
        v = v.trim()
        if (v === '') v = null
      }
      if (out[k] == null || out[k] === '') out[k] = v
    }
    return out
  })
}

function parseCsvBuffer(buffer, { delimiter = ';', codepage = 1252 } = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer', codepage, FS: delimiter, raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return trimSpreadsheetRows(XLSX.utils.sheet_to_json(sheet, { defval: null }))
}

/** Diff Excel 1904 vs 1900 (em ms). Workbooks Mac/BR com date1904=true chegam ~4 anos atrasados no SheetJS. */
const EXCEL_1904_OFFSET_MS = 1462 * 24 * 60 * 60 * 1000

function parseXlsxBuffer(buffer, sheetName = null) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets[sheetName ?? wb.SheetNames[0]]
  if (!sheet) {
    throw new Error(
      `Aba "${sheetName}" não encontrada. Abas: ${(wb.SheetNames ?? []).join(', ')}`,
    )
  }
  const date1904 = Boolean(wb.Workbook?.WBProps?.date1904)
  let rows = trimSpreadsheetRows(
    XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true }),
  )
  if (!date1904) return rows
  return rows.map((row) => {
    const out = { ...row }
    for (const [key, value] of Object.entries(out)) {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        out[key] = new Date(value.getTime() + EXCEL_1904_OFFSET_MS)
      }
    }
    return out
  })
}

/** Normaliza área com quebras de linha da planilha ("Contratos e \\r\\nSocietário"). */
function normalizeAreaLabel(v) {
  const s = strOrNull(v)
  if (!s) return null
  return s.replace(/\s+/g, ' ')
}

/** Alinha rótulos da planilha PDI às áreas do filtro Eficiência (AREAS_EFICIENCIA). */
function normalizePdiArea(v) {
  const s = normalizeAreaLabel(v)
  if (!s) return null
  if (/^contratos/i.test(s)) return 'Contratos'
  return s
}

/**
 * Aba "Elegíveis" tem cabeçalho em 2 linhas:
 *   R0: meses (Junho…Dezembro) a cada 3 colunas
 *   R1: Área | Colaborador | Estrutura | Progresso | Evidências | 1:1 | …
 * Dados a partir da R2. Normaliza para 1 linha por colaborador × mês.
 */
function parsePdiElegiveisBuffer(buffer, ano) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets['Elegíveis']
  if (!sheet) {
    throw new Error(
      `Aba "Elegíveis" não encontrada. Abas: ${(wb.SheetNames ?? []).join(', ')}`,
    )
  }
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  if (!matrix || matrix.length < 3) return []

  const headerMeses = matrix[0] ?? []
  const blocos = []
  for (let c = 0; c < headerMeses.length; c++) {
    const nomeMes = strOrNull(headerMeses[c])
    if (!nomeMes) continue
    const chave = nomeMes
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    const mes = MES_NOME_PARA_NUM[chave] ?? MES_NOME_PARA_NUM[nomeMes.toLowerCase()]
    if (!mes) continue
    blocos.push({ mes, colProgresso: c, colEvidencias: c + 1, colOneAOne: c + 2 })
  }
  if (blocos.length === 0) {
    throw new Error('Aba Elegíveis: nenhum mês reconhecido no cabeçalho (linha 1).')
  }

  const rows = []
  for (let r = 2; r < matrix.length; r++) {
    const line = matrix[r] ?? []
    const colaborador = strOrNull(line[1])
    if (!colaborador) continue
    const area = normalizePdiArea(line[0])
    const estrutura = strOrNull(line[2])
    for (const b of blocos) {
      const progresso = numOrNull(line[b.colProgresso])
      const evidencias_execucao = strOrNull(line[b.colEvidencias])
      const one_a_one = numOrNull(line[b.colOneAOne])
      if (progresso == null && evidencias_execucao == null && one_a_one == null) continue
      rows.push({
        ano,
        mes: b.mes,
        area,
        colaborador,
        estrutura,
        progresso,
        evidencias_execucao,
        one_a_one,
      })
    }
  }
  return rows
}

const MES_ABREV_PARA_NUM = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
}

/** "Jul-26", "Jul/2026", Date Excel → { ano, mes }. */
function parsePeriodoAnalisadoPdi(v, anoFallback) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { ano: v.getFullYear(), mes: v.getMonth() + 1 }
  }
  const s = strOrNull(v)
  if (!s) return null
  const m = s.match(/^([A-Za-zÀ-ÿ]+)\s*[-/\s]\s*(\d{2,4})$/i)
  if (!m) return null
  const nome = m[1]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const mes =
    MES_NOME_PARA_NUM[nome] ??
    MES_ABREV_PARA_NUM[nome.slice(0, 3)] ??
    null
  if (!mes) return null
  let ano = Number(m[2])
  if (!Number.isFinite(ano)) return null
  if (ano < 100) ano += 2000
  return { ano: ano || anoFallback, mes }
}

/**
 * Abas "Desvio …" / "Análise Desvios":
 * Período | Área | Colaborador | Estrutura | Progresso (ant) | Progresso | Evidências | 1:1 | Desvio Critério de Puração
 */
function parsePdiDesviosBuffer(buffer, anoFallback) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetNames = (wb.SheetNames ?? []).filter(
    (n) => /desvio/i.test(n) || /an[aá]lise\s*desvios/i.test(n),
  )
  if (sheetNames.length === 0) {
    console.log('[gestao_pdi] nenhuma aba Desvio* / Análise Desvios encontrada')
    return []
  }

  const rows = []
  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
    if (!matrix || matrix.length < 2) continue
    console.log(`[gestao_pdi] lendo aba "${sheetName}" (${matrix.length - 1} linhas)`)

    for (let r = 1; r < matrix.length; r++) {
      const line = matrix[r] ?? []
      const periodo = parsePeriodoAnalisadoPdi(line[0], anoFallback)
      const colaborador = strOrNull(line[2])
      if (!periodo || !colaborador) continue
      const criterio = strOrNull(line[8])
      rows.push({
        ano: periodo.ano,
        mes: periodo.mes,
        area: normalizePdiArea(line[1]),
        colaborador,
        estrutura: strOrNull(line[3]),
        progresso_anterior: numOrNull(line[4]),
        progresso: numOrNull(line[5]),
        evidencias_execucao: strOrNull(line[6]),
        one_a_one: numOrNull(line[7]),
        desvio_criterio_apuracao: criterio ? criterio.replace(/\r\n/g, '\n') : null,
      })
    }
  }
  return rows
}

function parseDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  const s = String(v).trim()
  // dd/MM/yyyy [HH:mm[:ss]]
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (br) {
    return new Date(+br[3], +br[2] - 1, +br[1], +(br[4] ?? 0), +(br[5] ?? 0), +(br[6] ?? 0))
  }
  // M/D/yy ou M/D/yyyy (formato de exibição do Turnover BP)
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (us) {
    let year = +us[3]
    if (year < 100) year += year >= 70 ? 1900 : 2000
    return new Date(year, +us[1] - 1, +us[2])
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// ============================================================
// Fontes
// ============================================================

const FONTES = {
  feriados: {
    tabela: 'sp_feriados',
    async run(ctx) {
      const buffer = await fetchDriveFile(ctx.siteControladoria, `${BASES_DIR}/Feriados.xlsx`)
      const raw = parseXlsxBuffer(buffer)
      const rows = raw
        .map((r) => ({
          data: toIsoDate(parseDate(r['Data Início'] ?? r['Data'])),
          data_fim: toIsoDate(parseDate(r['Data Fim'])),
          nome: r['Nome'] ?? null,
          descricao: r['Descrição'] ?? null,
          posterga_prazos: r['Posterga prazos?'] != null ? String(r['Posterga prazos?']) : null,
        }))
        .filter((r) => r.data)
      return await replaceAll('sp_feriados', dedupeBy(rows, (r) => r.data), 'data')
    },
  },

  gestao_pdi: {
    tabela: 'sp_gestao_pdi_elegiveis',
    async run(ctx) {
      const anoRef = new Date().getFullYear()
      const buffer = await fetchDriveFile(ctx.siteControladoria, PDI_XLSX_PATH)
      console.log(`[gestao_pdi] lendo ${PDI_XLSX_PATH} (ano=${anoRef})`)
      const elegiveis = parsePdiElegiveisBuffer(buffer, anoRef)
      const desvios = parsePdiDesviosBuffer(buffer, anoRef)
      const elegiveisSync = await replaceAll(
        'sp_gestao_pdi_elegiveis',
        dedupeBy(elegiveis, (r) => `${r.ano}|${r.mes}|${r.colaborador}`),
        'id',
      )
      let desviosSync = { upserted: 0, deleted: 0 }
      try {
        desviosSync = await replaceAll(
          'sp_gestao_pdi_desvios',
          dedupeBy(desvios, (r) => `${r.ano}|${r.mes}|${r.colaborador}`),
          'id',
        )
      } catch (e) {
        console.error(
          `[gestao_pdi] sp_gestao_pdi_desvios falhou (aplique a migração): ${e.message}`,
        )
        throw e
      }
      console.log(
        `[gestao_pdi] elegíveis=${elegiveisSync.upserted} desvios=${desviosSync.upserted}`,
      )
      return {
        upserted: elegiveisSync.upserted + desviosSync.upserted,
        deleted: elegiveisSync.deleted + desviosSync.deleted,
      }
    },
  },

  turnover: {
    tabela: 'sp_turnover',
    async run(ctx) {
      // Preferir pasta do ano corrente; fallback 2025 (arquivo histórico do BI).
      const anoRef = new Date().getFullYear()
      const candidatos = [
        `Gestão/Indicadores Juridico/${anoRef}/Turnover BP (1).xlsx`,
        `Gestão/Indicadores Juridico/${anoRef}/Turnover BP.xlsx`,
        'Gestão/Indicadores Juridico/2025/Turnover BP (1).xlsx',
      ]
      let buffer = null
      let usado = null
      let lastErr = null
      for (const path of candidatos) {
        try {
          buffer = await fetchDriveFile(ctx.siteControladoria, path)
          usado = path
          break
        } catch (e) {
          lastErr = e
        }
      }
      if (!buffer) {
        throw new Error(
          `Turnover não encontrado em ${candidatos.join(' | ')}. Último erro: ${lastErr?.message ?? lastErr}`,
        )
      }
      console.log(`[turnover] lendo ${usado}`)
      // 'TurnOver' era o nome de uma Tabela do Excel (Power Query), não da aba — a aba real
      // no arquivo de origem se chama 'Admissão - Demissão'.
      const raw = parseXlsxBuffer(buffer, 'Admissão - Demissão')
      const rows = raw
        .map((r) => ({
          // Cabeçalhos/valores já vêm com TRIM do parseXlsxBuffer.
          nome: strOrNull(r['Nome']),
          area: strOrNull(r['Área']),
          nucleo: strOrNull(r['Núcleo']),
          cargo: strOrNull(r['Cargo']),
          admissao: toIsoDate(parseDate(r['Admissão'])),
          desligamento: toIsoDate(parseDate(r['Desligamento'])),
          tipo_desligamento: strOrNull(r['Tipo do desligamento']),
          obs: strOrNull(r['OBS']),
        }))
        .filter((r) => r.nome)
      return await replaceAll(
        'sp_turnover',
        dedupeBy(rows, turnoverRowDedupeKey),
        'id',
      )
    },
  },

  agendamento: {
    tabela: 'sp_agendamento',
    async run(ctx) {
      const items = await fetchListItems(
        ctx.siteJuridica,
        LISTA_AGENDAMENTO,
        null,
        AGENDAMENTO_FIELD_SELECT,
      )
      if (ctx.dumpFields) return dumpFields(items)
      const rows = items
        .filter((f) => {
          const solicitado = parseDate(pick(f, ['DATAATUAL', 'SOLICITADO EM', 'DATA ATUAL']))
          const criado = parseDate(pick(f, ['Criado', 'Created']))
          const ref = solicitado ?? criado
          return ref && ref >= DATA_CORTE_LISTAS_GRANDES
        })
        .map((f) => {
          const solicitado = parseDate(pick(f, ['DATAATUAL', 'SOLICITADO EM', 'DATA ATUAL']))
          return {
            sp_id: Number(pick(f, ['ID', 'id'])),
            solicitado_em: toIsoDateBrt(solicitado),
            criado: toIsoDateTime(parseDate(pick(f, ['Criado', 'Created']))),
            agendado_por: expandUserField(
              pick(f, ['AGENDADO POR:', 'AGENDADOPOR_x003a_', 'AGENDADOPOR:']),
            ),
            tipo_abertura_encerramento: strOrNull(
              pick(f, [
                'Tipo de Agendamento - Abertura/Encerramento',
                'Tipo_x0020_de_x0020_Agendamento_',
              ]),
            ),
            tipo_agendamento: strOrNull(
              pick(f, ['Tipo do Agendamento', 'Tipo_x0020_do_x0020_Agendamento']),
            ),
            adesao_indicador: strOrNull(
              pick(f, ['Adesão ao Indicador', 'Ades_x00e3_o_x0020_ao_x0020_Indi']),
            ),
            inconsistencia_juridico: strOrNull(
              pick(f, [
                'INCONSISTÊNCIA - JURÍDICO',
                'INCONSIST_x00ca_NCIA_x002d_JUR_x',
              ]),
            ),
            revisao_observacao: strOrNull(
              pick(f, [
                'REVISÃO - OBSERVAÇÃO',
                'REVIS_x00c3_O_x0020__x002d__x002',
              ]),
            ),
            status: strOrNull(pick(f, ['Status'])),
            area_equipe: strOrNull(
              pick(f, ['ÁREA / EQUIPE', 'ÁREA', '_x00c1_REA_x0020__x002f__x0020_E']),
            ),
          }
        })
        .map((r) => ({
          ...r,
          // BI Agendamento[DePara]:
          // IF (TRIM(Adesão)="" || Adesão="SEM ADESÃO", "OK", "Inconsistência")
          de_para: (() => {
            const adesao = (r.adesao_indicador ?? '').trim()
            if (!adesao || adesao.toLocaleUpperCase('pt-BR') === 'SEM ADESÃO') {
              return 'Eficiência'
            }
            return 'Inconsistência'
          })(),
        }))
        .filter((r) => Number.isFinite(r.sp_id))
      const unique = dedupeBy(rows, (r) => r.sp_id)
      const upserted = await upsertChunks('sp_agendamento', unique, 'sp_id')
      const keepIds = items
        .map((f) => Number(pick(f, ['ID', 'id'])))
        .filter((id) => Number.isFinite(id))
      const deleted = await deleteMissingIds('sp_agendamento', 'sp_id', keepIds)
      return { upserted, deleted }
    },
  },

  publicacoes: {
    tabela: 'sp_publicacoes',
    async run(ctx) {
      const corte = dataCorteMesesAtras(PUBLICACOES_MESES_JANELA)
      const skipAfterId = await resolvePublicacoesSkipAfterId(corte)
      console.log(
        `[publicacoes] janela ${PUBLICACOES_MESES_JANELA} meses (>= ${corte.toISOString().slice(0, 10)})${skipAfterId != null ? `; skip após ID ${skipAfterId}` : ''}`,
      )
      const items = await fetchListItems(
        ctx.siteJuridica,
        LISTA_PUBLICACOES,
        null,
        PUBLICACOES_FIELD_SELECT,
        { createdSince: corte, skipAfterId },
      )
      if (ctx.dumpFields) return dumpFields(items)
      const feriados = await loadFeriadosSet()
      const janela = items.filter((f) => {
        const criado = parseDate(pick(f, ['Criado', 'Created']))
        return criado && criado >= corte
      })
      console.log(
        `[publicacoes] janela ${PUBLICACOES_MESES_JANELA} meses (>= ${corte.toISOString().slice(0, 10)}): ${janela.length} itens`,
      )
      const rows = janela
        .map((f) => {
          const disponibilizado = parseDate(
            pick(f, ['DISPONIBILIZADO PARA VISTAGEM', 'DISPONIBILIZADOPARAVISTAGEM'])
          )
          const vistadoEm = parseDate(
            pick(f, ['VISTADO EM', 'VISTADOEM', 'VISTADO_x0020_EM']),
          )
          // Nesta lista, várias colunas têm nome interno opaco (field_N) sem relação com o
          // nome de exibição — confirmado via schema real de colunas (Graph /lists/{id}/columns),
          // não recuperável por decodificação/normalização. Aliases exatos abaixo.
          const escritorio = pick(f, ['Escritório responsável', 'Escritorioresponsavel', 'field_9'])
          const inconsistenciasTipo =
            pick(f, [
              'INCONSISTÊNCIAS - TIPO',
              'INCONSISTENCIASTIPO',
              'INCONSIST_x00ca_NCIAS_x002d_TIPO',
            ]) ?? ''
          const inconsistenciaSubtipo =
            pick(f, [
              'INCONSISTÊNCIA - SUBTIPO',
              'INCONSISTENCIASUBTIPO',
              'INCONSIST_x00ca_NCIA_x002d_SUBTI',
            ]) ?? ''
          const dataRecebimentoKurier = parseDate(
            pick(f, ['DATA RECEBIMENTO KURIER', 'DATARECEBIMENTOKURIER']),
          )
          return {
            sp_id: Number(pick(f, ['ID', 'id'])),
            criado: toIsoDateTime(parseDate(pick(f, ['Criado', 'Created']))),
            data_publicacao: toIsoDate(parseDate(pick(f, ['DATA DE PUBLICAÇÃO', 'DATADEPUBLICACAO', 'field_3']))),
            data_divulgacao: toIsoDate(parseDate(pick(f, ['DATA DE DIVULGAÇÃO', 'DATADEDIVULGACAO', 'field_2']))),
            data_recebimento_kurier: toIsoDateBrt(dataRecebimentoKurier),
            numero_processo: pick(f, ['NÚMERO DO PROCESSO', 'NUMERODOPROCESSO', 'field_6']),
            pasta: pick(f, ['Pasta', 'field_5']),
            cliente_principal: pick(f, ['Cliente principal', 'Clienteprincipal', 'field_14']),
            grupo: pick(f, ['Grupo', 'field_15']),
            responsavel_principal: expandUserField(pick(f, ['Responsável principal', 'Responsavelprincipal', 'field_8'])),
            escritorio_responsavel: escritorio,
            area: mapAreaDePara(escritorio),
            tipo_agendamento: pick(f, ['TIPO DO AGENDAMENTO', 'TIPODOAGENDAMENTO']),
            prioridade_agendamento: pick(f, ['PRIORIDADE DE AGENDAMENTO', 'PRIORIDADEDEAGENDAMENTO']),
            publicacao_esocial: strOrNull(
              pick(f, [
                'PUBLICAÇÃO - ESOCIAL',
                'PUBLICACAOESOCIAL',
                'PUBLICA_x00c7__x00c3_O_x002d_ESO',
              ]),
            ),
            agendado_por: expandUserField(pick(f, ['AGENDADO POR', 'AGENDADOPOR'])),
            vistado_por: expandUserField(pick(f, ['VISTADO POR', 'VISTADOPOR'])),
            area_vistador: null, // derivada no BI; painel usa area (De-Para)
            disponibilizado_vistagem: toIsoDateTime(disponibilizado),
            vistado_em: toIsoDateTime(vistadoEm),
            vistado_d1: computeVistadoD1(disponibilizado, vistadoEm, feriados),
            demanda_risco: pick(f, ['Demanda de Risco', 'DemandadeRisco', 'field_22']),
            status_publicacao: pick(f, [
              'STATUS DA PUBLICAÇÃO',
              'STATUSDAPUBLICACAO',
              'STATUSDAPUBLICA_x00c7__x00c3_O',
            ]),
            natureza: pick(f, ['Natureza', 'field_17']),
            status: pick(f, ['Status', 'field_18']),
            acao: pick(f, ['Ação', 'Acao', 'field_19']),
            inconsistencias_tipo: String(inconsistenciasTipo).trim() || null,
            inconsistencia_subtipo: String(inconsistenciaSubtipo).trim() || null,
            check_pub: strOrNull(pick(f, ['CHECK', 'field_13'])),
            // Coluna calculada do BI (não existe no SharePoint)
            eficiencia: computeEficienciaPublicacao(inconsistenciasTipo, inconsistenciaSubtipo),
          }
        })
        .filter((r) => Number.isFinite(r.sp_id))
      const unique = dedupeBy(rows, (r) => r.sp_id)
      const upserted = await upsertChunks('sp_publicacoes', unique, 'sp_id')
      // Histórico antigo permanece no SIOE. Só apaga órfão na janela dos últimos N meses.
      const keepIds = janela
        .map((f) => Number(pick(f, ['ID', 'id'])))
        .filter((id) => Number.isFinite(id))
      const deleted = await deleteMissingIds('sp_publicacoes', 'sp_id', keepIds, {
        column: 'criado',
        gte: corte.toISOString(),
      })
      return { upserted, deleted }
    },
  },

  protocolos: {
    tabela: 'sp_protocolos',
    async run(ctx) {
      const items = await fetchListItems(
        ctx.siteJuridica,
        LISTA_PROTOCOLOS,
        null,
        PROTOCOLOS_FIELD_SELECT,
      )
      if (ctx.dumpFields) return dumpFields(items)
      const turnover = await loadTurnover()
      const rows = items
        .filter((f) => {
          const criado = parseDate(pick(f, ['Criado', 'Created']))
          return criado && criado >= DATA_CORTE_LISTAS_GRANDES
        })
        .map((f) => {
          // Campo Pessoa "Criado por" só traz LookupId via Graph; usa o createdBy do item
          // (já resolvido pelo Graph, ver fetchListItems) como equivalente ao Author do SharePoint.
          const criadoPor = f._CreatedByDisplayName ?? expandUserField(pick(f, ['Criado por', 'Author', 'Criadopor']))
          const criado = parseDate(pick(f, ['Criado', 'Created']))
          // Nomes internos truncados pelo SharePoint no meio de um escape _xHHHH_ (limite de
          // tamanho do nome estático) — não recuperáveis por decodificação, usa o nome exato
          // confirmado via schema real de colunas (Graph /lists/{id}/columns).
          const inconsistencia =
            pick(f, ['INCONSISTÊNCIA - JURÍDICO', 'INCONSISTENCIAJURIDICO', 'INCONSIST_x00ca_NCIA_x002d_JUR_x']) ?? ''
          // Graph /columns:
          //   INCONSISTÊNCIA - CONTROLADORIA        → INCONSIST_x00ca_NCIA_x002d_CONTR
          //   INCONSISTÊNCIA - CONTROLADORIA - MOTIVO → INCONSIST_x00ca_NCIA_x002d_CONTR0
          // KPI / card usam só CONTROLADORIA (não o motivo — motivo pode vir preenchido sozinho).
          const inconsistenciaControladoria =
            pick(f, [
              'INCONSISTÊNCIA - CONTROLADORIA',
              'INCONSISTENCIACONTROLADORIA',
              'INCONSIST_x00ca_NCIA_x002d_CONTR',
            ]) ?? ''
          const inconsistenciaControladoriaMotivo =
            pick(f, [
              'INCONSISTÊNCIA - CONTROLADORIA - MOTIVO',
              'INCONSISTENCIACONTROLADORIAMOTIVO',
              'INCONSIST_x00ca_NCIA_x002d_CONTR0',
            ]) ?? ''
          const protocoladoEm = parseDate(pick(f, ['PROTOCOLADO EM', 'PROTOCOLADOEM']))
          const dataDoFatal = parseDate(
            pick(f, ['DATA DO FATAL', 'DATADOFATAL', 'DATA_DO_FATAL', 'Data do Fatal']),
          )
          // Coluna EFICIÊNCIA do BI Ops Legais (Power Query) — não é o campo SharePoint "EFICIÊNCIA OPERACIONAL".
          const eficienciaSla = computeEficienciaSlaProtocolo(criado, dataDoFatal, protocoladoEm)
          return {
            sp_id: Number(pick(f, ['ID', 'id'])),
            criado: toIsoDateTime(criado),
            // Dia civil em BRT — toIsoDate (UTC) deslocava PROTOCOLADO EM após ~21h BRT (ex.: 31/03 23:17 → 01/04).
            data_criada: toIsoDateBrt(criado),
            criado_por: criadoPor,
            nome_limpo: normalizeNome(criadoPor),
            // Área_no_Protocolo_Final no BI é uma coluna calculada (lookup em BASE-TURNOVER por
            // nome+vigência) — mesma lógica de areaNaConclusao usada em tarefas/tarefas_historico.
            area: pick(f, ['Área_no_Protocolo_Final', 'AREA', 'Área']) ?? areaNaConclusao(criadoPor, criado, turnover),
            protocolado_em: toIsoDateBrt(protocoladoEm),
            data_do_fatal: toIsoDateTime(dataDoFatal),
            eficiencia_sla: eficienciaSla,
            protocolado_por: expandUserField(
              pick(f, ['PROTOCOLADO POR', 'PROTOCOLADOPOR']),
            ),
            tipo_protocolo: pick(f, ['TIPO DE PROTOCOLO', 'TIPODEPROTOCOLO']),
            tipo_peca: pick(f, ['TIPO DA PEÇA', 'TIPODAPECA']),
            sistema: pick(f, ['SISTEMA']),
            status: pick(f, ['STATUS']),
            instancia: pick(f, ['INSTÂNCIA', 'INSTANCIA']),
            protocolo_nos_autos: pick(f, ['PROTOCOLO NOS AUTOS', 'PROTOCOLONOSAUTOS']),
            cliente: pick(f, ['CLIENTE']),
            parte_contraria: pick(f, ['PARTE CONTRÁRIA', 'PARTECONTRARIA']),
            eficiencia_protocolo: pick(f, ['EFICIÊNCIA PROTOCOLO', 'EFICIENCIAPROTOCOLO']),
            eficiencia_operacional: pick(f, [
              'EFICIÊNCIA OPERACIONAL',
              'EFICIENCIAOPERACIONAL',
              'EFICI_x00ca_NCIA_x0020_OPERACION',
            ]),
            eficiencia_justificativa: pick(f, [
              'EFICIÊNCIA OPERACIONAL - JUSTIFICATIVA',
              'EFICIENCIAOPERACIONALJUSTIFICATIVA',
              'EFICI_x00ca_NCIA_x0020_OPERACION0',
            ]),
            inconsistencia_juridico: inconsistencia || null,
            inconsistencia_juridico_motivo: pick(f, [
              'INCONSISTÊNCIA - JURÍDICO - MOTIVO',
              'INCONSISTENCIAJURIDICOMOTIVO',
              'INCONSIST_x00ca_NCIA_x002d_JUR_x0',
            ]),
            inconsistencia_controladoria: inconsistenciaControladoria || null,
            inconsistencia_controladoria_motivo: inconsistenciaControladoriaMotivo || null,
            status_inconsistencia: inconsistencia.trim() === '' ? 'EFICIÊNCIA' : 'INCONSISTÊNCIA',
            urgente: pick(f, ['URGENTE?', 'URGENTE']),
          }
        })
        .filter((r) => Number.isFinite(r.sp_id))
      const unique = dedupeBy(rows, (r) => r.sp_id)
      const upserted = await upsertChunks('sp_protocolos', unique, 'sp_id')
      const keepIds = items
        .map((f) => Number(pick(f, ['ID', 'id'])))
        .filter((id) => Number.isFinite(id))
      const deleted = await deleteMissingIds('sp_protocolos', 'sp_id', keepIds)
      return { upserted, deleted }
    },
  },

  treinamentos: {
    tabela: 'sp_treinamentos_presenca',
    async run(ctx) {
      const items = await fetchListItems(
        ctx.siteJuridica,
        LISTA_TREINAMENTOS,
        null,
        'Colaborador,ColaboradorLookupId,Status,NomedoTreinamento0LookupId,Nome_x0020_do_x0020_Treinamento_0LookupId,StatusColaborador,id,Modified,Created',
      )
      if (ctx.dumpFields) return dumpFields(items)

      // "Data" e "Duração" da presença não são colunas próprias — são projeções do lookup
      // "Nome do Treinamento" (NomedoTreinamento0LookupId) para a lista mestre de sessões.
      // Graph só devolve o LookupId nessa lista, não o valor projetado; resolve via join.
      const sessoes = await fetchListItems(ctx.siteJuridica, LISTA_TREINAMENTOS_SESSOES)
      const sessaoPorId = new Map(sessoes.map((s) => [String(pick(s, ['ID', 'id'])), s]))

      const sessoesRows = sessoes
        .map((s) => {
          const spId = Number(pick(s, ['ID', 'id']))
          const data = toIsoDate(parseDate(pick(s, ['Data'])))
          const nome = strOrNull(pick(s, ['NomedoTreinamento', 'Title']))
          if (!Number.isFinite(spId) || !data || !nome) return null
          return {
            sp_id: spId,
            nome,
            data,
            duracao_minutos: numOrNull(
              pick(s, ['Duração (Minutos)', 'Dura_x00e7__x00e3_o_x0028_Minuto']),
            ),
            ministrado_por: resolveNomeCanonico(
              expandUserField(
                pick(s, [
                  'Facilitador',
                  'Ministrado por',
                  'Ministradopor',
                  'MinistradoPor',
                  'Ministrado_x0020_por',
                  'Responsável',
                  'Responsavel',
                ]),
              ),
            ),
          }
        })
        .filter(Boolean)
      const sessoesUnique = dedupeBy(sessoesRows, (r) => r.sp_id)
      const sessoesUpserted = await upsertChunks(
        'sp_treinamentos_sessoes',
        sessoesUnique,
        'sp_id',
      )
      const sessoesDeleted = await deleteMissingIds(
        'sp_treinamentos_sessoes',
        'sp_id',
        sessoesUnique.map((r) => r.sp_id),
      )

      const rows = items
        .map((f) => {
          const sessaoId = String(pick(f, ['NomedoTreinamento0LookupId', 'Nome_x0020_do_x0020_Treinamento_0LookupId']) ?? '')
          const sessao = sessaoPorId.get(sessaoId)
          return {
            sp_id: Number(pick(f, ['ID', 'id'])),
            colaborador: resolveNomeCanonico(
              expandUserField(pick(f, ['Colaborador'])),
            ),
            treinamento: sessao ? strOrNull(pick(sessao, ['NomedoTreinamento'])) : null,
            treinamento_id: sessaoId ? Number(sessaoId) : null,
            status: pick(f, ['Status']),
            tipo_treinamento: pick(f, ['Tipo do Treinamento', 'TipodoTreinamento']),
            status_colaborador: pick(f, ['Status Colaborador', 'StatusColaborador']),
            data: sessao ? toIsoDate(parseDate(pick(sessao, ['Data']))) : null,
            duracao_minutos: sessao
              ? numOrNull(pick(sessao, ['Duração (Minutos)', 'Dura_x00e7__x00e3_o_x0028_Minuto']))
              : null,
            ministrado_por: sessao
              ? resolveNomeCanonico(
                  expandUserField(
                    pick(sessao, [
                      'Facilitador',
                      'Ministrado por',
                      'Ministradopor',
                      'MinistradoPor',
                      'Ministrado_x0020_por',
                      'Responsável',
                      'Responsavel',
                    ]),
                  ),
                )
              : null,
            criado: toIsoDateTime(parseDate(pick(f, ['Criado', 'Created']))),
          }
        })
        .filter((r) => Number.isFinite(r.sp_id))
      const unique = dedupeBy(rows, (r) => r.sp_id)
      const upserted = await upsertChunks('sp_treinamentos_presenca', unique, 'sp_id')
      const deleted = await deleteMissingIds(
        'sp_treinamentos_presenca',
        'sp_id',
        unique.map((r) => r.sp_id),
      )
      return { upserted, deleted, sessoesUpserted, sessoesDeleted }
    },
  },

  /**
   * Processos Lista.csv — coluna Número (CNJ:/Outros:/…). Alimenta sp_processos_numero e
   * faz backfill de nro_cnj vazio em sp_tarefas* (processos administrativos).
   */
  processos_numero: {
    tabela: 'sp_processos_numero',
    async run(ctx) {
      const buffer = await fetchDriveFile(ctx.siteControladoria, `${BASES_DIR}/Processos Lista.csv`)
      const raw = parseCsvBuffer(buffer)
      const rows = raw
        .map((r) => {
          const ci = numOrNull(r['CI'])
          const parsed = parseNumeroProcessoLista(r['Número'] ?? r['Numero'])
          if (ci == null || !parsed) return null
          return {
            ci,
            numero: parsed.numero,
            numero_tipo: parsed.tipo,
            numero_raw: parsed.raw,
            updated_at: new Date().toISOString(),
          }
        })
        .filter(Boolean)
      const unique = dedupeBy(rows, (r) => r.ci)
      const upserted = await upsertChunks('sp_processos_numero', unique, 'ci')
      const deleted = await deleteMissingIds(
        'sp_processos_numero',
        'ci',
        unique.map((r) => r.ci),
      )
      const { data: backfill, error } = await supabase.rpc('eficiencia_backfill_nro_cnj_de_processo')
      if (error) throw new Error(`backfill nro_cnj: ${error.message}`)
      console.log(
        `[Sync SharePoint] processos_numero backfill nro_cnj: ${JSON.stringify(backfill)}`,
      )
      return { upserted, deleted }
    },
  },

  tarefas: {
    tabela: 'sp_tarefas',
    async run(ctx) {
      const buffer = await fetchDriveFile(ctx.siteControladoria, `${BASES_DIR}/Tarefas.csv`)
      const raw = parseCsvBuffer(buffer)
      const turnover = await loadTurnover()
      const feriados = await loadFeriadosSet()
      const numeroMap = await loadProcessosNumeroMap()
      const rows = raw
        .filter((r) => r['Status'] === 'Concluída')
        .map((r) => {
          const dataConclusao = parseDateOnlyBrt(r['Data da Conclusão'])
          const dataPrazo = parseDateOnlyBrt(r['Data para conclusão'])
          const conclusaoCompleta = computeConclusaoCompleta(dataConclusao, r['Hora da Conclusão'])
          const adesaoSem18 = computeAdesaoSem18(r['Status'], dataPrazo, dataConclusao, feriados)
          const adesaoApos18 = computeAdesaoApos18(r['Status'], dataPrazo, conclusaoCompleta)
          const ciProcesso = numOrNull(r['CI do Processo'])
          return {
            ci: numOrNull(r['CI']),
            ci_processo: ciProcesso,
            nro_cnj: coalesceNroCnj(r['Nro CNJ'], ciProcesso, numeroMap),
            area_processo: strOrNull(r['Área do Processo']),
            grupo_cliente: strOrNull(r['Grupo Cliente']),
            cliente: strOrNull(r['Cliente']),
            tarefa: strOrNull(r['Tarefa']),
            tarefa_pai: strOrNull(r['Tarefa Pai']),
            etiquetas_tarefa: strOrNull(r['Etiquetas da Tarefa']),
            status: strOrNull(r['Status']),
            usuario_conclusao: strOrNull(r['Usuário que concluiu a tarefa']),
            data_conclusao: toIsoDateBrt(dataConclusao),
            data_para_conclusao: toIsoDateBrt(dataPrazo),
            data_limite: toIsoDate(parseDate(r['Data limite'])),
            justificativa_fatal: strOrNull(r['Justificativa de Fatal']),
            adesao_sem18: adesaoSem18,
            fatal_sem18_d1: mapFatalTarefas(adesaoSem18),
            adesao_apos18: adesaoApos18,
            fatal_apos18: mapFatalHistorico(adesaoApos18),
            area_conclusao: areaNaConclusao(r['Usuário que concluiu a tarefa'], dataConclusao, turnover),
          }
        })
        .filter((r) => r.ci != null)
      // Acumulativo: o CSV é recorte do VIOS, não o universo. Exclusão na origem
      // não se propaga — apagar órfão aqui apagaria o histórico do painel.
      const upserted = await upsertChunks('sp_tarefas', dedupeBy(rows, (r) => r.ci), 'ci')
      return { upserted, deleted: 0 }
    },
  },

  tarefas_historico: {
    tabela: 'sp_tarefas_historico',
    async run(ctx) {
      const arquivos = await listDriveFolder(ctx.siteControladoria, `${BASES_DIR}/Historico`)
      const csvs = arquivos.filter((a) => a.name.toLowerCase().endsWith('.csv'))
      const turnover = await loadTurnover()
      const tipoDePrazo = await loadTipoDePrazoMap(ctx.siteControladoria)
      const numeroMap = await loadProcessosNumeroMap()
      let upserted = 0
      for (const arq of csvs) {
        const buffer = await fetchDriveFile(ctx.siteControladoria, arq.path)
        const raw = parseCsvBuffer(buffer)
        const rows = raw
          .map((r) => {
            // "Conclusão Completa", "Adesão Apos 18" e "Etiqueta da Tarefa" não existem crus no
            // CSV (mesma estrutura do Tarefas.csv) — são colunas calculadas no BI, replicadas aqui.
            const dataConclusao = parseDateOnlyBrt(r['Data da Conclusão'])
            const dataPrazo = parseDateOnlyBrt(r['Data para conclusão'])
            const conclusaoCompleta = computeConclusaoCompleta(dataConclusao, r['Hora da Conclusão'])
            const adesaoApos18 = computeAdesaoApos18(r['Status'], dataPrazo, conclusaoCompleta)
            const tarefaNome = (r['Tarefa'] ?? '').trim().toUpperCase()
            const ciProcesso = numOrNull(r['CI do Processo'])
            return {
              ci: numOrNull(r['CI']),
              ci_processo: ciProcesso,
              nro_cnj: coalesceNroCnj(r['Nro CNJ'], ciProcesso, numeroMap),
              grupo_cliente: strOrNull(r['Grupo Cliente']),
              cliente: strOrNull(r['Cliente']),
              tarefa: strOrNull(r['Tarefa']),
              tarefa_pai: strOrNull(r['Tarefa Pai']),
              etiqueta_tarefa: tipoDePrazo.get(tarefaNome) ?? 'Etiqueta não encontrada',
              status: strOrNull(r['Status']),
              usuario_conclusao: strOrNull(r['Usuário que concluiu a tarefa']),
              conclusao_completa: toIsoDateTime(conclusaoCompleta),
              data_conclusao: toIsoDateBrt(conclusaoCompleta),
              data_para_conclusao: toIsoDateBrt(dataPrazo),
              justificativa_fatal: strOrNull(r['Justificativa de Fatal']),
              excludente: computeExcludente(r['Justificativa de Fatal']),
              adesao_apos18: adesaoApos18,
              fatal_apos18: mapFatalHistorico(adesaoApos18),
              adesao_sem18: null,
              fatal_sem18: null,
              area_conclusao: areaNaConclusao(r['Usuário que concluiu a tarefa'], conclusaoCompleta, turnover),
              nucleo: null,
              meta_d1: metaD1PorData(conclusaoCompleta),
            }
          })
          .filter((r) => r.ci != null)
        upserted += await upsertChunks('sp_tarefas_historico', dedupeBy(rows, (r) => r.ci), 'ci')
      }
      return { upserted, deleted: 0 }
    },
  },

  decisoes: {
    tabela: 'sp_decisoes_processuais',
    async run(ctx) {
      const buffer = await fetchDriveFile(ctx.siteControladoria, `${BASES_DIR}/Decisoes Processuais.csv`)
      const raw = parseCsvBuffer(buffer)
      const ADVOGADOS_EXCLUIDOS = new Set([
        'Giovani Pina de Freitas',
        'Laura Puente Ferreira Gomes',
        'Maria Caroline da Cunha Thomé',
        'Midian Barbosa da Silva',
      ])
      const rows = raw
        .filter((r) => strOrNull(r['Processo']) && !ADVOGADOS_EXCLUIDOS.has((r['Advogado'] ?? '').trim()))
        .map((r) => ({
          processo: strOrNull(r['Processo']),
          pasta: strOrNull(r['Pasta']),
          cliente: strOrNull(r['Cliente']),
          grupo_cliente: strOrNull(r['Grupo Cliente']),
          advogado: strOrNull(r['Advogado']),
          autor: strOrNull(r['Autor']),
          reu: strOrNull(r['Réu']),
          jurisdicao: strOrNull(r['Jurisdição']),
          tipo_decisao: strOrNull(r['Tipo de Decisão']),
          data_decisao: toIsoDate(parseDate(r['Data da decisão'])),
          procedimento: strOrNull(r['Procedimento']),
          parte: strOrNull(r['Parte']),
          valor_acao: numOrNull(r['Valor da ação'] ?? r['Valor da Ação']),
          valor_condenacao: numOrNull(r['Valor da condenação']),
          valor_preparo: numOrNull(r['Valor do preparo']),
          valor_desembolso: numOrNull(r['Valor desembolso']),
          dispositivo: strOrNull(r['Dispositivo da sentença']),
          observacao: strOrNull(r['Observação']),
        }))
      // Dedupe por processo mantendo a decisão mais recente (mesma regra do Power Query)
      rows.sort((a, b) => (a.data_decisao ?? '').localeCompare(b.data_decisao ?? ''))
      return await replaceAll(
        'sp_decisoes_processuais',
        dedupeBy(rows, (r) => r.processo),
        'processo',
      )
    },
  },
}

// A ordem importa: feriados e turnover primeiro (são insumo das flags das demais fontes).
const ORDEM = [
  'feriados',
  'turnover',
  'gestao_pdi',
  // usuarios_area (Usuários x Área.xlsx) removido: tabela legada do BI, não usada por RPC/KPI do SIOE.
  'publicacoes',
  'agendamento',
  'protocolos',
  'treinamentos',
  'processos_numero', // antes das tarefas: mapa Número → nro_cnj (admin)
  'tarefas',
  'tarefas_historico',
  'decisoes',
]

function dedupeBy(rows, keyFn) {
  const map = new Map()
  for (const r of rows) map.set(keyFn(r), r)
  return [...map.values()]
}

/**
 * Alguns exports CSV do VIOS forçam colunas numéricas (ex.: CI) como texto no formato
 * Excel `="785679"`, para não perder zeros à esquerda. Remove esse invólucro antes de processar.
 */
function unwrapExcelText(v) {
  if (typeof v !== 'string') return v
  const m = v.match(/^="(.*)"$/)
  return m ? m[1] : v
}

function strOrNull(v) {
  if (v == null) return null
  const s = String(unwrapExcelText(v)).trim()
  return s === '' ? null : s
}

function numOrNull(v) {
  if (v == null || v === '') return null
  const unwrapped = unwrapExcelText(v)
  const n = Number(String(unwrapped).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : Number.isFinite(Number(unwrapped)) ? Number(unwrapped) : null
}

function normalizeNome(nome) {
  if (!nome) return null
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function dumpFields(items) {
  console.log('[dump-fields] campos do primeiro item:')
  console.log(Object.keys(items[0] ?? {}).join('\n'))
  return { upserted: 0, deleted: 0 }
}

async function main() {
  const args = process.argv.slice(2)
  const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
  const dumpArg = args.includes('--dump-fields') ? args[args.indexOf('--dump-fields') + 1] : null
  const fontes = dumpArg ? [dumpArg] : onlyArg ? onlyArg.split(',') : ORDEM

  console.log('[Sync SharePoint] resolvendo sites...')
  const ctx = {
    siteJuridica: await getSiteId(HOSTNAME, SITE_JURIDICA),
    siteControladoria: await getSiteId(HOSTNAME, SITE_CONTROLADORIA),
    dumpFields: Boolean(dumpArg),
  }

  let hadError = false
  for (const nome of fontes) {
    const fonte = FONTES[nome]
    if (!fonte) {
      console.error(`Fonte desconhecida: ${nome}. Disponíveis: ${ORDEM.join(', ')}`)
      process.exitCode = 1
      continue
    }
    const inicio = Date.now()
    try {
      const { upserted, deleted } = await fonte.run(ctx)
      const segundos = ((Date.now() - inicio) / 1000).toFixed(1)
      console.log(`[Sync SharePoint] ${nome} -> ${fonte.tabela} | upserted=${upserted} deleted=${deleted} (${segundos}s)`)
      if (!ctx.dumpFields) {
        await supabase.from('sharepoint_sync_log').insert({
          fonte: nome,
          upserted,
          deleted,
          errors: 0,
        })
      }
    } catch (err) {
      hadError = true
      console.error(`[Sync SharePoint] ${nome} FALHOU: ${err.message}`)
      await supabase.from('sharepoint_sync_log').insert({
        fonte: nome,
        upserted: 0,
        deleted: 0,
        errors: 1,
        detalhes: { erro: String(err.message).slice(0, 1000) },
      })
    }
  }

  if (!ctx.dumpFields) {
    const { error } = await supabase.rpc('registrar_sioe_sync', {
      p_fonte: 'sharepoint',
    })
    if (error) {
      hadError = true
      console.error(`[Sync SharePoint] heartbeat do SIOE FALHOU: ${error.message}`)
    }
  }

  if (hadError) process.exitCode = 1
}

main()
