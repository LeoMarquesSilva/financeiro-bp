import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Webhook publico da Evolution API. Autenticacao via secret na query (?secret=...).
// Nao usa JWT (deploy com verify_jwt=false).

interface EvolutionKey {
  remoteJid?: string
  fromMe?: boolean
  id?: string
}

interface EvolutionMessage {
  key?: EvolutionKey
  pushName?: string
  message?: Record<string, unknown>
  messageType?: string
  messageTimestamp?: number | string
}

function extractText(message: Record<string, unknown> | undefined): string {
  if (!message) return ''
  const m = message as Record<string, any>
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    ''
  )
}

function toTimestamp(ts: number | string | undefined): string {
  if (ts == null) return new Date().toISOString()
  const n = typeof ts === 'string' ? Number(ts) : ts
  if (!Number.isFinite(n)) return new Date().toISOString()
  // Evolution envia em segundos
  return new Date(n * 1000).toISOString()
}

async function handleMessage(
  supabase: SupabaseClient,
  instance: string | undefined,
  msg: EvolutionMessage,
) {
  const remoteJid = msg.key?.remoteJid
  if (!remoteJid) return
  // Ignora status broadcast
  if (remoteJid === 'status@broadcast') return

  const conteudo = extractText(msg.message)
  const timestamp = toTimestamp(msg.messageTimestamp)
  const fromMe = !!msg.key?.fromMe

  await supabase
    .from('whatsapp_mensagens')
    .upsert(
      {
        instance: instance ?? null,
        remote_jid: remoteJid,
        message_id: msg.key?.id ?? null,
        from_me: fromMe,
        tipo: msg.messageType ?? null,
        conteudo,
        timestamp,
        raw: msg as unknown as Record<string, unknown>,
      },
      { onConflict: 'message_id', ignoreDuplicates: true },
    )

  await supabase.from('whatsapp_chats').upsert(
    {
      remote_jid: remoteJid,
      instance: instance ?? null,
      push_name: msg.pushName ?? null,
      last_message_at: timestamp,
      last_message_preview: conteudo.slice(0, 120),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'remote_jid' },
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok')
  }

  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  const expected = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')
  if (!expected || secret !== expected) {
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
    } else if (event === 'chats.upsert' || event === 'chats.update') {
      const chats = Array.isArray(data) ? data : data ? [data] : []
      for (const c of chats) {
        const remoteJid = c.remoteJid ?? c.id
        if (!remoteJid || remoteJid === 'status@broadcast') continue
        await supabase.from('whatsapp_chats').upsert(
          {
            remote_jid: remoteJid,
            instance: instance ?? null,
            push_name: c.pushName ?? c.name ?? null,
            unread_count: c.unreadCount ?? undefined,
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
