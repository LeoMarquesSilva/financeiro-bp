import { useQuery } from '@tanstack/react-query'
import { isPeriodoCurtoFiltro, type MesFiltroEficiencia } from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type { RacionalEscopo, RacionalIndicador, RacionalResultado } from '../types/eficiencia.types'

/**
 * Resumo alinhado ao Racional quando o filtro é semana ou De–Até.
 * A série mensal (RPC) não recorta por dia — este hook usa a mesma base do drill-down.
 */
export function usePeriodoCurtoResumo(
  indicador: RacionalIndicador,
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null,
  responsavel: string | null = null,
  escopo: RacionalEscopo = 'default',
) {
  const periodoCurtoAtivo = isPeriodoCurtoFiltro(mesFiltro)

  const { data: resumo, isLoading } = useQuery({
    queryKey: [
      'eficiencia',
      'periodo-resumo',
      indicador,
      ano,
      mesFiltro,
      area,
      escopo,
      responsavel,
    ],
    enabled: periodoCurtoAtivo,
    queryFn: () =>
      eficienciaService.fetchRacionalResumoOnly(
        indicador,
        ano,
        area,
        mesFiltro,
        escopo,
        responsavel,
      ),
  })

  return {
    periodoCurtoAtivo,
    resumo: resumo as RacionalResultado['resumo'] | undefined,
    loading: periodoCurtoAtivo && isLoading,
  }
}
