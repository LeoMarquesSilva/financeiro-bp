import { GRUPO_SEM_NOME } from '@/features/escritorio/services/escritorioService'
import type { ReceitaRecebidoItemRow } from '../types/receita.types'

export type ReceitaRecebidoGrupoAgg = {
  grupo: string
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
}

export type ReceitaRecebidoTituloAgg = {
  ci_titulo: number
  nro_titulo: string | null
  cliente: string | null
  descricao: string | null
  data_pagamento: string | null
  total: number
  quantidadeItens: number
}

/** Normaliza nome de empresa/cliente para lookup no índice de pessoas. */
export function normalizarNomeCliente(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

/** Mapa nome normalizado → grupo exibido (a partir de escritorio_empresas_por_grupo). */
export function buildClienteGrupoMap(
  empresas: Array<{ nome: string; grupo_cliente: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of empresas) {
    const nome = e.nome?.trim()
    if (!nome) continue
    const raw = e.grupo_cliente?.trim() ?? ''
    const display = raw === '' ? GRUPO_SEM_NOME : raw
    const norm = normalizarNomeCliente(nome)
    if (!map.has(norm)) map.set(norm, display)
  }
  return map
}

export function resolverGrupoCliente(
  cliente: string | null | undefined,
  clienteGrupoMap: Map<string, string>,
): string {
  const nome = cliente?.trim()
  if (!nome) return GRUPO_SEM_NOME
  return clienteGrupoMap.get(normalizarNomeCliente(nome)) ?? GRUPO_SEM_NOME
}

export function agruparRecebidoPorGrupo(
  itens: ReceitaRecebidoItemRow[],
  clienteGrupoMap: Map<string, string>,
): ReceitaRecebidoGrupoAgg[] {
  const byGrupo = new Map<string, { total: number; titulos: Set<number>; itens: number }>()

  for (const item of itens) {
    const grupo = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const cur = byGrupo.get(grupo) ?? { total: 0, titulos: new Set<number>(), itens: 0 }
    cur.total += item.valor_pago_item
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

export function agruparRecebidoPorTitulo(
  itens: ReceitaRecebidoItemRow[],
  grupo: string,
  clienteGrupoMap: Map<string, string>,
): ReceitaRecebidoTituloAgg[] {
  const filtrados = itens.filter(
    (i) => resolverGrupoCliente(i.cliente, clienteGrupoMap) === grupo,
  )
  const byTitulo = new Map<number, ReceitaRecebidoTituloAgg>()

  for (const item of filtrados) {
    const cur = byTitulo.get(item.ci_titulo)
    if (!cur) {
      byTitulo.set(item.ci_titulo, {
        ci_titulo: item.ci_titulo,
        nro_titulo: item.nro_titulo,
        cliente: item.cliente,
        descricao: item.descricao,
        data_pagamento: item.data_pagamento,
        total: item.valor_pago_item,
        quantidadeItens: 1,
      })
      continue
    }
    cur.total += item.valor_pago_item
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
