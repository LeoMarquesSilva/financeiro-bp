import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'

import { mesesFiltroKey } from '../utils/opexPeriodo'

export function useOpexDashboard(ano: number, meses?: number[] | null) {
  return useQuery({
    queryKey: ['opex', 'dashboard', ano, mesesFiltroKey(meses ?? [])],
    queryFn: () => opexService.fetchDashboard(ano, meses),
  })
}
