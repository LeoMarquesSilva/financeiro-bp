import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'
import { mesesFiltroKey } from '../utils/opexPeriodo'

export function useOpexDepartamentos(
  ano: number,
  mesesFiltro: number[],
  somenteFixas: boolean,
) {
  return useQuery({
    queryKey: ['opex', 'departamentos', ano, mesesFiltroKey(mesesFiltro), somenteFixas],
    queryFn: () => opexService.fetchDepartamentos(ano, mesesFiltro, somenteFixas),
    staleTime: 60_000,
  })
}
