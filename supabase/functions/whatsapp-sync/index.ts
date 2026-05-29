import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

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

interface Payload {
  // Se informado, sincroniza apenas as mensagens dessa conversa.
  remoteJid?: string
  // Limite de mensagens por conversa (default 50).
  limit?: number
}

function extractText(message: Record<string, any> | undefined): string {
  if (!message) return ''
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    ''
  )
}

function toTimestamp(ts: number | string | undefined): string {
  if (ts == null) return new Date().toISOString()
  const n = typeof ts === 'string' ? Number(ts) : ts
  if (!Number.isFinite(n)) return new Date().toISOString()
  return new Date(n * 1000).toISOString()
}

// Remove o sufixo de dispositivo (:NN) do JID, mantendo o domínio.
// Ex.: "553592366669:68@s.whatsapp.net" -> "553592366669@s.whatsapp.net"
function canonicalJid(jid: string): string {
  const [user, domain] = jid.split('@')
  const base = (user ?? '').split(':')[0]
  return domain ? `${base}@${domain}` : base
}

// Grava mensagens forçando o remote_jid canônico informado, para que a thread
// do front (que filtra por remote_jid) sempre encontre as mensagens.
async function upsertMessages(
  supabase: SupabaseClient,
  instance: string,
  records: any[],
  forceRemoteJid?: string,
): Promise<number> {
  let ok = 0
  for (const msg of records) {
    const rawJid = msg?.key?.remoteJid
    if (!rawJid || rawJid === 'status@broadcast') continue
    const remoteJid = forceRemoteJid ?? canonicalJid(rawJid)
    const conteudo = extractText(msg.message)
    const timestamp = toTimestamp(msg.messageTimestamp)
    const { error } = await supabase.from('whatsapp_mensagens').upsert(
      {
        instance,
        remote_jid: remoteJid,
        message_id: msg.key?.id ?? null,
        from_me: !!msg.key?.fromMe,
        tipo: msg.messageType ?? null,
        conteudo,
        timestamp,
        raw: msg,
      },
      { onConflict: 'message_id', ignoreDuplicates: true },
    )
    if (!error) ok++
  }
  return ok
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

  let payload: Payload = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const headers = { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY }
  const inst = encodeURIComponent(EVOLUTION_INSTANCE)

  try {
    // Sincroniza mensagens de uma conversa específica (com paginação para puxar todo o histórico).
    if (payload.remoteJid) {
      const maxMensagens = payload.limit ?? 1000
      let page = 1
      let totalPages = 1
      let gravadas = 0
      let lidas = 0

      while (page <= totalPages && lidas < maxMensagens) {
        const resp = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${inst}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            where: { key: { remoteJid: payload.remoteJid } },
            page,
            offset: 100,
          }),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)

        const bloco = data?.messages ?? {}
        const records: any[] = bloco.records ?? data?.records ?? (Array.isArray(data) ? data : [])
        if (records.length === 0) break

        // Grava com o remote_jid original (suffixed/lid) para casar com a conversa selecionada.
        gravadas += await upsertMessages(supabase, EVOLUTION_INSTANCE, records, payload.remoteJid)
        lidas += records.length

        totalPages = Number(bloco.pages ?? 1) || 1
        const current = Number(bloco.currentPage ?? page) || page
        page = current + 1
      }

      return jsonResponse({ ok: true, mensagens: gravadas, lidas })
    }

    // Sincroniza lista de conversas
    const resp = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)

    const chats: any[] = Array.isArray(data) ? data : data?.chats ?? data?.records ?? []
    let count = 0
    for (const c of chats) {
      const remoteJid = c.remoteJid ?? c.id ?? c.jid
      if (!remoteJid || remoteJid === 'status@broadcast') continue
      const lastTs = c.lastMessage?.messageTimestamp ?? c.updatedAt ?? c.lastMsgTimestamp
      await supabase.from('whatsapp_chats').upsert(
        {
          remote_jid: remoteJid,
          instance: EVOLUTION_INSTANCE,
          push_name: c.pushName ?? c.name ?? null,
          profile_pic_url: c.profilePicUrl ?? c.profilePictureUrl ?? null,
          last_message_at: lastTs ? toTimestamp(lastTs) : null,
          last_message_preview: extractText(c.lastMessage?.message)?.slice(0, 120) || null,
          unread_count: c.unreadCount ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'remote_jid' },
      )
      count++
    }

    return jsonResponse({ ok: true, conversas: count })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
