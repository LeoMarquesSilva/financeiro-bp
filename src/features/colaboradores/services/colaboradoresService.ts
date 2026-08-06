import { supabase } from '@/lib/supabaseClient'
import type { Colaborador, ColaboradorDivergencia } from '../types'

/**
 * colaboradores / colaboradores_divergencias ainda não estão em database.types.ts (tabelas
 * novas, populadas por scripts/sync-colaboradores.mjs) — mesmo padrão de `as never` usado em
 * racionalQuery.ts para tabelas fora do schema gerado.
 */
export const colaboradoresService = {
  async list(): Promise<Colaborador[]> {
    const { data, error } = await supabase
      .from('colaboradores' as never)
      .select('*')
      .order('full_name', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as Colaborador[]
  },

  async listDivergencias(): Promise<ColaboradorDivergencia[]> {
    const { data, error } = await supabase
      .from('colaboradores_divergencias' as never)
      .select('*')
      .order('resolvido', { ascending: true })
      .order('detectado_em', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as ColaboradorDivergencia[]
  },

  async resolverDivergencia(id: string, resolvido: boolean): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela fora do schema gerado (database.types.ts)
    const query = supabase.from('colaboradores_divergencias' as never) as any
    const { error } = await query
      .update({ resolvido, resolvido_em: resolvido ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) throw error
  },
}
