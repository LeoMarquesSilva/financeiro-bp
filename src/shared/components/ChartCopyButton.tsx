import { useState, type RefObject } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { copyChartImageToClipboard } from '@/shared/utils/copyChartImage'

type Props = {
  containerRef: RefObject<HTMLElement | null>
  className?: string
}

export function ChartCopyButton({ containerRef, className }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  const handleCopy = async () => {
    const container = containerRef.current
    if (!container) {
      toast.error('Gráfico não disponível para cópia')
      return
    }

    setStatus('loading')
    try {
      await copyChartImageToClipboard(container)
      setStatus('done')
      toast.success('Gráfico copiado — cole no PowerPoint com Ctrl+V')
      window.setTimeout(() => setStatus('idle'), 2000)
    } catch (error) {
      setStatus('idle')
      const message =
        error instanceof Error ? error.message : 'Não foi possível copiar o gráfico'
      toast.error(message)
    }
  }

  const Icon =
    status === 'loading' ? Loader2 : status === 'done' ? Check : Copy

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('h-8 shrink-0 gap-1.5 text-xs text-slate-600', className)}
            onClick={handleCopy}
            disabled={status === 'loading'}
            aria-label="Copiar gráfico com fundo transparente"
          >
            <Icon
              className={cn('h-3.5 w-3.5', status === 'loading' && 'animate-spin')}
              aria-hidden
            />
            Copiar gráfico
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Copia o gráfico com legenda abaixo e fundo transparente para colar no PowerPoint
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
