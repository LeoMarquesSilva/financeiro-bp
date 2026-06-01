import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  extractText,
  extractMediaMeta,
  canonicalJid,
} from '../_shared/whatsappMessageUtils.ts'

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

function stripBase64Prefix(data: string): string {
  const idx = data.indexOf('base64,')
  return idx >= 0 ? data.slice(idx + 7) : data
}

type Payload =
  | { kind?: 'text'; remoteJid?: string; number?: string; text: string }
  | { kind: 'audio'; remoteJid?: string; number?: string; audio: string }
  | {
      kind: 'media'
      remoteJid?: string
      number?: string
      mediatype: 'image' | 'video' | 'document'
      media: string
      mimetype: string
      fileName?: string
      caption?: string
    }
  | { kind: 'reaction'; remoteJid: string; messageId: string; fromMe: boolean; emoji: string }

function resolveNumber(payload: { remoteJid?: string; number?: string }): string | null {
  const jid = payload.remoteJid
  const isGroup = !!jid?.endsWith('@g.us')
  const numberFromJid = jid ? canonicalJid(jid).split('@')[0] : null
  return isGroup ? canonicalJid(jid!) : normalizePhone(payload.number ?? numberFromJid ?? '')
}

async function persistMessage(
  supabase: ReturnType<typeof createClient>,
  instance: string,
  remoteJid: string,
  data: Record<string, unknown>,
  tipo: string,
  conteudo: string,
  mediaMeta?: Record<string, unknown> | null,
) {
  const messageId = (data?.key as Record<string, unknown> | undefined)?.id as string | null
  const now = new Date().toISOString()
  const status = (data.status as string | undefined) ?? 'PENDING'

  await supabase.from('whatsapp_mensagens').upsert(
    {
      instance,
      remote_jid: remoteJid,
      message_id: messageId,
      from_me: true,
      tipo,
      conteudo,
      timestamp: now,
      raw: data,
      status,
      media_meta: mediaMeta ?? null,
    },
    { onConflict: 'message_id', ignoreDuplicates: false },
  )

  await supabase.from('whatsapp_chats').upsert(
    {
      remote_jid: remoteJid,
      instance,
      last_message_at: now,
      last_message_preview: conteudo.slice(0, 120),
      updated_at: now,
    },
    { onConflict: 'remote_jid' },
  )

  return { remoteJid, messageId }
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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const inst = encodeURIComponent(EVOLUTION_INSTANCE)
  const headers = { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY }

  try {
    if (payload.kind === 'reaction') {
      const remoteJid = canonicalJid(payload.remoteJid)
      const resp = await fetch(`${EVOLUTION_API_URL}/message/sendReaction/${inst}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: { remoteJid, fromMe: payload.fromMe, id: payload.messageId },
          reaction: payload.emoji,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)
      return jsonResponse({ ok: true, data })
    }

    const numero = resolveNumber(payload)
    if (!numero) return jsonResponse({ error: 'Destinatário inválido.' }, 400)
    const jid = payload.remoteJid ? canonicalJid(payload.remoteJid) : `${numero}@s.whatsapp.net`

    if (payload.kind === 'audio') {
      const audio = stripBase64Prefix(payload.audio.trim())
      if (!audio) return jsonResponse({ error: 'Áudio vazio.' }, 400)
      const resp = await fetch(`${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${inst}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: numero, audio }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)
      const remoteJid = canonicalJid((data?.key?.remoteJid as string) ?? jid)
      const meta = extractMediaMeta(data?.message as Record<string, unknown>, 'audioMessage')
      const result = await persistMessage(
        supabase,
        EVOLUTION_INSTANCE,
        remoteJid,
        data,
        'audioMessage',
        '🎤 Áudio',
        meta,
      )
      return jsonResponse({ ok: true, ...result })
    }

    if (payload.kind === 'media') {
      const media = stripBase64Prefix(payload.media.trim())
      if (!media) return jsonResponse({ error: 'Mídia vazia.' }, 400)
      const resp = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${inst}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: numero,
          mediatype: payload.mediatype,
          mimetype: payload.mimetype,
          media,
          fileName: payload.fileName,
          caption: payload.caption,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)
      const remoteJid = canonicalJid((data?.key?.remoteJid as string) ?? jid)
      const tipo =
        payload.mediatype === 'image'
          ? 'imageMessage'
          : payload.mediatype === 'video'
            ? 'videoMessage'
            : 'documentMessage'
      const conteudo = extractText(data?.message as Record<string, unknown>, tipo) || payload.caption || '📎 Mídia'
      const meta = extractMediaMeta(data?.message as Record<string, unknown>, tipo) ?? {
        mimetype: payload.mimetype,
        fileName: payload.fileName,
        caption: payload.caption,
      }
      const result = await persistMessage(supabase, EVOLUTION_INSTANCE, remoteJid, data, tipo, conteudo, meta)
      return jsonResponse({ ok: true, ...result })
    }

    // Text (default / legacy)
    const textPayload = payload as { text: string; remoteJid?: string; number?: string }
    const text = (textPayload.text ?? '').trim()
    if (!text) return jsonResponse({ error: 'Mensagem vazia.' }, 400)

    const resp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: numero, text }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)

    const remoteJid = canonicalJid((data?.key?.remoteJid as string) ?? jid)
    const result = await persistMessage(supabase, EVOLUTION_INSTANCE, remoteJid, data, 'conversation', text)
    return jsonResponse({ ok: true, ...result })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
