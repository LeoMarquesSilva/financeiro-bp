import type { ReceitaPrevistoItemRow } from '../types/receita.types'
import { inadimplenciaItemMesFaturadoNaoPago } from './receitaPrevistoFechamento'
import { resolverGrupoCliente } from './recebidoGrupos'

export const PREVISTO_SEM_VENCIMENTO_KEY = '__sem_vencimento__'

export function normalizePrevistoVencimentoKey(
  data_vencimento: string | null | undefined,
): string {
  if (!data_vencimento?.trim()) return PREVISTO_SEM_VENCIMENTO_KEY
  return data_vencimento.trim().slice(0, 10)
}

type PrevistoItemComVencimento = {
  cliente: string | null
  ci_titulo: number
  valor_item: number
  data_vencimento?: string | null
  data_pagamento?: string | null
  contrato_novo?: boolean
}

function agruparItensPrevistoPorVencimento<T extends PrevistoItemComVencimento>(
  itens: T[],
): Map<string, T[]> {
  const byVenc = new Map<string, T[]>()
  for (const item of itens) {
    const key = normalizePrevistoVencimentoKey(item.data_vencimento)
    const list = byVenc.get(key) ?? []
    list.push(item)
    byVenc.set(key, list)
  }
  return byVenc
}

function ordenarChavesVencimento(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === PREVISTO_SEM_VENCIMENTO_KEY) return 1
    if (b === PREVISTO_SEM_VENCIMENTO_KEY) return -1
    return a.localeCompare(b)
  })
}

export type ReceitaPrevistoVencimentoGrupoAgg = {
  vencimentoKey: string
  total: number
  quantidadeTitulos: number
  quantidadeItens: number
  grupos: ReceitaPrevistoGrupoAgg[]
}

export type ReceitaPrevistoVencimentoQuitadoAgg = {
  vencimentoKey: string
  previsto: number
  quitado_no_mes: number
  em_aberto: number
  inadimplencia: number
  quantidadeTitulos: number
  quantidadeItens: number
  contrato_novo: boolean
  grupos: ReceitaPrevistoGrupoQuitadoAgg[]
}

export type ReceitaPrevistoVencimentoQuitadoSlice = {
  vencimentoKey: string
  previsto: number
  quitado_no_mes: number
  em_aberto: number
  inadimplencia: number
  quantidadeTitulos: number
  quantidadeItens: number
  contrato_novo: boolean
}

export type ReceitaPrevistoGrupoComVencQuitadoAgg = {
  grupo: string
  previsto: number
  quitado_no_mes: number
  em_aberto: number
  inadimplencia: number
  quantidadeTitulos: number
  quantidadeItens: number
  qtd_vencimentos: number
  contrato_novo: boolean
  vencimentos: ReceitaPrevistoVencimentoQuitadoSlice[]
}

export function agruparPrevistoPorVencimentoEGrupo(
  itens: ReceitaPrevistoItemRow[],
  clienteGrupoMap: Map<string, string>,
): ReceitaPrevistoVencimentoGrupoAgg[] {
  const byVenc = agruparItensPrevistoPorVencimento(itens)

  return ordenarChavesVencimento([...byVenc.keys()]).map((vencimentoKey) => {
    const vencItens = byVenc.get(vencimentoKey) ?? []
    const grupos = agruparPrevistoPorGrupo(vencItens, clienteGrupoMap)
    return {
      vencimentoKey,
      total: grupos.reduce((s, g) => s + g.total, 0),
      quantidadeTitulos: new Set(vencItens.map((i) => i.ci_titulo)).size,
      quantidadeItens: vencItens.length,
      grupos,
    }
  })
}

export function agruparPrevistoPorVencimentoComQuitado(
  itens: PrevistoItemComVencimento[],
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
  ref = new Date(),
): ReceitaPrevistoVencimentoQuitadoAgg[] {
  const byVenc = agruparItensPrevistoPorVencimento(itens)

  return ordenarChavesVencimento([...byVenc.keys()]).map((vencimentoKey) => {
    const vencItens = byVenc.get(vencimentoKey) ?? []
    const grupos = agruparPrevistoGrupoComQuitado(vencItens, clienteGrupoMap, ano, mes, ref)
    return {
      vencimentoKey,
      previsto: grupos.reduce((s, g) => s + g.previsto, 0),
      quitado_no_mes: grupos.reduce((s, g) => s + g.quitado_no_mes, 0),
      em_aberto: grupos.reduce((s, g) => s + g.em_aberto, 0),
      inadimplencia: grupos.reduce((s, g) => s + g.inadimplencia, 0),
      quantidadeTitulos: new Set(vencItens.map((i) => i.ci_titulo)).size,
      quantidadeItens: vencItens.length,
      contrato_novo: grupos.some((g) => g.contrato_novo),
      grupos,
    }
  })
}

