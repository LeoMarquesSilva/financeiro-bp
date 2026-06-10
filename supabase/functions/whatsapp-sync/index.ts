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
  isLidJid,
  resolveEvolutionContactJid,
  isInternalBusinessName,
  isUsableEvolutionContactName,
  extractProfileName,
  pickContactPushName,
  resolvePushNameForUpdate,
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
  /** ISO-8601 — importa só mensagens a partir desta data (útil para backfill do período sem webhook). */
  since?: string
  /** No sync global: também puxa mensagens das conversas recentes. */
  backfillRecent?: boolean
  maxChats?: number
  /** Importa TODAS as mensagens da Evolution desde `since` (sem filtrar por conversa). */
  backfillGlobal?: boolean
  startPage?: number
  maxPages?: number
}

const PAGE_SIZE = 100
/** Início aproximado da falha do webhook (15h BRT em 09/06/2026). */
const OUTAGE_FALLBACK_SINCE = '2026-06-09T18:00:00Z'

function parseSinceTs(since?: string): number | undefined {
  if (!since) return undefined
  const ms = Date.parse(since)
  if (!Number.isFinite(ms)) return undefined
  return Math.floor(ms / 1000)
}

function defaultBackfillSince(): string {
  const outageMs = Date.parse(OUTAGE_FALLBACK_SINCE)
  const hours72 = Date.now() - 72 * 3600 * 1000
  return new Date(Math.min(outageMs, hours72)).toISOString()
}

async function resolveSyncJids(supabase: SupabaseClient, remoteJid: string): Promise<string[]> {
  const canonical = canonicalJid(remoteJid)
  const jids = new Set<string>([canonical])

  if (isLidJid(canonical)) {
    const { data } = await supabase
      .from('whatsapp_chats')
      .select('phone_jid')
      .eq('remote_jid', canonical)
      .maybeSingle()
    if (data?.phone_jid) jids.add(canonicalJid(data.phone_jid as string))
  } else if (!isGroupJid(canonical)) {
    const { data: lidRows } = await supabase
      .from('whatsapp_chats')
      .select('remote_jid')
      .eq('phone_jid', canonical)
      .like('remote_jid', '%@lid')
      .limit(5)
    for (const row of lidRows ?? []) {
      jids.add(canonicalJid((row as { remote_jid: string }).remote_jid))
    }
  }

  return [...jids]
}

