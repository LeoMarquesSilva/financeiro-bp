import ExcelJS from 'exceljs'
import type {
  ReceitaInadimplenciaClientePeriodo,
  ReceitaInadimplenciaGrupoMes,
} from '../types/receitaInadimplencia.types'

type ExportMeta = {
  periodoLabel: string
  ano: number
}

const BRAND = '7F1D1D'
const BRAND_SOFT = 'FEF2F2'
const ZEBRA = 'FFF7F7'
const GREEN_SOFT = 'ECFDF5'
const TEXT = '1F2937'
const MUTED = '6B7280'
const WHITE = 'FFFFFF'
const BORDER = 'FECACA'
const MONEY_FMT = '"R$" #,##0.00'
const PCT_FMT = '0.00%'

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: `FF${BORDER}` } },
  left: { style: 'thin', color: { argb: `FF${BORDER}` } },
  bottom: { style: 'thin', color: { argb: `FF${BORDER}` } },
  right: { style: 'thin', color: { argb: `FF${BORDER}` } },
}

function fillArgb(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } }
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

export async function exportClientesPeriodoExcel(
  clientes: ReceitaInadimplenciaClientePeriodo[],
  incluidos: Set<string>,
  meta: ExportMeta,
): Promise<void> {
  const XLSX = await import('xlsx')
  const rows: Array<Record<string, string | number>> = clientes.map((c) => ({
    Cliente: c.cliente,
    'Valor (R$)': c.valor,
    'Meses inadimplente': c.qtd_meses,
    'Incluir na conta': incluidos.has(c.cliente) ? 'Sim' : 'Não',
  }))
  const totalIncluido = clientes
    .filter((c) => incluidos.has(c.cliente))
    .reduce((s, c) => s + c.valor, 0)
  rows.push({
    Cliente: 'TOTAL (incluídos)',
    'Valor (R$)': totalIncluido,
    'Meses inadimplente': '',
    'Incluir na conta': '',
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inadimplentes')
  const safeLabel = meta.periodoLabel.replace(/[^\w-]+/g, '_')
  XLSX.writeFile(wb, `inadimplencia-clientes-${meta.ano}-${safeLabel}.xlsx`)
}

export type ExportGruposMesMeta = {
  ano: number
  mes: number
  mesLabel: string
  previstoMes: number
  geradoEm?: Date
}

/** Planilha gerencial dos grupos marcados no sheet do mês (cores, totais, critérios). */
export async function exportGruposMesSelecionadosExcel(
  grupos: ReceitaInadimplenciaGrupoMes[],
  incluidos: Set<string>,
  meta: ExportGruposMesMeta,
): Promise<void> {
  const selecionados = grupos
    .filter((g) => incluidos.has(g.grupo_cliente) && g.inadimplencia > 0)
    .sort((a, b) => b.inadimplencia - a.inadimplencia)

  if (selecionados.length === 0) {
    throw new Error('Selecione ao menos um grupo inadimplente para exportar')
  }

  const totalInad = selecionados.reduce((s, g) => s + g.inadimplencia, 0)
  const totalFat = selecionados.reduce((s, g) => s + g.faturado, 0)
  const totalRec = selecionados.reduce((s, g) => s + g.recebido, 0)
  const pctPrevisto = meta.previstoMes > 0 ? totalInad / meta.previstoMes : null
  const gerado = meta.geradoEm ?? new Date()
  const geradoLabel = gerado.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const periodo = `${meta.mesLabel.toUpperCase()}/${meta.ano}`

  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIOE'
  wb.created = gerado

  const ws = wb.addWorksheet('Inadimplência', {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  })

  ws.mergeCells(1, 1, 1, 6)
  const title = ws.getCell(1, 1)
  title.value = `INADIMPLÊNCIA · VISÃO GERENCIAL — ${periodo}`
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: `FF${WHITE}` } }
  title.fill = fillArgb(BRAND)
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 34
  for (let c = 1; c <= 6; c++) {
    ws.getCell(1, c).fill = fillArgb(BRAND)
    ws.getCell(1, c).border = thinBorder
  }

  ws.mergeCells(2, 1, 2, 6)
  const sub = ws.getCell(2, 1)
  sub.value =
    'Grupos selecionados no mês · só títulos já vencidos (vencimento de hoje não entra) · Bismarchi Pires'
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: `FF${MUTED}` } }
  sub.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(2).height = 18

  const kpis: Array<[string, string | number, string?]> = [
    ['Grupos', selecionados.length],
    ['Inadimplência', totalInad, MONEY_FMT],
    ['% do previsto', pctPrevisto ?? '—', pctPrevisto != null ? PCT_FMT : undefined],
    ['Gerado em', geradoLabel],
  ]

  kpis.forEach(([label, value, numFmt], i) => {
    const col = 1 + i
    const lab = ws.getCell(4, col)
    lab.value = label
    lab.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${BRAND}` } }
    lab.fill = fillArgb(BRAND_SOFT)
    lab.alignment = { horizontal: 'center', vertical: 'middle' }
    lab.border = thinBorder
    const val = ws.getCell(5, col)
    val.value = value
    val.font = { name: 'Calibri', size: 12, bold: true, color: { argb: `FF${TEXT}` } }
    val.fill = fillArgb(i === 1 ? 'FEE2E2' : WHITE)
    val.alignment = { horizontal: 'center', vertical: 'middle' }
    val.border = thinBorder
    if (numFmt && typeof value === 'number') val.numFmt = numFmt
  })
  ws.mergeCells(4, 4, 4, 6)
  ws.mergeCells(5, 4, 5, 6)
  ws.getRow(4).height = 18
  ws.getRow(5).height = 22

  ws.mergeCells(7, 1, 7, 6)
  const sec = ws.getCell(7, 1)
  sec.value = 'Composição por grupo'
  sec.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${BRAND}` } }

  const headers = [
    '#',
    'Grupo',
    'Faturado (vencido)',
    'Recebido',
    'Inadimplência',
    '% do total',
  ]
  headers.forEach((h, i) => {
    const cell = ws.getCell(8, i + 1)
    cell.value = h
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${WHITE}` } }
    cell.fill = fillArgb(BRAND)
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder
  })
  ws.getRow(8).height = 22
  ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: 6 } }

  selecionados.forEach((g, i) => {
    const row = 9 + i
    const zebra = i % 2 === 1
    const share = totalInad > 0 ? g.inadimplencia / totalInad : 0
    const values: Array<{ v: string | number; fmt?: string; align?: 'left' | 'center' | 'right'; fill?: string }> = [
      { v: i + 1, align: 'center' },
      { v: g.grupo_cliente, align: 'left' },
      { v: g.faturado, fmt: MONEY_FMT, align: 'right' },
      { v: g.recebido, fmt: MONEY_FMT, align: 'right' },
      { v: g.inadimplencia, fmt: MONEY_FMT, align: 'right', fill: 'FEE2E2' },
      { v: share, fmt: PCT_FMT, align: 'center' },
    ]
    values.forEach((item, c) => {
      const cell = ws.getCell(row, c + 1)
      cell.value = item.v
      cell.font = { name: 'Calibri', size: 10, color: { argb: `FF${TEXT}` } }
      cell.border = thinBorder
      cell.alignment = { vertical: 'middle', horizontal: item.align ?? 'left' }
      cell.fill = fillArgb(item.fill ?? (zebra ? ZEBRA : WHITE))
      if (item.fmt && typeof item.v === 'number') cell.numFmt = item.fmt
    })
    ws.getRow(row).height = 18
  })

  const totalRow = 9 + selecionados.length
  const totalVals: Array<{ v: string | number; fmt?: string; align?: 'left' | 'center' | 'right' }> = [
    { v: '', align: 'center' },
    { v: 'TOTAL SELECIONADO', align: 'left' },
    { v: totalFat, fmt: MONEY_FMT, align: 'right' },
    { v: totalRec, fmt: MONEY_FMT, align: 'right' },
    { v: totalInad, fmt: MONEY_FMT, align: 'right' },
    { v: 1, fmt: PCT_FMT, align: 'center' },
  ]
  totalVals.forEach((item, c) => {
    const cell = ws.getCell(totalRow, c + 1)
    cell.value = item.v
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${WHITE}` } }
    cell.fill = fillArgb(BRAND)
    cell.border = thinBorder
    cell.alignment = { vertical: 'middle', horizontal: item.align ?? 'left' }
    if (item.fmt && typeof item.v === 'number') cell.numFmt = item.fmt
  })
  ws.getRow(totalRow).height = 20

  const noteRow = totalRow + 2
  ws.mergeCells(noteRow, 1, noteRow, 6)
  const note = ws.getCell(noteRow, 1)
  note.value =
    'Critérios: inadimplência = max(0, faturado vencido − recebido) consolidado por grupo. ' +
    'Títulos com vencimento hoje ou futuro não entram. Meses encerrados usam o último dia do mês como corte.'
  note.font = { name: 'Calibri', size: 9, italic: true, color: { argb: `FF${MUTED}` } }
  note.alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(noteRow).height = 32

  ws.getColumn(1).width = 6
  ws.getColumn(2).width = 42
  ws.getColumn(3).width = 20
  ws.getColumn(4).width = 16
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 12

  ws.headerFooter.oddFooter = `&LSIOE · Receita&C${periodo}&R&P / &N`

  const criterios = wb.addWorksheet('Critérios')
  criterios.getColumn(1).width = 28
  criterios.getColumn(2).width = 72
  criterios.mergeCells(1, 1, 1, 2)
  const ct = criterios.getCell(1, 1)
  ct.value = 'Critérios da extração'
  ct.font = { name: 'Calibri', size: 14, bold: true, color: { argb: `FF${WHITE}` } }
  ct.fill = fillArgb(BRAND)
  criterios.getCell(1, 2).fill = fillArgb(BRAND)
  const linhas: Array<[string, string]> = [
    ['Período', periodo],
    ['População', `${selecionados.length} grupo(s) marcado(s) no painel do mês`],
    ['Faturado', 'Somente títulos com data de vencimento até o corte (ontem no mês corrente)'],
    ['Recebido', 'Caixa do mês no grupo (netting entre razões sociais do mesmo grupo)'],
    ['Inadimplência', 'max(0, Σ faturado − Σ recebido) do grupo'],
    ['Vencimento = hoje', 'Não entra — o dia do vencimento ainda não é inadimplência'],
    ['Gerado em', geradoLabel],
  ]
  linhas.forEach(([k, v], i) => {
    const r = 3 + i
    criterios.getCell(r, 1).value = k
    criterios.getCell(r, 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${BRAND}` } }
    criterios.getCell(r, 1).fill = fillArgb(BRAND_SOFT)
    criterios.getCell(r, 1).border = thinBorder
    criterios.getCell(r, 2).value = v
    criterios.getCell(r, 2).font = { name: 'Calibri', size: 10, color: { argb: `FF${TEXT}` } }
    criterios.getCell(r, 2).border = thinBorder
    criterios.getCell(r, 2).fill = fillArgb(i % 2 ? GREEN_SOFT : WHITE)
  })

  const safeMes = meta.mesLabel.replace(/[^\w-]+/g, '_')
  await downloadWorkbook(wb, `inadimplencia-${meta.ano}-${safeMes}-selecionados.xlsx`)
}
