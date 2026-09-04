import { useQuery } from '@tanstack/react-query'
import { receitaService } from '../services/receitaService'

export function useReceitaUltimaAtualizacao() {
  return useQuery({
    queryKey: ['receita', 'ultima-atualizacao'],
    queryFn: () => receitaService.fetchUltimaAtualizacao(),
    staleTime: 5 * 60_000,
  })
}
