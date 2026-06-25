import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { opexMetasService } from '../services/opexMetasService'
import type { OpexIniciativa, OpexMetasEstrategicasConfig } from '../types/opexMetas.types'

const QUERY_KEY = ['opex', 'metas-estrategicas'] as const

export function useOpexMetasEstrategicas() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => opexMetasService.getConfig(),
    staleTime: 30_000,
  })

  const upsertMutation = useMutation({
    mutationFn: (iniciativa: OpexIniciativa) => opexMetasService.upsertIniciativa(iniciativa),
    onSuccess: (data: OpexMetasEstrategicasConfig) => queryClient.setQueryData(QUERY_KEY, data),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => opexMetasService.removeIniciativa(id),
    onSuccess: (data: OpexMetasEstrategicasConfig) => queryClient.setQueryData(QUERY_KEY, data),
  })

  return {
    config: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    upsertIniciativa: upsertMutation.mutateAsync,
    removeIniciativa: removeMutation.mutateAsync,
    isSaving: upsertMutation.isPending || removeMutation.isPending,
  }
}
