import type ExcelJS from 'exceljs'
import { formatDate, formatDateTime } from '@/shared/utils/format'
import { stripJsonArrayDecorators } from '@/features/eficiencia/utils/textFormat'
import {
  BLOCO_LABELS,
  type LevantamentoBloco,
  type LevantamentoColuna,
  type LevantamentoFiltros,
  type LevantamentoResumo,
  type LevantamentoRacional,
  type LevantamentoTipoVinculoQtd,
  escritorioLevantamentoService,
} from '../services/escritorioLevantamentoService'
import {
  formatHorasTimesheetLinhaHHMM,
  minutosTimesheetLinha,
  parseHorasDecimaisValor,
} from './timesheetHorasExcel'

type ExcelCell = string | number | Date | null

type TipoColuna =
  | 'texto'
  | 'id'
  | 'data'
  | 'dataHora'
  | 'inteiro'
  | 'decimal'
  | 'duracao'
  | 'percentual'

type ColunaExcel = { header: string; tipo: TipoColuna }

const HEADER_FILL = 'FF1E293B'
const TITLE_FILL = 'FF1E293B'
const MUTED = 'FF64748B'
const TABLE_THEME = 'TableStyleMedium1'

const NUM_FMT: Partial<Record<TipoColuna, string>> = {
  id: '0',
  data: 'dd/mm/yyyy',
  dataHora: 'dd/mm/yyyy hh:mm',
  inteiro: '#,##0',
  decimal: '#,##0.00',
  duracao: '[h]:mm',
  percentual: '0.00%',
}

/** Colunas do racional (escritorio_levantamento_racional_v2) que não são texto. */
const TIPO_POR_CHAVE: Record<string, TipoColuna> = {
  sp_id: 'id',
  ci: 'id',
  data: 'data',
  data_publicacao: 'data',
  data_cadastro: 'data',
  data_encerramento: 'data',
  data_conclusao: 'data',
  data_limite: 'data',
  solicitado_em: 'data',
  criado: 'dataHora',
  disponibilizado_vistagem: 'dataHora',
}

function safeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  const raw = String(value)
  if (raw.includes('[') || raw.includes('"')) {
    return stripJsonArrayDecorators(raw)
  }
  return raw
}

/** `yyyy-mm-dd` → Date em UTC (o Excel grava a data sem deslocar fuso). */
function isoDateToExcel(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

const SAO_PAULO_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** timestamptz → horário de Brasília como Date "ingênua" em UTC para o Excel. */
function timestampToExcel(value: string): Date | null {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const parts = Object.fromEntries(
    SAO_PAULO_PARTS.formatToParts(d).map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    ),
  )
}

function toExcelValue(value: unknown, tipo: TipoColuna): ExcelCell {
  if (value == null || value === '') return null
  switch (tipo) {
    case 'data':
      return isoDateToExcel(String(value)) ?? cellToString(value)
    case 'dataHora':
      return timestampToExcel(String(value)) ?? cellToString(value)
    case 'id':
    case 'inteiro': {
      const raw = String(value).trim()
      return /^\d+$/.test(raw) ? Number(raw) : cellToString(value)
    }
    case 'decimal':
    case 'duracao':
    case 'percentual': {
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }
    default:
      return cellToString(value) || null
  }
}

function tabelaFromRacional(racional: LevantamentoRacional): {
  colunas: ColunaExcel[]
  linhas: ExcelCell[][]
  totais: Partial<Record<number, 'sum'>>
} {
  const colunas: ColunaExcel[] = []
  const totais: Partial<Record<number, 'sum'>> = {}
  const extratores: Array<(row: Record<string, unknown>) => ExcelCell> = []

  for (const col of racional.colunas) {
    if (racional.bloco === 'timesheet' && col.key === 'total_horas_decimal') {
      totais[colunas.length] = 'sum'
      colunas.push({ header: 'Horas (HH:MM)', tipo: 'duracao' })
      extratores.push(
        (row) => minutosTimesheetLinha(parseHorasDecimaisValor(row[col.key])) / 1440,
      )
      colunas.push({ header: 'Horas (decimal)', tipo: 'decimal' })
      extratores.push((row) => toExcelValue(row[col.key], 'decimal'))
      continue
    }
    const tipo = TIPO_POR_CHAVE[col.key] ?? 'texto'
    colunas.push({ header: col.label, tipo })
    extratores.push((row) => toExcelValue(row[col.key], tipo))
  }

  return {
    colunas,
    linhas: racional.linhas.map((row) => extratores.map((fn) => fn(row))),
    totais,
  }
}

