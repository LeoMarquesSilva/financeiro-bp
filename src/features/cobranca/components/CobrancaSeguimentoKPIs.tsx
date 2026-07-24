import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { AlertTriangle, Clock, Users, type LucideIcon } from 'lucide-react'
import type { CobrancaSeguimentoGrupo, CobrancaSeguimentoKpis } from '../types/cobrancaSeguimento.types'
import { CobrancaSeguimentoDepartamentosPie } from './CobrancaSeguimentoDepartamentosPie'

interface Props {
  kpis: CobrancaSeguimentoKpis
  grupos: CobrancaSeguimentoGrupo[]
  loading?: boolean
}

type StatCard = {
  label: string
  value: string
  icon: LucideIcon
  color: string
  hint?: string
}

function kpiValueSizeClass(value: string): string {
  const len = value.length
  if (len <= 6) return 'cobranca-kpi-value cobranca-kpi-value--short'
  if (len <= 13) return 'cobranca-kpi-value'
  return 'cobranca-kpi-value cobranca-kpi-value--long'
}

function CobrancaSeguimentoStatCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
  loading,
}: StatCard & { loading?: boolean }) {
  const displayValue = loading ? '…' : value

  return (
    <Card className="cobranca-kpi-card flex h-full flex-col p-4">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className={cn('h-4 w-4 shrink-0', color)} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center pt-2">
        <p
          className={cn(
            'font-bold tabular-nums text-slate-900',
            !loading && kpiValueSizeClass(value),
          )}
          title={loading ? undefined : value}
        >
          {displayValue}
        </p>
        {hint && !loading && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    </Card>
  )
}

export function CobrancaSeguimentoKPIs({ kpis, grupos, loading }: Props) {
  const cards: StatCard[] = [
    {
      label: 'Valor em aberto',
      value: formatCurrency(kpis.valor_total),
      icon: AlertTriangle,
      color: 'text-red-600',
    },
    {
      label: 'Grupos devedores',
      value: String(kpis.qtd_grupos),
      icon: Users,
      color: 'text-slate-700',
    },
    {
      label: 'Faixa 31–60 dias',
      value: formatCurrency(kpis.valor_faixa_31_60),
      icon: Clock,
      color: 'text-amber-600',
      hint: `${kpis.media_dias_atraso} dias (média)`,
    },
  ]

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.slice(0, 2).map((c) => (
        <CobrancaSeguimentoStatCard key={c.label} {...c} loading={loading} />
      ))}

      <CobrancaSeguimentoDepartamentosPie grupos={grupos} loading={loading} />

      {cards.slice(2).map((c) => (
        <CobrancaSeguimentoStatCard key={c.label} {...c} loading={loading} />
      ))}
    </div>
  )
}
