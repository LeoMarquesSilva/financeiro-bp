import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/shared/utils/format'

type Props = {
  title?: string
  okLabel: string
  nokLabel: string
  qtdOk: number
  qtdNok: number
  loading?: boolean
  className?: string
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

/** Card estilo KPI_HTML_ANALISEPUB — % em destaque; quantidade em secundário. */
export function EficienciaEficDesvioCard({
  title = 'Eficiência x Desvio',
  okLabel,
  nokLabel,
  qtdOk,
  qtdNok,
  loading = false,
  className,
}: Props) {
  const total = qtdOk + qtdNok
  const pctOk = total > 0 ? (qtdOk / total) * 100 : 0
  const pctNok = total > 0 ? (qtdNok / total) * 100 : 0

  return (
    <div
      className={cn(
        'flex min-w-[230px] flex-col gap-2.5 rounded-[10px] border border-[#E6E8EB] bg-white p-4 shadow-[0_2px_4px_rgba(15,23,42,0.06)]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {title}
        </div>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] text-slate-700">{okLabel}</div>
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums text-emerald-600">
                {formatPercent(pctOk)}
              </div>
              <div className="text-[11px] font-bold tabular-nums text-slate-500">
                {formatInt(qtdOk)} de {formatInt(total)}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] text-slate-700">{nokLabel}</div>
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums text-red-600">
                {formatPercent(pctNok)}
              </div>
              <div className="text-[11px] font-bold tabular-nums text-slate-500">
                {formatInt(qtdNok)} de {formatInt(total)}
              </div>
            </div>
          </div>
          <div className="mt-1.5 text-xs text-slate-700">
            <span className="font-semibold">Total:</span> {formatInt(total)}
          </div>
        </>
      )}
    </div>
  )
}