function uniqueHeaders(colunas: ColunaExcel[]): string[] {
  const seen = new Map<string, number>()
  return colunas.map((c) => {
    const base = c.header.trim() || 'Coluna'
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

function tableName(prefix: string, used: Set<string>): string {
  const base = `tb_${safeFilenamePart(prefix).toLowerCase() || 'dados'}`
  let name = base
  let i = 2
  while (used.has(name)) name = `${base}_${i++}`
  used.add(name)
  return name
}

function larguraColuna(header: string, tipo: TipoColuna, linhas: ExcelCell[][], idx: number): number {
  if (tipo === 'data') return Math.max(12, header.length + 4)
  if (tipo === 'dataHora') return Math.max(17, header.length + 4)
  let max = header.length + 4
  for (let i = 0; i < Math.min(linhas.length, 500); i++) {
    const v = linhas[i]![idx]
    if (v == null) continue
    const len = v instanceof Date ? 10 : String(v).length + 2
    if (len > max) max = len
  }
  return Math.min(Math.max(max, 10), 60)
}

/** Tabela do Excel (filtro + listras) com cabeçalho slate e tipos por coluna. */
function addTabela(
  ws: ExcelJS.Worksheet,
  opts: {
    nome: string
    usedNames: Set<string>
    startRow: number
    colunas: ColunaExcel[]
    linhas: ExcelCell[][]
    totais?: Partial<Record<number, 'sum'>>
    setWidths?: boolean
  },
): number {
  const { colunas, startRow } = opts
  const headers = uniqueHeaders(colunas)
  const vazio = opts.linhas.length === 0
  const linhas: ExcelCell[][] = vazio
    ? [colunas.map((_, i) => (i === 0 ? 'Sem registros para os filtros' : null))]
    : opts.linhas
  const totais = vazio ? {} : (opts.totais ?? {})
  const temTotal = Object.keys(totais).length > 0

  ws.addTable({
    name: tableName(opts.nome, opts.usedNames),
    ref: `A${startRow}`,
    headerRow: true,
    totalsRow: temTotal,
    style: { theme: TABLE_THEME, showRowStripes: true },
    columns: headers.map((name, i) => ({
      name,
      filterButton: true,
      ...(temTotal && i === 0 && !totais[0] ? { totalsRowLabel: 'TOTAL' } : {}),
      ...(totais[i] ? { totalsRowFunction: totais[i] } : {}),
    })),
    rows: linhas,
  })

  const header = ws.getRow(startRow)
  header.height = 22
  headers.forEach((_, i) => {
    const cell = header.getCell(i + 1)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  const lastRow = startRow + linhas.length + (temTotal ? 1 : 0)
  colunas.forEach((col, i) => {
    const fmt = NUM_FMT[col.tipo]
    const align: ExcelJS.Alignment['horizontal'] =
      col.tipo === 'texto' ? 'left' : col.tipo === 'data' || col.tipo === 'dataHora' ? 'center' : 'right'
    for (let r = startRow + 1; r <= lastRow; r++) {
      const cell = ws.getCell(r, i + 1)
      if (fmt) cell.numFmt = fmt
      cell.alignment = { vertical: 'middle', horizontal: align }
    }
    if (opts.setWidths !== false) {
      ws.getColumn(i + 1).width = larguraColuna(headers[i]!, col.tipo, opts.linhas, i)
    }
  })
  if (temTotal) ws.getRow(lastRow).font = { bold: true }

  return lastRow
}

function addAbaRacional(
  wb: ExcelJS.Workbook,
  sheetName: string,
  racional: LevantamentoRacional,
  usedNames: Set<string>,
): void {
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })
  const { colunas, linhas, totais } = tabelaFromRacional(racional)
  addTabela(ws, { nome: sheetName, usedNames, startRow: 1, colunas, linhas, totais })
}

function tituloSecao(ws: ExcelJS.Worksheet, row: number, texto: string): void {
  const cell = ws.getCell(row, 1)
  cell.value = texto
  cell.font = { bold: true, size: 12, color: { argb: HEADER_FILL } }
}

function linhasQuebraTipo<T extends LevantamentoTipoVinculoQtd & { qtd: number }>(
  rows: T[],
  label: (row: T) => string,
): ExcelCell[][] {
  return rows.map((r) => [label(r), r.qtd, r.principal, r.recurso, r.incidente, r.nao_classificado])
}

const COLUNAS_QUEBRA_TIPO = (primeira: string): ColunaExcel[] => [
  { header: primeira, tipo: 'texto' },
  { header: 'Total', tipo: 'inteiro' },
  { header: 'Principal', tipo: 'inteiro' },
  { header: 'Recurso', tipo: 'inteiro' },
  { header: 'Incidente', tipo: 'inteiro' },
  { header: 'Não classificado', tipo: 'inteiro' },
]

const TOTAIS_QUEBRA_TIPO: Partial<Record<number, 'sum'>> = { 1: 'sum', 2: 'sum', 3: 'sum', 4: 'sum', 5: 'sum' }

function addAbaResumo(
  wb: ExcelJS.Workbook,
  resumo: LevantamentoResumo,
  filtros: LevantamentoFiltros,
  usedNames: Set<string>,
): void {
  const ws = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] })
  const largura = 6

  ws.mergeCells(1, 1, 1, largura)
  const titulo = ws.getCell(1, 1)
  titulo.value = `Levantamento Escritório — ${formatDate(filtros.dataInicio)} a ${formatDate(filtros.dataFim)}`
  titulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } }
  titulo.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 28

  ws.mergeCells(2, 1, 2, largura)
  const sub = ws.getCell(2, 1)
  sub.value = [
    `Gerado em ${formatDateTime(new Date().toISOString())}`,
    `Grupo: ${filtros.grupos.length ? filtros.grupos.join('; ') : 'Todos'}`,
    `Área: ${filtros.area ?? 'Todas'}`,
  ].join(' · ')
  sub.font = { italic: true, size: 10, color: { argb: MUTED } }

  let row = 4
  tituloSecao(ws, row, 'Indicadores')
  const indicadores: Array<[string, ExcelCell, TipoColuna]> = [
    ['Publicações', resumo.publicacoes_total, 'inteiro'],
    ['Timesheet — horas (HH:MM)', resumo.timesheet_horas / 24, 'duracao'],
    ['Timesheet — horas (decimal)', resumo.timesheet_horas, 'decimal'],
    ['Timesheet — apontamentos', resumo.timesheet_apontamentos, 'inteiro'],
    ['Processos (estoque)', resumo.processos_total, 'inteiro'],
    ['Tarefas VIOS', resumo.tarefas_total, 'inteiro'],
    ['Data início', isoDateToExcel(filtros.dataInicio), 'data'],
    ['Data fim', isoDateToExcel(filtros.dataFim), 'data'],
  ]
  const indicadoresFim = addTabela(ws, {
    nome: 'indicadores',
    usedNames,
    startRow: row + 1,
    colunas: [
      { header: 'Indicador', tipo: 'texto' },
      { header: 'Valor', tipo: 'texto' },
    ],
    linhas: indicadores.map(([k, v]) => [k, v]),
    setWidths: false,
  })
  indicadores.forEach(([, , tipo], i) => {
    const cell = ws.getCell(row + 2 + i, 2)
    const fmt = NUM_FMT[tipo]
    if (fmt) cell.numFmt = fmt
    cell.alignment = { vertical: 'middle', horizontal: 'right' }
  })

  row = indicadoresFim + 2
  tituloSecao(ws, row, 'Processos — Principal × Recurso × Incidente')
  const total = resumo.processos_total
  row =
    addTabela(ws, {
      nome: 'processos_tipo',
      usedNames,
      startRow: row + 1,
      colunas: [
        { header: 'Tipo', tipo: 'texto' },
        { header: 'Quantidade', tipo: 'inteiro' },
        { header: '% do estoque', tipo: 'percentual' },
      ],
      linhas: resumo.processos_por_tipo.map((t) => [t.tipo, t.qtd, total > 0 ? t.qtd / total : 0]),
      totais: { 1: 'sum', 2: 'sum' },
      setWidths: false,
    }) + 2

  tituloSecao(ws, row, 'Processos por departamento')
  row =
    addTabela(ws, {
      nome: 'processos_departamento',
      usedNames,
      startRow: row + 1,
      colunas: COLUNAS_QUEBRA_TIPO('Departamento'),
      linhas: linhasQuebraTipo(resumo.processos_por_departamento, (d) => d.departamento),
      totais: TOTAIS_QUEBRA_TIPO,
      setWidths: false,
    }) + 2

  tituloSecao(ws, row, 'Processos por situação')
  addTabela(ws, {
    nome: 'processos_situacao',
    usedNames,
    startRow: row + 1,
    colunas: COLUNAS_QUEBRA_TIPO('Situação'),
    linhas: linhasQuebraTipo(resumo.processos_por_situacao, (s) => s.situacao),
    totais: TOTAIS_QUEBRA_TIPO,
    setWidths: false,
  })

  ws.getColumn(1).width = 44
  for (let c = 2; c <= largura; c++) ws.getColumn(c).width = 18
}

