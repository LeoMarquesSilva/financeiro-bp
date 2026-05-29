import { useQuery } from '@tanstack/react-query'
import { fetchInadimplenciaGruposIndex } from '../services/inadimplenciaGruposIndex'

const STALE_TIME_MS = 5 * 60 * 1000

export function useInadimplenciaGruposIndex() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inadimplencia', 'grupos-index'],
    queryFn: fetchInadimplenciaGruposIndex,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
  })

  return {
    index: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
