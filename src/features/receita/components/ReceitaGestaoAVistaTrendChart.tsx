import { useMemo } from 'react'
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
  type LabelProps,
} from 'recharts'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import {
  RECEITA_CHART_AXIS,
  RECEITA_CHART_LABEL,
  RECEITA_CHART_LAYOUT,
  RECEITA_COLORS,
  receitaChartInnerPlotHeight,
} from '../constants'
import type { GestaoVistaMesRow } from '../types/receita.types'
import {
  edgeAwareAnchor,
  labelYForPosition,
  resolveLabelVerticalPosition,
} from '../utils/chartLabelPlacement'
import { formatColunaLabel } from '../utils/receitaColunasChart'

const GESTAO_VISTA_CHART_HEIGHT = 220

const GESTAO_VISTA_MARGIN = {
  ...RECEITA_CHART_LAYOUT.marginWithPointLabels,
  top: 24,
}

type ChartPoint = {
  mes: number
  mesLabel: string
  meta: number | null
  previsto: number
  recebido: number | null
}

type Props = {
  meses: GestaoVistaMesRow[]
  loading?: boolean
}

function ChartLabelWithBackdrop({
  text,
  x,
  y,
  color,
  textAnchor = 'middle',
  dominantBaseline = 'auto',
}: {
  text: string
  x: number
  y: number
  color: string
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
  dominantBaseline?: 'auto' | 'hanging' | 'middle' | 'inherit'
}) {
  const padX = 4
  const charW = 6.2
  const boxW = text.length * charW + padX * 2
  const boxH = 14
  const boxX =
    textAnchor === 'start' ? x : textAnchor === 'end' ? x - boxW : x - boxW / 2
  const boxY = Math.max(RECEITA_CHART_LAYOUT.labelMinY, y - 12)

  return (
    <g>
      <rect
        x={boxX}
        y={boxY}
        width={boxW}
        height={boxH}
        rx={3}
        fill="rgba(255,255,255,0.92)"
        stroke="rgba(226,232,240,0.9)"
        strokeWidth={0.5}
      />
      <text
        x={x}
        y={y}
        fill={color}
        fontSize={RECEITA_CHART_LABEL.linePoint}
        fontWeight={600}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
      >
        {text}
      </text>
    </g>
  )
}

function LinePointLabel({
  color,
  data,
  offset = 10,
}: {
  color: string
  data: ChartPoint[]
  offset?: number
}) {
  return function Label(props: LabelProps & { index?: number }) {
    const { x, y, value, index } = props
    if (value == null || x == null || y == null || index == null) return null
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num) || num <= 0) return null

    const text = formatCurrencyCompact(num)
    if (!text) return null

    const cx = Number(x)
    const cy = Number(y)
    const anchor = edgeAwareAnchor(index, data.length)
    const labelX = anchor === 'start' ? cx + 8 : anchor === 'end' ? cx - 8 : cx
    const plotHeight = receitaChartInnerPlotHeight(GESTAO_VISTA_MARGIN)
    const vertical = resolveLabelVerticalPosition(cy, offset, undefined, 'above', plotHeight)
    const labelY = labelYForPosition(cy, offset, vertical)

    return (
      <ChartLabelWithBackdrop
        text={text}
        x={labelX}
        y={labelY}
        color={color}
        textAnchor={anchor}
        dominantBaseline={vertical === 'above' ? 'auto' : 'hanging'}
      />
    )
  }
}

function ChartSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl border border-slate-200/60 bg-slate-50"
      style={{ height: GESTAO_VISTA_CHART_HEIGHT }}
    />
  )
}

export function ReceitaGestaoAVistaTrendChart({ meses, loading }: Props) {
  const chartData: ChartPoint[] = useMemo(
    () =>
      meses.map((m) => ({
        mes: m.mes,
        mesLabel: m.mesLabel,
        meta: m.meta,
        previsto: m.previsto,
        recebido: m.recebido,
      })),
    [meses],
  )

  if (loading) return <ChartSkeleton />

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: RECEITA_COLORS.recebido.hex }}
          />
          Recebido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ backgroundColor: RECEITA_COLORS.previsto.hex }}
          />
          Previsto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded border border-dashed"
            style={{ borderColor: RECEITA_COLORS.meta.hex }}
          />
          Meta
        </span>
      </div>
      <ResponsiveContainer width="100%" height={GESTAO_VISTA_CHART_HEIGHT}>
        <ComposedChart data={chartData} margin={GESTAO_VISTA_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="mesLabel"
            tick={{ fill: RECEITA_CHART_AXIS.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: RECEITA_CHART_AXIS.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v) => formatColunaLabel(Number(v))}
            domain={[0, 'auto']}
            padding={{ top: RECEITA_CHART_LAYOUT.yAxisPaddingTopWithLabels }}
          />
          <Tooltip
            formatter={(value, name) => {
              const num = typeof value === 'number' ? value : Number(value)
              if (!Number.isFinite(num)) return ['—', String(name)]
              const label =
                name === 'recebido' ? 'Recebido' : name === 'previsto' ? 'Previsto' : 'Meta'
              return [formatCurrency(num), label]
            }}
            labelFormatter={(label) => String(label)}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar
            dataKey="recebido"
            name="recebido"
            fill={RECEITA_COLORS.recebido.hex}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Line
            type="monotone"
            dataKey="previsto"
            name="previsto"
            stroke={RECEITA_COLORS.previsto.hex}
            strokeWidth={2}
            dot={{ r: 3, fill: RECEITA_COLORS.previsto.hex }}
            connectNulls
          >
            <LabelList dataKey="previsto" content={LinePointLabel({ color: RECEITA_COLORS.previsto.hex, data: chartData, offset: 14 })} />
          </Line>
          <Line
            type="monotone"
            dataKey="meta"
            name="meta"
            stroke={RECEITA_COLORS.meta.hex}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 3, fill: RECEITA_COLORS.meta.hex }}
            connectNulls
          >
            <LabelList dataKey="meta" content={LinePointLabel({ color: RECEITA_COLORS.meta.hex, data: chartData, offset: 22 })} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
