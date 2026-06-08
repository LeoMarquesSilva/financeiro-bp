import { supabase } from '@/lib/supabaseClient'
import { parseEdgeFunctionError, canonicalJid } from '../utils/phone'
import { isGroupJid, isValidWhatsappRemoteJid } from '../utils/jid'
import { phoneFromJidAlt } from '../utils/lidIndex'
import type { WhatsappChatRow, WhatsappMensagemRow } from '@/lib/database.types'
import type { WhatsappChatPessoa } from '../types/cobranca.types'
import {
  WHATSAPP_CATEGORIA_COBRANCA_AUTO,
  type WhatsappChatCategoriaId,
} from '../constants/whatsappCategorias'
import type { GroupParticipantRow } from '../utils/participants'

function isLidJid(jid: string): boolean {
  return jid.includes('@lid')
}

function chatKey(jid: string): string {
  return isLidJid(jid) ? jid : canonicalJid(jid)
}

const avatarDataUrlCache = new Map<string, string>()
const avatarInflight = new Map<string, Promise<string | null>>()

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
    unread_count: (existing.unread_count || 0) + (incoming.unread_count || 0),
    instance: newer.instance ?? older.instance,
    updated_at: newer.updated_at ?? older.updated_at,
    categoria: existing.categoria ?? incoming.categoria ?? null,
    pessoa_id: existing.pessoa_id ?? incoming.pessoa_id ?? null,
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
        const safe = term.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '')
        query = query.or(`push_name.ilike.%${safe}%,remote_jid.ilike.%${safe}%`)
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
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('remote_jid, raw')
        .like('remote_jid', '%@lid')
        .order('timestamp', { ascending: false })
        .limit(2000)
      if (error) return new Map()
      const map = new Map<string, string>()
      for (const row of (data ?? []) as { remote_jid: string; raw: Record<string, unknown> | null }[]) {
        const lid = row.remote_jid.split('@')[0]
        if (!lid || map.has(lid)) continue
        const key = row.raw?.key as Record<string, unknown> | undefined
        const alt = phoneFromJidAlt(key?.remoteJidAlt as string | undefined)
        if (alt) map.set(lid, alt)
      }
      return map
    } catch {
      return new Map()
    }
  },

  async listChats(busca?: string): Promise<WhatsappChatRow[]> {
    const [chats, participants, lidPhone] = await Promise.all([
      this.listChatsRaw(busca),
      this.listLidParticipantRows(),
      this.listLidPhoneMappings(),
    ])
    return dedupeWhatsappChats(chats, buildLidToPhoneJid(participants, lidPhone))
  },

  async fetchMensagens(remoteJid: string): Promise<WhatsappMensagemRow[]> {
    const extraJids: string[] = []
    if (!isLidJid(remoteJid) && !isGroupJid(remoteJid)) {
      const lidJid = await findLinkedLidJid(remoteJid)
      if (lidJid) extraJids.push(lidJid)
    } else if (isLidJid(remoteJid)) {
      const lid = remoteJid.split('@')[0]
      try {
        const { data } = await supabase
          .from('whatsapp_group_participants')
          .select('phone_number')
          .eq('lid_id', lid)
          .limit(1)
        const phone = (data as { phone_number: string | null }[] | null)?.[0]?.phone_number
        if (phone) extraJids.push(canonicalJid(phone))
      } catch {
        /* ignore */
      }
    }

    try {
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('*')
        .or(mensagensFilterParts(remoteJid, extraJids))
        .order('timestamp', { ascending: true, nullsFirst: true })
        .limit(500)

      if (error) {
        console.warn('[whatsappService] fetchMensagens', error.message)
        return []
      }

      const rows = (data ?? []) as WhatsappMensagemRow[]
      const seen = new Set<string>()
      return rows.filter((row) => {
        if (row.tipo === 'reactionMessage') return false
        const id = row.message_id || row.id
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
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

  async sendMessage(params: { remoteJid?: string; number?: string; text: string }): Promise<void> {
    const body = params.remoteJid
      ? { kind: 'text' as const, ...params, remoteJid: canonicalJid(params.remoteJid) }
      : { kind: 'text' as const, ...params }
    const { error } = await supabase.functions.invoke('whatsapp-send', { body })
    if (error) throw new Error(await parseEdgeFunctionError(error))
  },

  async sendAudio(params: { remoteJid: string; audio: string }): Promise<void> {
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        kind: 'audio',
        remoteJid: canonicalJid(params.remoteJid),
        audio: params.audio,
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
  }): Promise<void> {
    const { remoteJid, ...rest } = params
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: { kind: 'media', remoteJid: canonicalJid(remoteJid), ...rest },
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
    return {
      base64: result.base64,
      mimetype: result.mimetype ?? 'application/octet-stream',
      fileName: result.fileName ?? null,
    }
  },

  async sync(): Promise<{ conversas?: number }> {
    const { data, error } = await supabase.functions.invoke('whatsapp-sync', { body: {} })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    return data as { conversas?: number }
  },

  async syncConversa(remoteJid: string, limit = 50): Promise<{ mensagens?: number; membros?: number }> {
    const { data, error } = await supabase.functions.invoke('whatsapp-sync', {
      body: { remoteJid: canonicalJid(remoteJid), limit },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    return data as { mensagens?: number; membros?: number }
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

  /** Soma de mensagens não lidas (conversas deduplicadas, como na lista). */
  async getUnreadTotal(): Promise<number> {
    const chats = await this.listChats()
    return chats.reduce((acc, r) => acc + (r.unread_count || 0), 0)
  },

  /** Quantidade de conversas com pelo menos 1 não lida (filtro "Não lidas"). */
  async getUnreadChatsCount(): Promise<number> {
    const chats = await this.listChats()
    return chats.filter((c) => (c.unread_count ?? 0) > 0).length
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
        .update({ unread_count: 0 } as never)
        .eq('remote_jid', jid)
        .gt('unread_count', 0)
    }
  },

  async updateChatCategoria(
    remoteJid: string,
    categoria: WhatsappChatCategoriaId | null,
  ): Promise<void> {
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
