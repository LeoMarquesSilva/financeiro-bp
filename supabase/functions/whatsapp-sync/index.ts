import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  extractText,
  extractMediaMeta,
  extractReactionTo,
  mapStatus,
  canonicalJid,
  isGroupJid,
  isValidWhatsappRemoteJid,
  resolveEvolutionContactJid,
  isInternalBusinessName,
  mergeReaction,
  type ReactionEntry,
} from '../_shared/whatsappMessageUtils.ts'

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
  remoteJid?: string
  limit?: number
}

function toTimestamp(ts: number | string | undefined): string {
  if (ts == null) return new Date().toISOString()
  const n = typeof ts === 'string' ? Number(ts) : ts
  if (!Number.isFinite(n)) return new Date().toISOString()
  return new Date(n * 1000).toISOString()
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

// Remove o sufixo de dispositivo (:NN) do JID, mantendo o domínio.
// Ex.: "553592366669:68@s.whatsapp.net" -> "553592366669@s.whatsapp.net"

// Grava mensagens forçando o remote_jid canônico informado
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
    const remoteJid = forceRemoteJid ? canonicalJid(forceRemoteJid) : canonicalJid(rawJid)
    const conteudo = extractText(msg.message, msg.messageType)
    const timestamp = toTimestamp(msg.messageTimestamp)
    const reactionTo = extractReactionTo(msg.message)
    const mediaMeta = extractMediaMeta(msg.message, msg.messageType)
    const status = mapStatus(msg.status)

    if (msg.messageType === 'reactionMessage' && reactionTo) {
      const emoji = msg.message?.reactionMessage?.text ?? ''
      await mergeReactionOnParent(supabase, reactionTo, emoji, !!msg.key?.fromMe, msg.pushName)
    }

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
        status,
        reaction_to: reactionTo,
        media_meta: mediaMeta,
      },
      { onConflict: 'message_id', ignoreDuplicates: false },
    )
    if (!error) ok++
  }
  return ok
}

function extractDirectPushName(c: Record<string, any>): string | null {
  const pushName = (c.pushName ?? c.name ?? null) as string | null
  return pushName && !isInternalBusinessName(pushName) ? pushName : null
}

function extractGroupSubject(c: Record<string, any>): string | null {
  const subject = (c.subject ?? c.name ?? c.groupName ?? null) as string | null
  return subject?.trim() || null
}

async function fetchGroupInfo(
  apiUrl: string,
  instance: string,
  apiKey: string,
  groupJid: string,
): Promise<{ subject: string | null; picture: string | null }> {
  const canonical = canonicalJid(groupJid)
  const encoded = encodeURIComponent(canonical)
  try {
    const resp = await fetch(
      `${apiUrl}/group/findGroupInfos/${encodeURIComponent(instance)}?groupJid=${encoded}`,
      { headers: { apikey: apiKey } },
    )
    if (!resp.ok) return { subject: null, picture: null }
    const data = await resp.json().catch(() => ({}))
    return {
      subject: (data?.subject ?? data?.group?.subject ?? data?.name ?? null) as string | null,
      picture: (data?.pictureUrl ?? data?.group?.pictureUrl ?? data?.profilePictureUrl ?? null) as
        | string
        | null,
    }
  } catch {
    return { subject: null, picture: null }
  }
}

async function ensureGroupSubject(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
  groupJid: string,
): Promise<void> {
  const canonical = canonicalJid(groupJid)
  if (!isGroupJid(canonical)) return

  const { data: chat } = await supabase
    .from('whatsapp_chats')
    .select('push_name, profile_pic_url')
    .eq('remote_jid', canonical)
    .maybeSingle()

  const info = await fetchGroupInfo(apiUrl, instance, apiKey, canonical)
  const updates: Record<string, string> = { updated_at: new Date().toISOString() }
  if (info.subject) updates.push_name = info.subject
  if (info.picture && !chat?.profile_pic_url) updates.profile_pic_url = info.picture

  if (Object.keys(updates).length > 1) {
    await supabase.from('whatsapp_chats').update(updates).eq('remote_jid', canonical)
  }

  await syncGroupParticipants(supabase, apiUrl, instance, apiKey, canonical)
}

