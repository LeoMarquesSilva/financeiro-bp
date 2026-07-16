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
import { copyElementImageToClipboard } from '@/shared/utils/copyChartImage'

type Props = {
  containerRef: RefObject<HTMLElement | null>
  className?: string
  label?: string
  preserveBackground?: boolean
}

export function ElementCopyButton({
  containerRef,
  className,
  label = 'Copiar',
  preserveBackground = false,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  const handleCopy = async () => {
    const container = containerRef.current
    if (!container) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }

    setStatus('loading')
    try {
      await copyElementImageToClipboard(container, undefined, { preserveBackground })
      setStatus('done')
      toast.success('Conteúdo copiado — cole no PowerPoint com Ctrl+V')
      window.setTimeout(() => setStatus('idle'), 2000)
    } catch (error) {
      setStatus('idle')
      const message =
        error instanceof Error ? error.message : 'Não foi possível copiar o conteúdo'
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
            aria-label={
              preserveBackground
                ? 'Copiar conteúdo com fundo do card'
                : 'Copiar conteúdo com fundo transparente'
            }
          >
            <Icon
              className={cn('h-3.5 w-3.5', status === 'loading' && 'animate-spin')}
              aria-hidden
            />
            {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {preserveBackground
            ? 'Copia o card com a cor de fundo para colar no PowerPoint'
            : 'Copia o conteúdo com fundo transparente para colar no PowerPoint'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