async function syncMessagesFromEvolution(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
  queryJid: string,
  opts: { maxMensagens: number; sinceTs?: number; storeAsJid: string },
): Promise<{ gravadas: number; lidas: number }> {
  const headers = { 'Content-Type': 'application/json', apikey: apiKey }
  const inst = encodeURIComponent(instance)
  let gravadas = 0
  let lidas = 0
  let page = 1
  let totalPages = 1

  while (page <= totalPages && lidas < opts.maxMensagens) {
    const where: Record<string, unknown> = { key: { remoteJid: queryJid } }
    if (opts.sinceTs) where.messageTimestamp = { gte: opts.sinceTs }

    const resp = await fetch(`${apiUrl}/chat/findMessages/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ where, page, offset: PAGE_SIZE }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      console.error('[whatsapp-sync] findMessages falhou:', queryJid, JSON.stringify(data))
      break
    }

    const bloco = data?.messages ?? {}
    const records: any[] = bloco.records ?? data?.records ?? (Array.isArray(data) ? data : [])
    if (records.length === 0) break

    gravadas += await upsertMessages(supabase, instance, records, opts.storeAsJid)
    lidas += records.length

    totalPages = Number(bloco.pages ?? 1) || 1
    const current = Number(bloco.currentPage ?? page) || page
    page = current + 1
  }

  return { gravadas, lidas }
}

async function syncConversaCompleta(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
  remoteJid: string,
  opts: { limit?: number; since?: string },
): Promise<{ gravadas: number; lidas: number; membros: number }> {
  const canonical = canonicalJid(remoteJid)
  const sinceIso = opts.since ?? defaultBackfillSince()
  const sinceTs = parseSinceTs(sinceIso)
  const maxMensagens = opts.limit ?? 3000
  const jids = await resolveSyncJids(supabase, canonical)

  const { count: countBefore } = await supabase
    .from('whatsapp_mensagens')
    .select('*', { count: 'exact', head: true })
    .eq('remote_jid', canonical)
    .gte('timestamp', sinceIso)

  let gravadas = 0
  let lidas = 0
  for (const jid of jids) {
    const remaining = Math.max(0, maxMensagens - lidas)
    if (remaining <= 0) break
    const r = await syncMessagesFromEvolution(supabase, apiUrl, instance, apiKey, jid, {
      maxMensagens: remaining,
      sinceTs,
      storeAsJid: canonical,
    })
    gravadas += r.gravadas
    lidas += r.lidas
  }

  await ensureProfilePicture(supabase, apiUrl, instance, apiKey, canonical)

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
  await ensureContactName(supabase, apiUrl, instance, apiKey, canonical, phoneAlt)

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
    ? await syncGroupParticipants(supabase, apiUrl, instance, apiKey, canonical)
    : 0

  const { count: countAfter } = await supabase
    .from('whatsapp_mensagens')
    .select('*', { count: 'exact', head: true })
    .eq('remote_jid', canonical)
    .gte('timestamp', sinceIso)

  const novas = Math.max(0, (countAfter ?? 0) - (countBefore ?? 0))
  return { gravadas: novas, lidas, membros }
}

async function refreshChatsFromBatch(
  supabase: SupabaseClient,
  instance: string,
  records: any[],
): Promise<void> {
  const byJid = new Map<string, { ts: string; preview: string; phoneJid?: string }>()
  for (const msg of records) {
    const rawJid = msg?.key?.remoteJid
    if (!rawJid || rawJid === 'status@broadcast') continue
    const jid = canonicalJid(rawJid)
    if (!isValidWhatsappRemoteJid(jid)) continue
    const ts = toTimestamp(msg.messageTimestamp)
    const preview = extractText(msg.message, msg.messageType)?.slice(0, 120) || ''
    const alt = msg?.key?.remoteJidAlt as string | undefined
    const phoneJid = alt && !alt.includes('@lid') ? canonicalJid(alt) : undefined
    const cur = byJid.get(jid)
    if (!cur || ts > cur.ts) byJid.set(jid, { ts, preview, phoneJid: phoneJid ?? cur?.phoneJid })
  }
  for (const [jid, meta] of byJid) {
    await supabase.from('whatsapp_chats').upsert(
      {
        remote_jid: jid,
        instance,
        last_message_at: meta.ts,
        last_message_preview: meta.preview,
        ...(meta.phoneJid && jid.includes('@lid') ? { phone_jid: meta.phoneJid } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'remote_jid' },
    )
  }
}

/** Puxa mensagens de TODAS as conversas na Evolution desde `since` (paginação em lotes). */
async function backfillGlobalMessages(
  supabase: SupabaseClient,
  apiUrl: string,
  instance: string,
  apiKey: string,
  opts: { sinceIso: string; sinceTs: number; startPage: number; maxPages: number },
): Promise<{
  lidas: number
  processadas: number
  page: number
  nextPage: number
  totalPages: number
  totalEvolution: number
  done: boolean
}> {
  const headers = { 'Content-Type': 'application/json', apikey: apiKey }
  const inst = encodeURIComponent(instance)
  let page = Math.max(1, opts.startPage)
  let totalPages = 1
  let totalEvolution = 0
  let lidas = 0
  let processadas = 0
  let pagesDone = 0

  while (pagesDone < opts.maxPages) {
    const resp = await fetch(`${apiUrl}/chat/findMessages/${inst}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        where: { messageTimestamp: { gte: opts.sinceTs } },
        page,
        offset: PAGE_SIZE,
      }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      console.error('[whatsapp-sync] backfillGlobal falhou:', JSON.stringify(data))
      break
    }

    const bloco = data?.messages ?? {}
    const records: any[] = bloco.records ?? data?.records ?? (Array.isArray(data) ? data : [])
    totalPages = Number(bloco.pages ?? 1) || 1
    totalEvolution = Number(bloco.total ?? data?.total ?? 0) || totalEvolution

    if (records.length === 0) break

    processadas += await upsertMessages(supabase, instance, records)
    await refreshChatsFromBatch(supabase, instance, records)
    lidas += records.length
    pagesDone++
    page = (Number(bloco.currentPage ?? page) || page) + 1
    if (page > totalPages) break
  }

  const done = page > totalPages
  return {
    lidas,
    processadas,
    page: Math.max(1, opts.startPage),
    nextPage: page,
    totalPages,
    totalEvolution,
    done,
  }
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
  return pickContactPushName(c)
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

