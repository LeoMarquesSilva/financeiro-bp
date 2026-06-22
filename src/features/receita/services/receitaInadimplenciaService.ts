import { supabase } from '@/lib/supabaseClient'
import type {
  ReceitaInadimplenciaDashboard,
  ReceitaInadimplenciaFechamentoMes,
  ReceitaInadimplenciaGrupoMes,
} from '../types/receitaInadimplencia.types'

export type ReceitaInadimplenciaFiltro = {
  ano: number
  mesInicio: number
  mesFim: number
}

function parseDashboard(raw: unknown): ReceitaInadimplenciaDashboard {
  const d = raw as Record<string, unknown>
  return {
    ano: Number(d.ano) || new Date().getFullYear(),
    mes_inicio: Number(d.mes_inicio) || 1,
    mes_fim: Number(d.mes_fim) || 0,
    mes_max_disponivel: Number(d.mes_max_disponivel) || 0,
    periodo_label: String(d.periodo_label ?? ''),
    valor_total_periodo: Number(d.valor_total_periodo) || 0,
    pct_periodo: Number(d.pct_periodo) || 0,
    top5: ((d.top5 ?? []) as Array<{ cliente: string; valor: number }>).map((t) => ({
      cliente: String(t.cliente ?? ''),
      valor: Number(t.valor) || 0,
    })),
    top5_total: Number(d.top5_total) || 0,
    top5_pct: Number(d.top5_pct) || 0,
    evolucao: ((d.evolucao ?? []) as Array<Record<string, unknown>>).map((e) => ({
      mes: Number(e.mes) || 0,
      mes_label: String(e.mes_label ?? ''),
      valor: Number(e.valor) || 0,
      valor_calculado: e.valor_calculado != null ? Number(e.valor_calculado) : undefined,
      previsto: e.previsto != null ? Number(e.previsto) : undefined,
      pct: Number(e.pct) || 0,
      congelado: Boolean(e.congelado),
      congelado_em: e.congelado_em != null ? String(e.congelado_em) : undefined,
    })),
    destaque_reducao_pct:
      d.destaque_reducao_pct != null ? Number(d.destaque_reducao_pct) : null,
  }
}

function parseFechamento(raw: unknown): ReceitaInadimplenciaFechamentoMes {
  const d = (raw ?? {}) as Record<string, unknown>
  return {
    congelado: Boolean(d.congelado),
    valor_total: d.valor_total != null ? Number(d.valor_total) : undefined,
    pct: d.pct != null ? Number(d.pct) : undefined,
    congelado_em: d.congelado_em != null ? String(d.congelado_em) : undefined,
  }
}

export const receitaInadimplenciaService = {
  async fetchDashboard(filtro: ReceitaInadimplenciaFiltro): Promise<ReceitaInadimplenciaDashboard> {
    const { data, error } = await supabase.rpc(
      'receita_inadimplencia_dashboard' as never,
      {
        p_ano: filtro.ano,
        p_mes_inicio: filtro.mesInicio,
        p_mes_fim: filtro.mesFim,
      } as never,
    )
    if (error) throw error
    return parseDashboard(data)
  },

  async fetchFechamentoMes(ano: number, mes: number): Promise<ReceitaInadimplenciaFechamentoMes> {
    const { data, error } = await supabase.rpc(
      'receita_inadimplencia_fechamento_mes' as never,
      { p_ano: ano, p_mes: mes } as never,
    )
    if (error) throw error
    return parseFechamento(data)
  },

  async congelarMes(
    ano: number,
    mes: number,
    valorTotal: number,
    pct: number,
  ): Promise<ReceitaInadimplenciaFechamentoMes> {
    const { data, error } = await supabase.rpc(
      'receita_inadimplencia_congelar_mes' as never,
      {
        p_ano: ano,
        p_mes: mes,
        p_valor_total: valorTotal,
        p_pct: pct,
      } as never,
    )
    if (error) throw error
    return parseFechamento(data)
  },

  async fetchGruposMes(ano: number, mes: number): Promise<ReceitaInadimplenciaGrupoMes[]> {
    const { data, error } = await supabase.rpc(
      'receita_inadimplencia_grupo_mes' as never,
      { p_ano: ano, p_mes: mes } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      grupo_cliente: String(row.grupo_cliente ?? 'Sem grupo'),
      faturado: Number(row.faturado) || 0,
      recebido: Number(row.recebido) || 0,
      inadimplencia: Number(row.inadimplencia) || 0,
      qtd_clientes: Number(row.qtd_clientes) || 0,
      qtd_clientes_inad: Number(row.qtd_clientes_inad) || 0,
    }))
  },
}
