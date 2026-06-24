import type { ReceitaInadimplenciaClientePeriodo } from '../types/receitaInadimplencia.types'

type ExportMeta = {
  periodoLabel: string
  ano: number
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
