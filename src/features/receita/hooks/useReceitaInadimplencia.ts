import { useQuery } from '@tanstack/react-query'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'

export function useReceitaInadimplencia(
  ano: number | undefined,
  mesInicio: number,
  mesFim: number,
) {
  return useQuery({
    queryKey: ['receita', 'inadimplencia', ano, mesInicio, mesFim],
    queryFn: () => {
      if (ano == null) throw new Error('Ano não informado')
      return receitaInadimplenciaService.fetchDashboard({ ano, mesInicio, mesFim })
    },
    enabled: ano != null && mesInicio >= 1 && mesFim >= mesInicio,
  })
}
