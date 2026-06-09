import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  extractText,
  extractMediaMeta,
  canonicalJid,
  phoneFromJidAlt,
  isLidJid,
  mapStatus,
  buildEvolutionQuoted,
  enrichOutgoingRawWithQuote,
  type EvolutionQuoted,
} from '../_shared/whatsappMessageUtils.ts'

// Tempo de "digitando" (presença) antes de enviar — deixa o envio mais natural
// e reduz risco de bloqueio anti-spam do WhatsApp.
const SEND_DELAY_MS = 1200

/** fetch com timeout para não pendurar a function se a Evolution travar. */
function fetchEvolution(url: string, init: RequestInit, ms = 20000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
}

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
  // DDD + número (10 ou 11 dígitos) → acrescenta o código do país.
  // Não usar startsWith('55'): DDD 55 (RS) colide com o código do Brasil.
  // Números já com país têm 12 (55+10) ou 13 (55+11) dígitos.
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits
  }
  return digits || null
}

function stripBase64Prefix(data: string): string {
  const idx = data.indexOf('base64,')
  return idx >= 0 ? data.slice(idx + 7) : data
}

interface QuoteInput {
  messageId: string
  fromMe: boolean
  chatRemoteJid: string
  participant?: string | null
  tipo?: string | null
  conteudo?: string | null
  raw?: Record<string, unknown> | null
}

type Payload =
  | { kind?: 'text'; remoteJid?: string; number?: string; text: string; quote?: QuoteInput }
  | { kind: 'audio'; remoteJid?: string; number?: string; audio: string; quote?: QuoteInput }
  | {
      kind: 'media'
      remoteJid?: string
      number?: string
      mediatype: 'image' | 'video' | 'document'
      media: string
      mimetype: string
      fileName?: string
      caption?: string
      quote?: QuoteInput
    }
  | { kind: 'reaction'; remoteJid: string; messageId: string; fromMe: boolean; emoji: string }

function resolveQuoted(
  quote: QuoteInput | undefined,
  fallbackChatJid: string,
): EvolutionQuoted | undefined {
  if (!quote?.messageId) return undefined
  return buildEvolutionQuoted({
    messageId: quote.messageId,
    fromMe: quote.fromMe,
    chatRemoteJid: quote.chatRemoteJid || fallbackChatJid,
    participant: quote.participant,
    tipo: quote.tipo,
    conteudo: quote.conteudo,
    raw: quote.raw,
  })
}

async function resolveLidPhoneDigits(
  supabase: ReturnType<typeof createClient>,
  lidJid: string,
): Promise<string | null> {
  const canonical = canonicalJid(lidJid)
  const lid = canonical.split('@')[0]
  if (!lid) return null

  const { data: chat } = await supabase
    .from('whatsapp_chats')
    .select('phone_jid')
    .eq('remote_jid', canonical)
    .maybeSingle()
  if (chat?.phone_jid) {
    const digits = normalizePhone(canonicalJid(chat.phone_jid as string).split('@')[0])
    if (digits) return digits
  }

  const { data: part } = await supabase
    .from('whatsapp_group_participants')
    .select('phone_number')
    .eq('lid_id', lid)
    .not('phone_number', 'is', null)
    .limit(1)
    .maybeSingle()
  if (part?.phone_number) {
    const digits = normalizePhone(canonicalJid(part.phone_number as string).split('@')[0])
    if (digits) return digits
  }

  const { data: msgs } = await supabase
    .from('whatsapp_mensagens')
    .select('raw')
    .eq('remote_jid', canonical)
    .order('timestamp', { ascending: false })
    .limit(30)

  for (const row of msgs ?? []) {
    const key = (row.raw as Record<string, unknown> | null)?.key as Record<string, unknown> | undefined
    const alt = phoneFromJidAlt(key?.remoteJidAlt as string | undefined)
    if (alt) {
      const digits = normalizePhone(alt)
      if (digits) return digits
    }
  }
  return null
}

async function resolveNumber(
  supabase: ReturnType<typeof createClient>,
  payload: { remoteJid?: string; number?: string },
): Promise<string | null> {
  const jid = payload.remoteJid
  const isGroup = !!jid?.endsWith('@g.us')
  if (isGroup) return canonicalJid(jid!)

  if (payload.number) {
    const fromNumber = normalizePhone(payload.number)
    if (fromNumber) return fromNumber
  }

  if (jid && isLidJid(jid)) {
    return resolveLidPhoneDigits(supabase, jid)
  }

  const numberFromJid = jid ? canonicalJid(jid).split('@')[0] : null
  return normalizePhone(numberFromJid ?? '')
}

