import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { receitaService } from '../services/receitaService'
import {
  agruparRateioPorGrupo,
  RECEITA_RATEIO_OUTRAS_KEY,
  type ReceitaRateioGrupoRow,
} from '../utils/receitaRateioConsulta'
import { buildClienteGrupoMap } from '../utils/recebidoGrupos'

export function useReceitaRateioConsulta(ano: number, mes: number, enabled: boolean) {
  const query = useQuery({
    queryKey: ['receita', 'consulta-rateio', ano, mes],
    queryFn: async () => {
      const [itens, empresas] = await Promise.all([
        receitaService.fetchPrevistoMesItens(ano, mes),
        receitaService.fetchEmpresasNomeGrupo(),
      ])
      const rows: ReceitaRateioGrupoRow[] = agruparRateioPorGrupo(
        itens,
        buildClienteGrupoMap(empresas),
      )
      return rows
    },
    enabled: enabled && ano > 0 && mes >= 1 && mes <= 12,
  })

  const grupos: ReceitaRateioGrupoRow[] = query.data ?? []
  const hasOutras = useMemo(
    () => grupos.some((row) => (row.pctPorArea[RECEITA_RATEIO_OUTRAS_KEY] ?? 0) > 0),
    [grupos],
  )

  return {
    grupos,
    hasOutras,
    isLoading: query.isLoading,
    error: query.error,
  }
}
