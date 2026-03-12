import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appSettingsService } from '@/lib/appSettingsService'
import {
  getPrioridade,
  DEFAULT_PRIORIDADE_CONFIG,
  type PrioridadeConfig,
} from '@/features/inadimplencia/services/prioridade'
import type { PrioridadeTipo } from '@/features/inadimplencia/types/inadimplencia.types'

const QUERY_KEY = ['app_settings', 'prioridade_dias']

export function usePrioridadeConfig() {
  const queryClient = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => appSettingsService.getPrioridadeConfig(),
  })
  const mutation = useMutation({
    mutationFn: (value: PrioridadeConfig) => appSettingsService.setPrioridadeConfig(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
  const effectiveConfig = config ?? DEFAULT_PRIORIDADE_CONFIG
  return {
    config: effectiveConfig,
    defaultConfig: DEFAULT_PRIORIDADE_CONFIG,
    isLoading,
    updateConfig: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    getPrioridade: (diasEmAberto: number, valorEmAberto?: number): PrioridadeTipo =>
      getPrioridade(diasEmAberto, valorEmAberto, effectiveConfig),
  }
}
