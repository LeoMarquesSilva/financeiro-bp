import { useQuery } from '@tanstack/react-query'
import { receitaService } from '../services/receitaService'

export function useReceitaResultadoCaixa(ano: number) {
  return useQuery({
    queryKey: ['receita', 'resultado-caixa', ano],
    queryFn: () => receitaService.fetchResultadoCaixaMensal(ano),
  })
}
