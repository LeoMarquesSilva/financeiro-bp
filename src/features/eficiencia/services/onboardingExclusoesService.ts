import { supabase } from '@/lib/supabaseClient'
import type { OnboardingExclusao, OnboardingExclusaoInsert } from '../types/onboardingExclusoes.types'

const TABLE = 'eficiencia_onboarding_exclusoes'

let listCache: { at: number; rows: OnboardingExclusao[] } | null = null
const LIST_CACHE_MS = 15_000

export function invalidateOnboardingExclusoesCache() {
  listCache = null
}

export const onboardingExclusoesService = {
  async list(): Promise<OnboardingExclusao[]> {
    if (listCache && Date.now() - listCache.at < LIST_CACHE_MS) return listCache.rows
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, grupo_cliente, vigencia_inicio, vigencia_fim, motivo, created_at, updated_at, created_by')
      .order('vigencia_inicio', { ascending: false })
      .order('grupo_cliente', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as OnboardingExclusao[]
    listCache = { at: Date.now(), rows }
    return rows
  },

  async create(input: OnboardingExclusaoInsert): Promise<OnboardingExclusao> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        grupo_cliente: input.grupo_cliente.trim(),
        vigencia_inicio: input.vigencia_inicio,
        vigencia_fim: input.vigencia_fim,
        motivo: input.motivo?.trim() || 'Onboarding / transição de carteira',
        created_by: input.created_by ?? null,
      })
      .select('id, grupo_cliente, vigencia_inicio, vigencia_fim, motivo, created_at, updated_at, created_by')
      .single()
    if (error) throw error
    invalidateOnboardingExclusoesCache()
    return data as OnboardingExclusao
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
    invalidateOnboardingExclusoesCache()
  },
}
