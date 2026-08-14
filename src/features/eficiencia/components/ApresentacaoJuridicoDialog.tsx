import { useMemo, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Check, Copy, Loader2, Presentation } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { copyApresentacaoSlideToClipboard } from '@/shared/utils/copyChartImage'
import { MesFilterButtons } from './MesFilterButtons'
import { ApresentacaoJuridicoSlide } from './ApresentacaoJuridicoSlide'
import { useApresentacaoMatrix } from '../hooks/useApresentacaoMatrix'
import {
  APRESENTACAO_BLOCOS,
  type ApresentacaoBlocoId,
} from '../utils/apresentacaoMatrix'
import { mesesRangeBigNumber } from '../utils/apresentacaoBigNumber'
import { fetchApresentacaoFinanceiroBundle } from '../utils/apresentacaoFinanceiro'
import {
  anosNoPeriodo,
  type MesAno,
} from '../utils/apresentacaoMesAno'
import { eficienciaService } from '../services/eficienciaService'
import type { EficienciaOverview } from '../types/eficiencia.types'
import type { ApresentacaoFinanceiroBundle } from '../utils/apresentacaoFinanceiro'
import type { MesFiltroEficiencia } from '../constants'

type CopyStatus = 'idle' | 'loading' | 'done'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mesFiltro: MesFiltroEficiencia
  onMesFiltroChange: (mes: MesFiltroEficiencia) => void
}

