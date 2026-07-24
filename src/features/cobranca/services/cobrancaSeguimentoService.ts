import { supabase } from '@/lib/supabaseClient'
import type {
  CobrancaSeguimentoAcaoTipo,
  CobrancaSeguimentoDashboard,
  CobrancaSeguimentoGrupoDetalhe,
  CobrancaSeguimentoGruposAcima60,
  CobrancaSeguimentoNovaAcaoInput,
} from '../types/cobrancaSeguimento.types'

function parseDashboard(raw: unknown): CobrancaSeguimentoDashboard {
  const d = raw as Record<string, unknown>
  const kpisRaw = (d.kpis ?? {}) as Record<string, unknown>
  return {
    kpis: {
      valor_total: Number(kpisRaw.valor_total) || 0,
      qtd_titulos: Number(kpisRaw.qtd_titulos) || 0,
      qtd_grupos: Number(kpisRaw.qtd_grupos) || 0,
      valor_faixa_1_30: Number(kpisRaw.valor_faixa_1_30) || 0,
      valor_faixa_31_60: Number(kpisRaw.valor_faixa_31_60) || 0,
      media_dias_atraso: Number(kpisRaw.media_dias_atraso) || 0,
    },
    top_devedores: ((d.top_devedores ?? []) as Array<Record<string, unknown>>).map((t) => ({
      grupo_chave: String(t.grupo_chave ?? ''),
      valor_total: Number(t.valor_total) || 0,
      qtd_titulos: Number(t.qtd_titulos) || 0,
      max_dias_atraso: Number(t.max_dias_atraso) || 0,
    })),
    grupos: ((d.grupos ?? []) as Array<Record<string, unknown>>).map((g) => ({
      grupo_chave: String(g.grupo_chave ?? ''),
      qtd_titulos: Number(g.qtd_titulos) || 0,
      valor_total: Number(g.valor_total) || 0,
      max_dias_atraso: Number(g.max_dias_atraso) || 0,
      media_dias_atraso: Number(g.media_dias_atraso) || 0,
      qtd_razoes: Number(g.qtd_razoes) || 0,
      cobranca_d1_realizada: Boolean(g.cobranca_d1_realizada),
      ultima_cobranca_d1_at: g.ultima_cobranca_d1_at != null ? String(g.ultima_cobranca_d1_at) : null,
      ultima_cobranca_d1_canal:
        g.ultima_cobranca_d1_canal != null ? String(g.ultima_cobranca_d1_canal) : null,
      ultima_acao_seguimento_at:
        g.ultima_acao_seguimento_at != null ? String(g.ultima_acao_seguimento_at) : null,
      ultima_acao_seguimento_tipo: (g.ultima_acao_seguimento_tipo as CobrancaSeguimentoAcaoTipo | null) ?? null,
      proximo_follow_up: g.proximo_follow_up != null ? String(g.proximo_follow_up) : null,
      departamentos: ((g.departamentos ?? []) as Array<Record<string, unknown>>).map((d) => ({
        departamento: String(d.departamento ?? 'Sem departamento'),
        valor: Number(d.valor) || 0,
        pct: Number(d.pct) || 0,
      })),
    })),
  }
}

function parseGrupoDetalhe(raw: unknown): CobrancaSeguimentoGrupoDetalhe {
  const d = raw as Record<string, unknown>
  return {
    grupo_chave: String(d.grupo_chave ?? ''),
    titulos: ((d.titulos ?? []) as Array<Record<string, unknown>>).map((t) => ({
      parcela_id: String(t.parcela_id ?? ''),
      pessoa_id: t.pessoa_id != null ? String(t.pessoa_id) : null,
      cliente: t.cliente != null ? String(t.cliente) : null,
      pessoa_nome: t.pessoa_nome != null ? String(t.pessoa_nome) : null,
      grupo_chave: String(t.grupo_chave ?? ''),
      nro_titulo: t.nro_titulo != null ? String(t.nro_titulo) : null,
      parcela: t.parcela != null ? String(t.parcela) : null,
      parcelas: t.parcelas != null ? String(t.parcelas) : null,
      descricao: t.descricao != null ? String(t.descricao) : null,
      plano_contas: t.plano_contas != null ? String(t.plano_contas) : null,
      data_vencimento: String(t.data_vencimento ?? ''),
      valor: Number(t.valor) || 0,
      dias_atraso: Number(t.dias_atraso) || 0,
    })),
    historico_d1: ((d.historico_d1 ?? []) as Array<Record<string, unknown>>).map((h) => ({
      id: String(h.id ?? ''),
      parcela_id: String(h.parcela_id ?? ''),
      nro_titulo: h.nro_titulo != null ? String(h.nro_titulo) : null,
      cliente: h.cliente != null ? String(h.cliente) : null,
      canal: String(h.canal ?? ''),
      status: String(h.status ?? ''),
      created_at: String(h.created_at ?? ''),
      mensagem_resumo: h.mensagem_resumo != null ? String(h.mensagem_resumo) : null,
      created_by: h.created_by != null ? String(h.created_by) : null,
    })),
    acoes_seguimento: ((d.acoes_seguimento ?? []) as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id ?? ''),
      tipo: (a.tipo as CobrancaSeguimentoAcaoTipo) ?? 'outro',
      descricao: String(a.descricao ?? ''),
      data_acao: String(a.data_acao ?? ''),
      data_follow_up: a.data_follow_up != null ? String(a.data_follow_up) : null,
      created_by: a.created_by != null ? String(a.created_by) : null,
      created_at: String(a.created_at ?? ''),
    })),
  }
}

