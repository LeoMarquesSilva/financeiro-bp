import { resolverGrupoCliente } from './recebidoGrupos'
import type { ReceitaPrevistoGrupoAgg } from './previstoGrupos'
import type { ReceitaPrevistoItemRow } from '../types/receita.types'
import { formatDate } from '@/shared/utils/format'

type ExportMeta = {
  ano: number
  mes: number
  mesLabel: string
  areaKey: string
  areaLabel: string
}

export async function exportAreaPrevistoGrupoExcel(
  grupos: ReceitaPrevistoGrupoAgg[],
  itens: ReceitaPrevistoItemRow[],
  clienteGrupoMap: Map<string, string>,
  meta: ExportMeta,
): Promise<void> {
  const XLSX = await import('xlsx')

  const grupoRows = grupos.map((g) => ({
    Grupo: g.grupo,
    'Total (R$)': g.total,
    Títulos: g.quantidadeTitulos,
    Itens: g.quantidadeItens,
  }))
  const totalGrupos = grupos.reduce((s, g) => s + g.total, 0)
  grupoRows.push({
    Grupo: 'TOTAL',
    'Total (R$)': totalGrupos,
    Títulos: grupos.reduce((s, g) => s + g.quantidadeTitulos, 0),
    Itens: grupos.reduce((s, g) => s + g.quantidadeItens, 0),
  })

  const itemRows = itens.map((item) => ({
    Grupo: resolverGrupoCliente(item.cliente, clienteGrupoMap),
    Cliente: item.cliente ?? '',
    'Nº título': item.nro_titulo ?? '',
    'CI título': item.ci_titulo,
    Descrição: item.descricao ?? '',
    'Data vencimento': formatDate(item.data_vencimento),
    'Valor (R$)': item.valor_item,
    'Plano de contas': item.plano_contas,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grupoRows), 'Grupos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), 'Itens')

  const safeArea = meta.areaKey.replace(/[^\w-]+/g, '_')
  const safeMes = meta.mesLabel.replace(/[^\w-]+/g, '_').toLowerCase()
  XLSX.writeFile(wb, `previsto-${safeArea}-${meta.ano}-${safeMes}.xlsx`)
}
