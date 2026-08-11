import { supabase } from '@/lib/supabaseClient'
import { parseEdgeFunctionError } from '@/features/cobranca/utils/phone'

export type ReportarErroPayload = {
  title: string
  description: string
  route?: string | null
  indicador?: string | null
  modulo?: string | null
  ano?: number | null
  mes?: number | number[] | string | null
  area?: string | null
  screenshot_base64?: string | null
  client_logs?: string | null
  user_agent?: string | null
  error_message?: string | null
  error_stack?: string | null
}

export type ReportarErroResultado = {
  ok: boolean
  ticket_id: string
  screenshot_url?: string | null
  assigned_to_name?: string | null
}

export async function reportarErroSioe(
  payload: ReportarErroPayload,
): Promise<ReportarErroResultado> {
  const { data, error } = await supabase.functions.invoke('reportar-erro-sioe', {
    body: payload,
  })
  if (error) throw new Error(await parseEdgeFunctionError(error))
  if (data?.error) throw new Error(String(data.error))
  return data as ReportarErroResultado
}
