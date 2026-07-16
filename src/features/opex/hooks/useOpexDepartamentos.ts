import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'
import { mesesFiltroKey } from '../utils/opexPeriodo'

export function useOpexDepartamentosMensal(
  ano: number,
  mesesFiltro: number[],
  somenteFixas: boolean,
) {
  return useQuery({
    queryKey: ['opex', 'departamentos-mensal', ano, mesesFiltroKey(mesesFiltro), somenteFixas],
    queryFn: () => opexService.fetchDepartamentosMensal(ano, mesesFiltro, somenteFixas),
    staleTime: 60_000,
  })
}
