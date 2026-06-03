import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { receitaDepartamentoCoresService } from '../services/receitaDepartamentoCoresService'
import type { ReceitaDepartamentoCoresConfig } from '../types/receita.types'

export const RECEITA_DEPARTAMENTO_CORES_QUERY_KEY = ['receita', 'departamento-cores'] as const

export function useReceitaDepartamentoCores() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: RECEITA_DEPARTAMENTO_CORES_QUERY_KEY,
    queryFn: () => receitaDepartamentoCoresService.getCores(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  })

  const mutation = useMutation({
    mutationFn: (config: ReceitaDepartamentoCoresConfig) =>
      receitaDepartamentoCoresService.setCores(config),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RECEITA_DEPARTAMENTO_CORES_QUERY_KEY })
    },
  })

  return {
    cores: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateCores: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  }
}
