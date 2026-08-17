import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type { RacionalIndicador } from '../types/eficiencia.types'
import type { EvolucaoPoint } from '../components/EficienciaEvolucaoChart'
import {
  acumularEvolucaoPorResponsavel,
  agregarEvolucaoPorResponsavel,
} from '../utils/evolucaoPorResponsavel'

/**
 * Série mensal + KPI do período quando há filtro de responsável.
 * Busca o racional completo do ano (sem limite da UI) e agrega no client.
 */
export function useEvolucaoPorResponsavel(
  indicador: RacionalIndicador,
  ano: number,
  area: string | null,
  responsavel: string | null,
  mesFiltro: MesFiltroEficiencia = null,
) {
  const enabled = Boolean(responsavel?.trim())

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['eficiencia', 'evolucao-responsavel', indicador, ano, area, responsavel],
    enabled,
    queryFn: async () => {
      const result = await eficienciaService.fetchRacionalParaExport(
        indicador,
        ano,
        area,
        null,
        'default',
        responsavel,
      )
      const pontos = agregarEvolucaoPorResponsavel(indicador, result.linhas, ano, null)
      return { pontos, linhas: result.linhas }
    },
    staleTime: 1000 * 60,
  })

  const chartData: EvolucaoPoint[] = useMemo(() => {
    const pontos: EvolucaoPoint[] = data?.pontos ?? []
    const base = pontos.map((p: EvolucaoPoint) => ({ mes: p.mes, valor: p.valor }))
    return filtrarMensalPorMesFiltro(base, mesFiltro, ano)
  }, [data?.pontos, mesFiltro, ano])

  const acumulado = useMemo(() => {
    if (!enabled || !data?.linhas) return { pct: null as number | null, ok: 0, total: 0 }
    return acumularEvolucaoPorResponsavel(data.linhas, indicador, ano, mesFiltro)
  }, [enabled, data?.linhas, indicador, ano, mesFiltro])

  return {
    chartData,
    acumulado,
    /** Inclui refetch — evita gráfico “preso” na série anterior com array vazio. */
    loading: enabled && (isLoading || (isFetching && !data)),
    error,
  }
}
