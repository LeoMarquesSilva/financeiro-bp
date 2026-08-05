import ExcelJS from 'exceljs'
import {
  EFICIENCIA_EVIDENCIA_POR_JUSTIFICATIVA,
  MESES_EFICIENCIA,
  MESES_EFICIENCIA_ARQUIVO,
} from '../constants'
import type { IndicadoresResultadoMes } from '../types/indicadoresResultado.types'
import type { RacionalColuna, RacionalResultado } from '../types/eficiencia.types'
import { formatRacionalCell } from './racionalFormat'

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

function setColWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
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
  widths: number[],
  extraPivot?: { headers: string[]; rows: CellValue[][]; startCol: number; opts?: Parameters<typeof writeTable>[4] },
) {
  const ws = wb.addWorksheet(name.slice(0, 31))
  setColWidths(ws, widths)
  styleTitle(ws, 1, Math.max(widths.length, pivotHeaders.length + (extraPivot?.startCol ?? 0)), title)

  let row = 3
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
  const areas = [...byArea.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
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

  return { rows, justRows }
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
  const rows: CellValue[][] = [...byArea.keys()]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((area) => {
      const acc = byArea.get(area)!
      const den = acc.a + acc.b
      totA += acc.a
      totB += acc.b
      return [area, pct(acc.a, den), pct(acc.b, den)]
    })
  const den = totA + totB
  rows.push(['Total Geral', pct(totA, den), pct(totB, den)])
  return { headers, rows }
}

function buildVistagemPivot(linhas: Array<Record<string, unknown>>) {
  const byArea = new Map<string, { sim: number; nao: number }>()
  for (const row of linhas) {
    const area = String(row.area ?? '—')
    const acc = byArea.get(area) ?? { sim: 0, nao: 0 }
    const v = String(row.vistado_d1 ?? '')
    if (v === 'Sim' || v === 'SIM' || v === 'true') acc.sim += 1
    else acc.nao += 1
    byArea.set(area, acc)
  }
  let totS = 0
  let totN = 0
  const pctRows: CellValue[][] = []
  const qtdRows: CellValue[][] = []
  for (const area of [...byArea.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
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
  return { pctRows, qtdRows }
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
  setColWidths(ws, [36, 18, 55])
  const mesLabel = MESES_EFICIENCIA[data.mes - 1]
  styleTitle(ws, 1, 3, `INDICADORES RESULTADO — ${mesLabel}/${data.ano}`)

  ws.getCell(2, 1).value = 'Relatório gerencial parcial para coordenadores'
  ws.getCell(2, 1).font = { name: 'Calibri', size: 11, italic: true, color: { argb: `FF${MUTED}` } }
  ws.mergeCells(2, 1, 2, 3)

  styleHeaderRow(ws, 4, ['Indicador', 'Resultado', 'Detalhe'])

  const r = data.slaProtocolo.resumo
  const e = data.eficienciaProtocolo.resumo
  const kpis: Array<[string, string, string, string?]> = []

  if (r?.qtd_d1 != null && r.qtd_fatal != null) {
    const den = r.qtd_d1 + r.qtd_fatal
    const pctD1 = den > 0 ? `${((r.qtd_d1 / den) * 100).toFixed(2).replace('.', ',')}%` : '—'
    kpis.push([
      'SLA Protocolo (D-1)',
      pctD1,
      `${r.qtd_d1} D-1 · ${r.qtd_fatal} FATAL · ${r.qtd_excludente ?? 0} excludentes`,
      den > 0 && r.qtd_d1 / den >= 0.9 ? GREEN_SOFT : RED_SOFT,
    ])
  }
  if (e?.qtd_eficiencia != null && e.qtd_inconsistencia != null) {
    const den = e.qtd_eficiencia + e.qtd_inconsistencia
    const pctOk = den > 0 ? `${((e.qtd_eficiencia / den) * 100).toFixed(2).replace('.', ',')}%` : '—'
    kpis.push([
      'Eficiência Protocolo',
      pctOk,
      `${e.qtd_eficiencia} eficiência · ${e.qtd_inconsistencia} inconsistência`,
      den > 0 && e.qtd_eficiencia / den >= 0.95 ? GREEN_SOFT : RED_SOFT,
    ])
  }

  let dentro = 0
  let fora = 0
  for (const row of data.agendamento.linhas) {
    if (String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')) fora += 1
    else dentro += 1
  }
  const denAg = dentro + fora
  kpis.push([
    'SLA Ciência Agendamentos',
    denAg ? `${((dentro / denAg) * 100).toFixed(2).replace('.', ',')}%` : '—',
    `${dentro} dentro · ${fora} fora`,
    denAg && dentro / denAg >= 0.95 ? GREEN_SOFT : RED_SOFT,
  ])

  const countVist = (linhas: Array<Record<string, unknown>>) => {
    let sim = 0
    let nao = 0
    for (const row of linhas) {
      const v = String(row.vistado_d1 ?? '')
      if (v === 'Sim' || v === 'SIM' || v === 'true') sim += 1
      else nao += 1
    }
    return { sim, nao }
  }
  const vr = countVist(data.vistagemRisco.linhas)
  const vn = countVist(data.vistagemNormal.linhas)
  const denVr = vr.sim + vr.nao
  const denVn = vn.sim + vn.nao
  kpis.push([
    'SLA Vistagem Risco',
    denVr ? `${((vr.sim / denVr) * 100).toFixed(2).replace('.', ',')}%` : '—',
    `${vr.sim} Sim · ${vr.nao} Não`,
    denVr && vr.sim / denVr >= 0.98 ? GREEN_SOFT : RED_SOFT,
  ])
  kpis.push([
    'SLA Vistagem Normal',
    denVn ? `${((vn.sim / denVn) * 100).toFixed(2).replace('.', ',')}%` : '—',
    `${vn.sim} Sim · ${vn.nao} Não`,
    denVn && vn.sim / denVn >= 0.98 ? GREEN_SOFT : RED_SOFT,
  ])
  kpis.push([
    'Desenvolvimento Equipe',
    `${data.desenvolvimento.linhas.length} lançamentos`,
    'Ver aba DESENVOLVIMENTO DE EQUIPE',
    BRAND_SOFT,
  ])
  kpis.push([
    'Amostra evidências FATAL',
    `${data.amostraChamados.length} de ${data.detalhesExcludentes.length}`,
    'Ver abas Metodologia e Chamados - Amostra',
    AMBER_SOFT,
  ])

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
}

function writeMetodologia(wb: ExcelJS.Workbook, data: IndicadoresResultadoMes) {
  const ws = wb.addWorksheet('Metodologia')
  setColWidths(ws, [55, 55, 12, 12])
  styleTitle(ws, 1, 4, 'Metodologia de Amostragem — Evidências de Protocolos FATAL')

  const blocks: Array<{ title: string; body: string }> = [
    {
      title: '1. Objetivo',
      body: 'Validar, por amostragem, a justificativa registrada em cada protocolo classificado como FATAL, mediante solicitação de evidência documental ao responsável, confirmando que o descumprimento do SLA decorreu do motivo informado (ex.: atraso do cliente) e não de falha interna.',
    },
    {
      title: '2. População e escopo',
      body: `População: ${data.detalhesExcludentes.length} protocolos FATAL excludentes do mês. Unidade de amostragem = 1 protocolo (CI). A amostragem não é censo: seleciona-se uma parte representativa e de maior risco.`,
    },
    {
      title: '3. Critérios de estratificação',
      body: 'Estratos = combinação Área × Justificativa de Fatal. Dessa forma a amostra preserva a participação (quantidade) de cada Área e de cada Justificativa observada na população.',
    },
    {
      title: '4. Regra de seleção',
      body: 'a) ~30% por estrato (arredondado).\nb) Mínimo 1 caso por estrato não vazio.\nc) Ordem da lista (não por atraso).\nd) Casos sorteados listados na aba Chamados - Amostra.',
    },
  ]

  let row = 3
  for (const block of blocks) {
    styleSection(ws, row, block.title, 4)
    row += 1
    ws.mergeCells(row, 1, row, 4)
    const cell = ws.getCell(row, 1)
    cell.value = block.body
    cell.font = { name: 'Calibri', size: 12, color: { argb: `FF${TEXT}` } }
    cell.alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(row).height = block.body.length > 160 ? 48 : 32
    row += 2
  }

  styleSection(ws, row, '5. Resumo da amostra por estrato', 4)
  row += 1
  const resumoRows = data.resumoAmostra.map((r) => [
    r.justificativa,
    r.populacao,
    r.amostra,
    r.pctAmostra,
  ])
  writeTable(ws, row, ['Justificativa de Fatal', 'População', 'Amostra', '% Amostra'], resumoRows, {
    pctCols: [4],
    numberCols: [2, 3],
  })
  row += resumoRows.length + 2

  styleSection(ws, row, '6. Tipo de evidência a solicitar por justificativa', 4)
  row += 1
  const evidRows = Object.entries(EFICIENCIA_EVIDENCIA_POR_JUSTIFICATIVA).map(([j, e]) => [j, e])
  writeTable(ws, row, ['Justificativa de Fatal', 'Evidência a solicitar'], evidRows, {
    wrapCols: [1, 2],
  })
  row += evidRows.length + 2

  styleSection(ws, row, '7. Prazo de resposta e tratamento', 4)
  row += 1
  ws.mergeCells(row, 1, row, 4)
  ws.getCell(row, 1).value =
    'Prazo sugerido de resposta ao chamado: 5 dias úteis. Sem evidência válida no prazo, o FATAL é mantido como falha interna. As evidências recebidas devem ser anexadas ao chamado e o resultado registrado (Confirmado / Não comprovado).'
  ws.getCell(row, 1).alignment = { wrapText: true }
  ws.getRow(row).height = 40
  row += 2
  ws.getCell(row, 1).value =
    `Amostra gerada: ${data.amostraChamados.length} de ${data.detalhesExcludentes.length} excludentes.`
  ws.getCell(row, 1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: `FF${BRAND}` } }
  ws.views = [{ showGridLines: false }]
}

function writeChamadosAmostra(wb: ExcelJS.Workbook, data: IndicadoresResultadoMes) {
  const ws = wb.addWorksheet('Chamados - Amostra')
  const headers = [
    '#',
    'CI',
    'Área',
    'Grupo Cliente',
    'Tarefa Pai',
    'Nº CNJ',
    'Responsável',
    'Prazo',
    'Conclusão',
    'Atraso (dias)',
    'Justificativa de Fatal',
    'Evidência solicitada',
    'Texto do Chamado (pronto p/ copiar)',
    'CHAMADO ABERTO?',
    'RESPONSÁVEL PELO CHAMADO',
    'RESPOSTA',
    'DECISÃO',
  ]
  setColWidths(ws, [5, 10, 16, 22, 28, 24, 24, 12, 16, 12, 28, 36, 48, 14, 22, 16, 16])
  styleTitle(ws, 1, headers.length, 'Chamados — Amostra de Evidências (Protocolos FATAL)')
  styleHeaderRow(ws, 2, headers)

  data.amostraChamados.forEach((row, i) => {
    const r = 3 + i
    const zebra = i % 2 === 1
    const values: CellValue[] = [
      i + 1,
      row.ci,
      row.area,
      row.grupoCliente,
      row.tarefaPai,
      row.nroCnj,
      row.responsavel,
      formatRacionalCell(row.dataParaConclusao),
      formatRacionalCell(row.conclusaoCompleta),
      row.atrasoDias == null ? '' : Number(row.atrasoDias.toFixed(2)),
      row.justificativa,
      row.evidencia,
      row.textoChamado,
      '',
      '',
      '',
      '',
    ]
    values.forEach((v, c) => {
      styleDataCell(ws.getCell(r, c + 1), v, {
        zebra,
        wrap: c === 11 || c === 12,
        numFmt: c === 9 && typeof v === 'number' ? '0.00' : undefined,
        align: c === 0 || c === 9 ? 'center' : 'left',
        fill: c >= 13 ? AMBER_SOFT : undefined,
      })
    })
    ws.getRow(r).height = 48
  })

  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2 + data.amostraChamados.length, column: headers.length },
  }
  ws.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }]
}

