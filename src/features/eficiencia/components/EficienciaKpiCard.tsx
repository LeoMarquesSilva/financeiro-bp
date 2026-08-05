import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type Props = {
  title: string
  value: string
  hint?: string
  meta?: string
  atingiuMeta?: boolean | null
  icon: LucideIcon
  accentClass?: string
  loading?: boolean
}

export function EficienciaKpiCard({
  title,
  value,
  hint,
  meta,
  atingiuMeta,
  icon: Icon,
  accentClass = 'bg-slate-100 text-slate-700',
  loading,
}: Props) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="truncate text-xs font-medium text-slate-500">{title}</h3>
      </div>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded bg-slate-200/60" />
      ) : (
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      )}

      {(hint || meta) && !loading && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {hint && <span className="text-slate-400">{hint}</span>}
          {meta && (
            <span
              className={cn(
                'font-medium',
                atingiuMeta == null
                  ? 'text-slate-400'
                  : atingiuMeta
                    ? 'text-emerald-600'
                    : 'text-amber-600',
              )}
            >
              meta: {meta}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
