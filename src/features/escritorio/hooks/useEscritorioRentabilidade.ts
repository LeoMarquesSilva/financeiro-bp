import { useQuery } from '@tanstack/react-query'
import type { LevantamentoFiltros } from '../services/escritorioLevantamentoService'
import { escritorioRentabilidadeService } from '../services/escritorioRentabilidadeService'

export function useRentabilidadeContratos(
  filtros: LevantamentoFiltros,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      'escritorio',
      'rentabilidade',
      'contratos',
      filtros.dataInicio,
      filtros.dataFim,
      filtros.area,
    ],
    queryFn: () => escritorioRentabilidadeService.fetchContratos(filtros),
    enabled: enabled && Boolean(filtros.dataInicio && filtros.dataFim),
    staleTime: 2 * 60_000,
  })
}
