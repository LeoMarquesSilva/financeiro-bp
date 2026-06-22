import { supabase } from '@/lib/supabaseClient'
import { parseEdgeFunctionError, canonicalJid } from '../utils/phone'
import {
  buildChatSearchOr,
  chatMatchesSearch,
  escapeIlike,
  telefoneToRemoteJid,
} from '../utils/chatSearch'
import { parsePhoneDigits } from '../utils/phoneMask'
import { isGroupJid, isValidWhatsappRemoteJid } from '../utils/jid'
import { phoneFromJidAlt } from '../utils/lidIndex'
import type { WhatsappChatRow, WhatsappMensagemRow } from '@/lib/database.types'
import type { WhatsappChatPessoa } from '../types/cobranca.types'
import { WHATSAPP_CATEGORIA_COBRANCA_AUTO } from '../constants/whatsappCategorias'
import type { GroupParticipantRow } from '../utils/participants'
import type { QuoteSendPayload } from '../utils/quotedMessage'

function isLidJid(jid: string): boolean {
  return jid.includes('@lid')
}

function chatKey(jid: string): string {
  return isLidJid(jid) ? jid : canonicalJid(jid)
}

/** Início do período sem webhook (15h BRT 09/06/2026) — usado no backfill. */
export const WHATSAPP_BACKFILL_SINCE = '2026-06-09T18:00:00Z'

const avatarDataUrlCache = new Map<string, string>()
const avatarInflight = new Map<string, Promise<string | null>>()

type MediaCacheEntry = { base64: string; mimetype: string; fileName: string | null }
const mediaDataUrlCache = new Map<string, string>()
const mediaPayloadCache = new Map<string, MediaCacheEntry>()
const mediaInflight = new Map<string, Promise<MediaCacheEntry>>()
let mediaActiveLoads = 0
const MEDIA_MAX_CONCURRENT = 3
const mediaWaitQueue: Array<() => void> = []

const LID_CACHE_MS = 5 * 60_000
let lidParticipantsCache: Pick<GroupParticipantRow, 'lid_id' | 'phone_number' | 'display_name'>[] | null =
  null
let lidPhoneCache: Map<string, string> | null = null
let lidCacheAt = 0

const MENSAGEM_LIST_COLUMNS =
  'id, message_id, remote_jid, from_me, tipo, conteudo, timestamp, status, reaction_to, reactions, media_meta, instance'

const MENSAGENS_RECENTES_LIMIT = 200
const MENSAGENS_ANTIGAS_LIMIT = 50

function dedupeMensagensRows(rows: WhatsappMensagemRow[]): WhatsappMensagemRow[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (row.tipo === 'reactionMessage') return false
    const id = row.message_id || row.id
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

async function getLidCaches(): Promise<{
  participants: Pick<GroupParticipantRow, 'lid_id' | 'phone_number' | 'display_name'>[]
  lidPhone: Map<string, string>
}> {
  const fresh = Date.now() - lidCacheAt < LID_CACHE_MS
  if (fresh && lidParticipantsCache && lidPhoneCache) {
    return { participants: lidParticipantsCache, lidPhone: lidPhoneCache }
  }
  const [participants, lidPhone] = await Promise.all([
    whatsappService.listLidParticipantRows(),
    whatsappService.listLidPhoneMappings(),
  ])
  lidParticipantsCache = participants
  lidPhoneCache = lidPhone
  lidCacheAt = Date.now()
  return { participants, lidPhone }
}

function mediaCacheKey(remoteJid: string, messageId: string): string {
  return `${chatKey(remoteJid)}|${messageId}`
}

function runNextMediaLoad(): void {
  if (mediaActiveLoads >= MEDIA_MAX_CONCURRENT) return
  const next = mediaWaitQueue.shift()
  if (next) next()
}

async function fetchAvatarDataUrl(remoteJid: string): Promise<string | null> {
  const key = chatKey(remoteJid)
  const cached = avatarDataUrlCache.get(key)
  if (cached) return cached

  const pending = avatarInflight.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-avatar', {
        body: { remoteJid: key },
      })
      if (error) return null
      const result = data as { base64?: string; mimetype?: string; unavailable?: boolean }
      if (result?.unavailable || !result?.base64 || !result?.mimetype) return null
      const dataUrl = `data:${result.mimetype};base64,${result.base64}`
      avatarDataUrlCache.set(key, dataUrl)
      return dataUrl
    } catch {
      return null
    } finally {
      avatarInflight.delete(key)
    }
  })()

  avatarInflight.set(key, promise)
  return promise
}

