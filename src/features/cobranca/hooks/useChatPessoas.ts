import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { whatsappService } from '../services/whatsappService'

export function useChatPessoas(remoteJid: string | null | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['whatsapp', 'chat-pessoas', remoteJid ?? ''],
    queryFn: () => (remoteJid ? whatsappService.listChatPessoas(remoteJid) : []),
    enabled: !!remoteJid,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (!remoteJid) return
    const channel = supabase
      .channel(`whatsapp_chat_pessoas_${remoteJid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chat_pessoas', filter: `remote_jid=eq.${remoteJid}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp', 'chat-pessoas', remoteJid] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [remoteJid, queryClient])

  return {
    vinculados: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}
