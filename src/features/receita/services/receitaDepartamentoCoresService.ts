import { supabase } from '@/lib/supabaseClient'
import { RECEITA_DEPARTAMENTO_CORES } from '../constants'
import type { ReceitaDepartamentoCoresConfig } from '../types/receita.types'

export const KEY_RECEITA_DEPARTAMENTO_CORES = 'receita_departamento_cores'

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

function cloneDefaultCores(): ReceitaDepartamentoCoresConfig {
  return { ...RECEITA_DEPARTAMENTO_CORES }
}

function normalizeHex(color: string): string | null {
  const trimmed = color.trim()
  if (!trimmed) return null
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!HEX_RE.test(withHash)) return null
  return withHash.toLowerCase()
}

function normalizeCores(raw: ReceitaDepartamentoCoresConfig): ReceitaDepartamentoCoresConfig {
  const out: ReceitaDepartamentoCoresConfig = { ...cloneDefaultCores() }
  for (const [key, value] of Object.entries(raw)) {
    const hex = normalizeHex(String(value))
    if (hex) out[key] = hex
  }
  return out
}

function isDepartamentoCoresConfig(v: unknown): v is ReceitaDepartamentoCoresConfig {
  if (!v || typeof v !== 'object') return false
  return Object.values(v as Record<string, unknown>).every(
    (c) => typeof c === 'string' && HEX_RE.test(c.trim().startsWith('#') ? c.trim() : `#${c.trim()}`),
  )
}

type AppSettingsRow = { value: unknown }

export const receitaDepartamentoCoresService = {
  defaultCores(): ReceitaDepartamentoCoresConfig {
    return cloneDefaultCores()
  },

  mergeWithDefaults(stored: ReceitaDepartamentoCoresConfig | null | undefined): ReceitaDepartamentoCoresConfig {
    if (!stored) return cloneDefaultCores()
    return normalizeCores({ ...cloneDefaultCores(), ...stored })
  },

  async fetchRow(): Promise<AppSettingsRow | null> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY_RECEITA_DEPARTAMENTO_CORES)
      .maybeSingle()

    if (error) {
      throw new Error(`Não foi possível ler cores de áreas no Supabase: ${error.message}`)
    }
    if (!data) return null
    return data as AppSettingsRow
  },

  async getCores(): Promise<ReceitaDepartamentoCoresConfig> {
    let row = await this.fetchRow()

    if (!row) {
      await this.setCores(cloneDefaultCores())
      row = await this.fetchRow()
      if (!row) {
        return cloneDefaultCores()
      }
    }

    if (!isDepartamentoCoresConfig(row.value)) {
      return this.mergeWithDefaults(
        row.value && typeof row.value === 'object'
          ? (row.value as ReceitaDepartamentoCoresConfig)
          : undefined,
      )
    }

    return normalizeCores(row.value as ReceitaDepartamentoCoresConfig)
  },

  async setCores(config: ReceitaDepartamentoCoresConfig): Promise<void> {
    const payload = normalizeCores(config)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY_RECEITA_DEPARTAMENTO_CORES, value: payload } as never, {
        onConflict: 'key',
      })

    if (error) {
      throw new Error(`Não foi possível salvar cores de áreas no Supabase: ${error.message}`)
    }
  },
}