function parseGruposAcima60(raw: unknown): CobrancaSeguimentoGruposAcima60 {
  const d = raw as Record<string, unknown>
  const kpisRaw = (d.kpis ?? {}) as Record<string, unknown>
  return {
    kpis: {
      qtd_grupos: Number(kpisRaw.qtd_grupos) || 0,
      qtd_titulos: Number(kpisRaw.qtd_titulos) || 0,
      valor_total: Number(kpisRaw.valor_total) || 0,
    },
    grupos: ((d.grupos ?? []) as Array<Record<string, unknown>>).map((g) => ({
      grupo_chave: String(g.grupo_chave ?? ''),
      qtd_titulos: Number(g.qtd_titulos) || 0,
      valor_total: Number(g.valor_total) || 0,
      max_dias_atraso: Number(g.max_dias_atraso) || 0,
      qtd_razoes: Number(g.qtd_razoes) || 0,
      pessoa_id_principal: g.pessoa_id_principal != null ? String(g.pessoa_id_principal) : null,
      titulos: ((g.titulos ?? []) as Array<Record<string, unknown>>).map((t) => ({
        parcela_id: String(t.parcela_id ?? ''),
        cliente: t.cliente != null ? String(t.cliente) : null,
        pessoa_nome: t.pessoa_nome != null ? String(t.pessoa_nome) : null,
        nro_titulo: t.nro_titulo != null ? String(t.nro_titulo) : null,
        parcela: t.parcela != null ? String(t.parcela) : null,
        data_vencimento: String(t.data_vencimento ?? ''),
        valor: Number(t.valor) || 0,
        dias_atraso: Number(t.dias_atraso) || 0,
      })),
    })),
  }
}

export const cobrancaSeguimentoService = {
  async fetchDashboard(): Promise<CobrancaSeguimentoDashboard> {
    const { data, error } = await supabase.rpc('cobranca_seguimento_dashboard' as never)
    if (error) {
      console.error('[cobrancaSeguimentoService] fetchDashboard', error)
      throw error
    }
    return parseDashboard(data)
  },

  async fetchGruposAcima60(): Promise<CobrancaSeguimentoGruposAcima60> {
    const { data, error } = await supabase.rpc('cobranca_seguimento_grupos_acima_60' as never)
    if (error) {
      console.error('[cobrancaSeguimentoService] fetchGruposAcima60', error)
      throw error
    }
    return parseGruposAcima60(data)
  },

  async fetchGrupoDetalhe(grupoChave: string): Promise<CobrancaSeguimentoGrupoDetalhe> {
    const { data, error } = await supabase.rpc(
      'cobranca_seguimento_grupo_detalhe' as never,
      { p_grupo_chave: grupoChave } as never,
    )
    if (error) {
      console.error('[cobrancaSeguimentoService] fetchGrupoDetalhe', error)
      throw error
    }
    return parseGrupoDetalhe(data)
  },

  async createAcao(input: CobrancaSeguimentoNovaAcaoInput): Promise<void> {
    const { error } = await supabase.from('cobranca_seguimento_acoes').insert({
      grupo_chave: input.grupo_chave,
      tipo: input.tipo,
      descricao: input.descricao.trim(),
      data_acao: input.data_acao,
      data_follow_up: input.data_follow_up || null,
      created_by: input.created_by ?? null,
    } as never)
    if (error) {
      console.error('[cobrancaSeguimentoService] createAcao', error)
      throw error
    }
  },
}
