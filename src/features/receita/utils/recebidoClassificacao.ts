import type { ReceitaRecebidoClassificacaoItemRow } from '../types/receita.types'
import {
  agruparRecebidoPorGrupo,
  resolverGrupoCliente,
  valorRecebidoItem,
  type ReceitaRecebidoGrupoAgg,
} from './recebidoGrupos'
import {
  normalizePrevistoVencimentoKey,
  PREVISTO_SEM_VENCIMENTO_KEY,
} from './previstoGrupos'

export type ReceitaRecebidoCategoria = 'inadimplencia' | 'novos_contratos' | 'receita_mes'

export const RECEBIDO_CATEGORIA_ORDER: ReceitaRecebidoCategoria[] = [
  'inadimplencia',
  'novos_contratos',
  'receita_mes',
]

export const RECEBIDO_CATEGORIA_LABELS: Record<ReceitaRecebidoCategoria, string> = {
  inadimplencia: 'Inadimplência recuperada',
  novos_contratos: 'Novos contratos',
  receita_mes: 'Receita do mês',
}

/** Regra fixa — ver `.cursor/rules/receita-recebido-classificacao.mdc` */
export const RECEBIDO_CATEGORIA_DESCRICOES: Record<ReceitaRecebidoCategoria, string> = {
  inadimplencia:
    'Caixa do mês com vencimento em meses anteriores — atrasos pagos agora (extra ao previsto)',
  novos_contratos: '1º recebimento na cota — contratos novos no escritório',
  receita_mes: 'Vencimentos do mês pagos no mês',
}

/** Chaves exibidas no detalhe do sheet (novos split por vencimento). */
export type ReceitaRecebidoDetalheKey =
  | 'inadimplencia'
  | 'receita_mes'
  | 'novos_vencimento_mes'
  | 'novos_vencimento_anterior'

export const RECEBIDO_DETALHE_ORDER: ReceitaRecebidoDetalheKey[] = [
  'inadimplencia',
  'receita_mes',
  'novos_vencimento_mes',
  'novos_vencimento_anterior',
]

export const RECEBIDO_DETALHE_LABELS: Record<ReceitaRecebidoDetalheKey, string> = {
  inadimplencia: RECEBIDO_CATEGORIA_LABELS.inadimplencia,
  receita_mes: RECEBIDO_CATEGORIA_LABELS.receita_mes,
  novos_vencimento_mes: 'Novos contratos — vencimento neste mês',
  novos_vencimento_anterior: 'Novos contratos — vencimento em mês anterior',
}

export const RECEBIDO_DETALHE_DESCRICOES: Record<ReceitaRecebidoDetalheKey, string> = {
  inadimplencia: RECEBIDO_CATEGORIA_DESCRICOES.inadimplencia,
  receita_mes: 'Vencimento e pagamento neste mês (exceto 1º pagamento na cota)',
  novos_vencimento_mes: '1º pagamento na cota com vencimento neste mês — compõe o previsto',
  novos_vencimento_anterior:
    '1º pagamento na cota com vencimento anterior — extra ao previsto do mês',
}

export function isNovosVencimentoMes(
  item: Pick<ReceitaRecebidoClassificacaoItemRow, 'categoria' | 'data_vencimento'>,
  ano: number,
  mes: number,
): boolean {
  if (item.categoria !== 'novos_contratos' || !item.data_vencimento) return false
  const d = new Date(`${item.data_vencimento}T12:00:00`)
  return d.getFullYear() === ano && d.getMonth() + 1 === mes
}

export function filtrarItensDetalheRecebido(
  itens: ReceitaRecebidoClassificacaoItemRow[],
  key: ReceitaRecebidoDetalheKey,
  ano: number,
  mes: number,
): ReceitaRecebidoClassificacaoItemRow[] {
  switch (key) {
    case 'inadimplencia':
      return itens.filter((i) => i.categoria === 'inadimplencia')
    case 'receita_mes':
      return itens.filter((i) => i.categoria === 'receita_mes')
    case 'novos_vencimento_mes':
      return itens.filter((i) => isNovosVencimentoMes(i, ano, mes))
    case 'novos_vencimento_anterior':
      return itens.filter(
        (i) =>
          i.categoria === 'novos_contratos' &&
          (!i.data_vencimento || !isNovosVencimentoMes(i, ano, mes)),
      )
  }
}

export type ReceitaRecebidoDetalheAgg = {
  key: ReceitaRecebidoDetalheKey
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
}

