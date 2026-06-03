import { useMemo, useState } from 'react'
import { ChartColumnIncreasing } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LabelProps } from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { RECEITA_CHART_LABEL, RECEITA_COLORS } from '../constants'
import type { ReceitaMesRow } from '../types/receita.types'
import { buildAcumuladoChartData } from '../utils/receitaAcumuladoChart'
import { formatColunaLabel } from '../utils/receitaColunasChart'

const SERIES = [
  {
    key: 'recebidoAcumulado' as const,
    legend: 'Recebido real acumulado',
    color: RECEITA_COLORS.recebido.hex,
    type: 'bar' as const,
    defaultOn: true,
  },
  {
    key: 'previstoAcumulado' as const,
    legend: 'Previsto acumulado',
    color: RECEITA_COLORS.previsto.hex,
    type: 'bar' as const,
    defaultOn: true,
  },
  {
    key: 'metaAcumulada' as const,
    legend: 'Meta acumulada',
    color: RECEITA_COLORS.meta.hex,
    type: 'line' as const,
    strokeDasharray: '6 4',
    defaultOn: true,
  },
]

type SeriesKey = (typeof SERIES)[number]['key']

type Props = {
  rows: ReceitaMesRow[]
  ano: number
}

function AcumuladoBarLabel(props: LabelProps) {
  const { x, y, width, height, value } = props
  const num = typeof value === 'number' ? value : Number(value)
  if (!num || x == null || y == null || width == null || height == null) return null
  if (Number(height) < RECEITA_CHART_LABEL.minBarHeight) return null

  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 6}
      fill="#475569"
      textAnchor="middle"
      fontSize={RECEITA_CHART_LABEL.barTop}
      fontWeight={600}
    >
      {formatColunaLabel(num)}
    </text>
  )
}

function AcumuladoLineLabel(props: LabelProps) {
  const { x, y, value } = props
  const num = typeof value === 'number' ? value : Number(value)
  if (!num || x == null || y == null) return null

  return (
    <text
      x={Number(x)}
      y={Number(y) - 10}
      fill={RECEITA_COLORS.meta.hex}
      textAnchor="middle"
      fontSize={RECEITA_CHART_LABEL.linePoint}
      fontWeight={600}
    >
      {formatColunaLabel(num)}
    </text>
  )
}

function formatYAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

type TooltipPayload = {
  dataKey?: string | number
  value?: number
  color?: string
}

function AcumuladoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="pointer-events-auto z-50 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-lg"
      style={{ pointerEvents: 'auto' }}
      onWheel={(e) => e.stopPropagation()}
    >
      <p className="mb-1.5 font-semibold capitalize text-slate-800">{label}</p>
      <ul className="space-y-1">
        {payload
          .filter((e) => typeof e.value === 'number')
          .map((entry) => {
            const key = String(entry.dataKey ?? '')
            const series = SERIES.find((s) => s.key === key)
            if (!series) return null
            const color =
              typeof entry.color === 'string' ? entry.color : series.color
            return (
              <li key={key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {series.legend}
                </span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatCurrency(entry.value ?? 0)}
                </span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

export function ReceitaAcumuladoChart({ rows, ano }: Props) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(
    () => new Set(SERIES.filter((s) => s.defaultOn).map((s) => s.key)),
  )

  const chartData = useMemo(() => buildAcumuladoChartData(ano, rows), [ano, rows])

  const toggle = (key: SeriesKey) => {
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

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <ChartColumnIncreasing className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Valores acumulados</h2>
          <p className="text-xs text-slate-500">
            Recebido acumulado só até o mês atual · previsto e meta em todos os meses ({ano})
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {SERIES.map((s) => {
          const on = visible.has(s.key)
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                on
                  ? 'border-slate-200 bg-white text-slate-700 shadow-sm'
                  : 'border-transparent bg-slate-100/80 text-slate-400 line-through',
              )}
              aria-pressed={on}
            >
              {s.type === 'bar' ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
              ) : (
                <span
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
              )}
              {s.legend}
            </button>
          )
        })}
      </div>

      <div className="h-[340px] min-h-[340px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={340}>
          <ComposedChart
            data={chartData}
            margin={{ left: 4, right: 28, top: 40, bottom: 4 }}
            barCategoryGap="22%"
            barGap={4}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.35)"
            />

            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={60}
              domain={[0, 'auto']}
            />

            <Tooltip
              wrapperStyle={{ pointerEvents: 'auto', zIndex: 60 }}
              allowEscapeViewBox={{ x: false, y: true }}
              reverseDirection={{ x: true, y: true }}
              offset={12}
              content={<AcumuladoTooltip />}
              cursor={{ fill: 'rgba(148,163,184,0.1)' }}
            />

            {visible.has('recebidoAcumulado') && (
              <Bar
                dataKey="recebidoAcumulado"
                name="Recebido real acumulado"
                fill={RECEITA_COLORS.recebido.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                <LabelList dataKey="recebidoAcumulado" content={<AcumuladoBarLabel />} />
              </Bar>
            )}
            {visible.has('previstoAcumulado') && (
              <Bar
                dataKey="previstoAcumulado"
                name="Previsto acumulado"
                fill={RECEITA_COLORS.previsto.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                <LabelList dataKey="previstoAcumulado" content={<AcumuladoBarLabel />} />
              </Bar>
            )}
            {visible.has('metaAcumulada') && (
              <Line
                type="monotone"
                dataKey="metaAcumulada"
                name="Meta acumulada"
                stroke={RECEITA_COLORS.meta.hex}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: RECEITA_COLORS.meta.hex, strokeWidth: 0 }}
                activeDot={{
                  r: 5,
                  fill: RECEITA_COLORS.meta.hex,
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
                connectNulls
              >
                <LabelList dataKey="metaAcumulada" content={<AcumuladoLineLabel />} />
              </Line>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
