import type { ReceitaRecebidoSemAreaItemRow } from '../types/receita.types'

export type ReceitaSemAreaDepartamentoAgg = {
  departamento: string
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
}

export type ReceitaSemAreaTituloAgg = {
  ci_titulo: number
  nro_titulo: string | null
  cliente: string | null
  descricao: string | null
  data_pagamento: string | null
  plano_contas: string
  total: number
  quantidadeItens: number
}

export function agruparSemAreaPorDepartamento(
  itens: ReceitaRecebidoSemAreaItemRow[],
): ReceitaSemAreaDepartamentoAgg[] {
  const byDep = new Map<string, { total: number; titulos: Set<number>; itens: number }>()

  for (const item of itens) {
    const dep = item.departamento || 'Sem departamento'
    const cur = byDep.get(dep) ?? { total: 0, titulos: new Set<number>(), itens: 0 }
    cur.total += item.valor_recebido
    cur.titulos.add(item.ci_titulo)
    cur.itens += 1
    byDep.set(dep, cur)
  }

  return [...byDep.entries()]
    .map(([departamento, v]) => ({
      departamento,
      total: v.total,
      quantidadeTitulos: v.titulos.size,
      quantidadeItens: v.itens,
    }))
    .sort((a, b) => b.total - a.total)
}

export function agruparSemAreaPorTitulo(
  itens: ReceitaRecebidoSemAreaItemRow[],
  departamento: string,
): ReceitaSemAreaTituloAgg[] {
  const filtrados = itens.filter((i) => (i.departamento || 'Sem departamento') === departamento)
  const byTitulo = new Map<number, ReceitaSemAreaTituloAgg>()

  for (const item of filtrados) {
    const cur = byTitulo.get(item.ci_titulo)
    if (!cur) {
      byTitulo.set(item.ci_titulo, {
        ci_titulo: item.ci_titulo,
        nro_titulo: item.nro_titulo,
        cliente: item.cliente,
        descricao: item.descricao,
        data_pagamento: item.data_pagamento,
        plano_contas: item.plano_contas,
        total: item.valor_recebido,
        quantidadeItens: 1,
      })
      continue
    }
    cur.total += item.valor_recebido
    cur.quantidadeItens += 1
    if (!cur.nro_titulo && item.nro_titulo) cur.nro_titulo = item.nro_titulo
    if (!cur.descricao && item.descricao) cur.descricao = item.descricao
    if (
      item.data_pagamento &&
      (!cur.data_pagamento || item.data_pagamento > cur.data_pagamento)
    ) {
      cur.data_pagamento = item.data_pagamento
    }
  }

  return [...byTitulo.values()].sort((a, b) => b.total - a.total)
}
