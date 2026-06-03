import { supabase } from '@/lib/supabaseClient'
import { mesAbrev } from '../constants'
import type {
  ReceitaDashboardData,
  ReceitaMetasConfig,
  ReceitaMesRow,
  ReceitaRecebidoDepartamentoRow,
  ReceitaRecebidoPlanoMensalRow,
  ReceitaRecebidoItemRow,
  ReceitaRecebidoPlanoRow,
} from '../types/receita.types'

type TotaisMensaisRow = {
  mes: number
  recebido: number
  previsto: number
}

export const receitaService = {
  async fetchTotaisMensais(ano: number): Promise<Map<number, { recebido: number; previsto: number }>> {
    const { data, error } = await supabase.rpc(
      'receita_totais_mensais' as never,
      { p_ano: ano } as never,
    )
    if (error) throw error
    const map = new Map<number, { recebido: number; previsto: number }>()
    for (const row of (data ?? []) as TotaisMensaisRow[]) {
      map.set(row.mes, {
        recebido: Number(row.recebido) || 0,
        previsto: Number(row.previsto) || 0,
      })
    }
    return map
  },

  async buildDashboard(metas: ReceitaMetasConfig): Promise<ReceitaDashboardData> {
    const totais = await this.fetchTotaisMensais(metas.ano)
    const mesesOrdenados = [...metas.meses].sort((a, b) => a - b)

    const rows: ReceitaMesRow[] = mesesOrdenados.map((mes) => {
      const t = totais.get(mes)
      const key = String(mes)
      return {
        mes,
        mesLabel: mesAbrev(mes),
        meta: metas.meta,
        projetadoBaseAbril: metas.projetado_base_abril,
        projetadoReal: metas.projetado_real[key] ?? 0,
        recebido: t?.recebido ?? 0,
        previsto: t?.previsto ?? 0,
      }
    })

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

  /** Nome + grupo para vincular cliente do financeiro ao grupo de empresas. */
  async fetchEmpresasNomeGrupo(): Promise<Array<{ nome: string; grupo_cliente: string | null }>> {
    const PAGE_SIZE = 1000
    const all: Array<{ nome: string; grupo_cliente: string | null }> = []
    let from = 0
    let hasMore = true
    while (hasMore) {
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('escritorio_empresas_por_grupo')
        .select('nome, grupo_cliente')
        .range(from, to)
      if (error) throw error
      const chunk = (data ?? []) as Array<{ nome: string; grupo_cliente: string | null }>
      all.push(...chunk)
      hasMore = chunk.length === PAGE_SIZE
      from += PAGE_SIZE
    }
    return all
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
      valor_pago_item: Number(row.valor_pago_item) || 0,
      plano_contas: String(row.plano_contas ?? planoContas),
      situacao_titulo: row.situacao_titulo != null ? String(row.situacao_titulo) : null,
    }))
  },
}
