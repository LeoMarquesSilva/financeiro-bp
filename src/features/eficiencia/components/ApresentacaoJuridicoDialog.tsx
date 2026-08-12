import { useRef, useState } from 'react'
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
import type { MesFiltroEficiencia } from '../constants'

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
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const { rows, colunas, loading } = useApresentacaoMatrix(ano, mesFiltro, open)

  const handleCopy = async () => {
    const el = slideRef.current
    if (!el || loading) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }
    setCopyStatus('loading')
    try {
      await copyApresentacaoSlideToClipboard(el)
      setCopyStatus('done')
      toast.success('Slide 33,87×16,32 cm copiado — cole com Ctrl+V')
      window.setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (error) {
      setCopyStatus('idle')
      const message =
        error instanceof Error ? error.message : 'Não foi possível copiar o conteúdo'
      toast.error(message)
    }
  }

  const CopyIcon =
    copyStatus === 'loading' ? Loader2 : copyStatus === 'done' ? Check : Copy

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
                3 blocos · áreas com ícone · cópia 33,87 × 16,32 cm
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700"
              onClick={handleCopy}
              disabled={copyStatus === 'loading' || loading}
              aria-label="Copiar slide para PowerPoint"
            >
              <CopyIcon
                className={
                  copyStatus === 'loading' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'
                }
                aria-hidden
              />
              COPIAR
            </Button>
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
              loading={loading}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
