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

interface Payload {
  remoteJid: string
  messageId: string
}

/** Monta payload Baileys/Evolution (sem campos extras do ORM da Evolution). */
function buildEvolutionMediaBody(
  raw: Record<string, unknown> | null,
  messageId: string,
  fallbackJid: string,
  tipo: string | null,
): { message: Record<string, unknown>; convertToMp4: boolean } {
  const key = (raw?.key as Record<string, unknown> | undefined) ?? {
    id: messageId,
    remoteJid: fallbackJid,
    fromMe: false,
  }
  const inner = raw?.message as Record<string, unknown> | undefined
  const nested = (inner?.ephemeralMessage as Record<string, unknown> | undefined)?.message ??
    (inner?.viewOnceMessage as Record<string, unknown> | undefined)?.message
  const message: Record<string, unknown> = { key }
  if (inner) message.message = nested ?? inner
  if (raw?.messageType) message.messageType = raw.messageType
  else if (tipo) message.messageType = tipo
  if (raw?.messageTimestamp != null) message.messageTimestamp = raw.messageTimestamp
  return { message, convertToMp4: tipo === 'audioMessage' }
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

  const { remoteJid, messageId } = payload
  if (!remoteJid || !messageId) {
    return jsonResponse({ error: 'remoteJid e messageId são obrigatórios.' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const canonical = canonicalJid(remoteJid)

  const { data: messageRow, error: dbErr } = await supabase
    .from('whatsapp_mensagens')
    .select('raw, tipo, media_meta')
    .eq('message_id', messageId)
    .maybeSingle()

  if (dbErr || !messageRow) {
    return jsonResponse({ error: 'Mensagem não encontrada.' }, 404)
  }

  const raw = messageRow.raw as Record<string, unknown> | null
  const tipo = messageRow.tipo as string | null
  const keyJid = canonicalJid(
    ((raw?.key as Record<string, unknown> | undefined)?.remoteJid as string) ?? canonical,
  )
  const evolutionBody = buildEvolutionMediaBody(raw, messageId, keyJid, tipo)

  try {
    const resp = await fetch(
      `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify(evolutionBody),
        signal: AbortSignal.timeout(60000),
      },
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      // 200 evita spam de 502 no browser; UI trata unavailable.
      return jsonResponse({
        base64: '',
        mimetype: '',
        fileName: null,
        unavailable: true,
        reason: typeof data === 'object' ? JSON.stringify(data) : String(data),
      })
    }

    const base64 = (data.base64 ?? data.data ?? data.file ?? '') as string
    const mimetype = (data.mimetype ??
      (messageRow.media_meta as Record<string, string> | null)?.mimetype ??
      'application/octet-stream') as string
    const fileName = (data.fileName ??
      (messageRow.media_meta as Record<string, string> | null)?.fileName ??
      null) as string | null

    if (!base64) {
      return jsonResponse({
        base64: '',
        mimetype,
        fileName,
        unavailable: true,
        reason: 'Evolution não retornou base64.',
      })
    }

    const meta = {
      ...((messageRow.media_meta as Record<string, unknown> | null) ?? {}),
      cachedAt: new Date().toISOString(),
    }
    await supabase.from('whatsapp_mensagens').update({ media_meta: meta }).eq('message_id', messageId)

    return jsonResponse({ base64, mimetype, fileName })
  } catch (e) {
    return jsonResponse({
      base64: '',
      mimetype: '',
      fileName: null,
      unavailable: true,
      reason: e instanceof Error ? e.message : String(e),
    })
  }
})
