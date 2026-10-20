import { useQuery } from '@tanstack/react-query'
import { RECEITA_METAS_QUERY_KEY } from '@/features/receita/hooks/useReceitaMetas'
import { receitaInadimplenciaService } from '@/features/receita/services/receitaInadimplenciaService'
import { receitaMetasService } from '@/features/receita/services/receitaMetasService'
import { receitaService } from '@/features/receita/services/receitaService'
import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import type { MesFiltroEficiencia } from '../constants'
import {
  buildGestaoConsolidadoFromInadDashboard,
  consolidarInadimplenciaAoVivo,
  intervalosContiguos,
  mesesInadimplenciaAoVivo,
} from '../utils/overviewFinanceiroKpis'

export function useOverviewFinanceiroKpis(ano: number, enabled = true) {
  return useQuery({
    queryKey: ['eficiencia', 'overview-financeiro', ano],
    queryFn: async () => {
      const metas = await receitaMetasService.getMetas()
      const { rows } = await receitaService.buildDashboard(metas)
      const mesMax = mesMaxDisponivelInadimplencia(ano)
      const inadDashboard = await receitaInadimplenciaService.fetchDashboard({
        ano,
        mesInicio: 1,
        mesFim: mesMax > 0 ? mesMax : 12,
      })
      const { meses, resumo } = buildGestaoConsolidadoFromInadDashboard(rows, inadDashboard, ano)
      return { rows, meses, resumo }
    },
    staleTime: 60_000,
    enabled,
  })
}

/** Acum. do índice de inadimplência: saldo ao vivo dos meses do filtro (Jun+). */
export function useInadimplenciaAoVivo(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  enabled = true,
) {
  const meses = mesesInadimplenciaAoVivo(mesFiltro, ano)
  return useQuery({
    queryKey: ['eficiencia', 'inadimplencia-ao-vivo', ano, meses.join(',')],
    queryFn: async () => {
      const dashboards = await Promise.all(
        intervalosContiguos(meses).map(([mesInicio, mesFim]) =>
          receitaInadimplenciaService.fetchDashboard({ ano, mesInicio, mesFim }),
        ),
      )
      return consolidarInadimplenciaAoVivo(dashboards)
    },
    staleTime: 60_000,
    enabled: enabled && meses.length > 0,
  })
}

export { RECEITA_METAS_QUERY_KEY }
