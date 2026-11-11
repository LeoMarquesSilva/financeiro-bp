import { supabase } from '@/lib/supabaseClient'
import type {
  PlanAreaRow,
  PlanCenarioRow,
  PlanClienteHistoricoRow,
  PlanInadimplenciaPeriodoRow,
  PlanInadimplenciaRow,
  PlanMargemRow,
  PlanOpexBlocosRow,
  PlanPessoasRow,
  PlanReceitaAjusteRow,
  PlanReceitaRow,
  PlanReceitaSemAreaRow,
  PlanTimesheetRow,
  PlanTituloSemAreaRow,
} from '../types'

const n = (v: unknown) => Number(v) || 0
const s = (v: unknown) => (v == null ? null : String(v))

async function rpc(nome: string, args: Record<string, unknown> = {}): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase.rpc(nome as never, args as never)
  if (error) throw error
  return (data ?? []) as Array<Record<string, unknown>>
}

const CENARIO_COLS =
  'id, ano_alvo, nome, descricao, premissas, oficial, oficializado_em, oficializado_por_email, created_by_email, created_at, updated_by_email, updated_at'

function mapCenario(r: Record<string, unknown>): PlanCenarioRow {
  return {
    id: String(r.id),
    ano_alvo: n(r.ano_alvo),
    nome: String(r.nome ?? ''),
    descricao: s(r.descricao),
    premissas: r.premissas ?? {},
    oficial: Boolean(r.oficial),
    oficializado_em: s(r.oficializado_em),
    oficializado_por_email: s(r.oficializado_por_email),
    created_by_email: s(r.created_by_email),
    created_at: String(r.created_at ?? ''),
    updated_by_email: s(r.updated_by_email),
    updated_at: String(r.updated_at ?? ''),
  }
}

