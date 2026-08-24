import ExcelJS from 'exceljs'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_SLA_PROTOCOLO,
  MESES_EFICIENCIA,
  MESES_EFICIENCIA_ARQUIVO,
} from '../constants'
import type { IndicadoresResultadoMes } from '../types/indicadoresResultado.types'
import { buildIndicadoresOperacionaisRows } from './indicadoresOperacionaisHtml'
import type {
  GestaoPdiDetalheRow,
  RacionalColuna,
  RacionalResumo,
  RacionalResultado,
  TurnoverDesligamentoRow,
} from '../types/eficiencia.types'
import { countVistagemD1, formatRacionalCell, isVistadoD1Sim } from './racionalFormat'

/** Azul institucional do Excel de referência (#156082). */
const BRAND = '156082'
const BRAND_SOFT = 'D6EAF5'
const ZEBRA = 'F5F7FA'
const GREEN_SOFT = 'E8F5E9'
const RED_SOFT = 'FFEBEE'
const AMBER_SOFT = 'FFF8E1'
const WHITE = 'FFFFFF'
const TEXT = '1F2937'
const MUTED = '6B7280'
const BORDER = 'CBD5E1'

type CellValue = string | number | null | undefined

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: `FF${BORDER}` } },
  left: { style: 'thin', color: { argb: `FF${BORDER}` } },
  bottom: { style: 'thin', color: { argb: `FF${BORDER}` } },
  right: { style: 'thin', color: { argb: `FF${BORDER}` } },
}

function fillArgb(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } }
}

function pct(num: number, den: number): number | null {
  if (den <= 0) return null
  return num / den
}

/** Minutos → `HH:MM` (ex.: 90 → `01:30`). */
function formatMinutosComoHoras(minutos: number): string {
  const total = Math.max(0, Math.round(minutos))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Ajusta largura das colunas ao conteúdo (texto formatado da célula). */
function autoFitColumns(ws: ExcelJS.Worksheet, fromCol = 1, toCol?: number, maxWidth = 55) {
  const lastCol = toCol ?? (ws.columnCount || 1)
  for (let c = fromCol; c <= lastCol; c++) {
    let maxLen = 8
    ws.eachRow({ includeEmpty: false }, (row) => {
      const text = row.getCell(c).text ?? ''
      maxLen = Math.max(maxLen, text.length + 2)
    })
    ws.getColumn(c).width = Math.min(maxLen, maxWidth)
  }
}

/** Ordena linhas do pivot pelo indicador principal (maior → menor); Total Geral no fim. */
function sortPivotRowsDesc(rows: CellValue[][], sortColIndex: number): CellValue[][] {
  const isTotal = (row: CellValue[]) => {
    const label = String(row[0] ?? '').toLowerCase()
    return label === 'total geral' || label === 'total'
  }
  const total = rows.find(isTotal)
  const data = rows.filter((r) => !isTotal(r))
  data.sort((a, b) => Number(b[sortColIndex] ?? 0) - Number(a[sortColIndex] ?? 0))
  return total ? [...data, total] : data
}

const METAS_INDICADORES = {
  slaProtocolo: `${EFICIENCIA_META_SLA_PROTOCOLO}%`,
  eficienciaProtocolo: '95%',
  agendamento: '95%',
  vistagem: '98%',
  gestaoPdi: '100%',
  retencaoTalentos: '90%',
} as const

function formatPctExport(num: number, den: number): string | undefined {
  if (den <= 0) return undefined
  return `${((num / den) * 100).toFixed(2).replace('.', ',')}%`
}

function styleTitle(ws: ExcelJS.Worksheet, row: number, cols: number, text: string) {
  ws.mergeCells(row, 1, row, cols)
  const cell = ws.getCell(row, 1)
  cell.value = text
  cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: `FF${WHITE}` } }
  cell.fill = fillArgb(BRAND)
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(row).height = 32
  for (let c = 1; c <= cols; c++) {
    ws.getCell(row, c).fill = fillArgb(BRAND)
    ws.getCell(row, c).border = thinBorder
  }
}

