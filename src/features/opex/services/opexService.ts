import { supabase } from '@/lib/supabaseClient'
import { MESES_CURTOS } from '../constants'
import type { OpexDashboard, OpexDepartamentoRow, OpexMesGrupoRow, OpexPlanoRow, OpexTituloRow } from '../types/opex.types'
import type { OpexTituloVinculado } from '../types/opexMetas.types'

function mapTituloVinculado(row: Record<string, unknown>): OpexTituloVinculado {
  return {
    ci_item: Number(row.ci_item) || 0,
    ci_titulo: Number(row.ci_titulo) || 0,
    nro_titulo: String(row.nro_titulo ?? ''),
    descricao: String(row.descricao ?? ''),
    fornecedor: String(row.fornecedor ?? ''),
    grupo_conta: String(row.grupo_conta ?? ''),
    plano_contas: String(row.plano_contas ?? ''),
    valor_previsto: Number(row.valor_previsto) || 0,
    valor_realizado: Number(row.valor_realizado) || 0,
    data_vencimento: row.data_vencimento ? String(row.data_vencimento) : null,
    data_pagamento: row.data_pagamento ? String(row.data_pagamento) : null,
    situacao_titulo: String(row.situacao_titulo ?? ''),
  }
}

export function valorReferenciaTitulos(titulos: OpexTituloVinculado[]): number {
  return titulos.reduce((s, t) => s + Math.max(t.valor_previsto, t.valor_realizado), 0)
}

function mapDashboard(raw: Record<string, unknown>): OpexDashboard {
  const kpis = (raw.kpis ?? {}) as Record<string, unknown>
  const evolucao = ((raw.evolucao ?? []) as Array<Record<string, unknown>>).map((e) => {
    const mes = Number(e.mes) || 0
    return {
      mes,
      mesLabel: MESES_CURTOS[mes - 1] ?? String(mes),
      previsto: Number(e.previsto) || 0,
      realizado: Number(e.realizado) || 0,
      projetado_fixas: Number(e.projetado_fixas) || 0,
      variacao: Number(e.variacao) || 0,
    }
  })
  const grupos = ((raw.grupos ?? []) as Array<Record<string, unknown>>).map((g) => ({
    grupo_conta: String(g.grupo_conta ?? ''),
    fixo: Boolean(g.fixo),
    realizado_ytd: Number(g.realizado_ytd) || 0,
    previsto_ano: Number(g.previsto_ano) || 0,
    previsto_restante: Number(g.previsto_restante) || 0,
    projetado_ano: Number(g.projetado_ano) || 0,
  }))

  const mesesFiltroRaw = raw.meses_filtro ?? raw.mes_filtro
  const meses_filtro: number[] = Array.isArray(mesesFiltroRaw)
    ? mesesFiltroRaw.map((m) => Number(m)).filter((m) => m >= 1 && m <= 12)
    : mesesFiltroRaw != null
      ? [Number(mesesFiltroRaw)].filter((m) => m >= 1 && m <= 12)
      : []

  return {
    ano: Number(raw.ano) || new Date().getFullYear(),
    mes_atual: Number(raw.mes_atual) || 0,
    meses_filtro,
    kpis: {
      realizado_ytd: Number(kpis.realizado_ytd) || 0,
      previsto_ytd: Number(kpis.previsto_ytd) || 0,
      previsto_ano: Number(kpis.previsto_ano) || 0,
      projetado_ano: Number(kpis.projetado_ano) || 0,
      media_mensal_fixas: Number(kpis.media_mensal_fixas) || 0,
      variancia_ytd_pct: Number(kpis.variancia_ytd_pct) || 0,
    },
    evolucao,
    grupos,
  }
}

function rpcMeses(meses?: number[] | null): number[] | null {
  return meses?.length ? meses : null
}

export const opexService = {
  async fetchDashboard(ano: number, meses?: number[] | null): Promise<OpexDashboard> {
    const { data, error } = await supabase.rpc(
      'opex_dashboard' as never,
      { p_ano: ano, p_meses: rpcMeses(meses) } as never,
    )
    if (error) throw error
    return mapDashboard((data ?? {}) as Record<string, unknown>)
  },

  async fetchMesGrupos(ano: number, mes: number): Promise<OpexMesGrupoRow[]> {
    const { data, error } = await supabase.rpc(
      'opex_mes_grupos' as never,
      { p_ano: ano, p_mes: mes } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      grupo_conta: String(row.grupo_conta ?? ''),
      fixo: Boolean(row.fixo),
      previsto: Number(row.previsto) || 0,
      realizado: Number(row.realizado) || 0,
      variacao: Number(row.variacao) || 0,
    }))
  },

  async fetchPlanosGrupo(ano: number, grupo: string, meses?: number[] | null): Promise<OpexPlanoRow[]> {
    const { data, error } = await supabase.rpc(
      'opex_planos_grupo' as never,
      { p_ano: ano, p_grupo: grupo, p_meses: rpcMeses(meses) } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      plano_contas: String(row.plano_contas ?? ''),
      realizado_ytd: Number(row.realizado_ytd) || 0,
      previsto_ano: Number(row.previsto_ano) || 0,
    }))
  },

  async fetchPlanoTitulos(
    ano: number,
    grupo: string,
    plano: string,
    meses?: number[] | null,
  ): Promise<OpexTituloRow[]> {
    const { data, error } = await supabase.rpc(
      'opex_plano_titulos' as never,
      { p_ano: ano, p_grupo: grupo, p_plano: plano, p_meses: rpcMeses(meses) } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ci_item: Number(row.ci_item) || 0,
      nro_titulo: String(row.nro_titulo ?? ''),
      descricao: String(row.descricao ?? ''),
      fornecedor: String(row.fornecedor ?? ''),
      situacao_titulo: String(row.situacao_titulo ?? ''),
      departamento: String(row.departamento ?? ''),
      data_vencimento: row.data_vencimento ? String(row.data_vencimento) : null,
      data_pagamento: row.data_pagamento ? String(row.data_pagamento) : null,
      valor_previsto: Number(row.valor_previsto) || 0,
      valor_realizado: Number(row.valor_realizado) || 0,
    }))
  },

  async fetchDepartamentos(
    ano: number,
    meses?: number[] | null,
    somenteFixas = false,
  ): Promise<OpexDepartamentoRow[]> {
    const { data, error } = await supabase.rpc(
      'opex_departamentos' as never,
      {
        p_ano: ano,
        p_meses: rpcMeses(meses),
        p_somente_fixas: somenteFixas,
      } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      departamento: String(row.departamento ?? 'Sem departamento'),
      realizado: Number(row.realizado) || 0,
      previsto: Number(row.previsto) || 0,
    }))
  },

  async buscarTitulosVinculo(
    ano: number,
    busca: string,
    limit = 25,
  ): Promise<OpexTituloVinculado[]> {
    const { data, error } = await supabase.rpc(
      'opex_buscar_titulos' as never,
      { p_ano: ano, p_busca: busca, p_limit: limit } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapTituloVinculado)
  },

  async fetchTitulosCiItens(ciItens: number[]): Promise<OpexTituloVinculado[]> {
    if (!ciItens.length) return []
    const { data, error } = await supabase.rpc(
      'opex_titulos_ci_itens' as never,
      { p_ci_itens: ciItens } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapTituloVinculado)
  },
}
