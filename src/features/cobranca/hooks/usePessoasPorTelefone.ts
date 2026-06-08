import { useQuery } from '@tanstack/react-query'
import { cobrancaService } from '../services/cobrancaService'

export function usePessoasPorTelefone(numero: string | null | undefined) {
  const query = useQuery({
    queryKey: ['cobranca', 'pessoas-por-telefone', numero ?? ''],
    queryFn: () => (numero ? cobrancaService.resolvePessoasPorTelefone(numero) : []),
    enabled: !!numero,
    staleTime: 30_000,
  })
  return {
    candidatos: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  }
}
