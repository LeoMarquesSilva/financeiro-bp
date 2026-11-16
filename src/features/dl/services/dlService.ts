import { supabase } from '@/lib/supabaseClient'
import type {
  DlArea,
  DlClienteArea,
  DlGestor,
  DlGestorCliente,
  DlGestorMes,
  DlMesRow,
  DlParametroMensal,
} from '../types/dl.types'

const n = (v: unknown) => Number(v) || 0

export const dlService = {
  async fetchAreas(): Promise<DlArea[]> {
    const { data, error } = await supabase
      .from('dl_areas' as never)
      .select('area_key, nome, departamento, referencia_mercado, ordem')
      .order('ordem' as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      area_key: String(r.area_key),
      nome: String(r.nome),
      departamento: String(r.departamento),
      referencia_mercado: r.referencia_mercado == null ? null : n(r.referencia_mercado),
      ordem: n(r.ordem),
    }))
  },

  async fetchResultadoMensal(ano: number): Promise<DlMesRow[]> {
    const { data, error } = await supabase.rpc('dl_resultado_mensal' as never, { p_ano: ano } as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      area_key: String(r.area_key),
      mes: n(r.mes),
      receita_bruta: n(r.receita_bruta),
      impostos: n(r.impostos),
      desp_operacionais: n(r.desp_operacionais),
      desp_controladoria: n(r.desp_controladoria),
      desp_indiretas: n(r.desp_indiretas),
      profissionais: n(r.profissionais),
      pct_controladoria: n(r.pct_controladoria),
      parametro_herdado: Boolean(r.parametro_herdado),
      socios_prolabore: n(r.socios_prolabore),
    }))
  },

  async fetchGestorMensal(ano: number): Promise<DlGestorMes[]> {
    const { data, error } = await supabase.rpc('dl_gestor_mensal' as never, { p_ano: ano } as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      gestor_id: String(r.gestor_id),
      mes: n(r.mes),
      clientes: n(r.clientes),
      liquido_clientes: n(r.liquido_clientes),
      resultado_clientes: n(r.resultado_clientes),
      dl: n(r.dl),
    }))
  },

  async fetchClientesArea(ano: number): Promise<DlClienteArea[]> {
    const { data, error } = await supabase.rpc('dl_clientes_area' as never, { p_ano: ano } as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      area_key: String(r.area_key),
      cliente: String(r.cliente),
      liquido: n(r.liquido),
    }))
  },

  async fetchCarteiras(gestorIds: string[]): Promise<DlGestorCliente[]> {
    if (gestorIds.length === 0) return []
    const { data, error } = await supabase
      .from('dl_gestor_clientes' as never)
      .select('gestor_id, cliente')
      .in('gestor_id' as never, gestorIds as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      gestor_id: String(r.gestor_id),
      cliente: String(r.cliente),
    }))
  },

  async adicionarCliente(gestorId: string, cliente: string): Promise<void> {
    const { error } = await supabase
      .from('dl_gestor_clientes' as never)
      .upsert({ gestor_id: gestorId, cliente } as never, { onConflict: 'gestor_id,cliente' })
    if (error) throw error
  },

  async removerCliente(gestorId: string, cliente: string): Promise<void> {
    const { error } = await supabase
      .from('dl_gestor_clientes' as never)
      .delete()
      .eq('gestor_id' as never, gestorId as never)
      .eq('cliente' as never, cliente as never)
    if (error) throw error
  },

  async fetchParametros(ano: number): Promise<DlParametroMensal[]> {
    const { data, error } = await supabase
      .from('dl_parametros_mensais' as never)
      .select('ano, mes, area_key, profissionais, pct_controladoria')
      .eq('ano' as never, ano as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      ano: n(r.ano),
      mes: n(r.mes),
      area_key: String(r.area_key),
      profissionais: n(r.profissionais),
      pct_controladoria: n(r.pct_controladoria),
    }))
  },

  async fetchGestores(ano: number): Promise<DlGestor[]> {
    const { data, error } = await supabase
      .from('dl_gestores' as never)
      .select('id, ano, area_key, nome, pct, mes_inicio, mes_fim')
      .eq('ano' as never, ano as never)
      .order('area_key' as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      ano: n(r.ano),
      area_key: String(r.area_key),
      nome: String(r.nome),
      pct: n(r.pct),
      mes_inicio: n(r.mes_inicio),
      mes_fim: n(r.mes_fim),
    }))
  },

  async salvarParametros(rows: DlParametroMensal[], updatedBy: string | null): Promise<void> {
    if (rows.length === 0) return
    const { error } = await supabase
      .from('dl_parametros_mensais' as never)
      .upsert(
        rows.map((r) => ({ ...r, updated_by: updatedBy, updated_at: new Date().toISOString() })) as never,
        { onConflict: 'ano,mes,area_key' },
      )
    if (error) throw error
  },

  async salvarGestor(g: Omit<DlGestor, 'id'> & { id?: string }): Promise<void> {
    const payload = { ...g, updated_at: new Date().toISOString() }
    const { error } = g.id
      ? await supabase.from('dl_gestores' as never).update(payload as never).eq('id' as never, g.id as never)
      : await supabase.from('dl_gestores' as never).insert(payload as never)
    if (error) throw error
  },

  async excluirGestor(id: string): Promise<void> {
    const { error } = await supabase.from('dl_gestores' as never).delete().eq('id' as never, id as never)
    if (error) throw error
  },
}
