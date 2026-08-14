import { useQueries, useQuery } from '@tanstack/react-query'
import { eficienciaService } from '../services/eficienciaService'
import type {
  EficienciaOverview,
  OpsLegaisIniciativasDashboard,
} from '../types/eficiencia.types'
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
import {
  cellApresentacaoCrescimentoReceita,
  cellApresentacaoIndiceInadimplencia,
  fetchApresentacaoFinanceiroBundle,
} from '../utils/apresentacaoFinanceiro'
import {
  fetchApresentacaoComposicao,
  mesReferenciaComposicao,
} from '../utils/apresentacaoComposicao'
import { fetchApresentacaoBigNumber } from '../utils/apresentacaoBigNumber'
import { fetchApresentacaoControladoria } from '../utils/apresentacaoControladoria'
import { buildApresentacaoIniciativas } from '../utils/apresentacaoIniciativas'
import { buildApresentacaoMarketing } from '../utils/apresentacaoMarketing'
import { buildApresentacaoFinanceiroOps } from '../utils/apresentacaoFinanceiroOps'
import { fetchApresentacaoLideranca } from '../utils/apresentacaoLideranca'
import { instagramService } from '@/features/operacoes-legais/marketing/instagramService'
import { cobrancaService } from '@/features/cobranca/services/cobrancaService'
import type { MesFiltroEficiencia } from '../constants'

export type ApresentacaoMatrixRow = {
  kpiId: ApresentacaoKpiId
  secao: (typeof APRESENTACAO_KPIS)[number]['secao']
  title: string
  metaLabel: string
  cells: ApresentacaoCell[]
}

/**
 * Carrega overview por coluna + financeiro + composição + Big Numbers.
 * Loading é por bloco — o slide não fica bloqueado no Big Numbers.
 * `bigNumberMeses` = período próprio do Bloco 4.
 * `iniciativasMesFiltro` = período próprio do Bloco 6 (não usa o filtro global).
 * `marketingMesFiltro` = período próprio do Bloco 7.
 * `financeiroOpsMesFiltro` = período próprio do Bloco 8.
 */
