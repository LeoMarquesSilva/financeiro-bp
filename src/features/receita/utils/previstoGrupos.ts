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

export type ReceitaPrevistoGrupoQuitadoAgg = {
  grupo: string
  previsto: number
  quitado_no_mes: number
  em_aberto: number
  quantidadeTitulos: number
  quantidadeItens: number
}

function pagamentoNoMes(dataPagamento: string | null, ano: number, mes: number): boolean {
  if (!dataPagamento) return false
  const d = new Date(`${dataPagamento}T12:00:00`)
  return d.getFullYear() === ano && d.getMonth() + 1 === mes
}

export function agruparPrevistoGrupoComQuitado(
  itens: Array<{ cliente: string | null; ci_titulo: number; valor_item: number; data_pagamento?: string | null }>,
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
): ReceitaPrevistoGrupoQuitadoAgg[] {
  const byGrupo = new Map<
    string,
    {
      previsto: number
      quitado_no_mes: number
      em_aberto: number
      titulos: Set<number>
      itens: number
    }
  >()

  for (const item of itens) {
    const grupo = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const cur = byGrupo.get(grupo) ?? {
      previsto: 0,
      quitado_no_mes: 0,
      em_aberto: 0,
      titulos: new Set<number>(),
      itens: 0,
    }
    cur.previsto += item.valor_item
    if (pagamentoNoMes(item.data_pagamento ?? null, ano, mes)) {
      cur.quitado_no_mes += item.valor_item
    } else if (!item.data_pagamento) {
      cur.em_aberto += item.valor_item
    }
    cur.titulos.add(item.ci_titulo)
    cur.itens += 1
    byGrupo.set(grupo, cur)
  }

  return [...byGrupo.entries()]
    .map(([grupo, v]) => ({
      grupo,
      previsto: v.previsto,
      quitado_no_mes: v.quitado_no_mes,
      em_aberto: v.em_aberto,
      quantidadeTitulos: v.titulos.size,
      quantidadeItens: v.itens,
    }))
    .sort((a, b) => b.previsto - a.previsto)
}

export function agruparPrevistoTituloComQuitado(
  itens: Array<{
    ci_titulo: number
    nro_titulo: string | null
    cliente: string | null
    descricao: string | null
    data_vencimento: string | null
    data_pagamento?: string | null
    valor_item: number
  }>,
  grupo: string,
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
): Array<ReceitaPrevistoTituloAgg & { quitado_no_mes: number; em_aberto: number; data_pagamento: string | null }> {
  const filtrados = itens.filter(
    (i) => resolverGrupoCliente(i.cliente, clienteGrupoMap) === grupo,
  )
  const byTitulo = new Map<
    number,
    ReceitaPrevistoTituloAgg & { quitado_no_mes: number; em_aberto: number; data_pagamento: string | null }
  >()

  for (const item of filtrados) {
    const quitado = pagamentoNoMes(item.data_pagamento ?? null, ano, mes)
    const aberto = !item.data_pagamento
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
        quitado_no_mes: quitado ? item.valor_item : 0,
        em_aberto: aberto ? item.valor_item : 0,
        data_pagamento: item.data_pagamento ?? null,
      })
      continue
    }
    cur.total += item.valor_item
    cur.quantidadeItens += 1
    if (quitado) cur.quitado_no_mes += item.valor_item
    if (aberto) cur.em_aberto += item.valor_item
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