/** Busca um contato na agenda Evolution (findContacts com filtro por JID). */
async function fetchEvolutionContactByJid(
  apiUrl: string,
  instance: string,
  apiKey: string,
  remoteJid: string,
): Promise<Record<string, unknown> | null> {
  const canonical = canonicalJid(remoteJid)
  if (isGroupJid(canonical) || canonical.includes('@lid')) return null
  try {
    const resp = await fetchWithTimeout(
      `${apiUrl}/chat/findContacts/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ where: { remoteJid: canonical } }),
      },
      12000,
    )
    if (!resp.ok) return null
    const data = await resp.json().catch(() => ({}))
    const contacts: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : (data?.contacts ?? data?.records ?? []) as Record<string, unknown>[]
    return contacts[0] ?? null
  } catch {
    return null
  }
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
    const name = extractProfileName(data as Record<string, unknown>)
    return name
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
      const pushName = pickContactPushName(c)
      if (!pushName) continue
      const { data: existing } = await supabase
        .from('whatsapp_chats')
        .select('push_name')
        .eq('remote_jid', remoteJid)
        .maybeSingle()
      const resolved = resolvePushNameForUpdate(existing?.push_name, c)
      if (!resolved) continue
      await supabase.from('whatsapp_chats').upsert(
        {
          remote_jid: remoteJid,
          push_name: resolved,
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

  const phone = phoneAlt ?? (canonical.includes('@lid') ? null : canonical.split('@')[0])
  const phoneJid = phone ? `${phone.replace(/\D/g, '')}@s.whatsapp.net` : null

  const contactFromAgenda =
    (await fetchEvolutionContactByJid(apiUrl, instance, apiKey, canonical)) ??
    (phoneJid ? await fetchEvolutionContactByJid(apiUrl, instance, apiKey, phoneJid) : null)

  let resolved: string | null = null
  if (contactFromAgenda) {
    resolved = resolvePushNameForUpdate(chat?.push_name, contactFromAgenda)
  }
  if (!resolved && (!chat?.push_name || !isUsableEvolutionContactName(chat.push_name))) {
    const profileName = phone ? await fetchProfileName(apiUrl, instance, apiKey, phone) : null
    resolved = profileName
  }
  if (!resolved) return

  const targets = new Set<string>([canonical])
  if (phoneJid) targets.add(phoneJid)

  for (const jid of targets) {
    await supabase
      .from('whatsapp_chats')
      .update({ push_name: resolved, updated_at: new Date().toISOString() })
      .eq('remote_jid', canonicalJid(jid))
  }
}

/** Aplica nomes cadastrados em pessoa_telefones_whatsapp (Evolution não expõe agenda do celular). */
async function syncCadastroTelefoneNames(supabase: SupabaseClient): Promise<number> {
  const { data: rows, error } = await supabase
    .from('pessoa_telefones_whatsapp')
    .select('telefone, nome')
    .not('nome', 'is', null)
    .limit(5000)
  if (error || !rows?.length) return 0

  let count = 0
  for (const row of rows as { telefone: string; nome: string }[]) {
    const label = row.nome?.trim()
    if (!label || !isUsableEvolutionContactName(label)) continue
    let digits = row.telefone.replace(/\D/g, '')
    if (!digits) continue
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) digits = '55' + digits
    if (digits.length < 12) continue
    const remoteJid = `${digits}@s.whatsapp.net`
    const { error: upErr } = await supabase
      .from('whatsapp_chats')
      .update({ push_name: label, updated_at: new Date().toISOString() })
      .eq('remote_jid', remoteJid)
    if (!upErr) count++
  }
  return count
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
    // Desativado: reimportava milhares de mensagens já existentes (1 upsert/msg) e derrubava o banco.
    if (payload.backfillGlobal) {
      return jsonResponse({
        ok: false,
        error: 'backfillGlobal desativado',
        done: true,
        lidas: 0,
        processadas: 0,
      })
    }

    // Sincroniza mensagens de uma conversa (paginação + JIDs alternativos + filtro since).
    if (payload.remoteJid) {
      const { gravadas, lidas, membros } = await syncConversaCompleta(
        supabase,
        EVOLUTION_API_URL,
        EVOLUTION_INSTANCE,
        EVOLUTION_API_KEY,
        payload.remoteJid,
        { limit: payload.limit, since: payload.since },
      )
      return jsonResponse({ ok: true, mensagens: gravadas, lidas, membros })
    }

    // Sincroniza lista de conversas.
    // best-effort: a Evolution pode retornar 500 em findChats (ex.: bug
    // "Cannot read properties of null (reading 'mediaUrl')" quando algum chat
    // tem mídia nula). Nesse caso, NÃO abortamos o sync: registramos o erro e
    // seguimos para a sincronização de contatos (que corrige os nomes).
    let count = 0
    let chatsError: string | null = null
    const groupsSemNome: string[] = []

    try {
      const resp = await fetchWithTimeout(`${EVOLUTION_API_URL}/chat/findChats/${inst}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        chatsError = typeof data === 'object' ? JSON.stringify(data) : String(data)
        console.error('[whatsapp-sync] findChats falhou:', chatsError)
      } else {
        const chats: any[] = Array.isArray(data) ? data : data?.chats ?? data?.records ?? []
        for (const c of chats) {
          try {
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
              const { data: existingChat } = await supabase
                .from('whatsapp_chats')
                .select('push_name')
                .eq('remote_jid', remoteJid)
                .maybeSingle()
              chatName = resolvePushNameForUpdate(existingChat?.push_name, c)
              if (!chatName && !existingChat?.push_name?.trim()) {
                chatName = extractDirectPushName(c)
              }
            }
            await supabase.from('whatsapp_chats').upsert(
              {
                remote_jid: remoteJid,
                instance: EVOLUTION_INSTANCE,
                ...(chatName ? { push_name: chatName } : {}),
                ...(profilePic ? { profile_pic_url: profilePic } : {}),
                last_message_at: lastTs ? toTimestamp(lastTs) : null,
                last_message_preview:
                  extractText(c.lastMessage?.message, c.lastMessage?.messageType)?.slice(0, 120) || null,
                ...(typeof c.unreadCount === 'number'
                  ? { unread_count: Math.max(0, c.unreadCount) }
                  : {}),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'remote_jid' },
            )
            count++
          } catch (e) {
            // Um chat malformado não interrompe os demais.
            console.error('[whatsapp-sync] chat ignorado:', e instanceof Error ? e.message : String(e))
          }
        }
      }
    } catch (e) {
      chatsError = e instanceof Error ? e.message : String(e)
      console.error('[whatsapp-sync] findChats erro:', chatsError)
    }

    for (const groupJid of groupsSemNome.slice(0, 10)) {
      try {
        await ensureGroupSubject(supabase, EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY, groupJid)
      } catch {
        /* best-effort */
      }
    }

    // Agenda de contatos (findContacts) — corrige os nomes. Roda mesmo que
    // findChats tenha falhado.
    const contatos = await syncEvolutionContacts(
      supabase,
      EVOLUTION_API_URL,
      EVOLUTION_INSTANCE,
      EVOLUTION_API_KEY,
    )
    const cadastroNomes = await syncCadastroTelefoneNames(supabase)

    return jsonResponse({
      ok: true,
      conversas: count,
      contatos,
      cadastroNomes,
      ...(chatsError ? { chatsError } : {}),
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
