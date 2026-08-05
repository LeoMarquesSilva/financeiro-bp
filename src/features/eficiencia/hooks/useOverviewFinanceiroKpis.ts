import { useQuery } from '@tanstack/react-query'
import { RECEITA_METAS_QUERY_KEY } from '@/features/receita/hooks/useReceitaMetas'
import { receitaInadimplenciaService } from '@/features/receita/services/receitaInadimplenciaService'
import { receitaMetasService } from '@/features/receita/services/receitaMetasService'
import { receitaService } from '@/features/receita/services/receitaService'
import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import { buildGestaoConsolidadoFromInadDashboard } from '../utils/overviewFinanceiroKpis'

export function useOverviewFinanceiroKpis(ano: number) {
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
  })
}

export { RECEITA_METAS_QUERY_KEY }
