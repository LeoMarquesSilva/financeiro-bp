import { useQuery } from '@tanstack/react-query'
import { eficienciaService } from '../services/eficienciaService'
import { mesesEfetivosFiltro, type MesFiltroEficiencia } from '../constants'

/** % que cada área representa no volume de protocolos do escritório no período. */
export function useAreaParticipacao(ano: number, mesFiltro: MesFiltroEficiencia) {
  const meses = mesesEfetivosFiltro(mesFiltro, ano)

  const { data = [], isLoading } = useQuery({
    queryKey: ['eficiencia', 'area-participacao', ano, meses],
    queryFn: () => eficienciaService.fetchAreaParticipacao(ano, meses),
    staleTime: 60_000,
  })

  const pctByArea: Record<string, number> = {}
  for (const row of data) {
    pctByArea[row.area] = Number(row.pct_do_total ?? 0)
  }

  return { pctByArea, rows: data, loading: isLoading }
}
