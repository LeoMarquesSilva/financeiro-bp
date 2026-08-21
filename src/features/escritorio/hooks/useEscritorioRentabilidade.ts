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
      [...filtros.grupos].sort().join('\0'),
      filtros.area,
    ],
    queryFn: () => escritorioRentabilidadeService.fetchContratos(filtros),
    enabled: enabled && filtros.grupos.length > 0,
    staleTime: 2 * 60_000,
  })
}