export async function exportIndicadoresResultadoExcel(
  data: IndicadoresResultadoMes,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIOE'
  wb.created = new Date()
  wb.company = 'BP Law'

  writeResultadoSheet(wb, data)

  const slaPivot = buildSlaPivot(data.slaProtocolo.linhas)
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
    [12, 18, 22, 14, 30, 22, 26, 14, 16, 12, 32, 12],
    {
      headers: ['Justificativa de Fatal', 'QTD'],
      rows: slaPivot.justRows,
      startCol: 5,
    },
  )

  const efPivot = buildPctPivot(
    data.eficienciaProtocolo.linhas,
    'area',
    (row) =>
      String(row.status_inconsistencia ?? '').toUpperCase().includes('INCONSIST') ? 'b' : 'a',
    ['ÁREA', 'EFICIÊNCIA', 'INCONSISTÊNCIA'],
  )
  appendPivotAndDetail(
    wb,
    'EFICIENCIA PROTOCOLO',
    `Eficiência Protocolo — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
    efPivot.headers,
    efPivot.rows,
    { pctCols: [2, 3] },
    linhasTabela(data.eficienciaProtocolo),
    {
      statusCol: {
        col: 7,
        map: { INCONSISTÊNCIA: RED_SOFT, INCONSISTENCIA: RED_SOFT, EFICIÊNCIA: GREEN_SOFT, EFICIENCIA: GREEN_SOFT },
      },
    },
    [10, 14, 22, 18, 16, 22, 14, 28],
  )

  const agPivot = buildPctPivot(
    data.agendamento.linhas,
    'area_conclusao',
    (row) =>
      String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora') ? 'b' : 'a',
    ['ÁREA', 'Dentro do prazo', 'Fora do Prazo'],
  )
  appendPivotAndDetail(
    wb,
    'SLA CIENCIA DOS AGENDAMENTOS',
    `SLA Ciência dos Agendamentos — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
    agPivot.headers,
    agPivot.rows,
    { pctCols: [2, 3] },
    linhasTabela(data.agendamento, [
      { key: 'ci', label: 'CI' },
      { key: 'nro_cnj', label: 'Nro CNJ' },
      { key: 'usuario_conclusao', label: 'Usuário que concluiu a tarefa' },
      { key: 'area_conclusao', label: 'Área (na conclusão)' },
      { key: 'data_para_conclusao', label: 'Data para conclusão' },
      { key: 'data_conclusao', label: 'Data da Conclusão' },
      { key: 'fatal_sem18_d1', label: 'SLA Ciencia de Agendamento' },
    ]),
    {
      statusCol: {
        col: 7,
        map: { 'Fora do Prazo': RED_SOFT, 'Dentro do prazo': GREEN_SOFT },
      },
    },
    [10, 22, 26, 18, 14, 14, 18],
  )

  for (const [name, source, title] of [
    ['SLA VISTAGEM DE RISCO', data.vistagemRisco, 'SLA Vistagem de Risco'],
    ['SLA VISTAGEM NORMAL', data.vistagemNormal, 'SLA Vistagem Normal'],
  ] as const) {
    const vp = buildVistagemPivot(source.linhas)
    appendPivotAndDetail(
      wb,
      name,
      `${title} — ${MESES_EFICIENCIA[data.mes - 1]}/${data.ano}`,
      ['AREA', 'Sim', 'Não'],
      vp.pctRows,
      { pctCols: [2, 3] },
      linhasTabela(source),
      {
        statusCol: {
          col: 9,
          map: { Sim: GREEN_SOFT, Não: RED_SOFT, NAO: RED_SOFT },
        },
      },
      [10, 16, 22, 22, 18, 20, 18, 16, 12],
      {
        headers: ['AREA', 'Sim', 'Não'],
        rows: vp.qtdRows,
        startCol: 5,
        opts: { numberCols: [6, 7] },
      },
    )
  }

  {
    const ws = wb.addWorksheet('DESENVOLVIMENTO DE EQUIPE'.slice(0, 31))
    setColWidths(ws, [18, 36, 32, 10, 10])
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
  }

  writeMetodologia(wb, data)
  writeChamadosAmostra(wb, data)

  await downloadWorkbook(wb, indicadoresResultadoFilename(data.ano, data.mes))
}
