import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { MetricaFinanceiraConfig } from '../constants/financeiroTotais'

interface EscritorioTotalCardProps {
  config: MetricaFinanceiraConfig
  valor: number
  countGrupos: number
  onClick: () => void
}

export function EscritorioTotalCard({ config, valor, countGrupos, onClick }: EscritorioTotalCardProps) {
  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full min-w-[11.5rem] shrink-0 snap-start text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        'sm:min-w-0 sm:shrink',
      )}
      aria-label={`${config.label}: ${formatCurrency(valor)} em ${countGrupos} grupo(s). Ver detalhamento.`}
    >
      <Card
        className={cn(
          'h-full cursor-pointer shadow-sm transition-shadow group-hover:shadow-md',
          config.cardClassName,
        )}
      >
        <CardContent className="pt-4">
          <p className={cn('flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide', config.labelClassName)}>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{config.label}</span>
          </p>
          <p className={cn('mt-1 text-lg font-bold sm:text-xl', config.valueClassName)}>{formatCurrency(valor)}</p>
          <p className={cn('text-xs', config.countClassName)}>{countGrupos} grupo(s)</p>
          {config.subtitle && (
            <p className={cn('mt-1 text-[11px]', config.subtitleClassName)}>{config.subtitle}</p>
          )}
          <p className="mt-2 text-[11px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
            Ver por grupo →
          </p>
        </CardContent>
      </Card>
    </button>
  )
}
