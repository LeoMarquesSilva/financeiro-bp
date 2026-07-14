import { supabase } from '@/lib/supabaseClient'
import type { ReceitaMetasConfig } from '../types/receita.types'

/** Chave única em `app_settings` — fonte global no Supabase (nunca localStorage). */
export const KEY_RECEITA_METAS = 'receita_metas'

const DEFAULT_METAS: ReceitaMetasConfig = {
  ano: 2026,
  meses: [5, 6, 7, 8, 9, 10, 11, 12],
  meses_meta: [6, 7, 8, 9, 10, 11, 12],
  meta: 1428571.43,
  projetado_base_abril: 1173008.66,
  projetado_real: {
    '5': 1172379.75,
    '6': 1169484.68,
    '7': 1126982.14,
    '8': 1103817.14,
    '9': 1168013.73,
    '10': 1066187.15,
    '11': 1068230.49,
    '12': 1069730.49,
  },
}

function isReceitaMetasConfig(v: unknown): v is ReceitaMetasConfig {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.ano === 'number' &&
    Array.isArray(o.meses) &&
    o.meses.every((m) => typeof m === 'number') &&
    (o.meses_meta == null ||
      (Array.isArray(o.meses_meta) && o.meses_meta.every((m) => typeof m === 'number'))) &&
    typeof o.meta === 'number' &&
    typeof o.projetado_base_abril === 'number' &&
    o.projetado_real != null &&
    typeof o.projetado_real === 'object'
  )
}

/** Normaliza JSON do banco para o formato esperado pela UI. */
function normalizeMetas(raw: ReceitaMetasConfig): ReceitaMetasConfig {
  const projetado_real: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw.projetado_real ?? {})) {
    projetado_real[String(k)] = Number(v) || 0
  }
  return {
    ano: raw.ano,
    meses: [...raw.meses].sort((a, b) => a - b),
    meses_meta: [...(raw.meses_meta ?? raw.meses)]
      .filter((mes) => raw.meses.includes(mes))
      .sort((a, b) => a - b),
    meta: Number(raw.meta) || 0,
    projetado_base_abril: Number(raw.projetado_base_abril) || 0,
    projetado_real,
  }
}

function cloneDefaultMetas(): ReceitaMetasConfig {
  return normalizeMetas(DEFAULT_METAS)
}

type AppSettingsRow = { value: unknown }

export const receitaMetasService = {
  defaultMetas(): ReceitaMetasConfig {
    return cloneDefaultMetas()
  },

  async fetchRow(): Promise<AppSettingsRow | null> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY_RECEITA_METAS)
      .maybeSingle()

    if (error) {
      throw new Error(`Não foi possível ler metas de receita no Supabase: ${error.message}`)
    }
    if (!data) return null
    return data as AppSettingsRow
  },

  /**
   * Carrega metas globais de `app_settings`.
   * Se a linha não existir, grava o padrão no banco e relê (todos os usuários/PCs veem o mesmo).
   */
  async getMetas(): Promise<ReceitaMetasConfig> {
    let row = await this.fetchRow()

    if (!row) {
      await this.setMetas(cloneDefaultMetas())
      row = await this.fetchRow()
      if (!row) {
        throw new Error(
          'Metas de receita não encontradas no Supabase após tentativa de inicialização. Verifique RLS e migrations.',
        )
      }
    }

    if (!isReceitaMetasConfig(row.value)) {
      throw new Error(
        'Valor inválido em app_settings.receita_metas. Corrija no Supabase ou salve novamente em Receita > Editar metas.',
      )
    }

    return normalizeMetas(row.value)
  },

  /** Persiste metas para todos os usuários (upsert em app_settings). */
  async setMetas(config: ReceitaMetasConfig): Promise<void> {
    const payload = normalizeMetas(config)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY_RECEITA_METAS, value: payload } as never, { onConflict: 'key' })

    if (error) {
      throw new Error(`Não foi possível salvar metas no Supabase: ${error.message}`)
    }
  },
}
