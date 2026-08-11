import { useQuery } from '@tanstack/react-query'
import {
  escritorioLevantamentoService,
  type LevantamentoBloco,
  type LevantamentoFiltros,
} from '../services/escritorioLevantamentoService'

export function useLevantamentoFiltrosOpcoes() {
  return useQuery({
    queryKey: ['escritorio', 'levantamento', 'filtros'],
    queryFn: () => escritorioLevantamentoService.fetchFiltrosOpcoes(),
    staleTime: 5 * 60_000,
  })
}

export function useLevantamentoResumo(filtros: LevantamentoFiltros, enabled = true) {
  return useQuery({
    queryKey: [
      'escritorio',
      'levantamento',
      'resumo',
      filtros.dataInicio,
      filtros.dataFim,
      [...filtros.grupos].sort().join('\0'),
      filtros.area,
    ],
    queryFn: () => escritorioLevantamentoService.fetchResumo(filtros),
    enabled:
      enabled &&
      Boolean(filtros.dataInicio) &&
      Boolean(filtros.dataFim) &&
      filtros.dataInicio <= filtros.dataFim,
  })
}

export function useLevantamentoRacional(
  bloco: LevantamentoBloco | null,
  filtros: LevantamentoFiltros,
  tipoAgendamento: string | null = null,
) {
  return useQuery({
    queryKey: [
      'escritorio',
      'levantamento',
      'racional',
      bloco,
      filtros.dataInicio,
      filtros.dataFim,
      [...filtros.grupos].sort().join('\0'),
      filtros.area,
      tipoAgendamento,
    ],
    queryFn: () =>
      escritorioLevantamentoService.fetchRacional(bloco as LevantamentoBloco, filtros, {
        tipoAgendamento,
      }),
    enabled: bloco != null,
  })
}
