import { useQuery } from '@tanstack/react-query'
import { fetchEvolucaoSaldoDevedor } from '../services/saldoDevedorService'

export function useSaldoDevedor() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['inadimplencia', 'saldo-devedor'],
    queryFn: () => fetchEvolucaoSaldoDevedor(),
    staleTime: 60_000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error,
    refetch,
  }
}