export function useApresentacaoMatrix(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  enabled: boolean,
  bigNumberMeses: number[] = [1, 2, 3, 4, 5, 6],
  iniciativasMesFiltro: MesFiltroEficiencia = null,
  marketingMesFiltro: MesFiltroEficiencia = null,
  financeiroOpsMesFiltro: MesFiltroEficiencia = null,
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

  const financeiroQuery = useQuery({
    queryKey: ['eficiencia', 'apresentacao-financeiro', ano] as const,
    queryFn: () => fetchApresentacaoFinanceiroBundle(ano),
    enabled,
    staleTime: 60_000,
  })

  const mesComposicao = mesReferenciaComposicao(ano, mesFiltro)
  const composicaoQuery = useQuery({
    queryKey: ['eficiencia', 'apresentacao-composicao', ano, mesComposicao] as const,
    queryFn: () => {
      const rows = financeiroQuery.data?.rows
      if (!rows) throw new Error('Dashboard financeiro indisponível')
      return fetchApresentacaoComposicao(ano, mesComposicao, rows)
    },
    enabled: enabled && !!financeiroQuery.data?.rows,
    staleTime: 60_000,
  })

  const mesesBnKey = bigNumberMeses.join(',')
  const bigNumberQuery = useQuery({
    queryKey: ['eficiencia', 'apresentacao-bignumber', ano, mesesBnKey] as const,
    queryFn: () => fetchApresentacaoBigNumber(ano, bigNumberMeses),
    enabled: enabled && bigNumberMeses.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  const controladoriaQuery = useQuery({
    queryKey: ['eficiencia', 'apresentacao-controladoria', ano] as const,
    queryFn: () => fetchApresentacaoControladoria(ano),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })

  const liderancaQuery = useQuery({
    queryKey: ['eficiencia', 'apresentacao-lideranca', ano, mesFiltro] as const,
    queryFn: () => fetchApresentacaoLideranca(ano, mesFiltro),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })

  /** Mesmo cache da aba Ops Legais — ClickUp uma vez por ano. */
  const iniciativasAnoQuery = useQuery({
    queryKey: ['eficiencia', 'ops-legais-iniciativas', ano] as const,
    queryFn: (): Promise<OpsLegaisIniciativasDashboard> =>
      eficienciaService.fetchOpsLegaisIniciativas(ano, null),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  /** Mesmo cache da aba Marketing Instagram. */
  const marketingQuery = useQuery({
    queryKey: ['operacoes-legais', 'marketing', 'instagram'] as const,
    queryFn: () => instagramService.getDashboard(),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const antecipacaoQuery = useQuery({
    queryKey: ['eficiencia', 'ops-antecipacao-mensal', ano] as const,
    queryFn: () => eficienciaService.fetchOpsLegaisAntecipacaoMensal(ano),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })

  const cobrancaKpiQuery = useQuery({
    queryKey: ['cobranca', 'kpi-rows'] as const,
    queryFn: () => cobrancaService.listPainelKpi(),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })

  const loadingMatrix =
    enabled &&
    (queries.some(
      (q: { isLoading: boolean; isPending: boolean }) => q.isLoading || q.isPending,
    ) ||
      financeiroQuery.isLoading ||
      financeiroQuery.isPending)

  const loadingComposicao =
    enabled &&
    (financeiroQuery.isLoading ||
      financeiroQuery.isPending ||
      composicaoQuery.isLoading ||
      composicaoQuery.isPending)

  const loadingBigNumber =
    enabled && (bigNumberQuery.isLoading || bigNumberQuery.isPending)

  const loadingControladoria =
    enabled && (controladoriaQuery.isLoading || controladoriaQuery.isPending)

  const loadingLideranca =
    enabled && (liderancaQuery.isLoading || liderancaQuery.isPending)

  const loadingIniciativas =
    enabled && (iniciativasAnoQuery.isLoading || iniciativasAnoQuery.isPending)

  const loadingMarketing =
    enabled && (marketingQuery.isLoading || marketingQuery.isPending)

  const loadingFinanceiroOps =
    enabled &&
    (antecipacaoQuery.isLoading ||
      antecipacaoQuery.isPending ||
      cobrancaKpiQuery.isLoading ||
      cobrancaKpiQuery.isPending)

  /** Compat: cópia dos blocos 1–2 exige a grade pronta. */
  const loading = loadingMatrix

  const error =
    queries.find((q: { error: Error | null }) => q.error)?.error ??
    (financeiroQuery.error instanceof Error
      ? financeiroQuery.error
      : financeiroQuery.error
        ? new Error(String(financeiroQuery.error))
        : null)

  const bigNumberError =
    bigNumberQuery.error instanceof Error
      ? bigNumberQuery.error
      : bigNumberQuery.error
        ? new Error(String(bigNumberQuery.error))
        : null

  const controladoriaError =
    controladoriaQuery.error instanceof Error
      ? controladoriaQuery.error
      : controladoriaQuery.error
        ? new Error(String(controladoriaQuery.error))
        : null

  const liderancaError =
    liderancaQuery.error instanceof Error
      ? liderancaQuery.error
      : liderancaQuery.error
        ? new Error(String(liderancaQuery.error))
        : null

  const iniciativasError =
    iniciativasAnoQuery.error instanceof Error
      ? iniciativasAnoQuery.error
      : iniciativasAnoQuery.error
        ? new Error(String(iniciativasAnoQuery.error))
        : null

  const marketingError =
    marketingQuery.error instanceof Error
      ? marketingQuery.error
      : marketingQuery.error
        ? new Error(String(marketingQuery.error))
        : null

  const financeiroOpsError =
    antecipacaoQuery.error instanceof Error
      ? antecipacaoQuery.error
      : cobrancaKpiQuery.error instanceof Error
        ? cobrancaKpiQuery.error
        : antecipacaoQuery.error || cobrancaKpiQuery.error
          ? new Error(String(antecipacaoQuery.error || cobrancaKpiQuery.error))
          : null

  const iniciativas = iniciativasAnoQuery.data
    ? buildApresentacaoIniciativas(
        iniciativasAnoQuery.data,
        ano,
        iniciativasMesFiltro,
      )
    : null

  const marketing = marketingQuery.data
    ? buildApresentacaoMarketing(
        marketingQuery.data.posts ?? [],
        ano,
        marketingMesFiltro,
      )
    : null

  const financeiroOps =
    antecipacaoQuery.data != null && cobrancaKpiQuery.data != null
      ? buildApresentacaoFinanceiroOps(
          antecipacaoQuery.data,
          cobrancaKpiQuery.data,
          ano,
          financeiroOpsMesFiltro,
        )
      : null

  const byKey = new Map<ApresentacaoColunaKey, EficienciaOverview | null>()
  APRESENTACAO_COLUNAS.forEach((col, i) => {
    byKey.set(col.key, (queries[i]?.data as EficienciaOverview | undefined) ?? null)
  })

  const consolidado = byKey.get('__consolidado__')
  const metaDev = metaDesenvolvimentoApresentacao(consolidado)
  const financeiro = financeiroQuery.data

  const rows: ApresentacaoMatrixRow[] = APRESENTACAO_KPIS.map((kpi) => {
    const metaLabel =
      kpi.id === 'desenvolvimento' ? metaDev : kpi.metaLabel
    const cells = APRESENTACAO_COLUNAS.map((col) => {
      if (kpi.id === 'crescimento_receita') {
        return cellApresentacaoCrescimentoReceita(col.key, financeiro, mesFiltro, ano)
      }
      if (kpi.id === 'indice_inadimplencia') {
        return cellApresentacaoIndiceInadimplencia(col.key, financeiro, mesFiltro, ano)
      }
      return cellApresentacaoKpi(
        kpi.id,
        byKey.get(col.key),
        col.key,
        mesFiltro,
        ano,
      )
    })
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
    composicao: composicaoQuery.data ?? null,
    receitaRows: financeiroQuery.data?.rows ?? null,
    bigNumber: bigNumberQuery.data ?? null,
    controladoria: controladoriaQuery.data ?? null,
    lideranca: liderancaQuery.data ?? null,
    iniciativas,
    marketing,
    financeiroOps,
    loading,
    loadingMatrix,
    loadingComposicao,
    loadingBigNumber,
    loadingControladoria,
    loadingLideranca,
    loadingIniciativas,
    loadingMarketing,
    loadingFinanceiroOps,
    error,
    bigNumberError,
    controladoriaError,
    liderancaError,
    iniciativasError,
    marketingError,
    financeiroOpsError,
    rodape: rodapeDesenvolvimentoApresentacao(consolidado),
  }
}