export function ApresentacaoJuridicoDialog({
  open,
  onOpenChange,
  ano,
  mesFiltro,
  onMesFiltroChange,
}: Props) {
  const slideRef = useRef<HTMLDivElement>(null)
  const [copyStatus, setCopyStatus] = useState<Partial<Record<ApresentacaoBlocoId, CopyStatus>>>(
    {},
  )
  /** Período exclusivo do Bloco 2 — De Jan/25 · Até Jan/26 (ajustável). */
  const [unificadoInicio, setUnificadoInicio] = useState<MesAno>({ ano: 2025, mes: 1 })
  const [unificadoFim, setUnificadoFim] = useState<MesAno>({ ano: 2026, mes: 1 })
  const [bnMesInicio, setBnMesInicio] = useState(1)
  const [bnMesFim, setBnMesFim] = useState(6)
  const bigNumberMeses = useMemo(
    () => mesesRangeBigNumber(bnMesInicio, bnMesFim),
    [bnMesInicio, bnMesFim],
  )
  /** Período exclusivo do Bloco 11 — Programa de Bônus (padrão Jun–Dez). */
  const [bonusMesInicio, setBonusMesInicio] = useState(6)
  const [bonusMesFim, setBonusMesFim] = useState(12)
  const [iniciativasMesFiltro, setIniciativasMesFiltro] =
    useState<MesFiltroEficiencia>(null)
  const [marketingMesFiltro, setMarketingMesFiltro] =
    useState<MesFiltroEficiencia>(null)
  const [financeiroOpsMesFiltro, setFinanceiroOpsMesFiltro] =
    useState<MesFiltroEficiencia>(null)

  const anosUnificado = useMemo(
    () => anosNoPeriodo(unificadoInicio, unificadoFim),
    [unificadoInicio, unificadoFim],
  )

  const unificadoOverviewQueries = useQueries({
    queries: anosUnificado.map((y) => ({
      queryKey: ['eficiencia', 'overview', y, null] as const,
      queryFn: (): Promise<EficienciaOverview> =>
        eficienciaService.getOverview(y, null),
      enabled: open,
      staleTime: 60_000,
    })),
  })

  const unificadoFinanceiroQueries = useQueries({
    queries: anosUnificado.map((y) => ({
      queryKey: ['eficiencia', 'apresentacao-financeiro', y] as const,
      queryFn: () => fetchApresentacaoFinanceiroBundle(y),
      enabled: open,
      staleTime: 60_000,
    })),
  })

  const overviewByAno = useMemo(() => {
    const map = new Map<number, EficienciaOverview>()
    anosUnificado.forEach((y, i) => {
      const data = unificadoOverviewQueries[i]?.data
      if (data) map.set(y, data)
    })
    return map
  }, [anosUnificado, unificadoOverviewQueries])

  const financeiroByAno = useMemo(() => {
    const map = new Map<number, ApresentacaoFinanceiroBundle>()
    anosUnificado.forEach((y, i) => {
      const data = unificadoFinanceiroQueries[i]?.data
      if (data) map.set(y, data)
    })
    return map
  }, [anosUnificado, unificadoFinanceiroQueries])

  const loadingUnificado =
    open &&
    (unificadoOverviewQueries.some(
      (q: { isLoading: boolean; isPending: boolean }) =>
        q.isLoading || q.isPending,
    ) ||
      unificadoFinanceiroQueries.some(
        (q: { isLoading: boolean; isPending: boolean }) =>
          q.isLoading || q.isPending,
      ) ||
      anosUnificado.some((y) => !overviewByAno.has(y)))

  const {
    rows,
    colunas,
    composicao,
    receitaRows,
    topContratos,
    bigNumber,
    controladoria,
    lideranca,
    iniciativas,
    marketing,
    financeiroOps,
    bonus,
    loading,
    loadingComposicao,
    loadingBigNumber,
    loadingControladoria,
    loadingLideranca,
    loadingIniciativas,
    loadingMarketing,
    loadingFinanceiroOps,
    bigNumberError,
    controladoriaError,
    liderancaError,
    iniciativasError,
    marketingError,
    financeiroOpsError,
  } = useApresentacaoMatrix(
    ano,
    mesFiltro,
    open,
    bigNumberMeses,
    iniciativasMesFiltro,
    marketingMesFiltro,
    financeiroOpsMesFiltro,
    bonusMesInicio,
    bonusMesFim,
  )

  const handleCopyBloco = async (blocoId: ApresentacaoBlocoId) => {
    const root = slideRef.current
    if (!root) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }
    if (blocoId === 'juridico_unificado' && loadingUnificado) {
      toast.error('Jurídico Unificado ainda carregando')
      return
    }
    if (blocoId === 'bignumber' && (loadingBigNumber || !bigNumber)) {
      toast.error('Big Numbers ainda carregando')
      return
    }
    if (blocoId === 'lideranca' && (loadingLideranca || !lideranca)) {
      toast.error('Liderança ainda carregando')
      return
    }
    if (blocoId === 'controladoria' && (loadingControladoria || !controladoria)) {
      toast.error('Controladoria ainda carregando')
      return
    }
    if (blocoId === 'iniciativas' && (loadingIniciativas || !iniciativas)) {
      toast.error('Iniciativas ainda carregando')
      return
    }
    if (blocoId === 'marketing' && (loadingMarketing || !marketing)) {
      toast.error('Marketing ainda carregando')
      return
    }
    if (blocoId === 'financeiro_ops' && (loadingFinanceiroOps || !financeiroOps)) {
      toast.error('Financeiro Ops ainda carregando')
      return
    }
    if (blocoId === 'composicao' && (loadingComposicao || !composicao)) {
      toast.error('Composição ainda carregando')
      return
    }
    if (blocoId === 'programa_bonus' && (loading || !bonus)) {
      toast.error('Programa de Bônus ainda carregando')
      return
    }
    if (
      (blocoId === 'juridico' || blocoId === 'financeiro') &&
      loading
    ) {
      toast.error('Conteúdo ainda carregando')
      return
    }
    const el = root.querySelector<HTMLElement>(`[data-apresentacao-export="${blocoId}"]`)
    if (!el) {
      toast.error('Bloco não encontrado')
      return
    }

    setCopyStatus((prev) => ({ ...prev, [blocoId]: 'loading' }))
    try {
      await copyApresentacaoSlideToClipboard(el)
      setCopyStatus((prev) => ({ ...prev, [blocoId]: 'done' }))
      const label =
        APRESENTACAO_BLOCOS.find((b) => b.id === blocoId)?.label ?? 'Bloco'
      toast.success(`${label} copiado (33,87×16,32 cm) — cole com Ctrl+V`)
      window.setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, [blocoId]: 'idle' }))
      }, 2000)
    } catch (error) {
      setCopyStatus((prev) => ({ ...prev, [blocoId]: 'idle' }))
      const message =
        error instanceof Error ? error.message : 'Não foi possível copiar o conteúdo'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[95vh] w-[min(96vw,1400px)] max-w-[1400px] flex-col gap-0 overflow-hidden p-0"
        showClose
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Presentation className="h-4 w-4 text-slate-600" aria-hidden />
                Apresentação — Jurídico
              </DialogTitle>
              <p className="mt-1 text-xs text-slate-500">
                Bloco 2: De/Até mês·ano (a partir de Jan/25) · demais blocos com
                filtro próprio · cópia 33,87 × 16,32 cm
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {APRESENTACAO_BLOCOS.map((bloco, index) => {
                const status = copyStatus[bloco.id] ?? 'idle'
                const CopyIcon =
                  status === 'loading' ? Loader2 : status === 'done' ? Check : Copy
                const blocoBusy =
                  bloco.id === 'juridico_unificado'
                    ? loadingUnificado
                    : bloco.id === 'lideranca'
                      ? loadingLideranca || !lideranca
                      : bloco.id === 'bignumber'
                        ? loadingBigNumber || !bigNumber
                        : bloco.id === 'controladoria'
                          ? loadingControladoria || !controladoria
                          : bloco.id === 'iniciativas'
                            ? loadingIniciativas || !iniciativas
                            : bloco.id === 'marketing'
                              ? loadingMarketing || !marketing
                              : bloco.id === 'financeiro_ops'
                                ? loadingFinanceiroOps || !financeiroOps
                                : bloco.id === 'composicao'
                                  ? loadingComposicao || !composicao
                                  : bloco.id === 'programa_bonus'
                                    ? loading || !bonus
                                    : loading
                return (
                  <Button
                    key={bloco.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={status === 'loading' || blocoBusy}
                    onClick={() => void handleCopyBloco(bloco.id)}
                  >
                    <CopyIcon
                      className={
                        status === 'loading' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'
                      }
                      aria-hidden
                    />
                    Copiar {index + 1}
                  </Button>
                )
              })}
            </div>
          </div>
          <div className="mt-3">
            <MesFilterButtons
              value={mesFiltro}
              onChange={onMesFiltroChange}
              showSemanas={false}
              showDiaPicker={false}
              ano={ano}
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
          <div className="mx-auto w-full max-w-none">
            <ApresentacaoJuridicoSlide
              ref={slideRef}
              colunas={colunas}
              rows={rows}
              overviewByAnoUnificado={overviewByAno}
              financeiroByAnoUnificado={financeiroByAno}
              loadingUnificado={loadingUnificado}
              unificadoInicio={unificadoInicio}
              unificadoFim={unificadoFim}
              onUnificadoInicioChange={setUnificadoInicio}
              onUnificadoFimChange={setUnificadoFim}
              composicao={composicao}
              receitaRows={receitaRows}
              topContratos={topContratos}
              bigNumber={bigNumber}
              controladoria={controladoria}
              lideranca={lideranca}
              iniciativas={iniciativas}
              marketing={marketing}
              financeiroOps={financeiroOps}
              bonus={bonus}
              ano={ano}
              loading={loading}
              loadingComposicao={loadingComposicao}
              loadingBigNumber={loadingBigNumber}
              loadingControladoria={loadingControladoria}
              loadingLideranca={loadingLideranca}
              loadingIniciativas={loadingIniciativas}
              loadingMarketing={loadingMarketing}
              loadingFinanceiroOps={loadingFinanceiroOps}
              bigNumberError={bigNumberError}
              controladoriaError={controladoriaError}
              liderancaError={liderancaError}
              iniciativasError={iniciativasError}
              marketingError={marketingError}
              financeiroOpsError={financeiroOpsError}
              bigNumberMesInicio={bnMesInicio}
              bigNumberMesFim={bnMesFim}
              onBigNumberMesInicioChange={setBnMesInicio}
              onBigNumberMesFimChange={setBnMesFim}
              bonusMesInicio={bonusMesInicio}
              bonusMesFim={bonusMesFim}
              onBonusMesInicioChange={setBonusMesInicio}
              onBonusMesFimChange={setBonusMesFim}
              iniciativasMesFiltro={iniciativasMesFiltro}
              onIniciativasMesFiltroChange={setIniciativasMesFiltro}
              marketingMesFiltro={marketingMesFiltro}
              onMarketingMesFiltroChange={setMarketingMesFiltro}
              financeiroOpsMesFiltro={financeiroOpsMesFiltro}
              onFinanceiroOpsMesFiltroChange={setFinanceiroOpsMesFiltro}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
