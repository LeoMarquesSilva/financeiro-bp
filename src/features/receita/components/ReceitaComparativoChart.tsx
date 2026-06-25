import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ListTree, Percent, Table2, TrendingUp } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import type { ReceitaMesRow } from '../types/receita.types'
import { RECEITA_CHART_AXIS, RECEITA_CHART_LABEL, RECEITA_COLORS } from '../constants'
import { ReceitaRecebidoDetalheSheet } from './ReceitaRecebidoDetalheSheet'
import { isMesFuturo, valorRecebidoGrafico } from '../utils/receitaMes'
import { formatPercentLabel, formatColunaLabel } from '../utils/receitaColunasChart'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'

const SERIES = [
  {
    key: 'meta',
    legend: 'Meta',
    color: RECEITA_COLORS.meta.hex,
    type: 'line' as const,
    strokeDasharray: '6 4',
    defaultOn: true,
  },
  {
    key: 'projetadoBaseAbril',
    legend: 'Proj. base abril',
    color: RECEITA_COLORS.projetadoBaseAbril.hex,
    type: 'line' as const,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'projetadoReal',
    legend: 'Proj. real',
    color: RECEITA_COLORS.projetadoReal.hex,
    type: 'line' as const,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'recebido',
    legend: 'Recebido',
    color: RECEITA_COLORS.recebido.hex,
    gradientId: 'receitaRecebidoGradient',
    type: 'area' as const,
    defaultOn: true,
  },
  {
    key: 'previsto',
    legend: 'Previsto',
    color: RECEITA_COLORS.previsto.hex,
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
  recebido: number | null
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

function formatYAxisPercent(value: number): string {
  if (value >= 100) return `${Math.round(value)}%`
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
}

function toComparativoPercentData(data: ChartPoint[]): ChartPoint[] {
  return data.map((p) => {
    const meta = p.meta
    if (meta <= 0) {
      return {
        ...p,
        meta: 0,
        projetadoBaseAbril: 0,
        projetadoReal: 0,
        previsto: 0,
        recebido: p.recebido != null ? 0 : null,
      }
    }
    return {
      mesLabel: p.mesLabel,
      meta: 100,
      projetadoBaseAbril: (p.projetadoBaseAbril / meta) * 100,
      projetadoReal: (p.projetadoReal / meta) * 100,
      previsto: (p.previsto / meta) * 100,
      recebido: p.recebido != null ? (p.recebido / meta) * 100 : null,
    }
  })
}

const SERIES_PERCENT_LEGEND: Partial<Record<SeriesKey, string>> = {
  meta: 'Meta (100%)',
  recebido: 'Recebido (% meta)',
  previsto: 'Previsto (% meta)',
  projetadoBaseAbril: 'Proj. base abril (% meta)',
  projetadoReal: 'Proj. real (% meta)',
}

function pctMeta(recebido: number, meta: number): number | null {
  if (!meta) return null
  return (recebido / meta) * 100
}

function ComparativoDotLabel({
  color,
  percentMode,
  position = 'right',
}: {
  color: string
  percentMode: boolean
  position?: 'right' | 'above' | 'below'
}) {
  return function Label(props: LabelProps) {
    const { x, y, value } = props
    if (value == null || x == null || y == null) return null
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return null

    const text = percentMode ? formatPercentLabel(num) : formatColunaLabel(num)
    if (!text) return null

    const cx = Number(x)
    const cy = Number(y)

    if (position === 'above') {
      return (
        <text
          x={cx}
          y={cy - 10}
          fill={color}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={RECEITA_CHART_LABEL.linePoint}
          fontWeight={600}
        >
          {text}
        </text>
      )
    }

    if (position === 'below') {
      return (
        <text
          x={cx}
          y={cy + 14}
          fill={color}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={RECEITA_CHART_LABEL.linePoint}
          fontWeight={600}
        >
          {text}
        </text>
      )
    }

    return (
      <text
        x={cx + 8}
        y={cy}
        fill={color}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={RECEITA_CHART_LABEL.linePoint}
        fontWeight={600}
      >
        {text}
      </text>
    )
  }
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-slate-400">—</span>
  const color =
    pct >= 100
      ? 'bg-emerald-100 text-emerald-800 ring-emerald-300/80'
      : pct >= 80
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
        : 'bg-green-50/80 text-emerald-600 ring-emerald-100'
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
  percentMode,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  visible: Set<SeriesKey>
  percentMode: boolean
}) {
  if (!active || !payload?.length) return null

  const entries = payload.filter((e) => visible.has(e.dataKey as SeriesKey))
  if (!entries.length) return null

  return (
    <div
      className="pointer-events-auto z-50 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm shadow-lg"
      style={{ pointerEvents: 'auto' }}
      onWheel={(e) => e.stopPropagation()}
    >
      <p className="mb-1.5 font-semibold capitalize text-slate-800">{label}</p>
      <ul className="space-y-1">
        {entries.map((entry) => {
          const series = SERIES.find((s) => s.key === entry.dataKey)
          if (!series) return null
          const value = typeof entry.value === 'number' ? entry.value : null
          if (value == null) return null
          return (
            <li key={series.key} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                {percentMode && series.key !== 'meta'
                  ? (SERIES_PERCENT_LEGEND[series.key] ?? `${series.legend} (% meta)`)
                  : percentMode && series.key === 'meta'
                    ? SERIES_PERCENT_LEGEND.meta
                    : series.legend}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {percentMode ? formatPercentLabel(value) : formatCurrency(value)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ReceitaChartLegend({
  visible,
  percentMode,
  onToggle,
}: {
  visible: Set<SeriesKey>
  percentMode: boolean
  onToggle: (key: SeriesKey) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 px-1">
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
            {percentMode
              ? (SERIES_PERCENT_LEGEND[s.key] ?? `${s.legend} (% meta)`)
              : s.legend}
          </button>
        )
      })}
      <span className="hidden text-[10px] text-slate-400 sm:inline" data-chart-export-ignore>
        Clique para exibir/ocultar
      </span>
    </div>
  )
}

type Props = {
  rows: ReceitaMesRow[]
  ano: number
}

export function ReceitaComparativoChart({ rows, ano }: Props) {
  const [detalheMes, setDetalheMes] = useState<ReceitaMesRow | null>(null)
  const [tabelaAberta, setTabelaAberta] = useState(false)
  const [percentMode, setPercentMode] = useState(false)
  const [visible, setVisible] = useState<Set<SeriesKey>>(() => new Set(DEFAULT_VISIBLE))
  const chartExportRef = useRef<HTMLDivElement>(null)

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

  const rawChartData: ChartPoint[] = useMemo(
    () =>
      rows.map((r) => ({
        mesLabel: r.mesLabel,
        meta: r.meta,
        projetadoBaseAbril: r.projetadoBaseAbril,
        projetadoReal: r.projetadoReal,
        recebido: valorRecebidoGrafico(r.recebido, ano, r.mes),
        previsto: r.previsto,
      })),
    [rows, ano],
  )

  const chartData = useMemo(
    () => (percentMode ? toComparativoPercentData(rawChartData) : rawChartData),
    [percentMode, rawChartData],
  )

  const visibleSeries = visible

  const rowsComDados = useMemo(
    () => rows.filter((r) => !isMesFuturo(ano, r.mes)),
    [rows, ano],
  )

  const totais = useMemo(
    () => ({
      meta: rowsComDados.reduce((s, r) => s + r.meta, 0),
      projetadoBaseAbril: rowsComDados.reduce((s, r) => s + r.projetadoBaseAbril, 0),
      projetadoReal: rowsComDados.reduce((s, r) => s + r.projetadoReal, 0),
      recebido: rowsComDados.reduce((s, r) => s + r.recebido, 0),
      previsto: rows.reduce((s, r) => s + r.previsto, 0),
    }),
    [rowsComDados],
  )

  const pctTotal = pctMeta(totais.recebido, totais.meta)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                RECEITA_COLORS.meta.bgIcon,
              )}
            >
              <TrendingUp className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {percentMode ? 'Comparativo mensal (% da meta)' : 'Comparativo mensal'}
              </h2>
              <p className="text-xs text-slate-500">
                {percentMode ? (
                  <>Séries em % da meta de cada mês · linha tracejada = 100% ({ano})</>
                ) : (
                  <>
                    <span className={RECEITA_COLORS.meta.textStrong}>Meta</span>
                    {' · '}
                    <span className={RECEITA_COLORS.projetadoBaseAbril.text}>Proj. base abril</span>
                    {' · '}
                    <span className={RECEITA_COLORS.projetadoReal.text}>Proj. real</span>
                    {' · áreas = recebido e previsto ('}{ano})
                  </>
                )}
              </p>
            </div>
          </div>
          <ChartCopyButton containerRef={chartExportRef} />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPercentMode((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
              percentMode
                ? 'border-violet-200 bg-violet-50 text-violet-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
            aria-pressed={percentMode}
          >
            <Percent className="h-3 w-3 shrink-0" aria-hidden />
            {percentMode ? 'Ver valores (R$)' : 'Ver % da meta'}
          </button>
        </div>

        <div ref={chartExportRef} className="flex flex-col">
          <div data-chart-plot className="h-[300px] min-h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <ComposedChart
              data={chartData}
              margin={{ left: 4, right: percentMode ? 48 : 12, top: percentMode ? 8 : 16, bottom: 4 }}
            >
              <defs>
                <linearGradient id="receitaRecebidoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RECEITA_COLORS.recebido.hex} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={RECEITA_COLORS.recebido.hex} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="receitaPrevistoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RECEITA_COLORS.previsto.hex} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={RECEITA_COLORS.previsto.hex} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />

              <XAxis
                dataKey="mesLabel"
                tick={{ fontSize: 12, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis
                tickFormatter={percentMode ? formatYAxisPercent : formatYAxis}
                tick={{ fontSize: 11, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                width={percentMode ? 48 : 60}
                domain={[0, 'auto']}
              />

              <Tooltip
                wrapperStyle={{ pointerEvents: 'auto', zIndex: 60 }}
                allowEscapeViewBox={{ x: true, y: true }}
                content={<ReceitaChartTooltip visible={visibleSeries} percentMode={percentMode} />}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
              />

              {SERIES.filter((s) => s.type === 'area' && visibleSeries.has(s.key)).map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill={`url(#${'gradientId' in s ? s.gradientId : ''})`}
                  dot={({ cx, cy, value }) => {
                    if (value == null || cx == null || cy == null) return null
                    return <circle cx={cx} cy={cy} r={3} fill={s.color} />
                  }}
                  activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls={false}
                >
                  {s.key === 'recebido' && (
                    <LabelList
                      dataKey="recebido"
                      content={ComparativoDotLabel({
                        color: s.color,
                        percentMode,
                        position: percentMode ? 'right' : 'above',
                      })}
                    />
                  )}
                </Area>
              ))}

              {SERIES.filter((s) => s.type === 'line' && visibleSeries.has(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={'strokeDasharray' in s ? s.strokeDasharray : undefined}
                  dot={false}
                  activeDot={{ r: 4, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

          <div data-chart-legend className="mt-3">
            <ReceitaChartLegend
              visible={visibleSeries}
              percentMode={percentMode}
              onToggle={toggleSeries}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-slate-500" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-800">Detalhamento por mês</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-slate-600"
            onClick={() => setTabelaAberta((v) => !v)}
            aria-expanded={tabelaAberta}
          >
            {tabelaAberta ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                Expandir
              </>
            )}
          </Button>
        </div>

        {tabelaAberta && (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 backdrop-blur-sm">Mês</th>
                <th className={cn('px-4 py-3 text-right', RECEITA_COLORS.meta.header)}>Meta</th>
                <th
                  className={cn(
                    'hidden px-4 py-3 text-right md:table-cell',
                    RECEITA_COLORS.projetadoBaseAbril.header,
                  )}
                >
                  Proj. base abril
                </th>
                <th
                  className={cn(
                    'hidden px-4 py-3 text-right lg:table-cell',
                    RECEITA_COLORS.projetadoReal.header,
                  )}
                >
                  Proj. real
                </th>
                <th className="px-4 py-3 text-right">Recebido</th>
                <th className={cn('px-4 py-3 text-center', RECEITA_COLORS.meta.header)}>% meta</th>
                <th className="px-4 py-3 text-right">Previsto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const futuro = isMesFuturo(ano, r.mes)
                const pct = futuro ? null : pctMeta(r.recebido, r.meta)
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
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums font-medium',
                        RECEITA_COLORS.meta.text,
                      )}
                    >
                      {formatCurrency(r.meta)}
                    </td>
                    <td
                      className={cn(
                        'hidden px-4 py-2.5 text-right tabular-nums font-medium md:table-cell',
                        RECEITA_COLORS.projetadoBaseAbril.text,
                      )}
                    >
                      {formatCurrency(r.projetadoBaseAbril)}
                    </td>
                    <td
                      className={cn(
                        'hidden px-4 py-2.5 text-right tabular-nums font-medium lg:table-cell',
                        RECEITA_COLORS.projetadoReal.text,
                      )}
                    >
                      {formatCurrency(r.projetadoReal)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums font-medium',
                        futuro ? 'text-slate-400' : RECEITA_COLORS.recebido.text,
                      )}
                    >
                      {futuro ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>{formatCurrency(r.recebido)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-7 w-7 shrink-0 hover:bg-sky-50',
                              RECEITA_COLORS.recebido.text,
                              'hover:text-sky-900',
                            )}
                            title="Ver descritivo por plano de contas"
                            aria-label={`Descritivo recebido ${r.mesLabel} ${ano}`}
                            onClick={() => setDetalheMes(r)}
                          >
                            <ListTree className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <PctBadge pct={pct} />
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums font-medium',
                        RECEITA_COLORS.previsto.text,
                      )}
                    >
                      {formatCurrency(r.previsto)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold text-slate-800">
                <td className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 backdrop-blur-sm">Total</td>
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    RECEITA_COLORS.meta.textStrong,
                  )}
                >
                  {formatCurrency(totais.meta)}
                </td>
                <td
                  className={cn(
                    'hidden px-4 py-3 text-right tabular-nums md:table-cell',
                    RECEITA_COLORS.projetadoBaseAbril.textStrong,
                  )}
                >
                  {formatCurrency(totais.projetadoBaseAbril)}
                </td>
                <td
                  className={cn(
                    'hidden px-4 py-3 text-right tabular-nums lg:table-cell',
                    RECEITA_COLORS.projetadoReal.textStrong,
                  )}
                >
                  {formatCurrency(totais.projetadoReal)}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    RECEITA_COLORS.recebido.textStrong,
                  )}
                >
                  {formatCurrency(totais.recebido)}
                </td>
                <td className="px-4 py-3 text-center">
                  <PctBadge pct={pctTotal} />
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    RECEITA_COLORS.previsto.textStrong,
                  )}
                >
                  {formatCurrency(totais.previsto)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        )}
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