async function syncGroupParticipants(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
  groupJid: string,
): Promise<number> {
  const canonical = canonicalJid(groupJid)
  if (!isGroupJid(canonical)) return 0
  const encoded = encodeURIComponent(canonical)
  try {
    const resp = await fetch(
      `${apiUrl}/group/participants/${encodeURIComponent(instance)}?groupJid=${encoded}`,
      { headers: { apikey: apiKey } },
    )
    if (!resp.ok) return 0
    const data = await resp.json().catch(() => ({}))
    const participants: Record<string, unknown>[] = data?.participants ?? []
    for (const p of participants) {
      const participantJid = (p.id ?? p.jid) as string | undefined
      if (!participantJid) continue
      const lidId = participantJid.split('@')[0]
      const name = ((p.name as string | undefined) ?? '').trim()
      await supabase.from('whatsapp_group_participants').upsert(
        {
          group_jid: canonical,
          participant_jid: participantJid,
          lid_id: lidId,
          phone_number: (p.phoneNumber ?? p.phone ?? null) as string | null,
          display_name: name && !isInternalBusinessName(name) ? name : null,
          profile_pic_url: (p.imgUrl ?? p.profilePicUrl ?? null) as string | null,
          admin_role: (p.admin ?? null) as string | null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'group_jid,participant_jid' },
      )
    }
    return participants.length
  } catch {
    return 0
  }
}

async function fetchProfilePictureUrl(
  apiUrl: string,
  instance: string,
  apiKey: string,
  remoteJid: string,
): Promise<string | null> {
  if (remoteJid.includes('@lid')) return null
  const number = canonicalJid(remoteJid).split('@')[0]
  try {
    const resp = await fetch(
      `${apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number }),
      },
    )
    if (!resp.ok) return null
    const data = await resp.json().catch(() => ({}))
    return (data?.profilePictureUrl ?? data?.profilePicture ?? data?.url ?? null) as string | null
  } catch {
    return null
  }
}

function isUsableEvolutionContactName(name: string | null | undefined): boolean {
  const raw = (name ?? '').trim()
  if (!raw) return false
  if (/^\d+$/.test(raw)) return false
  if (isInternalBusinessName(raw)) return false
  const n = raw.toLowerCase()
  if (n === 'você' || n === 'voce' || n === 'you') return false
  return true
}

/** Nome de perfil WhatsApp via Evolution fetchProfile (best-effort; endpoint pode não existir). */
async function fetchProfileName(
  apiUrl: string,
  instance: string,
  apiKey: string,
  phoneOrJid: string,
): Promise<string | null> {
  if (phoneOrJid.includes('@g.us') || phoneOrJid.includes('@lid')) return null
  const number = canonicalJid(phoneOrJid.includes('@') ? phoneOrJid : `${phoneOrJid}@s.whatsapp.net`)
    .split('@')[0]
  try {
    const resp = await fetch(
      `${apiUrl}/chat/fetchProfile/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number }),
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!resp.ok) return null
    const data = await resp.json().catch(() => ({}))
    const name = (data?.name ?? data?.pushName ?? data?.notify ?? null) as string | null
    return isUsableEvolutionContactName(name) ? name!.trim() : null
  } catch {
    return null
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 25000,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
}