function pickPushName(
  a: string | null | undefined,
  b: string | null | undefined,
  group: boolean,
): string | null {
  const opts = [a, b]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .filter((v) => {
      if (/^\d+$/.test(v)) return false
      const n = v.toLowerCase()
      if (n === 'você' || n === 'voce') return false
      if (n.includes('bismarchi') && (n.includes('financeiro') || n.includes('advogados'))) return false
      return true
    })
  if (opts.length === 0) return null
  if (group) return opts.sort((x, y) => y.length - x.length)[0]
  return opts[0]
}

function mergeChats(existing: WhatsappChatRow, incoming: WhatsappChatRow, key: string): WhatsappChatRow {
  const existingTs = existing.last_message_at ? new Date(existing.last_message_at).getTime() : 0
  const incomingTs = incoming.last_message_at ? new Date(incoming.last_message_at).getTime() : 0
  const newer = incomingTs >= existingTs ? incoming : existing
  const older = newer === incoming ? existing : incoming
  const group = isGroupJid(key)

  return {
    ...newer,
    remote_jid: key,
    profile_pic_url: existing.profile_pic_url || incoming.profile_pic_url || null,
    push_name: pickPushName(existing.push_name, incoming.push_name, group),
    last_message_at: newer.last_message_at ?? older.last_message_at,
    last_message_preview: newer.last_message_preview ?? older.last_message_preview,
    // Mesma conversa pode existir em @lid + telefone — usa o maior, nunca soma.
    unread_count: Math.max(existing.unread_count || 0, incoming.unread_count || 0),
    instance: newer.instance ?? older.instance,
    updated_at: newer.updated_at ?? older.updated_at,
    categoria: existing.categoria ?? incoming.categoria ?? null,
    pessoa_id: existing.pessoa_id ?? incoming.pessoa_id ?? null,
    phone_jid: existing.phone_jid ?? incoming.phone_jid ?? key,
  }
}

export function buildLidToPhoneJid(
  participants: Pick<GroupParticipantRow, 'lid_id' | 'phone_number'>[],
  lidToPhoneDigits: Map<string, string> = new Map(),
): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of participants) {
    if (!p.lid_id || !p.phone_number) continue
    map.set(p.lid_id, canonicalJid(p.phone_number))
  }
  for (const [lid, phone] of lidToPhoneDigits) {
    if (!map.has(lid) && phone) map.set(lid, `${phone}@s.whatsapp.net`)
  }
  return map
}

export function dedupeWhatsappChats(
  chats: WhatsappChatRow[],
  lidToPhone: Map<string, string>,
): WhatsappChatRow[] {
  const map = new Map<string, WhatsappChatRow>()
  const pendingLid: WhatsappChatRow[] = []

  for (const chat of chats) {
    if (isLidJid(chat.remote_jid)) {
      pendingLid.push(chat)
      continue
    }
    const key = chatKey(chat.remote_jid)
    const current = map.get(key)
    map.set(key, current ? mergeChats(current, chat, key) : { ...chat, remote_jid: key })
  }

  for (const chat of pendingLid) {
    const lid = chat.remote_jid.split('@')[0]
    const phoneJid = lid ? lidToPhone.get(lid) : undefined
    if (phoneJid && map.has(phoneJid)) {
      map.set(phoneJid, mergeChats(map.get(phoneJid)!, chat, phoneJid))
      continue
    }
    const key = chatKey(chat.remote_jid)
    const current = map.get(key)
    map.set(key, current ? mergeChats(current, chat, key) : { ...chat, remote_jid: key })
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return tb - ta
  })
}

