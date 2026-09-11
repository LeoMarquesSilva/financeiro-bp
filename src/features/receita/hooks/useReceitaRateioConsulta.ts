import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { receitaService } from '../services/receitaService'
import { agruparRateioPorGrupo } from '../utils/receitaRateioConsulta'
import { buildClienteGrupoMap } from '../utils/recebidoGrupos'

export function useReceitaRateioConsulta(ano: number, mes: number, enabled: boolean) {
  const query = useQuery({
    queryKey: ['receita', 'consulta-rateio', ano, mes],
    queryFn: async () => {
      const [itens, empresas] = await Promise.all([
        receitaService.fetchPrevistoMesItens(ano, mes),
        receitaService.fetchEmpresasNomeGrupo(),
      ])
      return agruparRateioPorGrupo(itens, buildClienteGrupoMap(empresas))
    },
    enabled: enabled && ano > 0 && mes >= 1 && mes <= 12,
  })

  const hasOutras = useMemo(
    () => (query.data ?? []).some((row) => (row.pctPorArea.outras ?? 0) > 0),
    [query.data],
  )

  return {
    grupos: query.data ?? [],
    hasOutras,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  }
}
