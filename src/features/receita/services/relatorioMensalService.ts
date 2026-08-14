import { supabase } from '@/lib/supabaseClient'

export type RelatorioMensalSecoes = {
  indicadores_operacionais: boolean
  receita_visao_mes: boolean
  receita_composicao: boolean
  receita_inad_grupos: boolean
  receita_grafico_resumo: boolean
  eficiencia_overview: boolean
}

export type RelatorioSecaoKey = keyof RelatorioMensalSecoes

export const SECOES_ORDEM_DEFAULT: RelatorioSecaoKey[] = [
  'indicadores_operacionais',
  'receita_visao_mes',
  'receita_composicao',
  'receita_inad_grupos',
  'receita_grafico_resumo',
  'eficiencia_overview',
]

export type RelatorioMensalConfig = {
  enabled: boolean
  hora_local: string
  timezone: string
  mes_referencia: 'anterior' | 'corrente'
  secoes: RelatorioMensalSecoes
  secoes_ordem: RelatorioSecaoKey[]
  updated_at?: string
}

export type RelatorioMensalDestinatario = {
  id: string
  nome: string
  email: string
  area_key: string | null
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export type RelatorioMensalLogEntry = {
  id: string
  enviado_em: string
  ano: number
  mes: number
  email: string
  status: 'sucesso' | 'erro'
  erro: string | null
  trigger: 'cron' | 'manual' | 'teste'
}

const SECOES_DEFAULT: RelatorioMensalSecoes = {
  indicadores_operacionais: true,
  receita_visao_mes: true,
  receita_composicao: true,
  receita_inad_grupos: true,
  receita_grafico_resumo: false,
  eficiencia_overview: true,
}

function parseSecoes(raw: Record<string, unknown>): {
  secoes: RelatorioMensalSecoes
  secoes_ordem: RelatorioSecaoKey[]
} {
  const secoes = { ...SECOES_DEFAULT }
  for (const key of SECOES_ORDEM_DEFAULT) {
    if (typeof raw[key] === 'boolean' && key !== 'receita_grafico_resumo') secoes[key] = raw[key]
  }
  secoes.receita_grafico_resumo = false

  const ordemRaw = raw.ordem
  let secoes_ordem: RelatorioSecaoKey[] = Array.isArray(ordemRaw)
    ? ordemRaw.filter(
        (k): k is RelatorioSecaoKey =>
          typeof k === 'string' && SECOES_ORDEM_DEFAULT.includes(k as RelatorioSecaoKey),
      )
    : [...SECOES_ORDEM_DEFAULT]

  for (const key of SECOES_ORDEM_DEFAULT) {
    if (!secoes_ordem.includes(key)) secoes_ordem.push(key)
  }

  return { secoes, secoes_ordem }
}

function serializeSecoes(config: RelatorioMensalConfig): Record<string, unknown> {
  return { ordem: config.secoes_ordem, ...config.secoes }
}

function parseConfig(raw: Record<string, unknown>): RelatorioMensalConfig {
  const { secoes, secoes_ordem } = parseSecoes((raw.secoes ?? {}) as Record<string, unknown>)
  return {
    enabled: Boolean(raw.enabled),
    hora_local: String(raw.hora_local ?? '08:00:00').slice(0, 5),
    timezone: String(raw.timezone ?? 'America/Sao_Paulo'),
    mes_referencia: 'corrente',
    secoes,
    secoes_ordem,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  }
}

export const relatorioMensalService = {
  async fetchConfig(): Promise<RelatorioMensalConfig> {
    const { data, error } = await supabase
      .from('relatorio_mensal_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return parseConfig((data ?? {}) as Record<string, unknown>)
  },

  async saveConfig(config: RelatorioMensalConfig): Promise<void> {
    const { error } = await supabase
      .from('relatorio_mensal_config')
      .update({
        enabled: config.enabled,
        hora_local: `${config.hora_local.slice(0, 5)}:00`,
        timezone: config.timezone,
        mes_referencia: 'corrente',
        secoes: serializeSecoes(config),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', 1)
    if (error) throw error
  },

  async fetchDestinatarios(): Promise<RelatorioMensalDestinatario[]> {
    const { data, error } = await supabase
      .from('relatorio_mensal_destinatarios')
      .select('*')
      .order('nome', { ascending: true })
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      nome: String(r.nome ?? ''),
      email: String(r.email ?? ''),
      area_key: r.area_key != null ? String(r.area_key) : null,
      ativo: Boolean(r.ativo),
      created_at: r.created_at != null ? String(r.created_at) : undefined,
      updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
    }))
  },

  async upsertDestinatario(
    dest: Omit<RelatorioMensalDestinatario, 'created_at' | 'updated_at'> & { id?: string },
  ): Promise<void> {
    const row = {
      id: dest.id,
      nome: dest.nome.trim(),
      email: dest.email.trim().toLowerCase(),
      area_key: dest.area_key?.trim() || null,
      ativo: dest.ativo,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('relatorio_mensal_destinatarios').upsert(row as never)
    if (error) throw error
  },

  async deleteDestinatario(id: string): Promise<void> {
    const { error } = await supabase.from('relatorio_mensal_destinatarios').delete().eq('id', id)
    if (error) throw error
  },

  async fetchLog(limit = 30): Promise<RelatorioMensalLogEntry[]> {
    const { data, error } = await supabase
      .from('relatorio_mensal_log')
      .select('*')
      .order('enviado_em', { ascending: false })
      .limit(limit)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      enviado_em: String(r.enviado_em),
      ano: Number(r.ano),
      mes: Number(r.mes),
      email: String(r.email),
      status: r.status === 'erro' ? 'erro' : 'sucesso',
      erro: r.erro != null ? String(r.erro) : null,
      trigger: (r.trigger === 'cron' || r.trigger === 'teste' ? r.trigger : 'manual') as RelatorioMensalLogEntry['trigger'],
    }))
  },

  async invokeEnviar(opts: {
    modo: 'manual' | 'teste'
    ano?: number
    mes?: number
    emailTeste?: string
  }): Promise<{ enviados: number; total: number; results?: Array<{ email: string; ok: boolean; erro?: string }> }> {
    const { data, error } = await supabase.functions.invoke('relatorio-mensal-enviar', {
      body: {
        modo: opts.modo,
        ano: opts.ano,
        mes: opts.mes,
        email_teste: opts.emailTeste,
      },
    })
    if (error) throw error
    const d = data as Record<string, unknown>
    if (d.error) throw new Error(String(d.error))
    return {
      enviados: Number(d.enviados) || 0,
      total: Number(d.total) || 0,
      results: d.results as Array<{ email: string; ok: boolean; erro?: string }> | undefined,
    }
  },
}
