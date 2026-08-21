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

export function useLevantamentoGruposPeriodo(
  dataInicio: string,
  dataFim: string,
  enabled = true,
) {
  const periodoValido =
    Boolean(dataInicio) && Boolean(dataFim) && dataInicio <= dataFim

  return useQuery({
    queryKey: ['escritorio', 'levantamento', 'grupos', dataInicio, dataFim],
    queryFn: () => escritorioLevantamentoService.fetchGruposPeriodo(dataInicio, dataFim),
    enabled: enabled && periodoValido,
    staleTime: 2 * 60_000,
    placeholderData: (prev: string[] | undefined) => prev,
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
    ],
    queryFn: () =>
      escritorioLevantamentoService.fetchRacional(bloco as LevantamentoBloco, filtros),
    enabled: bloco != null,
  })
}
