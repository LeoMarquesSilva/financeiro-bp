import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { filtrarPrevistoMesItensPorCiItens, inadimplenciaItemMesFaturadoNaoPago } from './receitaFechamentoArea.ts'

const GRUPO_SEM_NOME = 'Sem grupo'

export type TopGrupoInadRow = {
  grupo: string
  valor: number
  data_vencimento: string
}

type PrevistoMesItem = {
  ci_item: number
  cliente: string | null
  valor_item: number
  data_vencimento: string | null
  data_pagamento: string | null
}

function normalizarNomeCliente(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

function clienteGrupoLookupKeys(nome: string): string[] {
  const trimmed = nome.trim()
  if (!trimmed) return []
  const keys = new Set<string>()
  keys.add(normalizarNomeCliente(trimmed))
  keys.add(trimmed.toLowerCase().replace(/\s+/g, ' '))
  return [...keys].filter(Boolean)
}

function setClienteGrupoLookup(map: Map<string, string>, nome: string, display: string): void {
  for (const key of clienteGrupoLookupKeys(nome)) {
    const existing = map.get(key)
    if (existing === undefined) {
      map.set(key, display)
    } else if (existing === GRUPO_SEM_NOME && display !== GRUPO_SEM_NOME) {
      map.set(key, display)
    }
  }
}

function buildClienteGrupoMap(
  empresas: Array<{ cliente_norm: string; grupo_cliente: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of empresas) {
    const nome = e.cliente_norm?.trim()
    if (!nome) continue
    const raw = e.grupo_cliente?.trim() ?? ''
    const display = raw === '' ? GRUPO_SEM_NOME : raw
    setClienteGrupoLookup(map, nome, display)
  }
  return map
}

function resolverGrupoCliente(cliente: string | null | undefined, map: Map<string, string>): string {
  const nome = cliente?.trim()
  if (!nome) return GRUPO_SEM_NOME
  for (const key of clienteGrupoLookupKeys(nome)) {
    const grupo = map.get(key)
    if (grupo) {
      if (grupo === GRUPO_SEM_NOME) return nome
      return grupo
    }
  }
  return nome
}

function normalizeVencimentoKey(data_vencimento: string | null | undefined): string | null {
  if (!data_vencimento?.trim()) return null
  return data_vencimento.trim().slice(0, 10)
}

async function fetchClienteGrupoMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const rows: Array<{ cliente_norm: string; grupo_cliente: string | null }> = []
  let from = 0
  const page = 1000
  while (true) {
    const { data, error } = await supabase
      .from('receita_grupo_por_nome_cliente')
      .select('cliente_norm, grupo_cliente')
      .order('cliente_norm', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw error
    const batch = (data ?? []) as Array<{ cliente_norm: string; grupo_cliente: string | null }>
    rows.push(...batch)
    if (batch.length < page) break
    from += page
  }
  return buildClienteGrupoMap(rows)
}

async function fetchPrevistoMesItens(
  supabase: SupabaseClient,
  ano: number,
  mes: number,
  areaKey: string | null,
): Promise<PrevistoMesItem[]> {
  const { data: all, error } = await supabase.rpc('receita_previsto_mes_itens', {
    p_ano: ano,
    p_mes: mes,
  })
  if (error) throw error
  let itens = (all ?? []) as PrevistoMesItem[]

  if (areaKey) {
    const { data: areaItens, error: e2 } = await supabase.rpc('receita_previsto_itens_area', {
      p_ano: ano,
      p_mes: mes,
      p_area_key: areaKey,
      p_incluir_inativos: true,
    })
    if (e2) throw e2
    itens = filtrarPrevistoMesItensPorCiItens(itens, (areaItens ?? []) as Array<{ ci_item: number }>)
  }

  return itens
}

/** Top 5 inad. do mês por grupo + vencimento (mesma base da visão gerencial Receita). */
export async function fetchTopGruposInadComVencimento(
  supabase: SupabaseClient,
  ano: number,
  mes: number,
  areaKey: string | null,
  ref = new Date(),
  corteIso?: string,
): Promise<TopGrupoInadRow[]> {
  const [itens, clienteGrupoMap] = await Promise.all([
    fetchPrevistoMesItens(supabase, ano, mes, areaKey),
    fetchClienteGrupoMap(supabase),
  ])

  const byGrupoVenc = new Map<string, { grupo: string; data_vencimento: string; inad: number }>()

  for (const item of itens) {
    const data_vencimento = normalizeVencimentoKey(item.data_vencimento)
    if (!data_vencimento) continue

    const inad = inadimplenciaItemMesFaturadoNaoPago(item, ano, mes, ref, corteIso)
    if (inad <= 0) continue

    const grupo = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const rowKey = `${grupo}::${data_vencimento}`
    const cur = byGrupoVenc.get(rowKey) ?? { grupo, data_vencimento, inad: 0 }
    cur.inad += inad
    byGrupoVenc.set(rowKey, cur)
  }

  return [...byGrupoVenc.values()]
    .filter((r) => r.inad > 0)
    .sort(
      (a, b) =>
        b.inad - a.inad ||
        a.data_vencimento.localeCompare(b.data_vencimento) ||
        a.grupo.localeCompare(b.grupo, 'pt-BR'),
    )
    .slice(0, 5)
    .map((r) => ({
      grupo: r.grupo,
      valor: Math.round(r.inad * 100) / 100,
      data_vencimento: r.data_vencimento,
    }))
}