export const planejamentoService = {
  async areas(): Promise<PlanAreaRow[]> {
    return (await rpc('planejamento_areas')).map((r) => ({
      area_key: String(r.area_key),
      nome: String(r.nome),
      departamento: String(r.departamento),
      ordem: n(r.ordem),
    }))
  },

  async receitaMensal(ano: number): Promise<PlanReceitaRow[]> {
    return (await rpc('planejamento_receita_mensal', { p_ano: ano })).map((r) => ({
      mes: n(r.mes),
      area_key: String(r.area_key),
      origem: String(r.origem) as PlanReceitaRow['origem'],
      recebido: n(r.recebido),
    }))
  },

  async receitaSemArea(ano: number): Promise<PlanReceitaSemAreaRow[]> {
    return (await rpc('planejamento_receita_sem_area', { p_ano: ano })).map((r) => ({
      cliente: String(r.cliente ?? ''),
      departamentos_vios: String(r.departamentos_vios ?? ''),
      total: n(r.total),
      titulos: n(r.titulos),
      sugestao_area_key: s(r.sugestao_area_key),
      area_key: s(r.area_key),
      classificado_por_email: s(r.classificado_por_email),
      classificado_em: s(r.classificado_em),
    }))
  },

  async titulosSemArea(ano: number, cliente: string): Promise<PlanTituloSemAreaRow[]> {
    return (await rpc('planejamento_receita_sem_area_titulos', { p_ano: ano, p_cliente: cliente })).map((r) => ({
      ci_titulo: r.ci_titulo == null ? null : n(r.ci_titulo),
      nro_titulo: s(r.nro_titulo),
      ci_item: r.ci_item == null ? null : n(r.ci_item),
      mes: n(r.mes),
      data_vencimento: s(r.data_vencimento),
      data_pagamento: s(r.data_pagamento),
      competencia: s(r.competencia),
      valor: n(r.valor),
      plano_contas: s(r.plano_contas),
      descricao: s(r.descricao),
      departamento: s(r.departamento),
      contrato: s(r.contrato),
      etiquetas: s(r.etiquetas),
      nfse: s(r.nfse),
    }))
  },

  async clienteHistoricoAreas(cliente: string): Promise<PlanClienteHistoricoRow[]> {
    return (await rpc('planejamento_cliente_historico_areas', { p_cliente: cliente })).map((r) => ({
      area_key: String(r.area_key),
      ano: n(r.ano),
      titulos: n(r.titulos),
      total: n(r.total),
    }))
  },

  /** Ajuste provisório da receita do ano (vazio quando o VIOS está certo). */
  async receitaAjustes(ano: number): Promise<PlanReceitaAjusteRow[]> {
    const { data, error } = await supabase
      .from('planejamento_receita_ajuste' as never)
      .select('mes, area_key, valor, fonte')
      .eq('ano' as never, ano as never)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      mes: n(r.mes),
      area_key: String(r.area_key),
      valor: n(r.valor),
      fonte: String(r.fonte ?? ''),
    }))
  },

  async margemMensal(ano: number): Promise<PlanMargemRow[]> {
    return (await rpc('planejamento_margem_mensal', { p_ano: ano })).map((r) => ({
      area_key: String(r.area_key),
      mes: n(r.mes),
      receita_bruta: n(r.receita_bruta),
      base_nf: n(r.base_nf),
      aliquota: n(r.aliquota),
      aliquota_herdada: Boolean(r.aliquota_herdada),
      impostos: n(r.impostos),
      desp_pessoas: n(r.desp_pessoas),
      desp_demais: n(r.desp_demais),
      desp_operacionais: n(r.desp_operacionais),
      pct_controladoria: n(r.pct_controladoria),
      origem_controladoria: String(r.origem_controladoria ?? ''),
      desp_controladoria: n(r.desp_controladoria),
      pessoas_reclassificadas: n(r.pessoas_reclassificadas),
    }))
  },

  async opexBlocos(ano: number): Promise<PlanOpexBlocosRow[]> {
    return (await rpc('planejamento_opex_blocos_mensal', { p_ano: ano })).map((r) => ({
      mes: n(r.mes),
      areas: n(r.areas),
      controladoria: n(r.controladoria),
      estrutura: n(r.estrutura),
      outros: n(r.outros),
      total: n(r.total),
      pessoas_reclassificadas: n(r.pessoas_reclassificadas),
      pessoas_sem_match: n(r.pessoas_sem_match),
    }))
  },

  async pessoasMensal(ano: number): Promise<PlanPessoasRow[]> {
    return (await rpc('planejamento_pessoas_mensal', { p_ano: ano })).map((r) => ({
      area_key: String(r.area_key),
      mes: n(r.mes),
      folha: n(r.folha),
      demais_pessoas: n(r.demais_pessoas),
      headcount: r.headcount == null ? null : n(r.headcount),
    }))
  },

  /** Só leitura (não congela meses, ao contrário de receita_inadimplencia_dashboard). */
  async inadimplenciaMensal(ano: number): Promise<PlanInadimplenciaRow[]> {
    return (await rpc('planejamento_inadimplencia_mensal', { p_ano: ano })).map((r) => ({
      mes: n(r.mes),
      area_key: String(r.area_key),
      inadimplencia: n(r.inadimplencia),
      previsto_mes: n(r.previsto_mes),
      congelado: Boolean(r.congelado),
    }))
  },

  /** Acumulado de jan até o último mês fechado (escritório = mesma conta do painel de Inadimplência). */
  async inadimplenciaPeriodo(ano: number): Promise<PlanInadimplenciaPeriodoRow[]> {
    return (await rpc('planejamento_inadimplencia_periodo', { p_ano: ano })).map((r) => ({
      area_key: String(r.area_key),
      inadimplencia: n(r.inadimplencia),
      previsto: n(r.previsto),
      mes_fim: n(r.mes_fim),
    }))
  },

  async timesheetMensal(ano: number): Promise<PlanTimesheetRow[]> {
    return (await rpc('planejamento_timesheet_mensal', { p_ano: ano })).map((r) => ({
      area_key: String(r.area_key),
      mes: n(r.mes),
      horas: n(r.horas),
    }))
  },

  async classificarCliente(cliente: string, areaKey: string | null): Promise<void> {
    if (areaKey == null) {
      const { error } = await supabase.from('planejamento_receita_classificacao' as never).delete().eq('cliente' as never, cliente as never)
      if (error) throw error
      return
    }
    const { error } = await supabase
      .from('planejamento_receita_classificacao' as never)
      .upsert({ cliente, area_key: areaKey } as never, { onConflict: 'cliente' })
    if (error) throw error
  },

  async listarCenarios(ano: number): Promise<PlanCenarioRow[]> {
    const { data, error } = await supabase
      .from('planejamento_cenarios' as never)
      .select(CENARIO_COLS)
      .eq('ano_alvo' as never, ano as never)
      .order('oficial' as never, { ascending: false })
      .order('updated_at' as never, { ascending: false })
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapCenario)
  },

  async criarCenario(input: { ano: number; nome: string; descricao?: string | null; premissas: unknown }): Promise<PlanCenarioRow> {
    const { data, error } = await supabase
      .from('planejamento_cenarios' as never)
      .insert({ ano_alvo: input.ano, nome: input.nome, descricao: input.descricao ?? null, premissas: input.premissas } as never)
      .select(CENARIO_COLS)
      .single()
    if (error) throw error
    return mapCenario(data as Record<string, unknown>)
  },

  async salvarCenario(id: string, patch: { nome?: string; descricao?: string | null; premissas?: unknown }): Promise<PlanCenarioRow> {
    const { data, error } = await supabase
      .from('planejamento_cenarios' as never)
      .update(patch as never)
      .eq('id' as never, id as never)
      .select(CENARIO_COLS)
      .single()
    if (error) throw error
    return mapCenario(data as Record<string, unknown>)
  },

  async excluirCenario(id: string): Promise<void> {
    const { error, count } = await supabase
      .from('planejamento_cenarios' as never)
      .delete({ count: 'exact' })
      .eq('id' as never, id as never)
    if (error) throw error
    if (!count) throw new Error('Só quem criou o cenário (ou um admin) pode excluí-lo, e o oficial não pode ser excluído.')
  },

  async oficializar(id: string, linhas: unknown[], operacionais: unknown[]): Promise<void> {
    const { error } = await supabase.rpc(
      'planejamento_oficializar' as never,
      { p_cenario_id: id, p_linhas: linhas, p_operacionais: operacionais } as never,
    )
    if (error) throw error
  },
}
