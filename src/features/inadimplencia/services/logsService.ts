import { supabase } from '@/lib/supabaseClient'
import type { InadimplenciaTipoAcao } from '@/lib/database.types'

export interface CreateLogInput {
  client_id: string
  tipo?: InadimplenciaTipoAcao
  descricao?: string | null
  usuario?: string | null
  data_acao?: string
}

export const logsService = {
  async create(input: CreateLogInput) {
    const { data, error } = await supabase
      .from('inadimplencia_logs')
      .insert({
        client_id: input.client_id,
        tipo: input.tipo ?? 'outro',
        descricao: input.descricao ?? null,
        usuario: input.usuario ?? null,
        data_acao: input.data_acao ?? new Date().toISOString(),
      })
      .select()
      .single()
    return { data, error }
  },

  async listByClientId(clientId: string) {
    const { data, error } = await supabase
      .from('inadimplencia_logs')
      .select('*')
      .eq('client_id', clientId)
      .order('data_acao', { ascending: false })
    return { data: data ?? [], error }
  },
}
