import { useQuery } from '@tanstack/react-query'
import { fetchGruposEscritorio } from '../services/escritorioService'

/** Cache 30 min; refetch ao voltar à aba (dados atualizados diariamente pelo sync). */
const STALE_TIME_MS = 30 * 60 * 1000

export function useGruposEscritorio() {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['escritorio', 'grupos'],
    queryFn: () => fetchGruposEscritorio(),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
  })

  return {
    grupos: data ?? [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? (error as Error).message ?? 'Erro ao carregar dados.' : null,
    refetch,
  }
}
