import { supabase } from './supabaseClient'
import type { PrioridadeConfig } from '@/features/inadimplencia/services/prioridade'

const KEY_EXIBIR_TAXA_RECUPERACAO_COMITE = 'exibir_taxa_recuperacao_comite'
const KEY_PRIORIDADE_DIAS = 'prioridade_dias'

function isPrioridadeConfig(v: unknown): v is PrioridadeConfig {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.controlado_max === 'number' &&
    typeof o.atencao_min === 'number' &&
    typeof o.atencao_max === 'number' &&
    typeof o.urgente_min === 'number'
  )
}

export const appSettingsService = {
  async getExibirTaxaRecuperacaoComite(): Promise<boolean> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY_EXIBIR_TAXA_RECUPERACAO_COMITE)
      .maybeSingle()
    if (error || !data) return true
    const v = (data as { value: unknown }).value
    return v === true || v === 'true'
  },

  async setExibirTaxaRecuperacaoComite(value: boolean): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY_EXIBIR_TAXA_RECUPERACAO_COMITE, value } as never, { onConflict: 'key' })
    if (error) throw error
  },

  async getPrioridadeConfig(): Promise<PrioridadeConfig | null> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY_PRIORIDADE_DIAS)
      .maybeSingle()
    if (error || !data) return null
    const v = (data as { value: unknown }).value
    return isPrioridadeConfig(v) ? v : null
  },

  async setPrioridadeConfig(config: PrioridadeConfig): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY_PRIORIDADE_DIAS, value: config } as never, { onConflict: 'key' })
    if (error) throw error
  },
}
