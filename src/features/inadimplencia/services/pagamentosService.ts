import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/lib/database.types'

type PagamentoInsert = Database['public']['Tables']['inadimplencia_pagamentos']['Insert']

export interface CreatePagamentoInput {
  client_id: string
  valor_pago: number
  data_pagamento: string
  forma_pagamento?: string | null
  observacao?: string | null
}

export const pagamentosService = {
  async create(input: CreatePagamentoInput) {
    const row: PagamentoInsert = {
      client_id: input.client_id,
      valor_pago: input.valor_pago,
      data_pagamento: input.data_pagamento,
      forma_pagamento: input.forma_pagamento ?? null,
      observacao: input.observacao ?? null,
    }
    const { data, error } = await supabase
      .from('inadimplencia_pagamentos')
      .insert(row as never)
      .select()
      .single()
    return { data, error }
  },

  async listByClientId(clientId: string) {
    const { data, error } = await supabase
      .from('inadimplencia_pagamentos')
      .select('*')
      .eq('client_id', clientId)
      .order('data_pagamento', { ascending: false })
    return { data: data ?? [], error }
  },
}
