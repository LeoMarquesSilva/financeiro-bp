import { parseDateAsLocal } from '@/shared/utils/format'
import { MESES_LONGOS } from '../constants'
import type { OpexLancamentoRow, OpexOrcamentoLinha } from '../types/opex.types'
import { parseFornecedorDescricao } from './opexOrcamentoGrouping'
import { departamentoLabel } from './departamentoLabel'
import { mesNoPainelOpex } from './opexPeriodo'
import { planoExcluido, temPlanoFiltroAtivo, type OpexPlanoFiltroState } from './opexPlanoFiltro'

type ExcelCell = string | number | Date | null

type ExportInput = {
  ano: number
  mesesFiltro: number[]
  mesAtual: number
  planoFiltro: OpexPlanoFiltroState
  periodoLabel: string
}

type Coluna = {
  header: string
  width: number
  money?: boolean
  date?: boolean
}

const LANCAMENTO_COLUNAS: Coluna[] = [
  { header: 'Plano', width: 36 },
  { header: 'Subplano', width: 36 },
  { header: 'Nº conta', width: 14 },
  { header: 'Fixo', width: 10 },
  { header: 'Ano', width: 10 },
  { header: 'Mês vencimento', width: 18 },
  { header: 'Mês pagamento', width: 18 },
  { header: 'Data vencimento', width: 18, date: true },
  { header: 'Data pagamento', width: 18, date: true },
  { header: 'Nº título', width: 16 },
  { header: 'CI título', width: 12 },
  { header: 'CI item', width: 12 },
  { header: 'Descrição', width: 42 },
  { header: 'Fornecedor', width: 32 },
  { header: 'Departamento', width: 24 },
  { header: 'Situação', width: 18 },
  { header: 'Previsto VIOS (R$)', width: 20, money: true },
  { header: 'Realizado (R$)', width: 18, money: true },
]

const ORCAMENTO_COLUNAS: Coluna[] = [
  { header: 'Plano', width: 36 },
  { header: 'Subplano', width: 36 },
  { header: 'Nº conta', width: 14 },
  { header: 'Fixo', width: 10 },
  { header: 'Ano', width: 10 },
  { header: 'Mês', width: 18 },
  { header: 'Fornecedor', width: 32 },
  { header: 'Departamento', width: 24 },
  { header: 'Descrição', width: 42 },
  { header: 'Referência', width: 22 },
  { header: 'Orçamento (R$)', width: 18, money: true },
]

const HEADER_FILL = 'FF1E293B'
const TOTAL_FILL = 'FFF8FAFC'
const MONEY_FMT = '"R$" #,##0.00'
const DATE_FMT = 'dd/mm/yyyy'

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function mesCompetenciaLabel(mes: number | null): string {
  if (mes == null || mes < 1 || mes > 12) return ''
  return `${String(mes).padStart(2, '0')} - ${MESES_LONGOS[mes - 1]}`
}

export function nomeArquivoOpexExport(periodoLabel: string): string {
  const slug = periodoLabel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `opex-lancamentos-${slug || 'periodo'}.xlsx`
}

export function ordenarLancamentos(rows: OpexLancamentoRow[]): OpexLancamentoRow[] {
  return [...rows].sort(
    (a, b) =>
      a.grupo_conta.localeCompare(b.grupo_conta, 'pt-BR') ||
      a.plano_contas.localeCompare(b.plano_contas, 'pt-BR') ||
      a.conta_numero.localeCompare(b.conta_numero, 'pt-BR') ||
      (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? '') ||
      a.ci_item - b.ci_item,
  )
}

export function filtrarOrcamentoExport(
  linhas: OpexOrcamentoLinha[],
  mesesFiltro: number[],
  mesAtual: number,
  planoFiltro: OpexPlanoFiltroState,
): OpexOrcamentoLinha[] {
  return linhas
    .filter((linha) => mesNoPainelOpex(linha.mes, mesesFiltro, mesAtual))
    .filter((linha) => !planoExcluido(linha.grupo_conta, linha.plano_contas, planoFiltro))
    .sort(
      (a, b) =>
        a.grupo_conta.localeCompare(b.grupo_conta, 'pt-BR') ||
        a.plano_contas.localeCompare(b.plano_contas, 'pt-BR') ||
        a.mes - b.mes ||
        a.descricao.localeCompare(b.descricao, 'pt-BR') ||
        a.id.localeCompare(b.id),
    )
}

export function linhaLancamentoExcel(item: OpexLancamentoRow, ano: number): Record<string, ExcelCell> {
  return {
    Plano: item.grupo_conta,
    Subplano: item.plano_contas,
    'Nº conta': item.conta_numero,
    Fixo: item.fixo ? 'Sim' : 'Não',
    Ano: ano,
    'Mês vencimento': mesCompetenciaLabel(item.mes_vencimento),
    'Mês pagamento': mesCompetenciaLabel(item.mes_pagamento),
    'Data vencimento': parseDateAsLocal(item.data_vencimento),
    'Data pagamento': parseDateAsLocal(item.data_pagamento),
    'Nº título': item.nro_titulo,
    'CI título': item.ci_titulo || null,
    'CI item': item.ci_item || null,
    Descrição: item.descricao,
    Fornecedor: item.fornecedor,
    Departamento: departamentoLabel(item.departamento),
    Situação: item.situacao_titulo,
    'Previsto VIOS (R$)': round2(item.valor_previsto_vios),
    'Realizado (R$)': round2(item.valor_realizado),
  }
}

