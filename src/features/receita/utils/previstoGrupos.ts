import type { ReceitaPrevistoItemRow } from '../types/receita.types'
import { resolverGrupoCliente } from './recebidoGrupos'

export type ReceitaPrevistoGrupoAgg = {
  grupo: string
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
}

export type ReceitaPrevistoTituloAgg = {
  ci_titulo: number
  nro_titulo: string | null
  cliente: string | null
  descricao: string | null
  data_vencimento: string | null
  total: number
  quantidadeItens: number
}

export function agruparPrevistoPorGrupo(
  itens: ReceitaPrevistoItemRow[],
  clienteGrupoMap: Map<string, string>,
): ReceitaPrevistoGrupoAgg[] {
  const byGrupo = new Map<string, { total: number; titulos: Set<number>; itens: number }>()

  for (const item of itens) {
    const grupo = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const cur = byGrupo.get(grupo) ?? { total: 0, titulos: new Set<number>(), itens: 0 }
    cur.total += item.valor_item
    cur.titulos.add(item.ci_titulo)
    cur.itens += 1
    byGrupo.set(grupo, cur)
  }

  return [...byGrupo.entries()]
    .map(([grupo, v]) => ({
      grupo,
      total: v.total,
      quantidadeTitulos: v.titulos.size,
      quantidadeItens: v.itens,
    }))
    .sort((a, b) => b.total - a.total)
}

export function agruparPrevistoPorTitulo(
  itens: ReceitaPrevistoItemRow[],
  grupo: string,
  clienteGrupoMap: Map<string, string>,
): ReceitaPrevistoTituloAgg[] {
  const filtrados = itens.filter(
    (i) => resolverGrupoCliente(i.cliente, clienteGrupoMap) === grupo,
  )
  const byTitulo = new Map<number, ReceitaPrevistoTituloAgg>()

  for (const item of filtrados) {
    const cur = byTitulo.get(item.ci_titulo)
    if (!cur) {
      byTitulo.set(item.ci_titulo, {
        ci_titulo: item.ci_titulo,
        nro_titulo: item.nro_titulo,
        cliente: item.cliente,
        descricao: item.descricao,
        data_vencimento: item.data_vencimento,
        total: item.valor_item,
        quantidadeItens: 1,
      })
      continue
    }
    cur.total += item.valor_item
    cur.quantidadeItens += 1
    if (!cur.nro_titulo && item.nro_titulo) cur.nro_titulo = item.nro_titulo
    if (!cur.descricao && item.descricao) cur.descricao = item.descricao
    if (
      item.data_vencimento &&
      (!cur.data_vencimento || item.data_vencimento < cur.data_vencimento)
    ) {
      cur.data_vencimento = item.data_vencimento
    }
  }

  return [...byTitulo.values()].sort((a, b) => b.total - a.total)
}