export function agruparRecebidoDetalhe(
  itens: ReceitaRecebidoClassificacaoItemRow[],
  ano: number,
  mes: number,
): ReceitaRecebidoDetalheAgg[] {
  return RECEBIDO_DETALHE_ORDER.map((key) => {
    const filtrados = filtrarItensDetalheRecebido(itens, key, ano, mes)
    const titulos = new Set<number>()
    let total = 0
    for (const item of filtrados) {
      total += valorRecebidoItem(item)
      titulos.add(item.ci_titulo)
    }
    return {
      key,
      total,
      quantidadeTitulos: titulos.size,
      quantidadeItens: filtrados.length,
    }
  }).filter((row) => row.total > 0.009 || row.quantidadeItens > 0)
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

export type ReceitaRecebidoClassificacaoGrupoAgg = ReceitaRecebidoGrupoAgg

export function agruparClassificacaoPorGrupo(
  itens: ReceitaRecebidoClassificacaoItemRow[],
  clienteGrupoMap: Map<string, string>,
  categoria?: ReceitaRecebidoCategoria,
): ReceitaRecebidoClassificacaoGrupoAgg[] {
  const filtrados = categoria ? itens.filter((i) => i.categoria === categoria) : itens
  return agruparRecebidoPorGrupo(filtrados, clienteGrupoMap)
}

export function agruparClassificacaoPorTitulo(
  itens: ReceitaRecebidoClassificacaoItemRow[],
  categoria?: ReceitaRecebidoCategoria,
  grupo?: string,
  clienteGrupoMap?: Map<string, string>,
): ReceitaRecebidoClassificacaoTituloAgg[] {
  let filtrados = categoria ? itens.filter((i) => i.categoria === categoria) : itens
  if (grupo && clienteGrupoMap) {
    filtrados = filtrados.filter(
      (i) => resolverGrupoCliente(i.cliente, clienteGrupoMap) === grupo,
    )
  }
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

export type ReceitaRecebidoVencimentoGrupoAgg = {
  vencimentoKey: string
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
  qtd_grupos: number
  grupos: ReceitaRecebidoGrupoAgg[]
}

function ordenarChavesVencimentoRecebido(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === PREVISTO_SEM_VENCIMENTO_KEY) return 1
    if (b === PREVISTO_SEM_VENCIMENTO_KEY) return -1
    return a.localeCompare(b)
  })
}

/** Recebido por vencimento e grupo (mesma hierarquia do drill de previsto/inad.). */
export function agruparRecebidoPorVencimentoEGrupo(
  itens: ReceitaRecebidoClassificacaoItemRow[],
  clienteGrupoMap: Map<string, string>,
): ReceitaRecebidoVencimentoGrupoAgg[] {
  const byVenc = new Map<string, ReceitaRecebidoClassificacaoItemRow[]>()
  for (const item of itens) {
    const key = normalizePrevistoVencimentoKey(item.data_vencimento)
    const list = byVenc.get(key) ?? []
    list.push(item)
    byVenc.set(key, list)
  }

  return ordenarChavesVencimentoRecebido([...byVenc.keys()]).map((vencimentoKey) => {
    const vencItens = byVenc.get(vencimentoKey) ?? []
    const grupos = agruparRecebidoPorGrupo(vencItens, clienteGrupoMap)
    return {
      vencimentoKey,
      total: grupos.reduce((s, g) => s + g.total, 0),
      quantidadeTitulos: new Set(vencItens.map((i) => i.ci_titulo)).size,
      quantidadeItens: vencItens.length,
      qtd_grupos: grupos.length,
      grupos,
    }
  })
}

export type ReceitaRecebidoGrupoComVencAgg = {
  grupo: string
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
  qtd_vencimentos: number
  vencimentos: Array<{
    vencimentoKey: string
    total: number
    quantidadeTitulos: number
    quantidadeItens: number
  }>
}

/** Inverte vencimento→grupos para grupo→vencimentos (toggle Por grupo). */
export function agruparRecebidoPorGrupoComVencimentos(
  vencimentos: ReceitaRecebidoVencimentoGrupoAgg[],
): ReceitaRecebidoGrupoComVencAgg[] {
  const byGrupo = new Map<string, ReceitaRecebidoGrupoComVencAgg>()
  for (const venc of vencimentos) {
    for (const g of venc.grupos) {
      const cur = byGrupo.get(g.grupo) ?? {
        grupo: g.grupo,
        total: 0,
        quantidadeTitulos: 0,
        quantidadeItens: 0,
        qtd_vencimentos: 0,
        vencimentos: [],
      }
      cur.total += g.total
      cur.quantidadeTitulos += g.quantidadeTitulos
      cur.quantidadeItens += g.quantidadeItens
      cur.qtd_vencimentos += 1
      cur.vencimentos.push({
        vencimentoKey: venc.vencimentoKey,
        total: g.total,
        quantidadeTitulos: g.quantidadeTitulos,
        quantidadeItens: g.quantidadeItens,
      })
      byGrupo.set(g.grupo, cur)
    }
  }

  return [...byGrupo.values()]
    .map((g) => ({
      ...g,
      vencimentos: [...g.vencimentos].sort((a, b) => {
        if (a.vencimentoKey === PREVISTO_SEM_VENCIMENTO_KEY) return 1
        if (b.vencimentoKey === PREVISTO_SEM_VENCIMENTO_KEY) return -1
        return a.vencimentoKey.localeCompare(b.vencimentoKey)
      }),
    }))
    .sort((a, b) => b.total - a.total || a.grupo.localeCompare(b.grupo, 'pt-BR'))
}

export function gruposComNovosContratos(
  itens: ReceitaRecebidoClassificacaoItemRow[],
  clienteGrupoMap: Map<string, string>,
): Set<string> {
  const set = new Set<string>()
  for (const item of itens) {
    if (item.categoria !== 'novos_contratos') continue
    set.add(resolverGrupoCliente(item.cliente, clienteGrupoMap))
  }
  return set
}

export function isItemPrevistoContratoNovo(
  item: { cliente: string | null; contrato_novo?: boolean | null },
  gruposNovos: Set<string>,
  clienteGrupoMap: Map<string, string>,
): boolean {
  if (item.contrato_novo) return true
  return gruposNovos.has(resolverGrupoCliente(item.cliente, clienteGrupoMap))
}

/** Soma das três categorias de recebido no mês. */
export function somaRecebidoClassificado(
  categorias: ReceitaRecebidoCategoriaAgg[],
): number {
  return categorias.reduce((s, c) => s + c.total, 0)
}