export function linhaOrcamentoExcel(linha: OpexOrcamentoLinha): Record<string, ExcelCell> {
  const { fornecedor, descricaoDetalhe } = parseFornecedorDescricao(linha)
  return {
    Plano: linha.grupo_conta,
    Subplano: linha.plano_contas,
    'Nº conta': linha.conta_numero,
    Fixo: linha.fixo ? 'Sim' : 'Não',
    Ano: linha.ano,
    Mês: mesCompetenciaLabel(linha.mes),
    Fornecedor: fornecedor,
    Departamento: departamentoLabel(linha.departamento),
    Descrição: descricaoDetalhe,
    Referência: linha.titulo_ref,
    'Orçamento (R$)': round2(linha.valor),
  }
}

function colLetter(index: number): string {
  let n = index
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function montarAba(
  wb: import('exceljs').Workbook,
  nome: string,
  colunas: Coluna[],
  linhas: Record<string, ExcelCell>[],
): void {
  const ws = wb.addWorksheet(nome)
  ws.columns = colunas.map((col) => ({
    header: col.header,
    key: col.header,
    width: col.width,
  }))

  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  header.alignment = { vertical: 'middle' }
  header.height = 22

  for (const col of colunas) {
    const column = ws.getColumn(col.header)
    if (col.money) column.numFmt = MONEY_FMT
    if (col.date) column.numFmt = DATE_FMT
  }

  for (const linha of linhas) ws.addRow(linha)

  const lastData = linhas.length + 1
  if (linhas.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastData, column: colunas.length },
    }
  }
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]

  const total = ws.getRow(lastData + 1)
  total.getCell(1).value = 'TOTAL'
  total.font = { bold: true }
  total.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }
  colunas.forEach((col, index) => {
    if (!col.money) return
    const letter = colLetter(index + 1)
    const cell = total.getCell(index + 1)
    const result = round2(
      linhas.reduce((acc, linha) => acc + (Number(linha[col.header]) || 0), 0),
    )
    cell.value = linhas.length
      ? { formula: `SUBTOTAL(109,${letter}2:${letter}${lastData})`, result }
      : 0
    cell.numFmt = MONEY_FMT
  })
}

function soma(valores: number[]): number {
  return round2(valores.reduce((acc, valor) => acc + valor, 0))
}

export async function buildOpexExportWorkbook(input: {
  ano: number
  periodoLabel: string
  planoFiltroAtivo: boolean
  lancamentos: OpexLancamentoRow[]
  orcamento: OpexOrcamentoLinha[]
}): Promise<import('exceljs').Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const lancamentos = ordenarLancamentos(input.lancamentos)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIOE'
  wb.created = new Date()

  montarAba(
    wb,
    'Lançamentos',
    LANCAMENTO_COLUNAS,
    lancamentos.map((item) => linhaLancamentoExcel(item, input.ano)),
  )
  montarAba(
    wb,
    'Orçamento',
    ORCAMENTO_COLUNAS,
    input.orcamento.map((linha) => linhaOrcamentoExcel(linha)),
  )

  const conferencia = wb.addWorksheet('Conferência')
  conferencia.columns = [
    { header: 'Campo', key: 'campo', width: 28 },
    { header: 'Valor', key: 'valor', width: 42 },
  ]
  const header = conferencia.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }

  const linhasConferencia: Array<[string, ExcelCell]> = [
    ['Período', input.periodoLabel],
    ['Filtro de planos', input.planoFiltroAtivo ? 'Ativo no painel' : 'Todos os planos'],
    ['Lançamentos', lancamentos.length],
    ['Realizado (R$)', soma(lancamentos.map((item) => item.valor_realizado))],
    ['Previsto VIOS (R$)', soma(lancamentos.map((item) => item.valor_previsto_vios))],
    ['Linhas de orçamento', input.orcamento.length],
    ['Orçamento (R$)', soma(input.orcamento.map((linha) => linha.valor))],
    ['Plano', 'Grupo de contas'],
    ['Subplano', 'Plano de contas'],
    [
      'Leitura',
      'Cada linha da aba Lançamentos é um item do VIOS. Realizado entra pelo mês do pagamento e previsto VIOS pelo mês do vencimento, no mesmo recorte dos cards. A linha TOTAL acompanha o filtro do Excel.',
    ],
  ]
  for (const [campo, valor] of linhasConferencia) {
    const row = conferencia.addRow({ campo, valor })
    if (typeof valor === 'number' && campo.includes('R$')) {
      row.getCell(2).numFmt = MONEY_FMT
    }
  }
  conferencia.getColumn(2).alignment = { wrapText: true, vertical: 'top' }
  conferencia.getRow(linhasConferencia.length + 1).height = 48

  return wb
}

async function downloadWorkbook(wb: import('exceljs').Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
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

export async function exportOpexLancamentosExcel(input: ExportInput): Promise<void> {
  const [{ opexService }, { opexOrcamentoService }] = await Promise.all([
    import('../services/opexService'),
    import('../services/opexOrcamentoService'),
  ])
  const [lancamentos, linhasOrcamento] = await Promise.all([
    opexService.fetchLancamentosPeriodo(input.ano, input.mesesFiltro, input.planoFiltro),
    opexOrcamentoService.listLinhas(input.ano),
  ])
  const orcamento = filtrarOrcamentoExport(
    linhasOrcamento,
    input.mesesFiltro,
    input.mesAtual,
    input.planoFiltro,
  )
  const wb = await buildOpexExportWorkbook({
    ano: input.ano,
    periodoLabel: input.periodoLabel,
    planoFiltroAtivo: temPlanoFiltroAtivo(input.planoFiltro),
    lancamentos,
    orcamento,
  })
  await downloadWorkbook(wb, nomeArquivoOpexExport(input.periodoLabel))
}
