import { useQuery } from '@tanstack/react-query'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'

/** Mesma chave na seção, na gestão à vista e no gráfico — uma ida ao banco. */
export function receitaInadimplenciaDashboardQueryKey(
  ano: number | undefined,
  mesInicio: number,
  mesFim: number,
) {
  return ['receita', 'inadimplencia', 'dashboard', ano, mesInicio, mesFim] as const
}

export function useReceitaInadimplencia(
  ano: number | undefined,
  mesInicio: number,
  mesFim: number,
) {
  return useQuery({
    queryKey: receitaInadimplenciaDashboardQueryKey(ano, mesInicio, mesFim),
    queryFn: () => {
      if (ano == null) throw new Error('Ano não informado')
      return receitaInadimplenciaService.fetchDashboard({ ano, mesInicio, mesFim })
    },
    enabled: ano != null && mesInicio >= 1 && mesFim >= mesInicio,
    staleTime: 60_000,
  })
}
