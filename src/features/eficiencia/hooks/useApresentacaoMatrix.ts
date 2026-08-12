import { useQueries } from '@tanstack/react-query'
import { eficienciaService } from '../services/eficienciaService'
import type { EficienciaOverview } from '../types/eficiencia.types'
import {
  APRESENTACAO_COLUNAS,
  APRESENTACAO_KPIS,
  areaKeyFromColuna,
  cellApresentacaoKpi,
  metaDesenvolvimentoApresentacao,
  rodapeDesenvolvimentoApresentacao,
  type ApresentacaoCell,
  type ApresentacaoColunaKey,
  type ApresentacaoKpiId,
} from '../utils/apresentacaoMatrix'
import type { MesFiltroEficiencia } from '../constants'

export type ApresentacaoMatrixRow = {
  kpiId: ApresentacaoKpiId
  secao: (typeof APRESENTACAO_KPIS)[number]['secao']
  title: string
  metaLabel: string
  cells: ApresentacaoCell[]
}

/**
 * Carrega overview por coluna (5 áreas jurídicas + Ops + consolidado)
 * e monta a matriz da slide de apresentação.
 */
export function useApresentacaoMatrix(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  enabled: boolean,
) {
  const queries = useQueries({
    queries: APRESENTACAO_COLUNAS.map((col) => {
      const area = areaKeyFromColuna(col)
      return {
        queryKey: ['eficiencia', 'overview', ano, area] as const,
        queryFn: (): Promise<EficienciaOverview> =>
          eficienciaService.getOverview(ano, area),
        enabled,
        staleTime: 1000 * 60,
      }
    }),
  })

  const loading =
    enabled &&
    queries.some(
      (q: { isLoading: boolean; isPending: boolean }) => q.isLoading || q.isPending,
    )
  const error =
    queries.find((q: { error: Error | null }) => q.error)?.error ?? null

  const byKey = new Map<ApresentacaoColunaKey, EficienciaOverview | null>()
  APRESENTACAO_COLUNAS.forEach((col, i) => {
    byKey.set(col.key, (queries[i]?.data as EficienciaOverview | undefined) ?? null)
  })

  const consolidado = byKey.get('__consolidado__')
  const metaDev = metaDesenvolvimentoApresentacao(consolidado)

  const rows: ApresentacaoMatrixRow[] = APRESENTACAO_KPIS.map((kpi) => {
    const metaLabel =
      kpi.id === 'desenvolvimento' ? metaDev : kpi.metaLabel
    const cells = APRESENTACAO_COLUNAS.map((col) =>
      cellApresentacaoKpi(
        kpi.id,
        byKey.get(col.key),
        col.key,
        mesFiltro,
        ano,
      ),
    )
    return {
      kpiId: kpi.id,
      secao: kpi.secao,
      title: kpi.title,
      metaLabel,
      cells,
    }
  })

  return {
    rows,
    colunas: APRESENTACAO_COLUNAS,
    loading,
    error,
    rodape: rodapeDesenvolvimentoApresentacao(consolidado),
  }
}
