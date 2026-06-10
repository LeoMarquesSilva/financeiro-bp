import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  extractText,
  extractMediaMeta,
  extractReactionTo,
  mapStatus,
  canonicalJid,
  isGroupJid,
  isUsableEvolutionContactName,
  pickContactPushName,
  resolvePushNameForUpdate,
  mergeReaction,
  type ReactionEntry,
} from '../_shared/whatsappMessageUtils.ts'
import {
  buildWhatsappPushPayload,
  sendWhatsappPushToSubscribers,
} from '../_shared/sendWhatsappPush.ts'

// Webhook publico da Evolution API. Autenticacao via secret na query (?secret=...).
// Nao usa JWT (deploy com verify_jwt=false).

interface EvolutionKey {
  remoteJid?: string
  fromMe?: boolean
  id?: string
  participant?: string
}

interface EvolutionMessage {
  key?: EvolutionKey
  pushName?: string
  message?: Record<string, unknown>
  messageType?: string
  messageTimestamp?: number | string
  status?: number | string
}

function labelForType(messageType?: string | null): string {
  return extractText(undefined, messageType)
}

function toTimestamp(ts: number | string | undefined): string {
  if (ts == null) return new Date().toISOString()
  const n = typeof ts === 'string' ? Number(ts) : ts
  if (!Number.isFinite(n)) return new Date().toISOString()
  return new Date(n * 1000).toISOString()
}

function extractChatPushName(c: Record<string, any>, remoteJid: string): string | null {
  if (isGroupJid(remoteJid)) {
    const subject = (c.subject ?? c.name ?? c.groupName ?? null) as string | null
    return subject?.trim() || null
  }
  return pickContactPushName(c)
}

async function resolveChatPushNameUpdate(
  supabase: SupabaseClient,
  remoteJid: string,
  c: Record<string, any>,
): Promise<string | null> {
  if (isGroupJid(remoteJid)) return extractChatPushName(c, remoteJid)
  const { data: existing } = await supabase
    .from('whatsapp_chats')
    .select('push_name')
    .eq('remote_jid', remoteJid)
    .maybeSingle()
  return resolvePushNameForUpdate(existing?.push_name, c)
}

async function mergeReactionOnParent(
  supabase: SupabaseClient,
  reactionTo: string,
  emoji: string,
  fromMe: boolean,
  pushName?: string | null,
): Promise<void> {
  const { data: parent } = await supabase
    .from('whatsapp_mensagens')
    .select('reactions')
    .eq('message_id', reactionTo)
    .maybeSingle()
  const reactions = mergeReaction(
    (parent?.reactions as ReactionEntry[] | null) ?? [],
    emoji,
    fromMe,
    pushName,
  )
  await supabase.from('whatsapp_mensagens').update({ reactions }).eq('message_id', reactionTo)
}

