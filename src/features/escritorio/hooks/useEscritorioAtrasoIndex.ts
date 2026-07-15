import { useQuery } from '@tanstack/react-query'
import { fetchEscritorioAtrasoIndex } from '../services/escritorioAtrasoIndex'

const STALE_TIME_MS = 5 * 60 * 1000

export function useEscritorioAtrasoIndex(dataReferencia: string) {
  const valida = !!dataReferencia && /^\d{4}-\d{2}-\d{2}$/.test(dataReferencia)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['escritorio', 'atraso-index', dataReferencia],
    queryFn: () => fetchEscritorioAtrasoIndex(dataReferencia),
    enabled: valida,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
  })

  return {
    index: data ?? null,
    loading: isLoading,
    fetching: isFetching,
    error: error ? (error as Error).message : null,
  }
}
