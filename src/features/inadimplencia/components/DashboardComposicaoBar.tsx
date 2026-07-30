import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'

export type ComposicaoCarteiraItem = {
  key: string
  label: string
  valor: number
  colorClass: string
}

type Props = {
  items: ComposicaoCarteiraItem[]
  total: number
}

export function DashboardComposicaoBar({ items, total }: Props) {
  if (total <= 0) {
    return (
      <p className="text-sm text-slate-500">Nenhum valor em aberto nas carteiras.</p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {items.map((item) => {
          const pct = (item.valor / total) * 100
          if (pct <= 0) return null
          return (
            <div
              key={item.key}
              className={cn('h-full transition-all', item.colorClass)}
              style={{ width: `${pct}%` }}
              title={`${item.label}: ${formatPercent(pct)}`}
            />
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => {
          const pct = total > 0 ? (item.valor / total) * 100 : 0
          return (
            <li key={item.key} className="flex items-center gap-2 text-xs text-slate-600">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', item.colorClass)} />
              <span>
                {item.label}{' '}
                <span className="font-medium text-slate-800">
                  {formatCurrency(item.valor)} ({formatPercent(pct)})
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
