import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'
import { planoFiltroKey } from '../utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'

export function useOpexMesGrupos(
  ano: number,
  periodo: number | 'ano' | null,
  planoFiltro?: OpexPlanoFiltroState,
) {
  const mes = periodo === 'ano' ? null : periodo
  return useQuery({
    queryKey: [
      'opex',
      'mes-grupos',
      ano,
      periodo,
      planoFiltroKey(planoFiltro ?? { gruposExcluidos: [], planosExcluidos: [] }),
    ],
    queryFn: () => opexService.fetchMesGrupos(ano, mes, planoFiltro),
    enabled: periodo === 'ano' || (typeof periodo === 'number' && periodo >= 1 && periodo <= 12),
    staleTime: 60_000,
  })
}
