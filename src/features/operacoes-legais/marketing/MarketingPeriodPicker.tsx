import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  formatInstagramPeriod,
  resolveInstagramPeriod,
  shiftInstagramPeriod,
} from './instagramPeriod'
import type { InstagramPeriodFilter } from './types'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const PRESETS: Array<{
  label: string
  value: Extract<InstagramPeriodFilter, { kind: 'preset' }>['preset']
}> = [
  { label: 'Esta semana', value: 'this_week' },
  { label: 'Semana anterior', value: 'last_week' },
  { label: 'Este mês', value: 'this_month' },
  { label: 'Mês anterior', value: 'last_month' },
  { label: 'Este ano', value: 'this_year' },
]

function toDate(value: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T12:00:00`) : undefined
}

function toDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function MarketingPeriodPicker({
  value,
  onChange,
  availableYears,
}: {
  value: InstagramPeriodFilter
  onChange: (value: InstagramPeriodFilter) => void
  availableYears: number[]
}) {
  const [open, setOpen] = useState(false)
  const currentYear = new Date().getFullYear()
  const [monthYear, setMonthYear] = useState(
    value.kind === 'month' ? value.year : availableYears[0] ?? currentYear,
  )
  const resolved = useMemo(() => resolveInstagramPeriod(value), [value])
  const [calendarMonth, setCalendarMonth] = useState(toDate(resolved.from) ?? new Date())
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>({
    from: toDate(resolved.from),
    to: toDate(resolved.to),
  })

  useEffect(() => {
    const from = toDate(resolved.from)
    setSelectedRange({ from, to: toDate(resolved.to) })
    if (from) setCalendarMonth(from)
  }, [resolved.from, resolved.to])

  const apply = (next: InstagramPeriodFilter) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={value.kind === 'all'}
          onClick={() => onChange(shiftInstagramPeriod(value, -1))}
          title="Período anterior"
          aria-label="Período anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-8 min-w-48 justify-between gap-2 rounded-lg px-3 font-semibold text-slate-700"
            >
              <span className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-teal-700" />
                <span className="truncate">{formatInstagramPeriod(value)}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(94vw,42rem)] p-0">
            <div className="grid sm:grid-cols-[14rem_1fr]">
              <aside className="space-y-5 border-b border-slate-100 p-4 sm:border-b-0 sm:border-r">
                <section>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Atalhos
                  </p>
                  <div className="space-y-1">
                    {PRESETS.map((preset) => {
                      const active = value.kind === 'preset' && value.preset === preset.value
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => apply({ kind: 'preset', preset: preset.value })}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                            active && 'bg-teal-50 font-semibold text-teal-800',
                          )}
                        >
                          {preset.label}
                          {active && <Check className="h-3.5 w-3.5" />}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => apply({ kind: 'all' })}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                        value.kind === 'all' && 'bg-teal-50 font-semibold text-teal-800',
                      )}
                    >
                      Todo o histórico
                      {value.kind === 'all' && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Ano
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableYears.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onClick={() => apply({ kind: 'year', year })}
                        className={cn(
                          'rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold tabular-nums transition hover:border-slate-400',
                          value.kind === 'year' && value.year === year &&
                            'border-slate-900 bg-slate-900 text-white',
                        )}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </section>
              </aside>

              <div className="space-y-4 p-4">
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Mês específico
                    </p>
                    <select
                      value={monthYear}
                      onChange={(event) => setMonthYear(Number(event.target.value))}
                      className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold"
                    >
                      {availableYears.map((year) => <option key={year}>{year}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MONTHS.map((label, index) => {
                      const month = index + 1
                      const active = value.kind === 'month' && value.year === monthYear && value.month === month
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => apply({ kind: 'month', year: monthYear, month })}
                          className={cn(
                            'rounded-lg border border-slate-200 py-1.5 text-xs font-semibold transition hover:border-slate-400',
                            active && 'border-slate-900 bg-slate-900 text-white',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Intervalo personalizado
                  </p>
                  <Calendar
                    mode="range"
                    selected={selectedRange}
                    onSelect={(range) => {
                      setSelectedRange(range)
                      if (range?.from && range.to) {
                        apply({ kind: 'custom', from: toDateKey(range.from), to: toDateKey(range.to) })
                      }
                    }}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    className="mx-auto border-0 p-0"
                  />
                </section>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={value.kind === 'all'}
          onClick={() => onChange(shiftInstagramPeriod(value, 1))}
          title="Próximo período"
          aria-label="Próximo período"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-9 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm"
        onClick={() => onChange({ kind: 'preset', preset: 'last_week' })}
      >
        Ver semana anterior
      </Button>
    </div>
  )
}
