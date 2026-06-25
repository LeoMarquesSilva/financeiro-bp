import { supabase } from '@/lib/supabaseClient'
import type {
  OpexIniciativa,
  OpexIniciativaStatus,
  OpexIniciativaTipo,
  OpexMetaTipoResumo,
  OpexMetasEstrategicasConfig,
} from '../types/opexMetas.types'
import { OPEX_META_MIN_INICIATIVAS, OPEX_META_MIN_VALOR_ANUAL } from '../constants/metasEstrategicas'

export const KEY_OPEX_METAS_ESTRATEGICAS = 'opex_metas_estrategicas'

const DEFAULT_CONFIG: OpexMetasEstrategicasConfig = {
  meta_min_iniciativas: OPEX_META_MIN_INICIATIVAS,
  meta_min_valor_anual: OPEX_META_MIN_VALOR_ANUAL,
  iniciativas: [],
}

function isIniciativa(v: unknown): v is OpexIniciativa {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.ano === 'number' &&
    (o.tipo === 'substituicao_ferramenta' || o.tipo === 'desenvolvimento_interno') &&
    typeof o.titulo === 'string' &&
    typeof o.contexto === 'string' &&
    typeof o.valor_anual === 'number' &&
    typeof o.status === 'string' &&
    (o.ci_itens == null || Array.isArray(o.ci_itens))
  )
}

function isConfig(v: unknown): v is OpexMetasEstrategicasConfig {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return Array.isArray(o.iniciativas) && o.iniciativas.every(isIniciativa)
}

function normalizeIniciativa(raw: OpexIniciativa): OpexIniciativa {
  return {
    id: raw.id,
    ano: raw.ano,
    tipo: raw.tipo,
    titulo: raw.titulo.trim(),
    descricao: raw.descricao?.trim() || undefined,
    contexto: raw.contexto.trim(),
    ci_itens: (raw.ci_itens ?? []).map((id) => Number(id)).filter((id) => id > 0),
    valor_anual: Number(raw.valor_anual) || 0,
    status: raw.status as OpexIniciativaStatus,
    data_inicio: raw.data_inicio || null,
    data_conclusao: raw.data_conclusao || null,
    validado_em: raw.validado_em || null,
    validado_por: raw.validado_por?.trim() || null,
    observacoes: raw.observacoes?.trim() || null,
  }
}

function normalizeConfig(raw: OpexMetasEstrategicasConfig): OpexMetasEstrategicasConfig {
  return {
    meta_min_iniciativas: Number(raw.meta_min_iniciativas) || OPEX_META_MIN_INICIATIVAS,
    meta_min_valor_anual: Number(raw.meta_min_valor_anual) || OPEX_META_MIN_VALOR_ANUAL,
    iniciativas: (raw.iniciativas ?? []).map(normalizeIniciativa),
  }
}

function cloneDefault(): OpexMetasEstrategicasConfig {
  return normalizeConfig(DEFAULT_CONFIG)
}

export function resumoPorTipo(
  config: OpexMetasEstrategicasConfig,
  ano: number,
  tipo: OpexIniciativaTipo,
): OpexMetaTipoResumo {
  const lista = config.iniciativas.filter((i) => i.ano === ano && i.tipo === tipo)
  const validadas = lista.filter((i) => i.status === 'validada')
  const valorValidado = validadas.reduce((s, i) => s + i.valor_anual, 0)
  const metaIniciativasOk = validadas.length >= config.meta_min_iniciativas
  const metaValorOk = valorValidado >= config.meta_min_valor_anual

  return {
    tipo,
    total: lista.length,
    validadas: validadas.length,
    valor_validado: valorValidado,
    meta_iniciativas_ok: metaIniciativasOk,
    meta_valor_ok: metaValorOk,
    meta_atingida: metaIniciativasOk && metaValorOk,
  }
}

type AppSettingsRow = { value: unknown }

export const opexMetasService = {
  defaultConfig(): OpexMetasEstrategicasConfig {
    return cloneDefault()
  },

  async fetchRow(): Promise<AppSettingsRow | null> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY_OPEX_METAS_ESTRATEGICAS)
      .maybeSingle()

    if (error) throw new Error(`Não foi possível ler metas OPEX: ${error.message}`)
    if (!data) return null
    return data as AppSettingsRow
  },

  async getConfig(): Promise<OpexMetasEstrategicasConfig> {
    let row = await this.fetchRow()

    if (!row) {
      await this.setConfig(cloneDefault())
      row = await this.fetchRow()
      if (!row) throw new Error('Metas OPEX não encontradas após inicialização.')
    }

    if (!isConfig(row.value)) {
      throw new Error('Valor inválido em app_settings.opex_metas_estrategicas.')
    }

    return normalizeConfig(row.value)
  },

  async setConfig(config: OpexMetasEstrategicasConfig): Promise<void> {
    const payload = normalizeConfig(config)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY_OPEX_METAS_ESTRATEGICAS, value: payload } as never, { onConflict: 'key' })

    if (error) throw new Error(`Não foi possível salvar metas OPEX: ${error.message}`)
  },

  async upsertIniciativa(iniciativa: OpexIniciativa): Promise<OpexMetasEstrategicasConfig> {
    const config = await this.getConfig()
    const normalized = normalizeIniciativa(iniciativa)
    const idx = config.iniciativas.findIndex((i) => i.id === normalized.id)
    const iniciativas =
      idx >= 0
        ? config.iniciativas.map((i, n) => (n === idx ? normalized : i))
        : [...config.iniciativas, normalized]

    const next = { ...config, iniciativas }
    await this.setConfig(next)
    return next
  },

  async removeIniciativa(id: string): Promise<OpexMetasEstrategicasConfig> {
    const config = await this.getConfig()
    const next = { ...config, iniciativas: config.iniciativas.filter((i) => i.id !== id) }
    await this.setConfig(next)
    return next
  },
}
