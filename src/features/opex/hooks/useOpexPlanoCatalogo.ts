import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'

export function useOpexPlanoCatalogo(ano: number) {
  return useQuery({
    queryKey: ['opex', 'catalogo-planos', ano],
    queryFn: () => opexService.fetchCatalogoPlanos(ano),
    staleTime: 5 * 60_000,
  })
}
