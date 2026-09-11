import ExcelJS from 'exceljs'

export type RelatorioGerencialLinha = {
  grupo_cliente: string
  tipo_receita: string
  data_vencimento: string | null
  faturado: number
  recebido: number
  inadimplencia: number
}

export type RelatorioGerencialGrupo = Omit<RelatorioGerencialLinha, 'data_vencimento'>

const DATE_FMT = 'DD/MM/YYYY'

export function vencimentoParaExcel(iso: string | null): Date | string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d)
}

export type RelatorioGerencialMeta = {
  ano: number
  periodoLabel: string
  areaLabel?: string
  geradoEm?: Date
}

const BRAND = '475569'
const BRAND_SOFT = 'F1F5F9'
const ZEBRA = 'F8FAFC'
const PAGO_SOFT = 'F0F9FF'
const INAD_SOFT = 'FEF2F2'
const TEXT = '1F2937'
const MUTED = '6B7280'
const WHITE = 'FFFFFF'
const BORDER = 'E2E8F0'
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

/** Sem grupo cadastrado → razão social (não balde único). */
export function chaveGrupoRelatorioGerencial(grupoCliente: string, cliente: string): string {
  const grupo = grupoCliente.trim()
  if (!grupo || grupo === 'Sem grupo') return cliente.trim() || 'Sem cliente'
  return grupo
}

export function agruparNetPorChaveGrupo(
  rows: Array<{ cliente: string; grupo_cliente: string; faturado: number; recebido: number }>,
): RelatorioGerencialGrupo[] {
  const map = new Map<string, { faturado: number; recebido: number }>()
  for (const row of rows) {
    const chave = chaveGrupoRelatorioGerencial(row.grupo_cliente, row.cliente)
    const cur = map.get(chave) ?? { faturado: 0, recebido: 0 }
    cur.faturado += row.faturado
    cur.recebido += row.recebido
    map.set(chave, cur)
  }

  return [...map.entries()]
    .map(([grupo_cliente, v]) => ({
      grupo_cliente,
      tipo_receita: '—',
      faturado: v.faturado,
      recebido: v.recebido,
      inadimplencia: Math.max(0, v.faturado - v.recebido),
    }))
    .filter((g) => g.faturado > 0 || g.recebido > 0)
    .sort(
      (a, b) =>
        b.faturado - a.faturado || a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR'),
    )
}

