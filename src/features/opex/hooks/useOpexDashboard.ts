import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'

import { mesesFiltroKey, planoFiltroKey } from '../utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'

export function useOpexDashboard(
  ano: number,
  meses?: number[] | null,
  planoFiltro?: OpexPlanoFiltroState,
) {
  return useQuery({
    queryKey: ['opex', 'dashboard', ano, mesesFiltroKey(meses ?? []), planoFiltroKey(planoFiltro ?? { gruposExcluidos: [], planosExcluidos: [] })],
    queryFn: () => opexService.fetchDashboard(ano, meses, planoFiltro),
  })
}
