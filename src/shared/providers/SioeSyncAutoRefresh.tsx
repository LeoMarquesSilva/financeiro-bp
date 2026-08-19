import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

const HEARTBEAT_FALLBACK_INTERVAL_MS = 15 * 60_000
const REFRESH_DEBOUNCE_MS = 5_000

type SyncScope = 'financeiro' | 'sharepoint'

const FINANCE_QUERY_ROOTS = new Set([
  'cobranca',
  'eficiencia',
  'escritorio',
  'inadimplencia',
  'opex',
  'receita',
  'receita-inadimplencia',
])

const FINANCE_QUERY_PREFIXES = [
  'clientes-escritorio',
  'contagem-ci-por-grupo',
  'escritorio-',
  'horas-por-grupo',
  'parcelas-cliente',
]

function isFinanceQuery(queryKey: readonly unknown[]): boolean {
  const root = String(queryKey[0] ?? '')
  return (
    FINANCE_QUERY_ROOTS.has(root) ||
    FINANCE_QUERY_PREFIXES.some((prefix) => root.startsWith(prefix))
  )
}

function isSharepointQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'eficiencia'
}

function scopeFromSource(source: unknown): SyncScope {
  return source === 'sharepoint' ? 'sharepoint' : 'financeiro'
}

/**
 * Mantém os dados visíveis sincronizados com as cargas VIOS e SharePoint.
 * O banco publica somente um heartbeat; filtros e navegação são preservados.
 */
export function SioeSyncAutoRefresh() {
  const queryClient = useQueryClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingWhileHiddenRef = useRef(false)
  const pendingScopeRef = useRef<SyncScope | null>(null)
  const lastVersionRef = useRef<number | null>(null)

  useEffect(() => {
    const armRefresh = () => {
      if (document.visibilityState !== 'visible') {
        pendingWhileHiddenRef.current = true
        return
      }

      pendingWhileHiddenRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const scope = pendingScopeRef.current
        pendingScopeRef.current = null
        if (!scope) return

        void queryClient.invalidateQueries({
          predicate: (query: { queryKey: readonly unknown[] }) =>
            scope === 'financeiro'
              ? isFinanceQuery(query.queryKey)
              : isSharepointQuery(query.queryKey),
          refetchType: 'active',
        })
      }, REFRESH_DEBOUNCE_MS)
    }

    const scheduleRefresh = (source: unknown) => {
      const nextScope = scopeFromSource(source)
      if (pendingScopeRef.current !== 'financeiro') {
        pendingScopeRef.current = nextScope
      }
      armRefresh()
    }

    let stopped = false
    const checkHeartbeatVersion = async () => {
      if (document.visibilityState !== 'visible') return

      const { data, error } = await supabase
        .from('sioe_sync_estado')
        .select('versao, fonte')
        .eq('id', 1)
        .maybeSingle()

      if (stopped || error || !data) return

      const heartbeat = data as { versao: unknown; fonte: unknown }
      const version = Number(heartbeat.versao)
      if (lastVersionRef.current == null) {
        lastVersionRef.current = version
        return
      }

      if (version !== lastVersionRef.current) {
        lastVersionRef.current = version
        scheduleRefresh(heartbeat.fonte)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (pendingWhileHiddenRef.current) armRefresh()
        void checkHeartbeatVersion()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    const channel = supabase
      .channel(`sioe_sync_auto_refresh_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sioe_sync_estado',
        },
        (payload) => {
          const heartbeat = payload.new as { versao?: unknown; fonte?: unknown }
          const version = Number(heartbeat.versao)
          if (Number.isFinite(version)) lastVersionRef.current = version
          scheduleRefresh(heartbeat.fonte)
        },
      )
      .subscribe()

    void checkHeartbeatVersion()
    const heartbeatPoll = window.setInterval(() => {
      void checkHeartbeatVersion()
    }, HEARTBEAT_FALLBACK_INTERVAL_MS)

    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(heartbeatPoll)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return null
}
