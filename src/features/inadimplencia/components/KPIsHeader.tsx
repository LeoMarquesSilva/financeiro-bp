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

const kpiCardBase =
  'min-w-[140px] rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm'

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
          <div
            key={i}
            className={cn(kpiCardBase, 'h-20 animate-pulse bg-slate-100')}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap gap-4">
      <div className={kpiCardBase}>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Total em aberto
        </p>
        <p className="mt-1 text-xl font-bold text-slate-900">
          {formatCurrency(totalEmAberto)}
        </p>
      </div>
      <div
        className={cn(kpiCardBase, 'border-blue-200/80 bg-blue-50/50')}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-blue-700">
          Classe A
        </p>
        <p className="mt-1 text-xl font-bold text-blue-900">
          {formatCurrency(totalClasseA)}
        </p>
      </div>
      <div
        className={cn(kpiCardBase, 'border-amber-200/80 bg-amber-50/50')}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
          Classe B
        </p>
        <p className="mt-1 text-xl font-bold text-amber-900">
          {formatCurrency(totalClasseB)}
        </p>
      </div>
      <div
        className={cn(kpiCardBase, 'border-red-200/80 bg-red-50/50')}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-red-700">
          Classe C
        </p>
        <p className="mt-1 text-xl font-bold text-red-900">
          {formatCurrency(totalClasseC)}
        </p>
      </div>
      <div className={kpiCardBase}>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Taxa de recuperação
        </p>
        <p className="mt-1 text-xl font-bold text-slate-900">
          {taxaRecuperacao.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}
