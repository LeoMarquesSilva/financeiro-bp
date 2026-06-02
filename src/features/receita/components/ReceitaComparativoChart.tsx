import { useMemo, useState } from 'react'
import { ListTree, Table2, TrendingUp } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import type { ReceitaMesRow } from '../types/receita.types'
import { ReceitaRecebidoDetalheSheet } from './ReceitaRecebidoDetalheSheet'

const SERIES = [
  {
    key: 'meta',
    legend: 'Meta',
    color: '#1e40af',
    type: 'line' as const,
    strokeDasharray: '6 4',
    defaultOn: true,
  },
  {
    key: 'projetadoBaseAbril',
    legend: 'Proj. base abril',
    color: '#ea580c',
    type: 'line' as const,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'projetadoReal',
    legend: 'Proj. real',
    color: '#10b981',
    type: 'line' as const,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'recebido',
    legend: 'Recebido',
    color: '#0284c7',
    gradientId: 'receitaRecebidoGradient',
    type: 'area' as const,
    defaultOn: true,
  },
  {
    key: 'previsto',
    legend: 'Previsto',
    color: '#7c3aed',
    gradientId: 'receitaPrevistoGradient',
    type: 'area' as const,
    defaultOn: true,
  },
] as const

type SeriesKey = (typeof SERIES)[number]['key']

const DEFAULT_VISIBLE = new Set(
  SERIES.filter((s) => s.defaultOn).map((s) => s.key),
)

type ChartPoint = {
  mesLabel: string
  meta: number
  projetadoBaseAbril: number
  projetadoReal: number
  recebido: number
  previsto: number
}

function formatYAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function pctMeta(recebido: number, meta: number): number | null {
  if (!meta) return null
  return (recebido / meta) * 100
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-slate-400">—</span>
  const color =
    pct >= 100
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
      : pct >= 80
        ? 'bg-amber-50 text-amber-800 ring-amber-200/80'
        : 'bg-red-50 text-red-800 ring-red-200/80'
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.25rem] justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1',
        color,
      )}
    >
      {pct.toFixed(0)}%
    </span>
  )
}

type TooltipEntry = {
  dataKey?: string | number
  value?: number
}

