import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'

export function useOpexTitulosCiItens(ciItens: number[]) {
  return useQuery({
    queryKey: ['opex', 'titulos-vinculo', ciItens],
    queryFn: () => opexService.fetchTitulosCiItens(ciItens),
    enabled: ciItens.length > 0,
    staleTime: 60_000,
  })
}
