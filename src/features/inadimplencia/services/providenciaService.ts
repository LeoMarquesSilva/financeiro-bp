import { supabase } from '@/lib/supabaseClient'
import type { ProvidenciaFollowUpTipo } from '@/lib/database.types'
import type { ProvidenciaRow, ProvidenciaFollowUpRow } from '@/lib/database.types'

export const PROVIDENCIA_FOLLOW_UP_TIPO_LABEL: Record<ProvidenciaFollowUpTipo, string> = {
  devolutiva: 'Devolutiva',
  cobranca: 'Cobrança',
  acordo: 'Acordo',
  validar_acordo_comite: 'Validar Acordo Comitê',
  avaliar_devolutiva_comite: 'Avaliar Devolutiva Comitê',
  andamento_negociacao: 'Andamento de Negociação',
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
  async create(
    clienteInadimplenciaId: string,
    texto: string,
    options?: { dataProvidencia?: string | null; createdBy?: string | null }
  ) {
    const { data, error } = await supabase
      .from('providencias')
      .insert({
        cliente_inadimplencia_id: clienteInadimplenciaId,
        texto,
        data_providencia: options?.dataProvidencia ?? null,
        created_by: options?.createdBy ?? null,
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
    createdBy?: string | null,
    dataFollowUp?: string | null
  ) {
    const { data, error } = await supabase
      .from('providencia_follow_ups')
      .insert({
        providencia_id: providenciaId,
        tipo,
        texto: texto ?? null,
        data_follow_up: dataFollowUp ?? null,
        created_by: createdBy ?? null,
      } as never)
      .select()
      .single()
    return { data: data as ProvidenciaFollowUpRow | null, error }
  },

  /** Remove uma providência (e seus follow-ups por cascade). */
  async deleteProvidencia(providenciaId: string) {
    const { error } = await supabase
      .from('providencias')
      .delete()
      .eq('id', providenciaId)
    return { error }
  },

  /** Remove um follow-up. */
  async deleteFollowUp(followUpId: string) {
    const { error } = await supabase
      .from('providencia_follow_ups')
      .delete()
      .eq('id', followUpId)
    return { error }
  },
}
