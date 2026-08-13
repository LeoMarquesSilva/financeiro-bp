import { useMemo, useRef, useState } from 'react'
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
  /** Período exclusivo do Bloco 4 (YoY). Default Jan–Jun. */
  const [bnMesInicio, setBnMesInicio] = useState(1)
  const [bnMesFim, setBnMesFim] = useState(6)
  const bigNumberMeses = useMemo(
    () => mesesRangeBigNumber(bnMesInicio, bnMesFim),
    [bnMesInicio, bnMesFim],
  )
  /** Período exclusivo do Bloco 6 (Iniciativas) — alinhado à aba Ops Legais. */
  const [iniciativasMesFiltro, setIniciativasMesFiltro] =
    useState<MesFiltroEficiencia>(null)
  /** Período exclusivo do Bloco 7 (Marketing). */
  const [marketingMesFiltro, setMarketingMesFiltro] =
    useState<MesFiltroEficiencia>(null)
  /** Período exclusivo do Bloco 8 (Financeiro Ops). */
  const [financeiroOpsMesFiltro, setFinanceiroOpsMesFiltro] =
    useState<MesFiltroEficiencia>(null)

  const {
    rows,
    colunas,
    composicao,
    receitaRows,
    bigNumber,
    controladoria,
    iniciativas,
    marketing,
    financeiroOps,
    loading,
    loadingComposicao,
    loadingBigNumber,
    loadingControladoria,
    loadingIniciativas,
    loadingMarketing,
    loadingFinanceiroOps,
    bigNumberError,
    controladoriaError,
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
  )

  const handleCopyBloco = async (blocoId: ApresentacaoBlocoId) => {
    const root = slideRef.current
    if (!root) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }
    if (blocoId === 'bignumber' && (loadingBigNumber || !bigNumber)) {
      toast.error('Big Numbers ainda carregando')
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
                Bloco 1–3: filtro abaixo · Bloco 4: YoY · Bloco 5: ano · Bloco
                6–8: filtro próprio · cópia 33,87 × 16,32 cm
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {APRESENTACAO_BLOCOS.map((bloco, index) => {
                const status = copyStatus[bloco.id] ?? 'idle'
                const CopyIcon =
                  status === 'loading' ? Loader2 : status === 'done' ? Check : Copy
                const blocoBusy =
                  bloco.id === 'bignumber'
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
                              : loading
                return (
                  <Button
                    key={bloco.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700"
                    onClick={() => handleCopyBloco(bloco.id)}
                    disabled={status === 'loading' || blocoBusy}
                    aria-label={`Copiar ${bloco.label} para PowerPoint`}
                  >
                    <CopyIcon
                      className={
                        status === 'loading' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'
                      }
                      aria-hidden
                    />
                    Copiar bloco {index + 1}
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
          <div className="mx-auto max-w-[1200px]">
            <ApresentacaoJuridicoSlide
              ref={slideRef}
              colunas={colunas}
              rows={rows}
              composicao={composicao}
              receitaRows={receitaRows}
              bigNumber={bigNumber}
              controladoria={controladoria}
              iniciativas={iniciativas}
              marketing={marketing}
              financeiroOps={financeiroOps}
              ano={ano}
              loading={loading}
              loadingComposicao={loadingComposicao}
              loadingBigNumber={loadingBigNumber}
              loadingControladoria={loadingControladoria}
              loadingIniciativas={loadingIniciativas}
              loadingMarketing={loadingMarketing}
              loadingFinanceiroOps={loadingFinanceiroOps}
              bigNumberError={bigNumberError}
              controladoriaError={controladoriaError}
              iniciativasError={iniciativasError}
              marketingError={marketingError}
              financeiroOpsError={financeiroOpsError}
              bigNumberMesInicio={bnMesInicio}
              bigNumberMesFim={bnMesFim}
              onBigNumberMesInicioChange={setBnMesInicio}
              onBigNumberMesFimChange={setBnMesFim}
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