/** Planilha gerencial: previsto faturado, grupo, vencimento, pago e inadimplente. */
export async function exportRelatorioGerencialExcel(
  linhas: RelatorioGerencialLinha[],
  meta: RelatorioGerencialMeta,
): Promise<void> {
  if (linhas.length === 0) {
    throw new Error('Não há grupos com receita no período selecionado.')
  }

  const totalFat = linhas.reduce((s, g) => s + g.faturado, 0)
  const totalRec = linhas.reduce((s, g) => s + g.recebido, 0)
  const totalInad = linhas.reduce((s, g) => s + g.inadimplencia, 0)
  const gerado = meta.geradoEm ?? new Date()
  const geradoLabel = gerado.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const periodo = `${meta.periodoLabel.toUpperCase()}/${meta.ano}`
  const areaLabel = meta.areaLabel?.trim() || 'Todas as áreas'

  const COLS = 8

  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIOE'
  wb.created = gerado

  const ws = wb.addWorksheet('Relatório gerencial', {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  })

  ws.mergeCells(1, 1, 1, COLS)
  const title = ws.getCell(1, 1)
  title.value = `RELATÓRIO GERENCIAL · RECEITA — ${periodo} · ${areaLabel.toUpperCase()}`
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: `FF${WHITE}` } }
  title.fill = fillArgb(BRAND)
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 34
  for (let c = 1; c <= COLS; c++) {
    ws.getCell(1, c).fill = fillArgb(BRAND)
    ws.getCell(1, c).border = thinBorder
  }

  ws.mergeCells(2, 1, 2, COLS)
  const sub = ws.getCell(2, 1)
  sub.value =
    `Todo o previsto do período · grupo, tipo e data de vencimento · ${areaLabel} · Bismarchi Pires`
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: `FF${MUTED}` } }
  sub.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(2).height = 18

  const kpis: Array<[string, string | number, string | undefined]> = [
    ['Linhas', linhas.length, undefined],
    ['Previsto faturado', totalFat, MONEY_FMT],
    ['Valor pago', totalRec, MONEY_FMT],
    ['Inadimplente', totalInad, MONEY_FMT],
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
    val.fill = fillArgb(i === 3 ? INAD_SOFT : WHITE)
    val.alignment = { horizontal: 'center', vertical: 'middle' }
    val.border = thinBorder
    if (numFmt && typeof value === 'number') val.numFmt = numFmt
  })
  ws.mergeCells(4, 4, 4, COLS)
  ws.mergeCells(5, 4, 5, COLS)
  ws.getRow(4).height = 18
  ws.getRow(5).height = 22

  ws.mergeCells(7, 1, 7, COLS)
  const sec = ws.getCell(7, 1)
  sec.value = 'Composição por grupo, tipo de receita e data de vencimento'
  sec.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${BRAND}` } }

  const headers = [
    '#',
    'Grupo',
    'Tipo de receita',
    'Data de vencimento',
    'Receita prevista faturada',
    'Valor pago',
    'Valor inadimplente',
    '% do previsto',
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
  ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: COLS } }

  linhas.forEach((g, i) => {
    const row = 9 + i
    const zebra = i % 2 === 1
    const share = totalFat > 0 ? g.faturado / totalFat : 0
    const venc = vencimentoParaExcel(g.data_vencimento)
    const values: Array<{
      v: string | number | Date
      fmt?: string
      align?: 'left' | 'center' | 'right'
      fill?: string
    }> = [
      { v: i + 1, align: 'center' },
      { v: g.grupo_cliente, align: 'left' },
      { v: g.tipo_receita, align: 'left' },
      { v: venc, fmt: venc instanceof Date ? DATE_FMT : undefined, align: 'center' },
      { v: g.faturado, fmt: MONEY_FMT, align: 'right' },
      { v: g.recebido, fmt: MONEY_FMT, align: 'right', fill: PAGO_SOFT },
      { v: g.inadimplencia, fmt: MONEY_FMT, align: 'right', fill: INAD_SOFT },
      { v: share, fmt: PCT_FMT, align: 'center' },
    ]
    values.forEach((item, c) => {
      const cell = ws.getCell(row, c + 1)
      cell.value = item.v
      cell.font = { name: 'Calibri', size: 10, color: { argb: `FF${TEXT}` } }
      cell.border = thinBorder
      cell.alignment = { vertical: 'middle', horizontal: item.align ?? 'left' }
      cell.fill = fillArgb(item.fill ?? (zebra ? ZEBRA : WHITE))
      if (item.fmt && (typeof item.v === 'number' || item.v instanceof Date)) {
        cell.numFmt = item.fmt
      }
    })
    ws.getRow(row).height = 18
  })

  const totalRow = 9 + linhas.length
  const totalVals: Array<{ v: string | number; fmt?: string; align?: 'left' | 'center' | 'right' }> = [
    { v: '', align: 'center' },
    { v: 'TOTAL', align: 'left' },
    { v: '', align: 'left' },
    { v: '', align: 'center' },
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
  ws.mergeCells(noteRow, 1, noteRow, COLS)
  const note = ws.getCell(noteRow, 1)
  note.value =
    'Critérios: previsto faturado = todos os títulos com vencimento nos meses selecionados. ' +
    'Valor pago = baixa do título (inclui posterior). ' +
    'Inadimplente = título vencido até o corte (ontem) e sem pagamento. Gerado em ' +
    geradoLabel +
    '.'
  note.font = { name: 'Calibri', size: 9, italic: true, color: { argb: `FF${MUTED}` } }
  note.alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(noteRow).height = 36

  ws.getColumn(1).width = 6
  ws.getColumn(2).width = 38
  ws.getColumn(3).width = 28
  ws.getColumn(4).width = 18
  ws.getColumn(5).width = 24
  ws.getColumn(6).width = 16
  ws.getColumn(7).width = 20
  ws.getColumn(8).width = 14

  ws.headerFooter.oddFooter = `&LSIOE · Relatório gerencial&C${periodo}&R&P / &N`

  const safeLabel = meta.periodoLabel.replace(/[^\w-]+/g, '_')
  const safeArea = areaLabel.replace(/[^\w-]+/g, '_').toLowerCase()
  await downloadWorkbook(wb, `relatorio-gerencial-${meta.ano}-${safeLabel}-${safeArea}.xlsx`)
}
