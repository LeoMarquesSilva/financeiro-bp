import { supabase } from '@/lib/supabaseClient'

export type TituloParaExcluir = {
  ci_titulo: number
  nro_titulo: string
  tipo: string | null
  cliente: string
  data_vencimento: string
  valor: number
  situacao: string
  plano_contas: string | null
  descricao: string | null
  qtd_itens: number
  qtd_cobrancas: number
}

export type TituloExcluido = {
  id: string
  lote_id: string
  ci_titulo: number
  nro_titulo: string | null
  tipo: string | null
  cliente: string | null
  data_vencimento: string | null
  valor: number | null
  motivo: string
  excluido_por_email: string
  excluido_por_nome: string | null
  excluido_em: string
  restaurado_em: string | null
  restaurado_por_email: string | null
  restaurado_por_nome: string | null
}

const HISTORICO_COLUNAS =
  'id,lote_id,ci_titulo,nro_titulo,tipo,cliente,data_vencimento,valor,motivo,excluido_por_email,excluido_por_nome,excluido_em,restaurado_em,restaurado_por_email,restaurado_por_nome'

export const exclusaoTitulosService = {
  async podeExcluir(): Promise<boolean> {
    const { data, error } = await supabase.rpc('current_user_pode_excluir_titulos' as never)
    if (error) throw new Error(error.message)
    return data === true
  },

  async buscar(numeros: string[], cliente: string | null): Promise<TituloParaExcluir[]> {
    const { data, error } = await supabase.rpc(
      'financeiro_exclusao_buscar' as never,
      { p_numeros: numeros, p_cliente: cliente } as never,
    )
    if (error) throw new Error(error.message)
    return ((data ?? []) as TituloParaExcluir[]).map((t) => ({ ...t, valor: Number(t.valor) }))
  },

  async excluir(ciTitulos: number[], motivo: string): Promise<{ excluidos: number }> {
    const { data, error } = await supabase.rpc(
      'financeiro_exclusao_excluir' as never,
      { p_ci_titulos: ciTitulos, p_motivo: motivo } as never,
    )
    if (error) throw new Error(error.message)
    return { excluidos: Number((data as { excluidos?: number } | null)?.excluidos ?? 0) }
  },

  async restaurar(exclusaoId: string): Promise<void> {
    const { error } = await supabase.rpc(
      'financeiro_exclusao_restaurar' as never,
      { p_exclusao_id: exclusaoId } as never,
    )
    if (error) throw new Error(error.message)
  },

  async historico(): Promise<TituloExcluido[]> {
    const { data, error } = await (supabase.from('financeiro_titulos_excluidos' as never) as any)
      .select(HISTORICO_COLUNAS)
      .order('excluido_em', { ascending: false })
      .limit(300)
    if (error) throw new Error(error.message)
    return ((data ?? []) as TituloExcluido[]).map((t) => ({
      ...t,
      valor: t.valor == null ? null : Number(t.valor),
    }))
  },
}