function styleSection(ws: ExcelJS.Worksheet, row: number, text: string, cols = 1) {
  const cell = ws.getCell(row, 1)
  cell.value = text
  cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${BRAND}` } }
  if (cols > 1) ws.mergeCells(row, 1, row, cols)
}

function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, headers: string[], startCol = 1) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, startCol + i)
    cell.value = h
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: `FF${WHITE}` } }
    cell.fill = fillArgb(BRAND)
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder
  })
  ws.getRow(row).height = 24
}

function styleDataCell(
  cell: ExcelJS.Cell,
  value: CellValue,
  opts?: {
    zebra?: boolean
    bold?: boolean
    fill?: string
    numFmt?: string
    wrap?: boolean
    align?: 'left' | 'center' | 'right'
  },
) {
  cell.value = value == null ? '' : value
  cell.font = {
    name: 'Calibri',
    size: 12,
    bold: opts?.bold ?? false,
    color: { argb: `FF${TEXT}` },
  }
  cell.border = thinBorder
  cell.alignment = {
    vertical: 'middle',
    horizontal: opts?.align ?? 'left',
    wrapText: opts?.wrap ?? false,
  }
  if (opts?.fill) cell.fill = fillArgb(opts.fill)
  else if (opts?.zebra) cell.fill = fillArgb(ZEBRA)
  if (opts?.numFmt && typeof value === 'number') cell.numFmt = opts.numFmt
}

function writeTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  headers: string[],
  rows: CellValue[][],
  opts?: {
    startCol?: number
    pctCols?: number[]
    numberCols?: number[]
    wrapCols?: number[]
    highlightCol?: { col: number; match: string; fill: string }
    statusCol?: { col: number; map: Record<string, string> }
  },
): number {
  const startCol = opts?.startCol ?? 1
  styleHeaderRow(ws, startRow, headers, startCol)
  let r = startRow + 1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const zebra = i % 2 === 1
    const isTotal = String(row[0] ?? '').toLowerCase() === 'total geral' || String(row[0]) === 'TOTAL'
    for (let c = 0; c < headers.length; c++) {
      const col = startCol + c
      const cell = ws.getCell(r, col)
      let value = row[c]
      let fill: string | undefined = isTotal ? BRAND_SOFT : undefined
      const pctCols = opts?.pctCols ?? []
      const numberCols = opts?.numberCols ?? []
      const wrapCols = opts?.wrapCols ?? []

      if (opts?.highlightCol && col === opts.highlightCol.col && value === opts.highlightCol.match) {
        fill = opts.highlightCol.fill
      }
      if (opts?.statusCol && col === opts.statusCol.col) {
        const key = String(value ?? '')
        if (opts.statusCol.map[key]) fill = opts.statusCol.map[key]
      }

      const isPct = pctCols.includes(col) && typeof value === 'number'
      styleDataCell(cell, value, {
        zebra: !fill && zebra,
        bold: isTotal,
        fill,
        numFmt: isPct ? '0.00%' : numberCols.includes(col) ? '0.00' : undefined,
        wrap: wrapCols.includes(col),
        align: isPct || numberCols.includes(col) ? 'center' : 'left',
      })
    }
    r += 1
  }
  return r
}

function linhasTabela(
  resultado: RacionalResultado,
  colunas?: RacionalColuna[],
): { headers: string[]; rows: CellValue[][] } {
  const cols = colunas ?? resultado.colunas
  return {
    headers: cols.map((c) => c.label),
    rows: resultado.linhas.map((row) =>
      cols.map((c) => {
        const raw = formatRacionalCell(row[c.key])
        return raw === '—' ? '' : raw
      }),
    ),
  }
}

function appendPivotAndDetail(
  wb: ExcelJS.Workbook,
  name: string,
  title: string,
  pivotHeaders: string[],
  pivotRows: CellValue[][],
  pivotOpts: Parameters<typeof writeTable>[4],
  detail: { headers: string[]; rows: CellValue[][] },
  detailOpts: Parameters<typeof writeTable>[4],
  extraPivot?: { headers: string[]; rows: CellValue[][]; startCol: number; opts?: Parameters<typeof writeTable>[4] },
  kpi?: { metaLabel?: string; resultadoLabel?: string },
) {
  const ws = wb.addWorksheet(name.slice(0, 31))
  const sheetCols = Math.max(
    pivotHeaders.length + (extraPivot?.startCol ?? 0),
    detail.headers.length,
    4,
  )
  styleTitle(ws, 1, sheetCols, title)

  let row = 2
  if (kpi?.metaLabel || kpi?.resultadoLabel) {
    ws.mergeCells(row, 1, row, sheetCols)
    const cell = ws.getCell(row, 1)
    const partes: string[] = []
    if (kpi.metaLabel) partes.push(`Meta: ${kpi.metaLabel}`)
    if (kpi.resultadoLabel) partes.push(`Resultado: ${kpi.resultadoLabel}`)
    cell.value = partes.join(' · ')
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: `FF${BRAND}` } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(row).height = 20
    row += 1
  }

  row += 1
  styleSection(ws, row, 'Resumo por área', pivotHeaders.length)
  row += 1
  const afterPivot = writeTable(ws, row, pivotHeaders, pivotRows, {
    ...pivotOpts,
    pctCols: (pivotOpts?.pctCols ?? []).map((c) => c),
  })

  if (extraPivot) {
    writeTable(ws, row, extraPivot.headers, extraPivot.rows, {
      startCol: extraPivot.startCol,
      ...extraPivot.opts,
    })
  }

  row = Math.max(afterPivot, row + pivotRows.length + 1) + 1
  styleSection(ws, row, 'Detalhamento', detail.headers.length)
  row += 1
  const detailHeaderRow = row
  writeTable(ws, row, detail.headers, detail.rows, detailOpts)
  ws.autoFilter = {
    from: { row: detailHeaderRow, column: 1 },
    to: { row: detailHeaderRow + detail.rows.length, column: detail.headers.length },
  }
  ws.views = [{ state: 'frozen', ySplit: detailHeaderRow, activeCell: 'A1', showGridLines: false }]
  autoFitColumns(ws, 1, sheetCols)
}

function buildSlaPivot(linhas: Array<Record<string, unknown>>) {
  type Acc = { d1: number; fatal: number }
  const byArea = new Map<string, Acc>()
  const byJust = new Map<string, number>()
  for (const row of linhas) {
    const area = String(row.area_conclusao ?? '—')
    if (row.excludente === 'Excludente') {
      const j = String(row.justificativa_fatal ?? 'Sem Justificativa')
      byJust.set(j, (byJust.get(j) ?? 0) + 1)
      continue
    }
    const acc = byArea.get(area) ?? { d1: 0, fatal: 0 }
    if (row.fatal_apos18 === 'D-1') acc.d1 += 1
    else if (row.fatal_apos18 === 'FATAL') acc.fatal += 1
    byArea.set(area, acc)
  }
  const areas = [...byArea.keys()]
  let totD1 = 0
  let totFatal = 0
  const rows: CellValue[][] = areas.map((area) => {
    const acc = byArea.get(area)!
    const den = acc.d1 + acc.fatal
    totD1 += acc.d1
    totFatal += acc.fatal
    return [area, pct(acc.d1, den), pct(acc.fatal, den)]
  })
  const den = totD1 + totFatal
  rows.push(['Total Geral', pct(totD1, den), pct(totFatal, den)])

  const justRows = [...byJust.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, qtd]) => [label, qtd] as CellValue[])
  const justTotal = justRows.reduce((s, r) => s + Number(r[1] ?? 0), 0)
  justRows.push(['Total Geral', justTotal])

  return { rows: sortPivotRowsDesc(rows, 1), justRows }
}

function buildPctPivot(
  linhas: Array<Record<string, unknown>>,
  areaKey: string,
  classify: (row: Record<string, unknown>) => 'a' | 'b',
  headers: [string, string, string],
) {
  const byArea = new Map<string, { a: number; b: number }>()
  for (const row of linhas) {
    const area = String(row[areaKey] ?? '—')
    const acc = byArea.get(area) ?? { a: 0, b: 0 }
    if (classify(row) === 'a') acc.a += 1
    else acc.b += 1
    byArea.set(area, acc)
  }
  let totA = 0
  let totB = 0
  const rows: CellValue[][] = [...byArea.keys()].map((area) => {
    const acc = byArea.get(area)!
    const den = acc.a + acc.b
    totA += acc.a
    totB += acc.b
    return [area, pct(acc.a, den), pct(acc.b, den)]
  })
  const den = totA + totB
  rows.push(['Total Geral', pct(totA, den), pct(totB, den)])
  return { headers, rows: sortPivotRowsDesc(rows, 1) }
}

function vistagemCounts(
  resumo: RacionalResumo | undefined,
  linhas: Array<Record<string, unknown>>,
): { sim: number; nao: number } {
  if (resumo?.qtd_vistado_sim != null && resumo?.qtd_vistado_nao != null) {
    return { sim: resumo.qtd_vistado_sim, nao: resumo.qtd_vistado_nao }
  }
  return countVistagemD1(linhas)
}

function buildVistagemPivot(linhas: Array<Record<string, unknown>>) {
  const byArea = new Map<string, { sim: number; nao: number }>()
  for (const row of linhas) {
    if (row.excludente === 'Excludente') continue
    const area = String(row.area ?? '—')
    const acc = byArea.get(area) ?? { sim: 0, nao: 0 }
    if (isVistadoD1Sim(row.vistado_d1)) acc.sim += 1
    else acc.nao += 1
    byArea.set(area, acc)
  }
  let totS = 0
  let totN = 0
  const pctRows: CellValue[][] = []
  const qtdRows: CellValue[][] = []
  for (const area of [...byArea.keys()]) {
    const acc = byArea.get(area)!
    const den = acc.sim + acc.nao
    totS += acc.sim
    totN += acc.nao
    pctRows.push([area, pct(acc.sim, den), pct(acc.nao, den)])
    qtdRows.push([area, acc.sim, acc.nao])
  }
  const den = totS + totN
  pctRows.push(['Total Geral', pct(totS, den), pct(totN, den)])
  qtdRows.push(['Total Geral', totS, totN])
  return {
    pctRows: sortPivotRowsDesc(pctRows, 1),
    qtdRows: sortPivotRowsDesc(qtdRows, 1),
  }
}

function buildGestaoPdiPivot(detalhe: GestaoPdiDetalheRow[]) {
  const byArea = new Map<string, { elegiveis: number; aptas: number }>()
  for (const row of detalhe) {
    const area = row.area ?? '—'
    const acc = byArea.get(area) ?? { elegiveis: 0, aptas: 0 }
    acc.elegiveis += 1
    if (row.apta) acc.aptas += 1
    byArea.set(area, acc)
  }
  let totE = 0
  let totA = 0
  const rows: CellValue[][] = [...byArea.keys()].map((area) => {
    const acc = byArea.get(area)!
    totE += acc.elegiveis
    totA += acc.aptas
    const desvios = acc.elegiveis - acc.aptas
    return [area, acc.elegiveis, acc.aptas, desvios, pct(acc.aptas, acc.elegiveis)]
  })
  const totD = totE - totA
  rows.push(['Total Geral', totE, totA, totD, pct(totA, totE)])
  return sortPivotRowsDesc(rows, 4)
}

function gestaoPdiDetailTable(detalhe: GestaoPdiDetalheRow[]): {
  headers: string[]
  rows: CellValue[][]
} {
  const headers = [
    'Mês',
    'Colaborador',
    'Área',
    'Progresso anterior',
    'Progresso',
    'Evidências de Execução',
    '1:1',
    'Status',
    'Desvio Critério de Puração',
  ]
  const rows = detalhe.map((d) => [
    MESES_EFICIENCIA[d.mes - 1] ?? String(d.mes),
    d.colaborador,
    d.area ?? '',
    d.progresso_anterior != null ? formatPercent(d.progresso_anterior) : '',
    d.progresso != null ? formatPercent(d.progresso) : '',
    d.evidencias_execucao ?? '',
    d.one_a_one != null ? d.one_a_one : '',
    d.status,
    d.desvio_criterio_apuracao?.trim() || '',
  ])
  return { headers, rows }
}

function anoDeDataIso(value: unknown): number | null {
  const s = String(value ?? '').trim()
  if (s.length < 4) return null
  const y = Number(s.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function formatMesesCasaExport(m: number | null | undefined): string {
  if (m == null) return ''
  const anos = Math.floor(m / 12)
  const meses = m % 12
  if (anos === 0) return `${meses}m`
  return `${anos}a ${meses}m`
}

/** Mesma regra de eficiencia_turnover_anual (ativos + saídas voluntárias no ano). */
function buildRetencaoPivot(linhas: Array<Record<string, unknown>>, ano: number) {
  const byArea = new Map<string, { ativos: number; saidas: number }>()
  for (const row of linhas) {
    const area = String(row.area ?? '—')
    const acc = byArea.get(area) ?? { ativos: 0, saidas: 0 }
    const admAno = anoDeDataIso(row.admissao)
    const desAno = anoDeDataIso(row.desligamento)
    if (admAno != null && admAno <= ano && (desAno == null || desAno > ano)) {
      acc.ativos += 1
    }
    if (
      String(row.tipo_desligamento ?? '').trim() === 'Voluntário' &&
      desAno === ano
    ) {
      acc.saidas += 1
    }
    byArea.set(area, acc)
  }
  let totA = 0
  let totS = 0
  const rows: CellValue[][] = [...byArea.keys()].map((area) => {
    const acc = byArea.get(area)!
    totA += acc.ativos
    totS += acc.saidas
    return [area, acc.ativos, acc.saidas, pct(acc.ativos - acc.saidas, acc.ativos)]
  })
  rows.push(['Total Geral', totA, totS, pct(totA - totS, totA)])
  return sortPivotRowsDesc(rows, 3)
}

function retencaoDesligamentosTable(desligamentos: TurnoverDesligamentoRow[]): {
  headers: string[]
  rows: CellValue[][]
} {
  const headers = ['Nome', 'Área', 'Cargo', 'Admissão', 'Desligamento', 'Tipo', 'Tempo de casa']
  const rows = desligamentos.map((d) => [
    d.nome,
    d.area ?? '',
    d.cargo ?? '',
    d.admissao ?? '',
    d.desligamento ?? '',
    d.tipo_desligamento ?? '',
    formatMesesCasaExport(d.meses_casa),
  ])
  return { headers, rows }
}

export function indicadoresResultadoFilename(ano: number, mes: number): string {
  const mesNome = MESES_EFICIENCIA_ARQUIVO[mes - 1] ?? String(mes)
  const aa = String(ano).slice(-2)
  return `INDICADORES - RESULTADO - ${mesNome}-${aa}.xlsx`
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
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

function writeResultadoSheet(wb: ExcelJS.Workbook, data: IndicadoresResultadoMes) {
  const ws = wb.addWorksheet('RESULTADO')
  const mesLabel = MESES_EFICIENCIA[data.mes - 1]
  styleTitle(ws, 1, 3, `INDICADORES RESULTADO — ${mesLabel}/${data.ano}`)

  ws.getCell(2, 1).value = 'Relatório gerencial parcial para coordenadores'
  ws.getCell(2, 1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: `FF${MUTED}` } }
  ws.mergeCells(2, 1, 2, 3)

  styleHeaderRow(ws, 4, ['Indicador', 'Resultado', 'Detalhe'])

  const kpis = buildIndicadoresOperacionaisRows(data).map((r) => [
    r.indicador,
    r.resultado,
    r.detalhe,
    r.bgColor.replace('#', ''),
  ] as [string, string, string, string])

  kpis.forEach((kpi, i) => {
    const row = 5 + i
    const zebra = i % 2 === 1
    styleDataCell(ws.getCell(row, 1), kpi[0], { zebra, bold: true })
    styleDataCell(ws.getCell(row, 2), kpi[1], {
      fill: kpi[3],
      bold: true,
      align: 'center',
    })
    styleDataCell(ws.getCell(row, 3), kpi[2], { zebra })
    ws.getRow(row).height = 20
  })

  ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }]
  autoFitColumns(ws, 1, 3)
}

export async function exportIndicadoresResultadoExcel(
  data: IndicadoresResultadoMes,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIOE'
  wb.created = new Date()
  wb.company = 'BP Law'

  writeResultadoSheet(wb, data)

  const r = data.slaProtocolo.resumo
  const e = data.eficienciaProtocolo.resumo

  const slaPivot = buildSlaPivot(data.slaProtocolo.linhas)
  const slaResultado =
    r?.qtd_d1 != null && r.qtd_fatal != null
      ? formatPctExport(r.qtd_d1, r.qtd_d1 + r.qtd_fatal)
      : undefined
  const efResultado =
    e?.qtd_eficiencia != null && e.qtd_inconsistencia != null
      ? formatPctExport(e.qtd_eficiencia, e.qtd_eficiencia + e.qtd_inconsistencia)
      : undefined

  let agDentro = 0
  let agFora = 0
  for (const row of data.agendamento.linhas) {
    if (row.excludente === 'Excludente') continue
    if (String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')) agFora += 1
    else agDentro += 1
  }
  const agResultado = formatPctExport(agDentro, agDentro + agFora)

  const vr = vistagemCounts(data.vistagemRisco.resumo, data.vistagemRisco.linhas)
  const vn = vistagemCounts(data.vistagemNormal.resumo, data.vistagemNormal.linhas)
  const vrResultado = formatPctExport(vr.sim, vr.sim + vr.nao)
  const vnResultado = formatPctExport(vn.sim, vn.sim + vn.nao)

  const slaDetail = linhasTabela(data.slaProtocolo, [
    { key: 'ci', label: 'CI' },
    { key: 'area_conclusao', label: 'Área (na conclusão)' },
    { key: 'grupo_cliente', label: 'Grupo Cliente' },
    { key: 'tarefa', label: 'Tarefa' },
    { key: 'tarefa_pai', label: 'Tarefa Pai' },
    { key: 'nro_cnj', label: 'Nro CNJ' },
    { key: 'usuario_conclusao', label: 'Usuário que concluiu a tarefa' },
    { key: 'data_para_conclusao', label: 'Data para conclusão' },
    { key: 'conclusao_completa', label: 'Conclusão Completa' },
    { key: 'fatal_apos18', label: 'SLA PROTOCOLO' },
    { key: 'justificativa_fatal', label: 'Justificativa de Fatal' },
    { key: 'excludente', label: 'Excludente' },
  ])
  // Excludente → SIM (leitura gerencial); demais ficam vazios.
  const slaExcludenteCol = slaDetail.headers.indexOf('Excludente')
  if (slaExcludenteCol >= 0) {
    for (const row of slaDetail.rows) {
      row[slaExcludenteCol] = row[slaExcludenteCol] === 'Excludente' ? 'SIM' : ''
    }
  }
  appendPivotAndDetail(
    wb,
    'SLA PROTOCOLO',
    `SLA Protocolo — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
    ['ÁREA', 'D-1', 'FATAL'],
    slaPivot.rows,
    { pctCols: [2, 3] },
    slaDetail,
    {
      statusCol: {
        col: 10,
        map: { FATAL: RED_SOFT, 'D-1': GREEN_SOFT },
      },
      highlightCol: { col: 12, match: 'SIM', fill: AMBER_SOFT },
    },
    {
      headers: ['Justificativa de Fatal', 'QTD'],
      rows: slaPivot.justRows,
      startCol: 5,
    },
    { metaLabel: METAS_INDICADORES.slaProtocolo, resultadoLabel: slaResultado },
  )

  const efPivot = buildPctPivot(
    data.eficienciaProtocolo.linhas.filter((row) => row.excludente !== 'Excludente'),
    'area',
    (row) =>
      String(row.status_inconsistencia ?? '').toUpperCase().includes('INCONSIST') ? 'b' : 'a',
    ['ÁREA', 'EFICIÊNCIA', 'INCONSISTÊNCIA'],
  )
  const efDetail = linhasTabela(data.eficienciaProtocolo)
  const efExclCol = efDetail.headers.indexOf('Excludente')
  if (efExclCol >= 0) {
    for (const row of efDetail.rows) {
      row[efExclCol] = row[efExclCol] === 'Excludente' ? 'SIM' : ''
    }
  }
  const efStatusCol = efDetail.headers.indexOf('Status') + 1
  appendPivotAndDetail(
    wb,
    'EFICIENCIA PROTOCOLO',
    `Eficiência Protocolo — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
    efPivot.headers,
    efPivot.rows,
    { pctCols: [2, 3] },
    efDetail,
    {
      statusCol: {
        col: efStatusCol > 0 ? efStatusCol : 9,
        map: { INCONSISTÊNCIA: RED_SOFT, INCONSISTENCIA: RED_SOFT, EFICIÊNCIA: GREEN_SOFT, EFICIENCIA: GREEN_SOFT },
      },
      highlightCol: efExclCol >= 0 ? { col: efExclCol + 1, match: 'SIM', fill: AMBER_SOFT } : undefined,
    },
    undefined,
    { metaLabel: METAS_INDICADORES.eficienciaProtocolo, resultadoLabel: efResultado },
  )

  const agPivot = buildPctPivot(
    data.agendamento.linhas.filter((row) => row.excludente !== 'Excludente'),
    'area_conclusao',
    (row) =>
      String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora') ? 'b' : 'a',
    ['ÁREA', 'Dentro do prazo', 'Fora do Prazo'],
  )
  const agDetail = linhasTabela(data.agendamento, [
    { key: 'ci', label: 'CI' },
    { key: 'nro_cnj', label: 'Nro CNJ' },
    { key: 'usuario_conclusao', label: 'Usuário que concluiu a tarefa' },
    { key: 'area_conclusao', label: 'Área (na conclusão)' },
    { key: 'data_para_conclusao', label: 'Data para conclusão' },
    { key: 'data_conclusao', label: 'Data da Conclusão' },
    { key: 'fatal_sem18_d1', label: 'SLA Ciencia de Agendamento' },
    { key: 'excludente', label: 'Excludente' },
  ])
  const agExcludenteCol = agDetail.headers.indexOf('Excludente')
  if (agExcludenteCol >= 0) {
    for (const row of agDetail.rows) {
      row[agExcludenteCol] = row[agExcludenteCol] === 'Excludente' ? 'SIM' : ''
    }
  }
  appendPivotAndDetail(
    wb,
    'SLA CIENCIA DOS AGENDAMENTOS',
    `SLA Ciência dos Agendamentos — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
    agPivot.headers,
    agPivot.rows,
    { pctCols: [2, 3] },
    agDetail,
    {
      statusCol: {
        col: 7,
        map: { 'Fora do Prazo': RED_SOFT, 'Dentro do prazo': GREEN_SOFT },
      },
      highlightCol: { col: 8, match: 'SIM', fill: AMBER_SOFT },
    },
    undefined,
    { metaLabel: METAS_INDICADORES.agendamento, resultadoLabel: agResultado },
  )

  for (const [name, source, title, resultadoLabel] of [
    ['SLA VISTAGEM DE RISCO', data.vistagemRisco, 'SLA Vistagem de Risco', vrResultado],
    ['SLA VISTAGEM NORMAL', data.vistagemNormal, 'SLA Vistagem Normal', vnResultado],
  ] as const) {
    const vp = buildVistagemPivot(source.linhas)
    const vistDetail = linhasTabela(source)
    const vistExclCol = vistDetail.headers.indexOf('Excludente')
    if (vistExclCol >= 0) {
      for (const row of vistDetail.rows) {
        row[vistExclCol] = row[vistExclCol] === 'Excludente' ? 'SIM' : ''
      }
    }
    const vistadoCol = vistDetail.headers.indexOf('Vistado D+1') + 1
    appendPivotAndDetail(
      wb,
      name,
      `${title} — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
      ['AREA', 'Sim', 'Não'],
      vp.pctRows,
      { pctCols: [2, 3] },
      vistDetail,
      {
        statusCol: {
          col: vistadoCol > 0 ? vistadoCol : 10,
          map: { Sim: GREEN_SOFT, Não: RED_SOFT, NAO: RED_SOFT },
        },
        highlightCol: vistExclCol >= 0 ? { col: vistExclCol + 1, match: 'SIM', fill: AMBER_SOFT } : undefined,
      },
      {
        headers: ['AREA', 'Sim', 'Não'],
        rows: vp.qtdRows,
        startCol: 5,
        opts: { numberCols: [6, 7] },
      },
      { metaLabel: METAS_INDICADORES.vistagem, resultadoLabel },
    )
  }

  {
    const ws = wb.addWorksheet('DESENVOLVIMENTO DE EQUIPE'.slice(0, 31))
    styleTitle(ws, 1, 5, `Relatório de Treinamentos — ${data.ano}`)
    const headers = ['Área', 'Treinamento', 'Participante', 'Mês', 'Horas']
    styleHeaderRow(ws, 3, headers)
    data.desenvolvimento.linhas.forEach((row, i) => {
      const min = Number(row.duracao_minutos) || 0
      const dataStr = String(row.data ?? '')
      const mesNum = dataStr.length >= 7 ? Number(dataStr.slice(5, 7)) : data.mes
      const mesNome = (MESES_EFICIENCIA[mesNum - 1] ?? '').toLowerCase()
      const values: CellValue[] = [
        String(row.area ?? ''),
        String(row.treinamento ?? ''),
        String(row.colaborador ?? ''),
        mesNome,
        formatMinutosComoHoras(min),
      ]
      values.forEach((v, c) => {
        styleDataCell(ws.getCell(4 + i, c + 1), v, {
          zebra: i % 2 === 1,
          align: c >= 3 ? 'center' : 'left',
        })
      })
    })
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + data.desenvolvimento.linhas.length, column: 5 },
    }
    ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }]
    autoFitColumns(ws, 1, 5)
  }

  {
    const gp = data.gestaoPdiMensal
    const gpResultado =
      gp?.pct_aptas != null
        ? `${gp.pct_aptas.toFixed(2).replace('.', ',')}%`
        : gp && gp.elegiveis > 0
          ? formatPctExport(gp.aptas, gp.elegiveis)
          : undefined
    const pivotRows = buildGestaoPdiPivot(data.gestaoPdiDetalhe)
    const detail = gestaoPdiDetailTable(data.gestaoPdiDetalhe)
    appendPivotAndDetail(
      wb,
      'GESTÃO DE PDI',
      `Gestão de PDI — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
      ['ÁREA', 'Elegíveis', 'Aptas', 'Desvios', '% Aptas'],
      pivotRows,
      { pctCols: [5], numberCols: [2, 3, 4] },
      detail,
      {
        statusCol: {
          col: 8,
          map: { Apta: GREEN_SOFT, Desvio: RED_SOFT },
        },
        wrapCols: [9],
      },
      undefined,
      { metaLabel: METAS_INDICADORES.gestaoPdi, resultadoLabel: gpResultado },
    )
  }

  {
    const rt = data.retencaoAnual
    const rtResultado =
      rt != null ? `${rt.pct_retencao.toFixed(2).replace('.', ',')}%` : undefined
    const metaRetencao = rt
      ? `mín. ${rt.meta_pct_retencao_minima.toFixed(2).replace('.', ',')}%`
      : `mín. ${METAS_INDICADORES.retencaoTalentos}`
    const pivotRows = buildRetencaoPivot(data.retencaoTalentos.linhas, data.ano)
    const detail = retencaoDesligamentosTable(data.retencaoDesligamentos)
    appendPivotAndDetail(
      wb,
      'RETENÇÃO DE TALENTOS',
      `Retenção de Talentos — ${data.ano}`,
      ['ÁREA', 'Ativos', 'Saídas voluntárias', '% Retenção'],
      pivotRows,
      { pctCols: [4], numberCols: [2, 3] },
      detail,
      {
        statusCol: {
          col: 6,
          map: { Voluntário: RED_SOFT },
        },
      },
      undefined,
      {
        metaLabel: metaRetencao,
        resultadoLabel: rtResultado,
      },
    )
  }

  await downloadWorkbook(wb, indicadoresResultadoFilename(data.ano, data.mes))
}