/** Agenda WhatsApp (findContacts) — traz pushName real, não só o número. */
async function syncEvolutionContacts(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
): Promise<number> {
  try {
    const resp = await fetchWithTimeout(
      `${apiUrl}/chat/findContacts/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({}),
      },
      20000,
    )
    if (!resp.ok) return 0
    const data = await resp.json().catch(() => ({}))
    const contacts: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data?.contacts ?? data?.records ?? []) as Record<string, unknown>[]
    let count = 0
    const maxContacts = 500
    for (const c of contacts.slice(0, maxContacts)) {
      const remoteJid = resolveEvolutionContactJid(c)
      if (!remoteJid || isGroupJid(remoteJid) || !isValidWhatsappRemoteJid(remoteJid)) continue
      const pushName = (c.pushName ?? c.name ?? c.verifiedName ?? c.notify ?? null) as string | null
      if (!isUsableEvolutionContactName(pushName)) continue
      await supabase.from('whatsapp_chats').upsert(
        {
          remote_jid: remoteJid,
          push_name: pushName!.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'remote_jid' },
      )
      count++
    }
    return count
  } catch {
    return 0
  }
}

async function ensureContactName(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
  remoteJid: string,
  phoneAlt?: string | null,
): Promise<void> {
  const canonical = canonicalJid(remoteJid)
  const { data: chat } = await supabase
    .from('whatsapp_chats')
    .select('push_name')
    .eq('remote_jid', canonical)
    .maybeSingle()
  if (chat?.push_name && isUsableEvolutionContactName(chat.push_name)) return

  const phone = phoneAlt ?? (canonical.includes('@lid') ? null : canonical.split('@')[0])
  const profileName = phone ? await fetchProfileName(apiUrl, instance, apiKey, phone) : null
  if (!profileName) return

  const targets = new Set<string>([canonical])
  if (phone) targets.add(`${phone.replace(/\D/g, '')}@s.whatsapp.net`)

  for (const jid of targets) {
    await supabase
      .from('whatsapp_chats')
      .update({ push_name: profileName, updated_at: new Date().toISOString() })
      .eq('remote_jid', canonicalJid(jid))
  }
}

async function ensureProfilePicture(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
  remoteJid: string,
): Promise<void> {
  const canonical = canonicalJid(remoteJid)
  if (isGroupJid(canonical)) {
    await ensureGroupSubject(supabase, apiUrl, instance, apiKey, canonical)
    return
  }
  const { data: chat } = await supabase
    .from('whatsapp_chats')
    .select('profile_pic_url')
    .eq('remote_jid', canonical)
    .maybeSingle()
  if (chat?.profile_pic_url) return

  const profilePic = await fetchProfilePictureUrl(apiUrl, instance, apiKey, canonical)
  if (!profilePic) return

  await supabase
    .from('whatsapp_chats')
    .update({ profile_pic_url: profilePic, updated_at: new Date().toISOString() })
    .eq('remote_jid', canonical)
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
      const canonical = canonicalJid(payload.remoteJid)
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

        // Grava com JID canônico para unificar thread no front.
        gravadas += await upsertMessages(supabase, EVOLUTION_INSTANCE, records, canonical)
        lidas += records.length

        totalPages = Number(bloco.pages ?? 1) || 1
        const current = Number(bloco.currentPage ?? page) || page
        page = current + 1
      }

      await ensureProfilePicture(supabase, EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY, canonical)

      const { data: altRow } = await supabase
        .from('whatsapp_mensagens')
        .select('raw')
        .eq('remote_jid', canonical)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      const altKey = (altRow?.raw as Record<string, unknown> | null)?.key as Record<string, unknown> | undefined
      const phoneAlt = altKey?.remoteJidAlt
        ? canonicalJid(altKey.remoteJidAlt as string).split('@')[0]
        : null
      await ensureContactName(
        supabase,
        EVOLUTION_API_URL,
        EVOLUTION_INSTANCE,
        EVOLUTION_API_KEY,
        canonical,
        phoneAlt,
      )

      if (canonical.includes('@lid') && phoneAlt) {
        await supabase
          .from('whatsapp_chats')
          .update({
            phone_jid: `${phoneAlt.replace(/\D/g, '')}@s.whatsapp.net`,
            updated_at: new Date().toISOString(),
          })
          .eq('remote_jid', canonical)
      }

      const membros = isGroupJid(canonical)
        ? await syncGroupParticipants(supabase, EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY, canonical)
        : 0

      return jsonResponse({ ok: true, mensagens: gravadas, lidas, membros })
    }

    // Sincroniza lista de conversas
    const resp = await fetchWithTimeout(`${EVOLUTION_API_URL}/chat/findChats/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) return jsonResponse({ error: JSON.stringify(data) }, 502)

    const chats: any[] = Array.isArray(data) ? data : data?.chats ?? data?.records ?? []
    let count = 0
    const groupsSemNome: string[] = []
    for (const c of chats) {
      const rawJid = c.remoteJid ?? c.id ?? c.jid
      if (!rawJid || rawJid === 'status@broadcast') continue
      const remoteJid = canonicalJid(rawJid)
      const lastTs = c.lastMessage?.messageTimestamp ?? c.updatedAt ?? c.lastMsgTimestamp
      const profilePic = c.profilePicUrl ?? c.profilePictureUrl ?? null
      let chatName: string | null = null
      if (isGroupJid(remoteJid)) {
        chatName = extractGroupSubject(c)
        if (!chatName) groupsSemNome.push(remoteJid)
      } else {
        chatName = extractDirectPushName(c)
      }
      await supabase.from('whatsapp_chats').upsert(
        {
          remote_jid: remoteJid,
          instance: EVOLUTION_INSTANCE,
          ...(chatName ? { push_name: chatName } : {}),
          ...(profilePic ? { profile_pic_url: profilePic } : {}),
          last_message_at: lastTs ? toTimestamp(lastTs) : null,
          last_message_preview: extractText(c.lastMessage?.message, c.lastMessage?.messageType)?.slice(0, 120) || null,
          unread_count: c.unreadCount ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'remote_jid' },
      )
      count++
    }

    for (const groupJid of groupsSemNome.slice(0, 10)) {
      try {
        await ensureGroupSubject(supabase, EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY, groupJid)
      } catch {
        /* best-effort */
      }
    }

    // Participantes de grupo: só em sync por conversa (evita timeout no sync global).
    const contatos = await syncEvolutionContacts(
      supabase,
      EVOLUTION_API_URL,
      EVOLUTION_INSTANCE,
      EVOLUTION_API_KEY,
    )

    return jsonResponse({ ok: true, conversas: count, contatos })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
