import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

export type DashboardCarteiraStat = {
  label: string
  value: string
  hint?: string
}

type Props = {
  to: string
  title: string
  description: string
  icon: LucideIcon
  accentClass: string
  stats: DashboardCarteiraStat[]
}

export function DashboardCarteiraCard({
  to,
  title,
  description,
  icon: Icon,
  accentClass,
  stats,
}: Props) {
  return (
    <NavLink
      to={to}
      className={cn(
        'group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all',
        'hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                accentClass,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-600" />
      </div>

      <dl className="mt-auto space-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-slate-500">{stat.label}</dt>
            <dd className="text-right">
              <span className="text-sm font-semibold tabular-nums text-slate-900">{stat.value}</span>
              {stat.hint && (
                <p className="text-[10px] text-slate-400">{stat.hint}</p>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </NavLink>
  )
}

/** Helper para formatar valor monetário nos cards. */
export function carteiraCurrency(value: number): string {
  return formatCurrency(value)
}
