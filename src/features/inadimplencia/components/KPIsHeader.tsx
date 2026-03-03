import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { DollarSign, TrendingUp, AlertTriangle, AlertCircle, ShieldCheck } from 'lucide-react'

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

interface KPIItemProps {
  icon: React.ElementType
  label: string
  value: string
  iconColor: string
  valueColor?: string
}

function KPIItem({ icon: Icon, label, value, iconColor, valueColor = 'text-slate-900' }: KPIItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p className={cn('mt-0.5 text-lg font-bold tabular-nums leading-tight', valueColor)}>{value}</p>
      </div>
    </div>
  )
}

function KPISkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
      <div>
        <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-5 w-20 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <KPISkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KPIItem
        icon={DollarSign}
        label="Total em aberto"
        value={formatCurrency(totalEmAberto)}
        iconColor="bg-slate-100 text-slate-600"
      />
      <KPIItem
        icon={AlertCircle}
        label="Classe A"
        value={formatCurrency(totalClasseA)}
        iconColor="bg-blue-50 text-blue-600"
        valueColor="text-blue-800"
      />
      <KPIItem
        icon={AlertTriangle}
        label="Classe B"
        value={formatCurrency(totalClasseB)}
        iconColor="bg-amber-50 text-amber-600"
        valueColor="text-amber-800"
      />
      <KPIItem
        icon={ShieldCheck}
        label="Classe C"
        value={formatCurrency(totalClasseC)}
        iconColor="bg-red-50 text-red-600"
        valueColor="text-red-800"
      />
      <KPIItem
        icon={TrendingUp}
        label="Recuperação"
        value={`${taxaRecuperacao.toFixed(1)}%`}
        iconColor="bg-emerald-50 text-emerald-600"
        valueColor="text-emerald-800"
      />
    </div>
  )
}
