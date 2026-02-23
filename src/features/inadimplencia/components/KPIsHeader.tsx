import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'

interface KPIsHeaderProps {
  totalEmAberto: number
  totalClasseA: number
  totalClasseB: number
  totalClasseC: number
  taxaRecuperacao: number
  followUpVencidos?: number
  followUpAVencer?: number
  loading?: boolean
}

const cardBase = 'min-w-[140px]'

const kpiVariants = {
  default: '',
  blue: 'border-blue-200/80 bg-blue-50/50',
  amber: 'border-amber-200/80 bg-amber-50/50',
  red: 'border-red-200/80 bg-red-50/50',
} as const

const labelVariants = {
  default: 'text-slate-500',
  blue: 'text-blue-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
} as const

const valueVariants = {
  default: 'text-slate-900',
  blue: 'text-blue-900',
  amber: 'text-amber-900',
  red: 'text-red-900',
} as const

function KPICard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string
  variant?: keyof typeof kpiVariants
}) {
  return (
    <Card className={cn(cardBase, kpiVariants[variant])}>
      <CardContent className="p-4 pt-4">
        <p
          className={cn(
            'text-xs font-medium uppercase tracking-wider',
            labelVariants[variant]
          )}
        >
          {label}
        </p>
        <p className={cn('mt-1 text-xl font-bold', valueVariants[variant])}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function KPICardSkeleton() {
  return (
    <Card className={cn(cardBase, 'h-20 overflow-hidden')}>
      <CardContent className="h-full p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-6 w-24 animate-pulse rounded bg-slate-200" />
      </CardContent>
    </Card>
  )
}

export function KPIsHeader({
  totalEmAberto,
  totalClasseA,
  totalClasseB,
  totalClasseC,
  taxaRecuperacao,
  loading,
}: KPIsHeaderProps) {
  if (loading) {
    return (
      <div className="mb-4 flex flex-wrap gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap gap-4">
      <KPICard
        label="Total em aberto"
        value={formatCurrency(totalEmAberto)}
        variant="default"
      />
      <KPICard
        label="Classe A"
        value={formatCurrency(totalClasseA)}
        variant="blue"
      />
      <KPICard
        label="Classe B"
        value={formatCurrency(totalClasseB)}
        variant="amber"
      />
      <KPICard
        label="Classe C"
        value={formatCurrency(totalClasseC)}
        variant="red"
      />
      <KPICard
        label="Taxa de recuperação"
        value={`${taxaRecuperacao.toFixed(1)}%`}
        variant="default"
      />
    </div>
  )
}
