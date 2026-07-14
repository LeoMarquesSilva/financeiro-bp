import { supabase } from '@/lib/supabaseClient'
import { collectPaginatedRows } from '@/lib/supabasePaginate'
import { mesAbrev } from '../constants'
import { aplicarMetaComRateioDeGap } from '../utils/receitaMes'
import type {
  ReceitaDashboardData,
  ReceitaMetasConfig,
  ReceitaMesRow,
  ReceitaRecebidoDepartamentoRow,
  ReceitaRecebidoPlanoMensalRow,
  ReceitaRecebidoItemRow,
  ReceitaRecebidoPlanoRow,
  ReceitaPrevistoItemRow,
  ReceitaEncargosItemRow,
  ReceitaRecebidoSemAreaItemRow,
} from '../types/receita.types'

type TotaisMensaisRow = {
  mes: number
  recebido: number
  previsto: number
  encargos: number
}

export const receitaService = {
  async fetchTotaisMensais(
    ano: number,
  ): Promise<Map<number, { recebido: number; previsto: number; encargos: number }>> {
    const { data, error } = await supabase.rpc(
      'receita_totais_mensais' as never,
      { p_ano: ano } as never,
    )
    if (error) throw error
    const map = new Map<number, { recebido: number; previsto: number; encargos: number }>()
    for (const row of (data ?? []) as TotaisMensaisRow[]) {
      map.set(row.mes, {
        recebido: Number(row.recebido) || 0,
        previsto: Number(row.previsto) || 0,
        encargos: Number(row.encargos) || 0,
      })
    }
    return map
  },

  async buildDashboard(metas: ReceitaMetasConfig): Promise<ReceitaDashboardData> {
    const totais = await this.fetchTotaisMensais(metas.ano)
    const mesesOrdenados = [...metas.meses].sort((a, b) => a - b)
    const mesesComMeta = new Set(metas.meses_meta ?? metas.meses)

    const rowsBase: ReceitaMesRow[] = mesesOrdenados.map((mes) => {
      const t = totais.get(mes)
      const key = String(mes)
      return {
        mes,
        mesLabel: mesAbrev(mes),
        meta: mesesComMeta.has(mes) ? metas.meta : 0,
        projetadoBaseAbril: metas.projetado_base_abril,
        projetadoReal: metas.projetado_real[key] ?? 0,
        recebido: t?.recebido ?? 0,
        previsto: t?.previsto ?? 0,
        encargos: t?.encargos ?? 0,
      }
    })

    // Gap de meses fechados que não bateram a meta é rateado (partes iguais) entre os meses
    // restantes do ano, reforçando a meta deles em cascata (ver aplicarMetaComRateioDeGap).
    const rows = aplicarMetaComRateioDeGap(rowsBase, metas.ano)

    return { ano: metas.ano, rows }
  },

  async fetchRecebidoPorPlano(ano: number, mes: number): Promise<ReceitaRecebidoPlanoRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_recebido_por_plano' as never,
      { p_ano: ano, p_mes: mes } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<{ plano_contas: string; quantidade: number; total: number }>).map(
      (row) => ({
        plano_contas: row.plano_contas,
        quantidade: Number(row.quantidade) || 0,
        total: Number(row.total) || 0,
      }),
    )
  },

  async fetchRecebidoPorPlanoMensal(ano: number): Promise<ReceitaRecebidoPlanoMensalRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_recebido_por_plano_mensal' as never,
      { p_ano: ano } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<{ mes: number; plano_contas: string; total: number }>).map(
      (row) => ({
        mes: Number(row.mes) || 0,
        plano_contas: String(row.plano_contas ?? ''),
        total: Number(row.total) || 0,
      }),
    )
  },

  async fetchRecebidoPorDepartamento(ano: number): Promise<ReceitaRecebidoDepartamentoRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_recebido_por_departamento_mensal' as never,
      { p_ano: ano } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<{ mes: number; departamento: string; total: number }>).map(
      (row) => ({
        mes: Number(row.mes) || 0,
        departamento: String(row.departamento ?? 'Sem departamento'),
        total: Number(row.total) || 0,
      }),
    )
  },

  /** Previsto mensal por área (departamento) — usado no gráfico de linha por área da Receita. */
  async fetchPrevistoPorDepartamento(
    ano: number,
    incluirInativos = true,
  ): Promise<ReceitaRecebidoDepartamentoRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_previsto_por_departamento_mensal' as never,
      { p_ano: ano, p_incluir_inativos: incluirInativos } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<{ mes: number; departamento: string; total: number }>).map(
      (row) => ({
        mes: Number(row.mes) || 0,
        departamento: String(row.departamento ?? 'Sem departamento'),
        total: Number(row.total) || 0,
      }),
    )
  },

  /** Nome + grupo para vincular cliente do financeiro ao grupo de empresas. */
  async fetchEmpresasNomeGrupo(): Promise<Array<{ nome: string; grupo_cliente: string | null }>> {
    return collectPaginatedRows(async (from, to) =>
      supabase
        .from('escritorio_empresas_por_grupo')
        .select('nome, grupo_cliente')
        .order('id', { ascending: true })
        .range(from, to),
    )
  },

  async fetchRecebidoItens(
    ano: number,
    mes: number,
    planoContas: string,
  ): Promise<ReceitaRecebidoItemRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_recebido_itens' as never,
      { p_ano: ano, p_mes: mes, p_plano_contas: planoContas } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ci_item: Number(row.ci_item) || 0,
      ci_titulo: Number(row.ci_titulo) || 0,
      cliente: row.cliente != null ? String(row.cliente) : null,
      descricao: row.descricao != null ? String(row.descricao) : null,
      nro_titulo: row.nro_titulo != null ? String(row.nro_titulo) : null,
      data_pagamento: row.data_pagamento != null ? String(row.data_pagamento) : null,
      valor_recebido: Number(row.valor_recebido ?? row.valor_pago_item) || 0,
      valor_encargos: Number(row.valor_encargos) || 0,
      valor_pago_item: Number(row.valor_pago_item) || 0,
      valor_fluxo_item:
        row.valor_fluxo_item != null && row.valor_fluxo_item !== ''
          ? Number(row.valor_fluxo_item)
          : null,
      plano_contas: String(row.plano_contas ?? planoContas),
      situacao_titulo: row.situacao_titulo != null ? String(row.situacao_titulo) : null,
    }))
  },

  /** Títulos recebidos sem departamento mapeado em uma das áreas do rateio; mes=null → ano todo. */
  async fetchRecebidoItensSemArea(
    ano: number,
    mes: number | null,
  ): Promise<ReceitaRecebidoSemAreaItemRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_recebido_itens_sem_area' as never,
      { p_ano: ano, p_mes: mes } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ci_item: Number(row.ci_item) || 0,
      ci_titulo: Number(row.ci_titulo) || 0,
      cliente: row.cliente != null ? String(row.cliente) : null,
      descricao: row.descricao != null ? String(row.descricao) : null,
      nro_titulo: row.nro_titulo != null ? String(row.nro_titulo) : null,
      data_pagamento: row.data_pagamento != null ? String(row.data_pagamento) : null,
      valor_recebido: Number(row.valor_recebido) || 0,
      valor_pago_item: Number(row.valor_pago_item) || 0,
      plano_contas: String(row.plano_contas ?? ''),
      departamento: String(row.departamento ?? 'Sem departamento'),
      situacao_titulo: row.situacao_titulo != null ? String(row.situacao_titulo) : null,
    }))
  },

  async fetchEncargosPorPlano(ano: number, mes: number): Promise<ReceitaRecebidoPlanoRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_encargos_por_plano' as never,
      { p_ano: ano, p_mes: mes } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<{ plano_contas: string; quantidade: number; total: number }>).map(
      (row) => ({
        plano_contas: row.plano_contas,
        quantidade: Number(row.quantidade) || 0,
        total: Number(row.total) || 0,
      }),
    )
  },

  async fetchEncargosItens(
    ano: number,
    mes: number,
    planoContas: string,
  ): Promise<ReceitaEncargosItemRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_encargos_itens' as never,
      { p_ano: ano, p_mes: mes, p_plano_contas: planoContas } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ci_item: Number(row.ci_item) || 0,
      ci_titulo: Number(row.ci_titulo) || 0,
      cliente: row.cliente != null ? String(row.cliente) : null,
      descricao: row.descricao != null ? String(row.descricao) : null,
      nro_titulo: row.nro_titulo != null ? String(row.nro_titulo) : null,
      data_pagamento: row.data_pagamento != null ? String(row.data_pagamento) : null,
      valor_encargos: Number(row.valor_encargos) || 0,
      valor_pago_item: Number(row.valor_pago_item) || 0,
      valor_fluxo_item:
        row.valor_fluxo_item != null && row.valor_fluxo_item !== ''
          ? Number(row.valor_fluxo_item)
          : null,
      plano_contas: String(row.plano_contas ?? planoContas),
      situacao_titulo: row.situacao_titulo != null ? String(row.situacao_titulo) : null,
    }))
  },

  async fetchPrevistoPorPlano(ano: number, mes: number): Promise<ReceitaRecebidoPlanoRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_previsto_por_plano' as never,
      { p_ano: ano, p_mes: mes, p_incluir_inativos: true } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<{ plano_contas: string; quantidade: number; total: number }>).map(
      (row) => ({
        plano_contas: row.plano_contas,
        quantidade: Number(row.quantidade) || 0,
        total: Number(row.total) || 0,
      }),
    )
  },

  async fetchPrevistoItens(
    ano: number,
    mes: number,
    planoContas: string,
  ): Promise<ReceitaPrevistoItemRow[]> {
    const { data, error } = await supabase.rpc(
      'receita_previsto_itens' as never,
      { p_ano: ano, p_mes: mes, p_plano_contas: planoContas, p_incluir_inativos: true } as never,
    )
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ci_item: Number(row.ci_item) || 0,
      ci_titulo: Number(row.ci_titulo) || 0,
      cliente: row.cliente != null ? String(row.cliente) : null,
      descricao: row.descricao != null ? String(row.descricao) : null,
      nro_titulo: row.nro_titulo != null ? String(row.nro_titulo) : null,
      data_vencimento: row.data_vencimento != null ? String(row.data_vencimento) : null,
      valor_item: Number(row.valor_item) || 0,
      plano_contas: String(row.plano_contas ?? planoContas),
      situacao_titulo: row.situacao_titulo != null ? String(row.situacao_titulo) : null,
    }))
  },
}
