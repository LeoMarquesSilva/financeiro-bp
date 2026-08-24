import { supabase } from '@/lib/supabaseClient'
import type { OnboardingExclusao, OnboardingExclusaoInsert } from '../types/onboardingExclusoes.types'
import { onboardingGrupoChave } from '../utils/onboardingExclusoes'

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
    const rows = await anexarChavesMatch((data ?? []) as OnboardingExclusao[])
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
      } as never)
      .select('id, grupo_cliente, vigencia_inicio, vigencia_fim, motivo, created_at, updated_at, created_by')
      .single()
    if (error) throw error
    invalidateOnboardingExclusoesCache()
    const [comChaves] = await anexarChavesMatch([data as OnboardingExclusao])
    return comChaves
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
    invalidateOnboardingExclusoesCache()
  },
}

async function anexarChavesMatch(rows: OnboardingExclusao[]): Promise<OnboardingExclusao[]> {
  if (rows.length === 0) return rows
  const grupos = [...new Set(rows.map((r) => r.grupo_cliente).filter(Boolean))]
  const { data, error } = await supabase
    .from('pessoas')
    .select('nome, grupo_cliente')
    .in('grupo_cliente', grupos)
  if (error) {
    return rows.map((r) => ({
      ...r,
      chaves_match: [onboardingGrupoChave(r.grupo_cliente)],
    }))
  }
  return rows.map((r) => {
    const chaveGrupo = onboardingGrupoChave(r.grupo_cliente)
    const chaves = new Set<string>([chaveGrupo])
    for (const p of (data ?? []) as Array<{ nome: string; grupo_cliente: string | null }>) {
      if (onboardingGrupoChave(p.grupo_cliente) === chaveGrupo) {
        const nome = onboardingGrupoChave(p.nome)
        if (nome) chaves.add(nome)
      }
    }
    return { ...r, chaves_match: [...chaves] }
  })
}