function ReceitaChartTooltip({
  active,
  payload,
  label,
  visible,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  visible: Set<SeriesKey>
}) {
  if (!active || !payload?.length) return null

  const entries = payload.filter((e) => visible.has(e.dataKey as SeriesKey))
  if (!entries.length) return null

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold capitalize text-slate-800">{label}</p>
      <ul className="space-y-1">
        {entries.map((entry) => {
          const series = SERIES.find((s) => s.key === entry.dataKey)
          if (!series) return null
          const value = typeof entry.value === 'number' ? entry.value : 0
          return (
            <li key={series.key} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                {series.legend}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(value)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ReceitaChartLegend({
  visible,
  onToggle,
}: {
  visible: Set<SeriesKey>
  onToggle: (key: SeriesKey) => void
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2 px-1">
      {SERIES.map((s) => {
        const on = visible.has(s.key)
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
              on
                ? 'border-slate-200 bg-white text-slate-700 shadow-sm'
                : 'border-transparent bg-slate-100/80 text-slate-400 line-through',
            )}
            aria-pressed={on}
          >
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', !on && 'opacity-40')}
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            {s.legend}
          </button>
        )
      })}
      <span className="hidden text-[10px] text-slate-400 sm:inline">Clique para exibir/ocultar</span>
    </div>
  )
}

type Props = {
  rows: ReceitaMesRow[]
  ano: number
}

export function ReceitaComparativoChart({ rows, ano }: Props) {
  const [detalheMes, setDetalheMes] = useState<ReceitaMesRow | null>(null)
  const [visible, setVisible] = useState<Set<SeriesKey>>(() => new Set(DEFAULT_VISIBLE))

  const toggleSeries = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const chartData: ChartPoint[] = rows.map((r) => ({
    mesLabel: r.mesLabel,
    meta: r.meta,
    projetadoBaseAbril: r.projetadoBaseAbril,
    projetadoReal: r.projetadoReal,
    recebido: r.recebido,
    previsto: r.previsto,
  }))

  const totais = useMemo(
    () => ({
      meta: rows.reduce((s, r) => s + r.meta, 0),
      projetadoBaseAbril: rows.reduce((s, r) => s + r.projetadoBaseAbril, 0),
      projetadoReal: rows.reduce((s, r) => s + r.projetadoReal, 0),
      recebido: rows.reduce((s, r) => s + r.recebido, 0),
      previsto: rows.reduce((s, r) => s + r.previsto, 0),
    }),
    [rows],
  )

  const pctTotal = pctMeta(totais.recebido, totais.meta)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Comparativo mensal</h2>
              <p className="text-xs text-slate-500">
                Linhas = metas e projeções · Áreas = recebido e previsto ({ano})
              </p>
            </div>
          </div>
        </div>

        <ReceitaChartLegend visible={visible} onToggle={toggleSeries} />

        <div className="h-[300px] min-h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <ComposedChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="receitaRecebidoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="receitaPrevistoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />

              <XAxis
                dataKey="mesLabel"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={60}
                domain={[0, 'auto']}
              />

              <Tooltip
                content={<ReceitaChartTooltip visible={visible} />}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
              />

              {SERIES.filter((s) => s.type === 'area' && visible.has(s.key)).map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill={`url(#${s.gradientId})`}
                  dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              ))}

              {SERIES.filter((s) => s.type === 'line' && visible.has(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.strokeDasharray}
                  dot={false}
                  activeDot={{ r: 4, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-slate-500" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-800">Detalhamento por mês</h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 backdrop-blur-sm">Mês</th>
                <th className="px-4 py-3 text-right">Meta</th>
                <th className="hidden px-4 py-3 text-right md:table-cell">Proj. base abril</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Proj. real</th>
                <th className="px-4 py-3 text-right">Recebido</th>
                <th className="px-4 py-3 text-center">% meta</th>
                <th className="px-4 py-3 text-right">Previsto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = pctMeta(r.recebido, r.meta)
                return (
                  <tr
                    key={r.mes}
                    className={cn(
                      'border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80',
                      i % 2 === 1 && 'bg-slate-50/40',
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium capitalize text-slate-800 even:bg-slate-50/40">
                      {r.mesLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {formatCurrency(r.meta)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-slate-700 md:table-cell">
                      {formatCurrency(r.projetadoBaseAbril)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-slate-700 lg:table-cell">
                      {formatCurrency(r.projetadoReal)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-sky-700">
                      <div className="inline-flex items-center justify-end gap-1">
                        <span>{formatCurrency(r.recebido)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-sky-600 hover:bg-sky-50 hover:text-sky-800"
                          title="Ver descritivo por plano de contas"
                          aria-label={`Descritivo recebido ${r.mesLabel} ${ano}`}
                          onClick={() => setDetalheMes(r)}
                        >
                          <ListTree className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <PctBadge pct={pct} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-violet-700">
                      {formatCurrency(r.previsto)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold text-slate-800">
                <td className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 backdrop-blur-sm">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totais.meta)}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                  {formatCurrency(totais.projetadoBaseAbril)}
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">
                  {formatCurrency(totais.projetadoReal)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-sky-800">
                  {formatCurrency(totais.recebido)}
                </td>
                <td className="px-4 py-3 text-center">
                  <PctBadge pct={pctTotal} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-violet-800">
                  {formatCurrency(totais.previsto)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        <strong>Recebido:</strong> valor pago por data de pagamento. <strong>Previsto:</strong> valor
        por data de vencimento. Planos da cota: honorários mensais, spot, sucumbência, êxito,
        manutenção, por hora e advocatícios.
      </p>

      {detalheMes && (
        <ReceitaRecebidoDetalheSheet
          open={!!detalheMes}
          onOpenChange={(open) => {
            if (!open) setDetalheMes(null)
          }}
          ano={ano}
          mes={detalheMes.mes}
          mesLabel={detalheMes.mesLabel}
          totalRecebido={detalheMes.recebido}
        />
      )}
    </div>
  )
}
