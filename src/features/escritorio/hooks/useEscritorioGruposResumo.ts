import { useQuery } from '@tanstack/react-query'
import { fetchGruposResumo } from '../services/escritorioService'

const STALE_TIME_MS = 30 * 60 * 1000

export function useEscritorioGruposResumo() {
  return useQuery({
    queryKey: ['escritorio', 'resumo-v2'],
    queryFn: fetchGruposResumo,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
  })
}
