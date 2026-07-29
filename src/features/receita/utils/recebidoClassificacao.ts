import type { ReceitaRecebidoClassificacaoItemRow } from '../types/receita.types'
import { valorRecebidoItem } from './recebidoGrupos'

export type ReceitaRecebidoCategoria = 'inadimplencia' | 'novos_contratos' | 'receita_mes'

export const RECEBIDO_CATEGORIA_ORDER: ReceitaRecebidoCategoria[] = [
  'inadimplencia',
  'novos_contratos',
  'receita_mes',
]

export const RECEBIDO_CATEGORIA_LABELS: Record<ReceitaRecebidoCategoria, string> = {
  inadimplencia: 'Inadimplência',
  novos_contratos: 'Novos contratos',
  receita_mes: 'Receita do mês',
}

export const RECEBIDO_CATEGORIA_DESCRICOES: Record<ReceitaRecebidoCategoria, string> = {
  inadimplencia: 'Recebidos no mês com vencimento anterior ao mês',
  novos_contratos: '1º recebimento na cota — contratos novos no escritório',
  receita_mes: 'Vencimentos do mês pagos no mês',
}

export type ReceitaRecebidoCategoriaAgg = {
  categoria: ReceitaRecebidoCategoria
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
}

export type ReceitaRecebidoClassificacaoTituloAgg = {
  ci_titulo: number
  nro_titulo: string | null
  cliente: string | null
  descricao: string | null
  data_pagamento: string | null
  data_vencimento: string | null
  total: number
  quantidadeItens: number
}

export function agruparRecebidoPorCategoria(
  itens: ReceitaRecebidoClassificacaoItemRow[],
): ReceitaRecebidoCategoriaAgg[] {
  const byCat = new Map<
    ReceitaRecebidoCategoria,
    { total: number; titulos: Set<number>; itens: number }
  >()

  for (const item of itens) {
    const cat = item.categoria
    const cur = byCat.get(cat) ?? { total: 0, titulos: new Set<number>(), itens: 0 }
    cur.total += valorRecebidoItem(item)
    cur.titulos.add(item.ci_titulo)
    cur.itens += 1
    byCat.set(cat, cur)
  }

  return RECEBIDO_CATEGORIA_ORDER.filter((c) => byCat.has(c)).map((categoria) => {
    const v = byCat.get(categoria)!
    return {
      categoria,
      total: v.total,
      quantidadeTitulos: v.titulos.size,
      quantidadeItens: v.itens,
    }
  })
}

export function agruparClassificacaoPorTitulo(
  itens: ReceitaRecebidoClassificacaoItemRow[],
  categoria?: ReceitaRecebidoCategoria,
): ReceitaRecebidoClassificacaoTituloAgg[] {
  const filtrados = categoria ? itens.filter((i) => i.categoria === categoria) : itens
  const byTitulo = new Map<number, ReceitaRecebidoClassificacaoTituloAgg>()

  for (const item of filtrados) {
    const cur = byTitulo.get(item.ci_titulo)
    if (!cur) {
      byTitulo.set(item.ci_titulo, {
        ci_titulo: item.ci_titulo,
        nro_titulo: item.nro_titulo,
        cliente: item.cliente,
        descricao: item.descricao,
        data_pagamento: item.data_pagamento,
        data_vencimento: item.data_vencimento,
        total: valorRecebidoItem(item),
        quantidadeItens: 1,
      })
      continue
    }
    cur.total += valorRecebidoItem(item)
    cur.quantidadeItens += 1
    if (!cur.nro_titulo && item.nro_titulo) cur.nro_titulo = item.nro_titulo
    if (!cur.descricao && item.descricao) cur.descricao = item.descricao
    if (
      item.data_pagamento &&
      (!cur.data_pagamento || item.data_pagamento > cur.data_pagamento)
    ) {
      cur.data_pagamento = item.data_pagamento
    }
    if (
      item.data_vencimento &&
      (!cur.data_vencimento || item.data_vencimento < cur.data_vencimento)
    ) {
      cur.data_vencimento = item.data_vencimento
    }
  }

  return [...byTitulo.values()].sort((a, b) => b.total - a.total)
}

/** Soma das três categorias de recebido no mês. */
export function somaRecebidoClassificado(
  categorias: ReceitaRecebidoCategoriaAgg[],
): number {
  return categorias.reduce((s, c) => s + c.total, 0)
}
