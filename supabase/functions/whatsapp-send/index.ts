import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, '')
  if (digits.length === 0) return null
  digits = digits.replace(/^0+/, '')
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = '55' + digits
  }
  return digits || null
}

interface Payload {
  // Pode informar remoteJid (ex.: 5511...@s.whatsapp.net) ou number cru.
  remoteJid?: string
  number?: string
  text: string
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
    return jsonResponse({ error: 'Evolution API não configurada (secrets ausentes).' }, 500)
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido.' }, 400)
  }

  const text = (payload.text ?? '').trim()
  if (!text) return jsonResponse({ error: 'Mensagem vazia.' }, 400)

  const jid = payload.remoteJid
  const numberFromJid = jid ? jid.split('@')[0] : null
  const numero = normalizePhone(payload.number ?? numberFromJid ?? '')
  if (!numero) return jsonResponse({ error: 'Destinatário inválido.' }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  try {
    const resp = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number: numero, text }),
      },
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)

    const remoteJid = data?.key?.remoteJid ?? jid ?? `${numero}@s.whatsapp.net`
    const messageId = data?.key?.id ?? null
    const now = new Date().toISOString()

    await supabase.from('whatsapp_mensagens').upsert(
      {
        instance: EVOLUTION_INSTANCE,
        remote_jid: remoteJid,
        message_id: messageId,
        from_me: true,
        tipo: 'conversation',
        conteudo: text,
        timestamp: now,
        raw: data,
      },
      { onConflict: 'message_id', ignoreDuplicates: true },
    )
    await supabase.from('whatsapp_chats').upsert(
      {
        remote_jid: remoteJid,
        instance: EVOLUTION_INSTANCE,
        last_message_at: now,
        last_message_preview: text.slice(0, 120),
        updated_at: now,
      },
      { onConflict: 'remote_jid' },
    )

    return jsonResponse({ ok: true, remoteJid, messageId })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
