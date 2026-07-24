import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import { MESES_CURTOS } from '../constants'
import { OPEX_COLORS } from '../constants'
import type { OpexOrcamentoLinha } from '../types/opex.types'

type MesTotal = {
  mes: number
  label: string
  total: number
}

type Props = {
  linhas: OpexOrcamentoLinha[]
  mesSelecionado: number | null
  onMesSelect: (mes: number | null) => void
  compact?: boolean
  className?: string
}

export function buildTotaisPorMes(linhas: OpexOrcamentoLinha[]): MesTotal[] {
  const totals = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    label: MESES_CURTOS[i],
    total: 0,
  }))
  for (const l of linhas) {
    if (l.mes >= 1 && l.mes <= 12) totals[l.mes - 1].total += l.valor
  }
  return totals
}

export function OpexOrcamentoMesChart({
  linhas,
  mesSelecionado,
  onMesSelect,
  compact = false,
  className,
}: Props) {
  const chartData = useMemo(() => buildTotaisPorMes(linhas), [linhas])
  const maxTotal = useMemo(() => Math.max(...chartData.map((d) => d.total), 0), [chartData])
  const plotHeight = compact ? 56 : 128

  if (!maxTotal) {
    return (
      <p className={cn('text-xs text-slate-500', compact ? 'py-2' : 'py-6 text-center text-sm', className)}>
        Sem valores no escopo selecionado.
      </p>
    )
  }

  return (
    <div className={cn('w-full min-w-0 overflow-x-auto', className)}>
      <div
        className={cn(
          'grid w-full gap-0.5 sm:gap-1',
          compact ? 'min-w-[480px] py-1' : 'min-w-[640px] py-2',
        )}
        style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
        role="group"
        aria-label="Distribuição mensal do orçamento"
      >
      {chartData.map((entry) => {
        const selecionado = mesSelecionado === entry.mes
        const esmaecido = mesSelecionado != null && !selecionado
        const pct = entry.total > 0 ? Math.max((entry.total / maxTotal) * 100, 6) : 0

        return (
          <button
            key={entry.mes}
            type="button"
            aria-pressed={selecionado}
            aria-label={`${entry.label}: ${formatCurrency(entry.total)}`}
            title={`${entry.label.toUpperCase()} · ${formatCurrency(entry.total)}`}
            onClick={() => onMesSelect(selecionado ? null : entry.mes)}
            className={cn(
              'group flex min-w-0 flex-col items-center gap-1 rounded-md px-0.5 transition-opacity sm:px-1',
              esmaecido ? 'opacity-40' : 'opacity-100',
              'hover:bg-slate-50/80',
            )}
          >
            {!compact && (
              <span className="hidden h-4 truncate text-[10px] tabular-nums text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                {formatCurrencyCompact(entry.total)}
              </span>
            )}
            <div
              className="relative flex w-full items-end justify-center border-b border-slate-200/80"
              style={{ height: plotHeight }}
            >
              <div
                className={cn(
                  'w-full max-w-[28px] rounded-t-sm transition-all sm:max-w-[36px]',
                  selecionado
                    ? 'bg-purple-600 shadow-sm'
                    : 'bg-violet-300 group-hover:bg-violet-400',
                )}
                style={{
                  height: `${pct}%`,
                  backgroundColor: selecionado ? OPEX_COLORS.previsto.hex : undefined,
                }}
              />
            </div>
            <span
              className={cn(
                'w-full truncate text-center text-[9px] font-medium uppercase leading-none sm:text-[10px]',
                selecionado ? 'font-semibold text-violet-800' : 'text-slate-500',
              )}
            >
              {entry.label}
            </span>
          </button>
        )
      })}
      </div>
    </div>
  )
}
