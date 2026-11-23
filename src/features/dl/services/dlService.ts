import { supabase } from '@/lib/supabaseClient'
import type {
  DlAliquota,
  DlArea,
  DlClienteArea,
  DlFechamento,
  DlOrigemParametro,
  DlRegraNegativo,
  DlGestor,
  DlGestorCliente,
  DlGestorMes,
  DlMesRow,
  DlParametroMensal,
} from '../types/dl.types'

const n = (v: unknown) => Number(v) || 0
const nOuNulo = (v: unknown) => (v == null ? null : Number(v))

export const dlService = {
  async fetchAreas(): Promise<DlArea[]> {
    const { data, error } = await supabase
      .from('dl_areas' as never)
      .select('area_key, nome, departamento, referencia_mercado, ordem, regra_negativo')
      .order('ordem' as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      area_key: String(r.area_key),
      nome: String(r.nome),
      departamento: String(r.departamento),
      referencia_mercado: r.referencia_mercado == null ? null : n(r.referencia_mercado),
      ordem: n(r.ordem),
      regra_negativo: (r.regra_negativo === 'acumulado' ? 'acumulado' : 'mensal') as DlRegraNegativo,
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
      liberacao_recursos: n(r.liberacao_recursos),
      aliquota: n(r.aliquota),
      aliquota_herdada: Boolean(r.aliquota_herdada),
      origem_profissionais: String(r.origem_profissionais ?? 'manual') as DlOrigemParametro,
      origem_controladoria: String(r.origem_controladoria ?? 'manual') as DlOrigemParametro,
      fechado: Boolean(r.fechado),
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
      dl_calculado: n(r.dl_calculado ?? r.dl),
      ajuste: n(r.ajuste),
      fechado: Boolean(r.fechado),
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
    // ~155 linhas por gestor (inclusões e exclusões): pagina para não esbarrar no limite de 1.000 do PostgREST.
    const pagina = 1000
    const linhas: Array<Record<string, unknown>> = []
    for (let de = 0; ; de += pagina) {
      const { data, error } = await supabase
        .from('dl_gestor_clientes' as never)
        .select('gestor_id, cliente, incluido')
        .in('gestor_id' as never, gestorIds as never)
        .order('gestor_id' as never)
        .order('cliente' as never)
        .range(de, de + pagina - 1)
      if (error) throw error
      const lote = (data ?? []) as Array<Record<string, unknown>>
      linhas.push(...lote)
      if (lote.length < pagina) break
    }
    return linhas.map((r) => ({
      gestor_id: String(r.gestor_id),
      cliente: String(r.cliente),
      incluido: r.incluido !== false,
    }))
  },

  /** Marca o cliente como dentro ou fora do DL do gestor (sem linha = entra automaticamente). */
  async definirClienteCarteira(gestorId: string, cliente: string, incluido: boolean): Promise<void> {
    const { error } = await supabase
      .from('dl_gestor_clientes' as never)
      .upsert({ gestor_id: gestorId, cliente, incluido, updated_at: new Date().toISOString() } as never, {
        onConflict: 'gestor_id,cliente',
      })
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
      profissionais: nOuNulo(r.profissionais),
      pct_controladoria: nOuNulo(r.pct_controladoria),
    }))
  },

  async fetchAliquotas(ano: number): Promise<DlAliquota[]> {
    const { data, error } = await supabase
      .from('dl_aliquotas' as never)
      .select('ano, mes, aliquota')
      .eq('ano' as never, ano as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({ ano: n(r.ano), mes: n(r.mes), aliquota: n(r.aliquota) }))
  },

  /** Grava as alíquotas preenchidas e apaga as que ficaram em branco (o mês volta a herdar). */
  async salvarAliquotas(ano: number, salvar: DlAliquota[], apagarMeses: number[], updatedBy: string | null): Promise<void> {
    if (salvar.length > 0) {
      const { error } = await supabase.from('dl_aliquotas' as never).upsert(
        salvar.map((a) => ({ ...a, updated_by: updatedBy, updated_at: new Date().toISOString() })) as never,
        { onConflict: 'ano,mes' },
      )
      if (error) throw error
    }
    if (apagarMeses.length > 0) {
      const { error } = await supabase
        .from('dl_aliquotas' as never)
        .delete()
        .eq('ano' as never, ano as never)
        .in('mes' as never, apagarMeses as never)
      if (error) throw error
    }
  },

  async salvarRegraNegativo(areaKey: string, regra: DlRegraNegativo): Promise<void> {
    const { error } = await supabase
      .from('dl_areas' as never)
      .update({ regra_negativo: regra } as never)
      .eq('area_key' as never, areaKey as never)
    if (error) throw error
  },

  async fetchFechamentos(ano: number): Promise<DlFechamento[]> {
    const { data, error } = await supabase
      .from('dl_fechamentos' as never)
      .select('ano, mes, fechado_em, fechado_por')
      .eq('ano' as never, ano as never)
      .order('mes' as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      ano: n(r.ano),
      mes: n(r.mes),
      fechado_em: String(r.fechado_em),
      fechado_por: r.fechado_por == null ? null : String(r.fechado_por),
    }))
  },

  /** Fecha todos os meses abertos até `mes`, em ordem. Devolve quantos fechou. */
  async fecharMes(ano: number, mes: number, observacao: string | null): Promise<number> {
    const { data, error } = await supabase.rpc(
      'dl_fechar_mes' as never,
      { p_ano: ano, p_mes: mes, p_observacao: observacao } as never,
    )
    if (error) throw error
    return n(data)
  },

  async reabrirMes(ano: number, mes: number): Promise<void> {
    const { error } = await supabase.rpc('dl_reabrir_mes' as never, { p_ano: ano, p_mes: mes } as never)
    if (error) throw error
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