async function novoWorkbook(): Promise<ExcelJS.Workbook> {
  const ExcelJSMod = (await import('exceljs')).default
  const wb = new ExcelJSMod.Workbook()
  wb.creator = 'SIOE'
  wb.created = new Date()
  return wb
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function exportLevantamentoRacionalExcel(
  racional: LevantamentoRacional,
  meta: { titulo: string; filtros: LevantamentoFiltros },
): Promise<void> {
  const wb = await novoWorkbook()
  addAbaRacional(wb, 'Racional', racional, new Set())

  const filename = [
    'escritorio',
    safeFilenamePart(meta.titulo),
    meta.filtros.dataInicio,
    meta.filtros.dataFim,
    meta.filtros.grupos.length ? safeFilenamePart(meta.filtros.grupos.join('_').slice(0, 40)) : null,
    meta.filtros.area ? safeFilenamePart(meta.filtros.area) : null,
  ]
    .filter(Boolean)
    .join('-')

  await downloadWorkbook(wb, `${filename}.xlsx`)
}

export async function buildLevantamentoRelatorioWorkbook(
  resumo: LevantamentoResumo,
  filtros: LevantamentoFiltros,
  racionais: LevantamentoRacional[],
): Promise<ExcelJS.Workbook> {
  const wb = await novoWorkbook()
  const usedNames = new Set<string>()
  addAbaResumo(wb, resumo, filtros, usedNames)
  for (const racional of racionais) {
    addAbaRacional(wb, BLOCO_LABELS[racional.bloco].slice(0, 28), racional, usedNames)
  }
  return wb
}

export async function exportLevantamentoRelatorioCompleto(
  resumo: LevantamentoResumo,
  filtros: LevantamentoFiltros,
): Promise<{ truncado: boolean }> {
  const blocos: LevantamentoBloco[] = ['publicacoes', 'timesheet', 'processos', 'tarefas']
  const racionais: LevantamentoRacional[] = []
  for (const bloco of blocos) {
    racionais.push(
      await escritorioLevantamentoService.fetchRacional(bloco, filtros, { limit: 5000 }),
    )
  }
  const truncado = racionais.some((r) => r.truncado)
  const wb = await buildLevantamentoRelatorioWorkbook(resumo, filtros, racionais)

  const filename = [
    'escritorio-levantamento',
    filtros.dataInicio,
    filtros.dataFim,
    filtros.grupos.length ? safeFilenamePart(filtros.grupos.join('_').slice(0, 40)) : null,
    filtros.area ? safeFilenamePart(filtros.area) : null,
  ]
    .filter(Boolean)
    .join('-')

  await downloadWorkbook(wb, `${filename}.xlsx`)
  return { truncado }
}

export function formatRacionalCell(
  value: unknown,
  bloco?: LevantamentoBloco,
  colKey?: string,
): string {
  if (bloco === 'timesheet' && colKey === 'total_horas_decimal') {
    return formatHorasTimesheetLinhaHHMM(parseHorasDecimaisValor(value))
  }
  if (value != null && value !== '' && colKey) {
    const tipo = TIPO_POR_CHAVE[colKey]
    if (tipo === 'data') return formatDate(String(value))
    if (tipo === 'dataHora') return formatDateTime(String(value))
  }
  return cellToString(value)
}

export function emptyColunas(): LevantamentoColuna[] {
  return []
}
