import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { receitaMetasService } from '../services/receitaMetasService'
import type { ReceitaMetasConfig } from '../types/receita.types'

export const RECEITA_METAS_QUERY_KEY = ['receita', 'metas'] as const

export function useReceitaMetas() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: RECEITA_METAS_QUERY_KEY,
    queryFn: () => receitaMetasService.getMetas(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  })

  const mutation = useMutation({
    mutationFn: (config: ReceitaMetasConfig) => receitaMetasService.setMetas(config),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RECEITA_METAS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['receita', 'dashboard'] })
    },
  })

  return {
    metas: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateMetas: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    saveError: mutation.error,
  }
}