async function handleMessage(
  supabase: SupabaseClient,
  instance: string | undefined,
  msg: EvolutionMessage,
) {
  const rawJid = msg.key?.remoteJid
  if (!rawJid) return
  if (rawJid === 'status@broadcast') return
  const remoteJid = canonicalJid(rawJid)

  const conteudo = extractText(msg.message, msg.messageType)
  const timestamp = toTimestamp(msg.messageTimestamp)
  const fromMe = !!msg.key?.fromMe
  const reactionTo = extractReactionTo(msg.message)
  const mediaMeta = extractMediaMeta(msg.message, msg.messageType)
  const status = mapStatus((msg as Record<string, unknown>).status)

  const messageId = msg.key?.id ?? null
  let isNewMessage = !!messageId
  if (messageId) {
    const { data: existingMsg } = await supabase
      .from('whatsapp_mensagens')
      .select('message_id, raw')
      .eq('message_id', messageId)
      .maybeSingle()
    isNewMessage = !existingMsg

    // whatsapp-send pode gravar contextInfo antes; webhook às vezes reenvia só `conversation`.
    const existingRaw = existingMsg?.raw as Record<string, unknown> | null | undefined
    const existingCtx = (existingRaw as Record<string, any> | undefined)?.contextInfo
    const incoming = msg as Record<string, any>
    if (existingCtx?.quotedMessage && !incoming.contextInfo?.quotedMessage) {
      incoming.contextInfo = existingCtx
    }
  }

  if (msg.messageType === 'reactionMessage' && reactionTo) {
    const emoji = ((msg.message as Record<string, any>)?.reactionMessage?.text ?? '') as string
    await mergeReactionOnParent(supabase, reactionTo, emoji, fromMe, msg.pushName)
  }

  await supabase.from('whatsapp_mensagens').upsert(
    {
      instance: instance ?? null,
      remote_jid: remoteJid,
      message_id: msg.key?.id ?? null,
      from_me: fromMe,
      tipo: msg.messageType ?? null,
      conteudo,
      timestamp,
      raw: msg as unknown as Record<string, unknown>,
      status,
      reaction_to: reactionTo,
      media_meta: mediaMeta,
    },
    { onConflict: 'message_id', ignoreDuplicates: false },
  )

  if (msg.messageType === 'reactionMessage') return

  // Mensagem recebida incrementa o contador de não lidas (base do filtro "Não lidas").
  // Enviada por nós não altera o contador. Ignora reentrega do mesmo message_id.
  let unreadCount: number | undefined
  if (!fromMe && isNewMessage) {
    const { data: cur } = await supabase
      .from('whatsapp_chats')
      .select('unread_count')
      .eq('remote_jid', remoteJid)
      .maybeSingle()
    unreadCount = ((cur?.unread_count as number | null) ?? 0) + 1
  }

  await supabase.from('whatsapp_chats').upsert(
    {
      remote_jid: remoteJid,
      instance: instance ?? null,
      last_message_at: timestamp,
      last_message_preview: (conteudo || labelForType(msg.messageType)).slice(0, 120) || null,
      ...(unreadCount !== undefined ? { unread_count: unreadCount } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'remote_jid' },
  )

  // pushName na mensagem é o nome de perfil WhatsApp — só preenche se ainda vazio.
  if (
    !fromMe &&
    !isGroupJid(remoteJid) &&
    msg.pushName &&
    isUsableEvolutionContactName(msg.pushName)
  ) {
    await supabase
      .from('whatsapp_chats')
      .update({ push_name: msg.pushName.trim() })
      .eq('remote_jid', remoteJid)
      .is('push_name', null)
  }

  if (!fromMe) {
    const pushPayload = buildWhatsappPushPayload(
      conteudo || labelForType(msg.messageType),
      remoteJid,
      msg.pushName,
    )
    sendWhatsappPushToSubscribers(supabase, pushPayload).catch((e) =>
      console.error('push notify error', e),
    )
  }
}

async function handleMessageUpdate(supabase: SupabaseClient, update: Record<string, any>) {
  const key = update.key as EvolutionKey | undefined
  if (!key?.id) return

  const patch: Record<string, unknown> = {}

  const statusRaw = update.update?.status ?? update.status
  if (statusRaw != null) {
    patch.status = mapStatus(statusRaw)
  }

  if (Object.keys(patch).length > 0) {
    await supabase.from('whatsapp_mensagens').update(patch).eq('message_id', key.id)
  }

  const reactionMsg = update.update?.message?.reactionMessage ?? update.message?.reactionMessage
  if (reactionMsg) {
    const reactionTo = reactionMsg.key?.id as string | undefined
    const emoji = (reactionMsg.text ?? '') as string
    if (reactionTo) {
      await mergeReactionOnParent(supabase, reactionTo, emoji, !!key.fromMe, update.pushName)
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok')
  }

  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')?.trim() ?? ''
  // Evolution envia ?secret= na URL. Aceita env do Supabase OU o valor configurado na instância.
  const allowedSecrets = new Set(
    [
      Deno.env.get('WHATSAPP_WEBHOOK_SECRET')?.trim(),
      'bp-cobranca-webhook-2026',
    ].filter((s): s is string => !!s),
  )
  if (!secret || !allowedSecrets.has(secret)) {
    console.error('[whatsapp-webhook] unauthorized', {
      hasSecretParam: !!secret,
      allowedCount: allowedSecrets.size,
    })
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawEvent: string = body.event ?? ''
  const event = rawEvent.toLowerCase().replace(/_/g, '.')
  const instance: string | undefined = body.instance
  const data = body.data

  try {
    if (event === 'messages.upsert' || event === 'send.message') {
      const messages: EvolutionMessage[] = Array.isArray(data) ? data : data ? [data] : []
      for (const m of messages) {
        await handleMessage(supabase, instance, m)
      }
    } else if (event === 'messages.update') {
      const updates = Array.isArray(data) ? data : data ? [data] : []
      for (const u of updates) {
        await handleMessageUpdate(supabase, u)
      }
    } else if (event === 'chats.upsert' || event === 'chats.update') {
      const chats = Array.isArray(data) ? data : data ? [data] : []
      for (const c of chats) {
        const rawJid = c.remoteJid ?? c.id
        if (!rawJid || rawJid === 'status@broadcast') continue
        const remoteJid = canonicalJid(rawJid)
        const chatName = await resolveChatPushNameUpdate(supabase, remoteJid, c)
        await supabase.from('whatsapp_chats').upsert(
          {
            remote_jid: remoteJid,
            instance: instance ?? null,
            ...(chatName ? { push_name: chatName } : {}),
            ...(typeof c.unreadCount === 'number'
              ? { unread_count: Math.max(0, c.unreadCount) }
              : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'remote_jid' },
        )
      }
    }
  } catch (e) {
    console.error('webhook error', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