export function agruparPrevistoQuitadoPorGrupoComVencimentos(
  vencimentos: ReceitaPrevistoVencimentoQuitadoAgg[],
): ReceitaPrevistoGrupoComVencQuitadoAgg[] {
  const byGrupo = new Map<string, ReceitaPrevistoGrupoComVencQuitadoAgg>()
  for (const venc of vencimentos) {
    for (const g of venc.grupos) {
      const cur = byGrupo.get(g.grupo) ?? {
        grupo: g.grupo,
        previsto: 0,
        quitado_no_mes: 0,
        em_aberto: 0,
        inadimplencia: 0,
        quantidadeTitulos: 0,
        quantidadeItens: 0,
        qtd_vencimentos: 0,
        contrato_novo: false,
        vencimentos: [],
      }
      cur.previsto += g.previsto
      cur.quitado_no_mes += g.quitado_no_mes
      cur.em_aberto += g.em_aberto
      cur.inadimplencia += g.inadimplencia
      cur.quantidadeTitulos += g.quantidadeTitulos
      cur.quantidadeItens += g.quantidadeItens
      cur.qtd_vencimentos += 1
      if (g.contrato_novo) cur.contrato_novo = true
      cur.vencimentos.push({
        vencimentoKey: venc.vencimentoKey,
        previsto: g.previsto,
        quitado_no_mes: g.quitado_no_mes,
        em_aberto: g.em_aberto,
        inadimplencia: g.inadimplencia,
        quantidadeTitulos: g.quantidadeTitulos,
        quantidadeItens: g.quantidadeItens,
        contrato_novo: g.contrato_novo,
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
    .sort(
      (a, b) =>
        Number(b.contrato_novo) - Number(a.contrato_novo) ||
        b.previsto - a.previsto ||
        a.grupo.localeCompare(b.grupo, 'pt-BR'),
    )
}

export function filtrarPrevistoItensPorBusca<
  T extends {
    cliente: string | null
    ci_titulo: number
    nro_titulo?: string | null
    descricao?: string | null
  },
>(itens: T[], busca: string, clienteGrupoMap: Map<string, string>): T[] {
  const q = busca.trim().toLowerCase()
  if (!q) return itens
  return itens.filter((item) => {
    const grupo = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    if (grupo.toLowerCase().includes(q)) return true
    const hay = [item.nro_titulo, item.cliente, item.descricao, String(item.ci_titulo)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

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
  inadimplencia: number
  quantidadeTitulos: number
  quantidadeItens: number
  contrato_novo: boolean
}

function pagamentoNoMes(dataPagamento: string | null, ano: number, mes: number): boolean {
  if (!dataPagamento) return false
  const d = new Date(`${dataPagamento}T12:00:00`)
  return d.getFullYear() === ano && d.getMonth() + 1 === mes
}

export function agruparPrevistoGrupoComQuitado(
  itens: Array<{
    cliente: string | null
    ci_titulo: number
    valor_item: number
    data_vencimento?: string | null
    data_pagamento?: string | null
    contrato_novo?: boolean
  }>,
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
  ref = new Date(),
): ReceitaPrevistoGrupoQuitadoAgg[] {
  const byGrupo = new Map<
    string,
    {
      previsto: number
      quitado_no_mes: number
      em_aberto: number
      inadimplencia: number
      titulos: Set<number>
      itens: number
      contrato_novo: boolean
    }
  >()

  for (const item of itens) {
    const grupo = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const cur = byGrupo.get(grupo) ?? {
      previsto: 0,
      quitado_no_mes: 0,
      em_aberto: 0,
      inadimplencia: 0,
      titulos: new Set<number>(),
      itens: 0,
      contrato_novo: false,
    }
    cur.previsto += item.valor_item
    if (pagamentoNoMes(item.data_pagamento ?? null, ano, mes)) {
      cur.quitado_no_mes += item.valor_item
    } else if (!item.data_pagamento) {
      cur.em_aberto += item.valor_item
    }
    cur.inadimplencia += inadimplenciaItemMesFaturadoNaoPago(item, ano, mes, ref)
    cur.titulos.add(item.ci_titulo)
    cur.itens += 1
    if (item.contrato_novo) cur.contrato_novo = true
    byGrupo.set(grupo, cur)
  }

  return [...byGrupo.entries()]
    .map(([grupo, v]) => ({
      grupo,
      previsto: v.previsto,
      quitado_no_mes: v.quitado_no_mes,
      em_aberto: v.em_aberto,
      inadimplencia: v.inadimplencia,
      quantidadeTitulos: v.titulos.size,
      quantidadeItens: v.itens,
      contrato_novo: v.contrato_novo,
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
    contrato_novo?: boolean
  }>,
  grupo: string,
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
  ref = new Date(),
): Array<
  ReceitaPrevistoTituloAgg & {
    quitado_no_mes: number
    em_aberto: number
    inadimplencia: number
    data_pagamento: string | null
    contrato_novo: boolean
  }
> {
  const filtrados = itens.filter(
    (i) => resolverGrupoCliente(i.cliente, clienteGrupoMap) === grupo,
  )
  const byTitulo = new Map<
    number,
    ReceitaPrevistoTituloAgg & {
      quitado_no_mes: number
      em_aberto: number
      inadimplencia: number
      data_pagamento: string | null
      contrato_novo: boolean
    }
  >()

  for (const item of filtrados) {
    const quitado = pagamentoNoMes(item.data_pagamento ?? null, ano, mes)
    const aberto = !item.data_pagamento
    const inadItem = inadimplenciaItemMesFaturadoNaoPago(item, ano, mes, ref)
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
        inadimplencia: inadItem,
        data_pagamento: item.data_pagamento ?? null,
        contrato_novo: Boolean(item.contrato_novo),
      })
      continue
    }
    cur.total += item.valor_item
    cur.quantidadeItens += 1
    if (quitado) cur.quitado_no_mes += item.valor_item
    if (aberto) cur.em_aberto += item.valor_item
    cur.inadimplencia += inadItem
    if (item.contrato_novo) cur.contrato_novo = true
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

export type ReceitaInadMesGrupoAgg = {
  grupo_cliente: string
  data_vencimento: string
  faturado: number
  recebido: number
  inadimplencia: number
  qtd_clientes: number
  qtd_clientes_inad: number
}

export type ReceitaInadMesVencimentoAgg = {
  vencimentoKey: string
  faturado: number
  recebido: number
  inadimplencia: number
  qtd_grupos: number
  grupos: ReceitaInadMesGrupoAgg[]
}

export type ReceitaInadMesGrupoComVencAgg = {
  grupo_cliente: string
  faturado: number
  recebido: number
  inadimplencia: number
  qtd_vencimentos: number
  qtd_clientes_inad: number
  vencimentos: ReceitaInadMesGrupoAgg[]
}

/** Agrupa linhas grupo×vencimento em blocos por data de vencimento. */
export function agruparInadMesFlatPorVencimento(
  linhas: ReceitaInadMesGrupoAgg[],
): ReceitaInadMesVencimentoAgg[] {
  const byVenc = new Map<string, ReceitaInadMesGrupoAgg[]>()
  for (const row of linhas) {
    const list = byVenc.get(row.data_vencimento) ?? []
    list.push(row)
    byVenc.set(row.data_vencimento, list)
  }

  return ordenarChavesVencimento([...byVenc.keys()]).map((vencimentoKey) => {
    const grupos = byVenc.get(vencimentoKey) ?? []
    return {
      vencimentoKey,
      faturado: grupos.reduce((s, g) => s + g.faturado, 0),
      recebido: grupos.reduce((s, g) => s + g.recebido, 0),
      inadimplencia: grupos.reduce((s, g) => s + g.inadimplencia, 0),
      qtd_grupos: grupos.length,
      grupos,
    }
  })
}

/** Agrupa linhas grupo×vencimento em blocos por grupo (vencimentos como filhos). */
export function agruparInadMesPorGrupoComVencimentos(
  linhas: ReceitaInadMesGrupoAgg[],
): ReceitaInadMesGrupoComVencAgg[] {
  const byGrupo = new Map<string, ReceitaInadMesGrupoAgg[]>()
  for (const row of linhas) {
    const list = byGrupo.get(row.grupo_cliente) ?? []
    list.push(row)
    byGrupo.set(row.grupo_cliente, list)
  }

  return [...byGrupo.entries()]
    .map(([grupo_cliente, vencimentos]) => {
      const vencOrdenados = [...vencimentos].sort((a, b) =>
        a.data_vencimento.localeCompare(b.data_vencimento),
      )
      return {
        grupo_cliente,
        faturado: vencOrdenados.reduce((s, v) => s + v.faturado, 0),
        recebido: vencOrdenados.reduce((s, v) => s + v.recebido, 0),
        inadimplencia: vencOrdenados.reduce((s, v) => s + v.inadimplencia, 0),
        qtd_vencimentos: vencOrdenados.length,
        qtd_clientes_inad: vencOrdenados.reduce((s, v) => s + v.qtd_clientes_inad, 0),
        vencimentos: vencOrdenados,
      }
    })
    .sort(
      (a, b) =>
        b.inadimplencia - a.inadimplencia || a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR'),
    )
}

/** Inad. do mês por vencimento e grupo — soma item a item, sem compensação entre razões sociais. */
export function agruparInadMesPorVencimentoEGrupo(
  itens: Array<{
    cliente: string | null
    valor_item: number
    data_vencimento?: string | null
    data_pagamento?: string | null
  }>,
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
  ref = new Date(),
): ReceitaInadMesVencimentoAgg[] {
  return agruparInadMesFlatPorVencimento(
    agruparInadMesPorGrupoSemCompensacao(itens, clienteGrupoMap, ano, mes, ref),
  )
}

/** Inad. do mês por grupo e vencimento (lista plana). */
export function agruparInadMesPorGrupoSemCompensacao(
  itens: Array<{
    cliente: string | null
    valor_item: number
    data_vencimento?: string | null
    data_pagamento?: string | null
  }>,
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
  ref = new Date(),
): ReceitaInadMesGrupoAgg[] {
  const byGrupoVenc = new Map<
    string,
    {
      grupo_cliente: string
      data_vencimento: string
      faturado: number
      recebido: number
      inad: number
      clientes: Set<string>
      inadClientes: Set<string>
    }
  >()

  for (const item of itens) {
    const grupo = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const data_vencimento = normalizePrevistoVencimentoKey(item.data_vencimento)
    if (data_vencimento === PREVISTO_SEM_VENCIMENTO_KEY) continue
    const rowKey = `${grupo}::${data_vencimento}`
    const cur = byGrupoVenc.get(rowKey) ?? {
      grupo_cliente: grupo,
      data_vencimento,
      faturado: 0,
      recebido: 0,
      inad: 0,
      clientes: new Set<string>(),
      inadClientes: new Set<string>(),
    }
    cur.faturado += item.valor_item
    if (pagamentoNoMes(item.data_pagamento ?? null, ano, mes)) {
      cur.recebido += item.valor_item
    }
    const inadItem = inadimplenciaItemMesFaturadoNaoPago(item, ano, mes, ref)
    if (inadItem > 0) {
      cur.inad += inadItem
      if (item.cliente) cur.inadClientes.add(item.cliente)
    }
    if (item.cliente) cur.clientes.add(item.cliente)
    byGrupoVenc.set(rowKey, cur)
  }

  return [...byGrupoVenc.values()]
    .map((v) => ({
      grupo_cliente: v.grupo_cliente,
      data_vencimento: v.data_vencimento,
      faturado: v.faturado,
      recebido: v.recebido,
      inadimplencia: v.inad,
      qtd_clientes: v.clientes.size,
      qtd_clientes_inad: v.inadClientes.size,
    }))
    .filter((g) => g.inadimplencia > 0)
    .sort(
      (a, b) =>
        b.inadimplencia - a.inadimplencia ||
        a.data_vencimento.localeCompare(b.data_vencimento) ||
        a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR'),
    )
}
