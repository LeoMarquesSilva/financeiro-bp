import { supabase } from './supabaseClient'

const KEY_EXIBIR_TAXA_RECUPERACAO_COMITE = 'exibir_taxa_recuperacao_comite'

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
}
