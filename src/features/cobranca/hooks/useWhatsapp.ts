import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { whatsappService } from '../services/whatsappService'
import { cobrancaService } from '../services/cobrancaService'
import type { CobrancaPainelKpiRow } from '../services/cobrancaService'
import { phoneKey } from '../utils/phone'
import type { CobrancaTituloAbertoRow } from '@/lib/database.types'

/** Carrega os títulos vencidos com telefone, para vincular ao cliente da conversa. */
export function useCobrancaContatos() {
  const query = useQuery({
    queryKey: ['cobranca', 'contatos'],
    queryFn: () => cobrancaService.listPainelComContato(),
    staleTime: 60_000,
  })
  return {
    contatos: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}

/** Mapa telefone (chave DDD+8) -> nome do cliente, para identificar conversas. */
export function useContatoNomes() {
  const query = useQuery({
    queryKey: ['cobranca', 'contato-nomes'],
    queryFn: () => cobrancaService.listContatoNomes(),
    staleTime: 5 * 60_000,
  })
  return useMemo(() => {
    const mapa = new Map<string, string>()
    for (const c of (query.data ?? []) as { telefone: string; nome: string }[]) {
      const k = phoneKey(c.telefone)
      if (k && !mapa.has(k)) mapa.set(k, c.nome)
    }
    return mapa
  }, [query.data])
}

/** Linhas-base do painel (vencimento >= 2026-05-01) para o dashboard de indicadores. */
export function useCobrancaKpiRows() {
  const query = useQuery({
    queryKey: ['cobranca', 'kpi-rows'],
    queryFn: () => cobrancaService.listPainelKpi(),
    staleTime: 30_000,
  })
  return {
    rows: (query.data ?? []) as CobrancaPainelKpiRow[],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}

/** Títulos em aberto (vencidos e a vencer) do cliente vinculado ao telefone da conversa. */
export function useTitulosCliente(numero: string | null) {
  const query = useQuery({
    queryKey: ['cobranca', 'titulos-cliente', numero ?? ''],
    queryFn: () =>
      numero ? cobrancaService.listTitulosPorTelefone(numero) : Promise.resolve([]),
    enabled: !!numero,
    staleTime: 30_000,
  })
  return {
    titulos: (query.data ?? []) as CobrancaTituloAbertoRow[],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}

export function useWhatsappChats(busca?: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['whatsapp', 'chats', busca ?? ''],
    queryFn: () => whatsappService.listChats(busca),
  })

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp_chats_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chats' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp', 'chats'] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return {
    chats: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}

export function useWhatsappConversa(remoteJid: string | null) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['whatsapp', 'conversa', remoteJid],
    queryFn: () => (remoteJid ? whatsappService.fetchMensagens(remoteJid) : Promise.resolve([])),
    enabled: !!remoteJid,
  })

  useEffect(() => {
    if (!remoteJid) return
    const channel = supabase
      .channel(`whatsapp_msgs_${remoteJid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_mensagens',
          filter: `remote_jid=eq.${remoteJid}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversa', remoteJid] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [remoteJid, queryClient])

  return {
    mensagens: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}
