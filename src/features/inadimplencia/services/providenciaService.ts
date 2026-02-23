import { supabase } from '@/lib/supabaseClient'
import type { ProvidenciaFollowUpTipo } from '@/lib/database.types'
import type { ProvidenciaRow, ProvidenciaFollowUpRow } from '@/lib/database.types'

export const PROVIDENCIA_FOLLOW_UP_TIPO_LABEL: Record<ProvidenciaFollowUpTipo, string> = {
  devolutiva: 'Devolutiva',
  cobranca: 'Cobrança',
  acordo: 'Acordo',
}

export const providenciaService = {
  /** Lista providências de um cliente inadimplente (mais recente primeiro). */
  async listByCliente(clienteInadimplenciaId: string) {
    const { data, error } = await supabase
      .from('providencias')
      .select('*')
      .eq('cliente_inadimplencia_id', clienteInadimplenciaId)
      .order('created_at', { ascending: false })
    return { data: (data ?? []) as ProvidenciaRow[], error }
  },

  /** Cria uma providência (coordenadora na reunião do comitê). */
  async create(clienteInadimplenciaId: string, texto: string, createdBy?: string | null) {
    const { data, error } = await supabase
      .from('providencias')
      .insert({
        cliente_inadimplencia_id: clienteInadimplenciaId,
        texto,
        created_by: createdBy ?? null,
      } as never)
      .select()
      .single()
    return { data: data as ProvidenciaRow | null, error }
  },

  /** Lista follow-ups de uma providência (mais recente primeiro). */
  async listFollowUpsByProvidencia(providenciaId: string) {
    const { data, error } = await supabase
      .from('providencia_follow_ups')
      .select('*')
      .eq('providencia_id', providenciaId)
      .order('created_at', { ascending: false })
    return { data: (data ?? []) as ProvidenciaFollowUpRow[], error }
  },

  /** Adiciona follow-up a uma providência (gestor). */
  async addFollowUp(
    providenciaId: string,
    tipo: ProvidenciaFollowUpTipo,
    texto: string | null,
    createdBy?: string | null
  ) {
    const { data, error } = await supabase
      .from('providencia_follow_ups')
      .insert({
        providencia_id: providenciaId,
        tipo,
        texto: texto ?? null,
        created_by: createdBy ?? null,
      } as never)
      .select()
      .single()
    return { data: data as ProvidenciaFollowUpRow | null, error }
  },
}
