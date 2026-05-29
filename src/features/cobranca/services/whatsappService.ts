import { supabase } from '@/lib/supabaseClient'
import { parseEdgeFunctionError } from '../utils/phone'
import type { WhatsappChatRow, WhatsappMensagemRow } from '@/lib/database.types'

export const whatsappService = {
  async listChats(busca?: string): Promise<WhatsappChatRow[]> {
    let query = supabase
      .from('whatsapp_chats')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200)

    const term = busca?.trim()
    if (term) {
      const safe = term.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '')
      query = query.or(`push_name.ilike.%${safe}%,remote_jid.ilike.%${safe}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('[whatsappService] listChats', error)
      return []
    }
    return (data ?? []) as WhatsappChatRow[]
  },

  async fetchMensagens(remoteJid: string): Promise<WhatsappMensagemRow[]> {
    const { data, error } = await supabase
      .from('whatsapp_mensagens')
      .select('*')
      .eq('remote_jid', remoteJid)
      .order('timestamp', { ascending: true, nullsFirst: true })
      .limit(500)
    if (error) {
      console.error('[whatsappService] fetchMensagens', error)
      return []
    }
    return (data ?? []) as WhatsappMensagemRow[]
  },

  async sendMessage(params: { remoteJid?: string; number?: string; text: string }): Promise<void> {
    const { error } = await supabase.functions.invoke('whatsapp-send', { body: params })
    if (error) throw new Error(await parseEdgeFunctionError(error))
  },

  async sync(): Promise<{ conversas?: number }> {
    const { data, error } = await supabase.functions.invoke('whatsapp-sync', { body: {} })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    return data as { conversas?: number }
  },

  async syncConversa(remoteJid: string, limit = 50): Promise<{ mensagens?: number }> {
    const { data, error } = await supabase.functions.invoke('whatsapp-sync', {
      body: { remoteJid, limit },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    return data as { mensagens?: number }
  },

  /** Soma de mensagens não lidas em todas as conversas. */
  async getUnreadTotal(): Promise<number> {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('unread_count')
      .gt('unread_count', 0)
      .limit(1000)
    if (error || !data) return 0
    return (data as { unread_count: number }[]).reduce((acc, r) => acc + (r.unread_count || 0), 0)
  },

  /** Zera o contador de não lidas de uma conversa (ao abrir). */
  async markChatRead(remoteJid: string): Promise<void> {
    await supabase
      .from('whatsapp_chats')
      .update({ unread_count: 0 } as never)
      .eq('remote_jid', remoteJid)
      .gt('unread_count', 0)
  },
}
