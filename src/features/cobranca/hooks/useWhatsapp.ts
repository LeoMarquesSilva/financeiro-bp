import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { whatsappService } from '../services/whatsappService'
import { cobrancaService } from '../services/cobrancaService'
import type { CobrancaPainelKpiRow } from '../services/cobrancaService'
import { phoneKey, canonicalJid } from '../utils/phone'
import { buildLidContactIndex, type LidContactEntry, phoneFromJidAlt } from '../utils/lidIndex'
import { isUsableContactName } from '../utils/contactDisplay'
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

/** Índice @lid -> telefone/nome (participantes de grupos + push_name dos chats). */
export function useLidContactIndex() {
  const nomesPorTelefone = useContatoNomes()
  const query = useQuery({
    queryKey: ['whatsapp', 'lid-index'],
    queryFn: async () => {
      const [participants, chatsRes, msgsRes, altMsgsRes] = await Promise.all([
        whatsappService.listLidParticipantRows(),
        supabase.from('whatsapp_chats').select('remote_jid, push_name, phone_jid').limit(1000),
        supabase
          .from('whatsapp_mensagens')
          .select('remote_jid, raw')
          .or('remote_jid.like.%@lid')
          .eq('from_me', false)
          .order('timestamp', { ascending: false })
          .limit(800),
        supabase
          .from('whatsapp_mensagens')
          .select('remote_jid, raw')
          .or('remote_jid.like.%@lid')
          .order('timestamp', { ascending: false })
          .limit(1500),
      ])

      const chatsByPhoneJid = new Map<string, string | null>()
      const lidChatNames = new Map<string, string>()
      const lidToPhoneDigits = new Map<string, string>()
      for (const c of (chatsRes.data ?? []) as {
        remote_jid: string
        push_name: string | null
        phone_jid: string | null
      }[]) {
        if (c.remote_jid.endsWith('@g.us')) continue
        if (c.remote_jid.includes('@lid')) {
          const lid = c.remote_jid.split('@')[0]
          if (lid && isUsableContactName(c.push_name)) lidChatNames.set(lid, c.push_name!.trim())
          const digits = c.phone_jid ? phoneFromJidAlt(c.phone_jid) : null
          if (lid && digits) lidToPhoneDigits.set(lid, digits)
          continue
        }
        chatsByPhoneJid.set(canonicalJid(c.remote_jid), c.push_name)
      }

      const messageNames = new Map<string, string>()
      for (const m of (msgsRes.data ?? []) as { remote_jid: string; raw: Record<string, unknown> | null }[]) {
        const raw = m.raw as Record<string, unknown> | null
        const pushName = (raw?.pushName as string | undefined)?.trim()
        const participant = (raw?.key as Record<string, unknown> | undefined)?.participant as string | undefined
        const targets = [m.remote_jid, participant].filter(Boolean) as string[]
        for (const jid of targets) {
          if (!jid.includes('@lid') || !pushName || !isUsableContactName(pushName)) continue
          const lid = jid.split('@')[0]
          if (lid && !messageNames.has(lid)) messageNames.set(lid, pushName)
        }
      }

      for (const m of (altMsgsRes.data ?? []) as { remote_jid: string; raw: Record<string, unknown> | null }[]) {
        if (!m.remote_jid.includes('@lid')) continue
        const lid = m.remote_jid.split('@')[0]
        if (!lid || lidToPhoneDigits.has(lid)) continue
        const key = (m.raw as Record<string, unknown> | null)?.key as Record<string, unknown> | undefined
        const alt = phoneFromJidAlt(key?.remoteJidAlt as string | undefined)
        if (alt) lidToPhoneDigits.set(lid, alt)
      }

      return { participants, chatsByPhoneJid, lidChatNames, messageNames, lidToPhoneDigits }
    },
    staleTime: 5 * 60_000,
  })

  return useMemo(() => {
    if (!query.data) return new Map<string, LidContactEntry>()
    return buildLidContactIndex(
      query.data.participants,
      query.data.chatsByPhoneJid,
      nomesPorTelefone,
      query.data.lidChatNames,
      query.data.messageNames,
      query.data.lidToPhoneDigits,
    )
  }, [query.data, nomesPorTelefone])
}

/** Linhas-base do painel (vencimento >= 2026-05-01) para o dashboard de indicadores. */
export function useCobrancaKpiRows() {
  const query = useQuery({
    queryKey: ['cobranca', 'kpi-rows'],
    queryFn: () => cobrancaService.listPainelKpi(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  return {
    rows: (query.data ?? []) as CobrancaPainelKpiRow[],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}

/** Títulos em aberto do(s) cliente(s) vinculado(s) ou, na ausência, pelo telefone. */
export function useTitulosCliente(numero: string | null, pessoaIds: string[] = []) {
  const idsKey = pessoaIds.length > 0 ? pessoaIds.slice().sort().join(',') : ''
  const query = useQuery({
    queryKey: ['cobranca', 'titulos-cliente', idsKey, numero ?? ''],
    queryFn: async () => {
      if (pessoaIds.length > 0) return cobrancaService.listTitulosPorPessoaIds(pessoaIds)
      if (numero) return cobrancaService.listTitulosPorTelefone(numero)
      return []
    },
    enabled: pessoaIds.length > 0 || !!numero,
    staleTime: 30_000,
  })
  return {
    titulos: (query.data ?? []) as CobrancaTituloAbertoRow[],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}

export function usePessoaResumo(pessoaId: string | null) {
  const query = useQuery({
    queryKey: ['cobranca', 'pessoa-resumo', pessoaId ?? ''],
    queryFn: () => (pessoaId ? cobrancaService.getPessoaResumo(pessoaId) : Promise.resolve(null)),
    enabled: !!pessoaId,
    staleTime: 60_000,
  })
  return { pessoa: query.data ?? null, loading: query.isLoading }
}

export function useWhatsappChats(busca?: string) {
  const queryClient = useQueryClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = useQuery({
    queryKey: ['whatsapp', 'chats', busca ?? ''],
    queryFn: () => whatsappService.listChats(busca),
    staleTime: 15_000,
  })

  useEffect(() => {
    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp', 'chats'] })
      }, 1200)
    }

    const channel = supabase
      .channel('whatsapp_chats_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chats' },
        invalidate,
      )
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const query = useQuery({
    queryKey: ['whatsapp', 'conversa', remoteJid],
    queryFn: () => (remoteJid ? whatsappService.fetchMensagens(remoteJid) : Promise.resolve([])),
    enabled: !!remoteJid,
  })

  useEffect(() => {
    if (!remoteJid) return

    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversa', remoteJid] })
      }, 800)
    }

    const channel = supabase
      .channel(`whatsapp_msgs_${canonicalJid(remoteJid)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_mensagens' },
        invalidate,
      )
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [remoteJid, queryClient])

  return {
    mensagens: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}

/** Membros de um grupo WhatsApp (cache sincronizado da Evolution). */
export function useGroupParticipants(groupJid: string | null) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['whatsapp', 'group-members', groupJid ?? ''],
    queryFn: () => (groupJid ? whatsappService.listGroupParticipants(groupJid) : Promise.resolve([])),
    enabled: !!groupJid,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!groupJid) return
    const channel = supabase
      .channel(`whatsapp_group_members_${canonicalJid(groupJid)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_group_participants',
          filter: `group_jid=eq.${canonicalJid(groupJid)}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp', 'group-members', groupJid] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [groupJid, queryClient])

  return {
    members: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}