async function persistMessage(
  supabase: ReturnType<typeof createClient>,
  instance: string,
  remoteJid: string,
  data: Record<string, unknown>,
  tipo: string,
  conteudo: string,
  mediaMeta?: Record<string, unknown> | null,
  quoted?: EvolutionQuoted,
) {
  const rawStored = quoted ? enrichOutgoingRawWithQuote(data, quoted) : data
  const tipoStored = quoted && tipo === 'conversation' ? 'extendedTextMessage' : tipo
  const messageId = (data?.key as Record<string, unknown> | undefined)?.id as string | null
  const now = new Date().toISOString()
  const status = mapStatus(data.status) ?? 'PENDING'

  await supabase.from('whatsapp_mensagens').upsert(
    {
      instance,
      remote_jid: remoteJid,
      message_id: messageId,
      from_me: true,
      tipo: tipoStored,
      conteudo,
      timestamp: now,
      raw: rawStored,
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
      const resp = await fetchEvolution(`${EVOLUTION_API_URL}/message/sendReaction/${inst}`, {
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

    const numero = await resolveNumber(supabase, payload)
    if (!numero) {
      const hint = payload.remoteJid && isLidJid(payload.remoteJid)
        ? 'Contato com número oculto (@lid): sincronize a conversa ou vincule pelo telefone cadastrado.'
        : 'Destinatário inválido.'
      return jsonResponse({ error: hint }, 400)
    }
    const isGroup = numero.includes('@g.us')
    const jid = isGroup ? canonicalJid(numero) : `${numero}@s.whatsapp.net`
    const chatJid = payload.remoteJid ? canonicalJid(payload.remoteJid) : jid

    if (payload.kind === 'audio') {
      const audio = stripBase64Prefix(payload.audio.trim())
      if (!audio) return jsonResponse({ error: 'Áudio vazio.' }, 400)
      const quoted = resolveQuoted(payload.quote, chatJid)
      const resp = await fetchEvolution(`${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${inst}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: numero,
          audio,
          delay: SEND_DELAY_MS,
          ...(quoted ? { quoted } : {}),
        }),
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
        quoted,
      )
      return jsonResponse({ ok: true, ...result })
    }

    if (payload.kind === 'media') {
      const media = stripBase64Prefix(payload.media.trim())
      if (!media) return jsonResponse({ error: 'Mídia vazia.' }, 400)
      const quoted = resolveQuoted(payload.quote, chatJid)
      const resp = await fetchEvolution(`${EVOLUTION_API_URL}/message/sendMedia/${inst}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: numero,
          mediatype: payload.mediatype,
          mimetype: payload.mimetype,
          media,
          fileName: payload.fileName,
          caption: payload.caption,
          delay: SEND_DELAY_MS,
          ...(quoted ? { quoted } : {}),
        }),
      }, 60000)
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
      const result = await persistMessage(
        supabase,
        EVOLUTION_INSTANCE,
        remoteJid,
        data,
        tipo,
        conteudo,
        meta,
        quoted,
      )
      return jsonResponse({ ok: true, ...result })
    }

    // Text (default / legacy)
    const textPayload = payload as {
      text: string
      remoteJid?: string
      number?: string
      quote?: QuoteInput
    }
    const text = (textPayload.text ?? '').trim()
    if (!text) return jsonResponse({ error: 'Mensagem vazia.' }, 400)

    const quoted = resolveQuoted(textPayload.quote, chatJid)
    const resp = await fetchEvolution(`${EVOLUTION_API_URL}/message/sendText/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: numero,
        text,
        delay: SEND_DELAY_MS,
        linkPreview: true,
        ...(quoted ? { quoted } : {}),
      }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)

    const remoteJid = canonicalJid((data?.key?.remoteJid as string) ?? jid)
    const result = await persistMessage(
      supabase,
      EVOLUTION_INSTANCE,
      remoteJid,
      data,
      'conversation',
      text,
      null,
      quoted,
    )
    return jsonResponse({ ok: true, ...result })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
