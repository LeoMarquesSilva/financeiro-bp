import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { canonicalJid } from '../_shared/whatsappMessageUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface ReadMessageKey {
  remoteJid: string
  fromMe: boolean
  id: string
}

interface Payload {
  remoteJid: string
  readMessages?: ReadMessageKey[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '')
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
  const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return jsonResponse({ error: 'Evolution API não configurada.' }, 500)
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido.' }, 400)
  }

  const canonical = canonicalJid(payload.remoteJid ?? '')
  if (!canonical) return jsonResponse({ error: 'remoteJid inválido.' }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let readMessages = payload.readMessages
  if (!readMessages?.length) {
    const { data: rows } = await supabase
      .from('whatsapp_mensagens')
      .select('message_id, from_me')
      .eq('remote_jid', canonical)
      .eq('from_me', false)
      .not('message_id', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(30)
    readMessages = (rows ?? [])
      .filter((r) => r.message_id)
      .map((r) => ({
        remoteJid: canonical,
        fromMe: false,
        id: r.message_id as string,
      }))
  }

  if (readMessages.length === 0) {
    await supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('remote_jid', canonical)
    return jsonResponse({ ok: true, read: 0 })
  }

  try {
    const resp = await fetch(
      `${EVOLUTION_API_URL}/chat/markMessageAsRead/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ readMessages }),
      },
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)

    await supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('remote_jid', canonical)

    return jsonResponse({ ok: true, read: readMessages.length })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
