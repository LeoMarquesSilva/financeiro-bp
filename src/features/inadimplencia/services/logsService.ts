import { supabase } from '@/lib/supabaseClient'
import type { Database, InadimplenciaTipoAcao } from '@/lib/database.types'

type LogInsert = Database['public']['Tables']['inadimplencia_logs']['Insert']

export interface CreateLogInput {
  client_id: string
  tipo?: InadimplenciaTipoAcao
  descricao?: string | null
  usuario?: string | null
  data_acao?: string
}

export const logsService = {
  async create(input: CreateLogInput) {
    const row: LogInsert = {
      client_id: input.client_id,
      tipo: input.tipo ?? 'outro',
      descricao: input.descricao ?? null,
      usuario: input.usuario ?? null,
      data_acao: input.data_acao ?? new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('inadimplencia_logs')
      .insert(row as never)
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
