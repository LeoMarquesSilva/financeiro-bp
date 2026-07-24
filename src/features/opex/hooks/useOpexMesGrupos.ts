import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'
import { planoFiltroKey } from '../utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'

export function useOpexMesGrupos(ano: number, mes: number | null, planoFiltro?: OpexPlanoFiltroState) {
  return useQuery({
    queryKey: ['opex', 'mes-grupos', ano, mes, planoFiltroKey(planoFiltro ?? { gruposExcluidos: [], planosExcluidos: [] })],
    queryFn: () => opexService.fetchMesGrupos(ano, mes!, planoFiltro),
    enabled: mes != null && mes >= 1 && mes <= 12,
    staleTime: 60_000,
  })
}