function mensagensFilterParts(remoteJid: string, extraJids: string[] = []): string {
  const parts = new Set<string>()
  parts.add(mensagensFilterSingle(remoteJid))
  for (const jid of extraJids) parts.add(mensagensFilterSingle(jid))
  return [...parts].join(',')
}

function mensagensFilterSingle(remoteJid: string): string {
  if (isLidJid(remoteJid)) return `remote_jid.eq.${remoteJid}`
  const canonical = canonicalJid(remoteJid)
  const [user, domain] = canonical.split('@')
  if (!domain) return `remote_jid.eq.${canonical}`
  return `remote_jid.eq.${canonical},remote_jid.like.${user}:%@${domain}`
}

async function findLinkedLidJid(phoneJid: string): Promise<string | null> {
  const canonical = canonicalJid(phoneJid)
  if (isLidJid(canonical) || isGroupJid(canonical)) return null
  const phone = canonical.split('@')[0]

  try {
    const { data: lidRows } = await supabase
      .from('whatsapp_chats')
      .select('remote_jid')
      .eq('phone_jid', canonical)
      .like('remote_jid', '%@lid')
      .limit(1)
    const lidChat = (lidRows as { remote_jid: string }[] | null)?.[0]
    if (lidChat?.remote_jid) return lidChat.remote_jid

    const { data } = await supabase
      .from('whatsapp_group_participants')
      .select('lid_id')
      .or(`phone_number.eq.${canonical},phone_number.like.${phone}@%`)
      .limit(1)
    const lid = (data as { lid_id: string | null }[] | null)?.[0]?.lid_id
    return lid ? `${lid}@lid` : null
  } catch {
    return null
  }
}

async function findLinkedPhoneJid(lidJid: string): Promise<string | null> {
  const canonical = canonicalJid(lidJid)
  if (!isLidJid(canonical)) return null
  const lid = canonical.split('@')[0]
  if (!lid) return null

  try {
    const { data: chatRows } = await supabase
      .from('whatsapp_chats')
      .select('phone_jid')
      .eq('remote_jid', canonical)
      .limit(1)
    const chat = (chatRows as { phone_jid: string | null }[] | null)?.[0]
    if (chat?.phone_jid) return canonicalJid(chat.phone_jid)

    const { data: partRows } = await supabase
      .from('whatsapp_group_participants')
      .select('phone_number')
      .eq('lid_id', lid)
      .not('phone_number', 'is', null)
      .limit(1)
    const part = (partRows as { phone_number: string | null }[] | null)?.[0]
    if (part?.phone_number) return canonicalJid(part.phone_number)

    const { data: msgs } = await supabase
      .from('whatsapp_mensagens')
      .select('raw')
      .eq('remote_jid', canonical)
      .order('timestamp', { ascending: false })
      .limit(5)
    for (const row of (msgs ?? []) as { raw: Record<string, unknown> | null }[]) {
      const key = (row.raw as Record<string, unknown> | null)?.key as Record<string, unknown> | undefined
      const alt = phoneFromJidAlt(key?.remoteJidAlt as string | undefined)
      if (alt) return `${alt}@s.whatsapp.net`
    }
    return null
  } catch {
    return null
  }
}

export const whatsappService = {
  async listLidParticipantRows(): Promise<
    Pick<GroupParticipantRow, 'lid_id' | 'phone_number' | 'display_name'>[]
  > {
    try {
      const { data, error } = await supabase
        .from('whatsapp_group_participants')
        .select('lid_id, phone_number, display_name')
        .not('lid_id', 'is', null)
        .limit(2000)
      if (error) {
        console.warn('[whatsappService] listLidParticipantRows', error.message)
        return []
      }
      return (data ?? []) as Pick<GroupParticipantRow, 'lid_id' | 'phone_number' | 'display_name'>[]
    } catch {
      return []
    }
  },

  async listChatsRaw(busca?: string): Promise<WhatsappChatRow[]> {
    try {
      let query = supabase
        .from('whatsapp_chats')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(400)

      const term = busca?.trim()
      if (term) {
        query = query.or(buildChatSearchOr(term))
      }

      const { data, error } = await query
      if (error) {
        console.warn('[whatsappService] listChatsRaw', error.message)
        return []
      }
      return ((data ?? []) as WhatsappChatRow[]).filter((row) =>
        isValidWhatsappRemoteJid(row.remote_jid),
      )
    } catch (e) {
      console.warn('[whatsappService] listChatsRaw fetch failed', e)
      return []
    }
  },

  async listLidPhoneMappings(): Promise<Map<string, string>> {
    try {
      const [msgsRes, chatsRes] = await Promise.all([
        // Extrai só o campo necessário (remoteJidAlt) no servidor — NUNCA o raw
        // inteiro, que para milhares de linhas estoura o timeout do banco.
        supabase
          .from('whatsapp_mensagens')
          .select('remote_jid, alt:raw->key->>remoteJidAlt')
          .like('remote_jid', '%@lid')
          .not('raw->key->>remoteJidAlt', 'is', null)
          .order('timestamp', { ascending: false })
          .limit(500),
        supabase
          .from('whatsapp_chats')
          .select('remote_jid, phone_jid')
          .like('remote_jid', '%@lid')
          .not('phone_jid', 'is', null),
      ])
      const map = new Map<string, string>()
      for (const row of (chatsRes.data ?? []) as { remote_jid: string; phone_jid: string | null }[]) {
        const lid = row.remote_jid.split('@')[0]
        const digits = row.phone_jid ? phoneFromJidAlt(row.phone_jid) : null
        if (lid && digits) map.set(lid, digits)
      }
      if (msgsRes.error) return map
      for (const row of (msgsRes.data ?? []) as { remote_jid: string; alt: string | null }[]) {
        const lid = row.remote_jid.split('@')[0]
        if (!lid || map.has(lid)) continue
        const alt = phoneFromJidAlt(row.alt ?? undefined)
        if (alt) map.set(lid, alt)
      }
      return map
    } catch {
      return new Map()
    }
  },

  async findChatJidsByCadastroTelefone(term: string): Promise<string[]> {
    const digits = parsePhoneDigits(term)
    if (digits.length < 4) return []
    try {
      const safe = escapeIlike(digits)
      const { data, error } = await supabase
        .from('pessoa_telefones_whatsapp')
        .select('telefone')
        .ilike('telefone', `%${safe}%`)
        .limit(40)
      if (error) return []
      const jids = new Set<string>()
      for (const row of (data ?? []) as { telefone: string }[]) {
        const jid = telefoneToRemoteJid(row.telefone)
        if (jid) jids.add(jid)
      }
      return [...jids]
    } catch {
      return []
    }
  },

  async listChats(busca?: string): Promise<WhatsappChatRow[]> {
    const term = busca?.trim()
    const [{ participants, lidPhone }, chats, cadastroJids] = await Promise.all([
      getLidCaches(),
      this.listChatsRaw(busca),
      term ? this.findChatJidsByCadastroTelefone(term) : Promise.resolve([]),
    ])

    const lidToPhone = buildLidToPhoneJid(participants, lidPhone)
    let merged = chats

    const missingJids = cadastroJids.filter(
      (jid) => !chats.some((c) => canonicalJid(c.remote_jid) === canonicalJid(jid)),
    )
    if (missingJids.length > 0) {
      const { data } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .in('remote_jid', missingJids)
      if (data?.length) {
        merged = [...chats, ...(data as WhatsappChatRow[])]
      }
    }

    const deduped = dedupeWhatsappChats(merged, lidToPhone)
    if (!term) return deduped
    return deduped.filter((chat) => chatMatchesSearch(chat, term, lidToPhone))
  },

  /** JIDs da mesma thread (telefone + @lid vinculado, variantes de dispositivo). */
  async resolveThreadJids(remoteJid: string): Promise<string[]> {
    const canonical = canonicalJid(remoteJid)
    const jids = new Set<string>([canonical])
    if (!isLidJid(canonical) && !isGroupJid(canonical)) {
      const lidJid = await findLinkedLidJid(canonical)
      if (lidJid) jids.add(canonicalJid(lidJid))
    } else if (isLidJid(canonical)) {
      const phoneJid = await findLinkedPhoneJid(canonical)
      if (phoneJid) jids.add(canonicalJid(phoneJid))
    }
    return [...jids]
  },

  /** Últimas N mensagens da thread, em ordem cronológica (mais antiga → mais recente). */
  async fetchMensagens(remoteJid: string): Promise<WhatsappMensagemRow[]> {
    const threadJids = await this.resolveThreadJids(remoteJid)
    const extraJids = threadJids.filter((j) => canonicalJid(j) !== canonicalJid(remoteJid))

    try {
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select(MENSAGEM_LIST_COLUMNS)
        .or(mensagensFilterParts(remoteJid, extraJids))
        .order('timestamp', { ascending: false, nullsFirst: false })
        .limit(MENSAGENS_RECENTES_LIMIT)

      if (error) {
        console.warn('[whatsappService] fetchMensagens', error.message)
        return []
      }

      return dedupeMensagensRows((data ?? []) as WhatsappMensagemRow[]).reverse()
    } catch {
      return []
    }
  },

  /** Mensagens anteriores a `beforeTimestamp` (para scroll infinito para cima). */
  async fetchMensagensAntigas(
    remoteJid: string,
    beforeTimestamp: string,
    limit = MENSAGENS_ANTIGAS_LIMIT,
  ): Promise<WhatsappMensagemRow[]> {
    const threadJids = await this.resolveThreadJids(remoteJid)
    const extraJids = threadJids.filter((j) => canonicalJid(j) !== canonicalJid(remoteJid))

    try {
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select(MENSAGEM_LIST_COLUMNS)
        .or(mensagensFilterParts(remoteJid, extraJids))
        .lt('timestamp', beforeTimestamp)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .limit(limit)

      if (error) {
        console.warn('[whatsappService] fetchMensagensAntigas', error.message)
        return []
      }

      return dedupeMensagensRows((data ?? []) as WhatsappMensagemRow[]).reverse()
    } catch {
      return []
    }
  },

  async fetchAvatar(
    remoteJid: string,
  ): Promise<{ base64: string; mimetype: string } | null> {
    const dataUrl = await fetchAvatarDataUrl(remoteJid)
    if (!dataUrl) return null
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
    if (!match) return null
    return { mimetype: match[1], base64: match[2] }
  },

  /** URL data: pronta para `<img>` (com cache em memória). */
  fetchAvatarDataUrl,

  getCachedAvatarDataUrl(remoteJid: string): string | null {
    return avatarDataUrlCache.get(chatKey(remoteJid)) ?? null
  },

  async resolveSendTarget(remoteJid: string): Promise<{ remoteJid: string; number: string }> {
    if (!isLidJid(remoteJid)) {
      const canonical = canonicalJid(remoteJid)
      return { remoteJid: canonical, number: canonical.split('@')[0] }
    }
    const lid = remoteJid.split('@')[0]
    const [participants, lidPhone] = await Promise.all([
      this.listLidParticipantRows(),
      this.listLidPhoneMappings(),
    ])
    const map = buildLidToPhoneJid(participants, lidPhone)
    const phoneJid = lid ? map.get(lid) : undefined
    if (!phoneJid) {
      throw new Error(
        'Telefone deste contato não está disponível (número oculto). Sincronize a conversa ou vincule pelo telefone cadastrado.',
      )
    }
    const canonical = canonicalJid(phoneJid)
    return { remoteJid: canonical, number: canonical.split('@')[0] }
  },

  async sendMessage(params: {
    remoteJid?: string
    number?: string
    text: string
    quote?: QuoteSendPayload
  }): Promise<void> {
    const target = params.remoteJid
      ? await this.resolveSendTarget(params.remoteJid)
      : null
    const body = target
      ? {
          kind: 'text' as const,
          remoteJid: target.remoteJid,
          number: target.number,
          text: params.text,
          quote: params.quote,
        }
      : { kind: 'text' as const, ...params }
    const { error } = await supabase.functions.invoke('whatsapp-send', { body })
    if (error) throw new Error(await parseEdgeFunctionError(error))
  },

  async sendAudio(params: {
    remoteJid: string
    audio: string
    quote?: QuoteSendPayload
  }): Promise<void> {
    const target = await this.resolveSendTarget(params.remoteJid)
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        kind: 'audio',
        remoteJid: target.remoteJid,
        number: target.number,
        audio: params.audio,
        quote: params.quote,
      },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
  },

  async sendMediaFile(params: {
    remoteJid: string
    mediatype: 'image' | 'video' | 'document'
    media: string
    mimetype: string
    fileName?: string
    caption?: string
    quote?: QuoteSendPayload
  }): Promise<void> {
    const target = await this.resolveSendTarget(params.remoteJid)
    const { mediatype, media, mimetype, fileName, caption, quote } = params
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        kind: 'media',
        remoteJid: target.remoteJid,
        number: target.number,
        mediatype,
        media,
        mimetype,
        fileName,
        caption,
        quote,
      },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
  },

  async sendReaction(params: {
    remoteJid: string
    messageId: string
    fromMe: boolean
    emoji: string
  }): Promise<void> {
    const { remoteJid, messageId, fromMe, emoji } = params
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        kind: 'reaction',
        remoteJid: canonicalJid(remoteJid),
        messageId,
        fromMe,
        emoji,
      },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
  },

  async fetchMedia(
    remoteJid: string,
    messageId: string,
  ): Promise<{ base64: string; mimetype: string; fileName: string | null }> {
    const key = mediaCacheKey(remoteJid, messageId)
    const cached = mediaPayloadCache.get(key)
    if (cached) return cached

    const { data, error } = await supabase.functions.invoke('whatsapp-media', {
      body: { remoteJid: canonicalJid(remoteJid), messageId },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    const result = data as {
      base64?: string
      mimetype?: string
      fileName?: string | null
      unavailable?: boolean
    }
    if (result?.unavailable || !result?.base64) {
      throw new Error('Mídia indisponível no momento.')
    }
    const entry: MediaCacheEntry = {
      base64: result.base64,
      mimetype: result.mimetype ?? 'application/octet-stream',
      fileName: result.fileName ?? null,
    }
    mediaPayloadCache.set(key, entry)
    return entry
  },

  /** Fila de download — evita disparar dezenas de requests à Evolution de uma vez. */
  fetchMediaQueued(
    remoteJid: string,
    messageId: string,
  ): Promise<{ base64: string; mimetype: string; fileName: string | null }> {
    const key = mediaCacheKey(remoteJid, messageId)
    const cached = mediaPayloadCache.get(key)
    if (cached) return Promise.resolve(cached)

    const pending = mediaInflight.get(key)
    if (pending) return pending

    const promise = new Promise<MediaCacheEntry>((resolve, reject) => {
      const run = () => {
        mediaActiveLoads++
        this.fetchMedia(remoteJid, messageId)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            mediaActiveLoads--
            mediaInflight.delete(key)
            runNextMediaLoad()
          })
      }
      if (mediaActiveLoads < MEDIA_MAX_CONCURRENT) run()
      else mediaWaitQueue.push(run)
    })

    mediaInflight.set(key, promise)
    return promise
  },

  cacheMediaDataUrl(remoteJid: string, messageId: string, base64: string, mimetype: string): string {
    const key = mediaCacheKey(remoteJid, messageId)
    const dataUrl = base64.startsWith('data:') ? base64 : `data:${mimetype};base64,${base64}`
    mediaDataUrlCache.set(key, dataUrl)
    return dataUrl
  },

  getCachedMediaDataUrl(remoteJid: string, messageId: string): string | null {
    return mediaDataUrlCache.get(mediaCacheKey(remoteJid, messageId)) ?? null
  },

  async sync(): Promise<{ conversas?: number }> {
    const { data, error } = await supabase.functions.invoke('whatsapp-sync', {
      body: { backfillRecent: false },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    return data as { conversas?: number }
  },

  async syncConversa(
    remoteJid: string,
    opts?: { limit?: number; since?: string },
  ): Promise<{ mensagens?: number; lidas?: number; membros?: number }> {
    const { data, error } = await supabase.functions.invoke('whatsapp-sync', {
      body: {
        remoteJid: canonicalJid(remoteJid),
        limit: opts?.limit ?? 200,
        ...(opts?.since ? { since: opts.since } : {}),
      },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    return data as { mensagens?: number; lidas?: number; membros?: number }
  },

  async listGroupParticipants(groupJid: string): Promise<GroupParticipantRow[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_group_participants')
        .select('*')
        .eq('group_jid', canonicalJid(groupJid))
        .order('display_name', { ascending: true, nullsFirst: false })
      if (error) return []
      return (data ?? []) as GroupParticipantRow[]
    } catch {
      return []
    }
  },

  /** Contagem leve de não lidas (sem recarregar participantes/LID da lista inteira). */
  async getUnreadCounts(): Promise<{ total: number; chats: number }> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('remote_jid, unread_count, phone_jid, push_name, last_message_at, last_message_preview, instance, updated_at, categoria, pessoa_id, profile_pic_url')
        .gt('unread_count', 0)
        .limit(150)
      if (error || !data?.length) return { total: 0, chats: 0 }

      const { lidPhone } = await getLidCaches()
      const deduped = dedupeWhatsappChats(data as WhatsappChatRow[], buildLidToPhoneJid([], lidPhone))
      const withUnread = deduped.filter((c) => (c.unread_count ?? 0) > 0)
      return {
        total: withUnread.reduce((acc, r) => acc + (r.unread_count || 0), 0),
        chats: withUnread.length,
      }
    } catch {
      return { total: 0, chats: 0 }
    }
  },

  async getUnreadTotal(): Promise<number> {
    return (await this.getUnreadCounts()).total
  },

  async getUnreadChatsCount(): Promise<number> {
    return (await this.getUnreadCounts()).chats
  },

  async markChatRead(remoteJid: string): Promise<void> {
    const key = chatKey(remoteJid)

    try {
      await supabase.functions.invoke('whatsapp-read', {
        body: { remoteJid: key },
      })
    } catch {
      /* best-effort Evolution read sync */
    }

    const targets = new Set<string>([key])

    if (!isLidJid(remoteJid) && !isGroupJid(remoteJid)) {
      const lidJid = await findLinkedLidJid(remoteJid)
      if (lidJid) targets.add(lidJid)
      const [user, domain] = key.split('@')
      await supabase
        .from('whatsapp_chats')
        .update({ unread_count: 0 } as never)
        .like('remote_jid', `${user}:%@${domain}`)
        .gt('unread_count', 0)
    }

    for (const jid of targets) {
      await supabase
        .from('whatsapp_chats')
        .update({ unread_count: 0, updated_at: new Date().toISOString() } as never)
        .eq('remote_jid', jid)
    }
  },

  async updateChatCategoria(remoteJid: string, categoria: string | null): Promise<void> {
    const key = chatKey(remoteJid)
    const { error } = await supabase
      .from('whatsapp_chats')
      .update({ categoria, updated_at: new Date().toISOString() } as never)
      .eq('remote_jid', key)
    if (error) throw error
  },

  /** Vincula conversa a um cliente (permite múltiplos vínculos). */
  async addChatPessoa(remoteJid: string, pessoaId: string): Promise<void> {
    const key = chatKey(remoteJid)
    const { error } = await supabase.from('whatsapp_chat_pessoas').insert({
      remote_jid: key,
      pessoa_id: pessoaId,
    } as never)
    if (error && error.code !== '23505') throw error
    await this.syncChatPessoaPrincipal(key)
  },

  /** Remove vínculo de um cliente específico. */
  async removeChatPessoa(remoteJid: string, pessoaId: string): Promise<void> {
    const key = chatKey(remoteJid)
    const { error } = await supabase
      .from('whatsapp_chat_pessoas')
      .delete()
      .eq('remote_jid', key)
      .eq('pessoa_id', pessoaId)
    if (error) throw error
    await this.syncChatPessoaPrincipal(key)
  },

  /** Lista clientes vinculados manualmente à conversa. */
  async listChatPessoas(remoteJid: string): Promise<WhatsappChatPessoa[]> {
    const key = chatKey(remoteJid)
    const { data: links, error } = await supabase
      .from('whatsapp_chat_pessoas')
      .select('pessoa_id')
      .eq('remote_jid', key)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[whatsappService] listChatPessoas', error)
      return []
    }
    if (!links?.length) return []

    const ids = links.map((l) => (l as { pessoa_id: string }).pessoa_id)
    const { data: pessoas, error: pErr } = await supabase
      .from('pessoas')
      .select('id, nome, grupo_cliente')
      .in('id', ids)
    if (pErr) {
      console.error('[whatsappService] listChatPessoas pessoas', pErr)
      return ids.map((id) => ({ pessoa_id: id, nome: 'Cliente', grupo_cliente: null }))
    }

    const byId = new Map(
      ((pessoas ?? []) as { id: string; nome: string; grupo_cliente: string | null }[]).map((p) => [
        p.id,
        p,
      ]),
    )
    return ids.map((id) => {
      const p = byId.get(id)
      return {
        pessoa_id: id,
        nome: p?.nome ?? 'Cliente',
        grupo_cliente: p?.grupo_cliente ?? null,
      }
    })
  },

  /** Mantém pessoa_id legado como o primeiro vínculo (compatibilidade). */
  async syncChatPessoaPrincipal(remoteJid: string): Promise<void> {
    const vinculados = await this.listChatPessoas(remoteJid)
    const principal = vinculados[0]?.pessoa_id ?? null
    await supabase
      .from('whatsapp_chats')
      .update({ pessoa_id: principal, updated_at: new Date().toISOString() } as never)
      .eq('remote_jid', remoteJid)
  },

  /** @deprecated Use addChatPessoa / removeChatPessoa */
  async linkChatPessoa(remoteJid: string, pessoaId: string | null): Promise<void> {
    const key = chatKey(remoteJid)
    if (pessoaId === null) {
      const { error } = await supabase.from('whatsapp_chat_pessoas').delete().eq('remote_jid', key)
      if (error) throw error
      await this.syncChatPessoaPrincipal(key)
      return
    }
    await this.addChatPessoa(key, pessoaId)
  },

  /** Marca conversa como Cobrança (painel / envio de cobrança). Cria o chat se ainda não existir. */
  async ensureChatCategoriaCobranca(remoteJid: string): Promise<void> {
    const key = chatKey(remoteJid)
    const now = new Date().toISOString()
    const { data: row, error: selError } = await supabase
      .from('whatsapp_chats')
      .select('remote_jid')
      .eq('remote_jid', key)
      .maybeSingle()
    if (selError) throw selError
    if (row) {
      await this.updateChatCategoria(key, WHATSAPP_CATEGORIA_COBRANCA_AUTO)
      return
    }
    const { error } = await supabase.from('whatsapp_chats').insert({
      remote_jid: key,
      categoria: WHATSAPP_CATEGORIA_COBRANCA_AUTO,
      unread_count: 0,
      updated_at: now,
    } as never)
    if (error) throw error
  },
}
