import { useRef } from 'react'
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'
import { formatPercent } from '@/shared/utils/format'
import { OverviewRacionalButton } from './OverviewKpiHeatRow'

const MESES_LABEL = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' }

export type EvolucaoPoint = {
  mes: number
  valor: number
  meta?: number | null
  /** Rótulo do eixo X (ex.: filtro semana). Default = mês abreviado. */
  label?: string
}

type Props = {
  title: string
  subtitle?: string
  data: EvolucaoPoint[]
  color?: string
  metaFixa?: number | null
  /** Abre o sheet de Racional (mesma base do Overview). */
  onRacionalClick?: () => void
}

function EvolucaoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number; name?: string; color?: string }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-slate-800">{label}</p>
      <ul className="space-y-1">
        {payload
          .filter((e) => typeof e.value === 'number')
          .map((entry, i) => (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {formatPercent(entry.value ?? 0)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}

function EvolucaoPointLabel(props: {
  x?: number | string
  y?: number | string
  value?: number | string | null
  index?: number
  total?: number
}) {
  const { x, y, value, index, total } = props
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null

  const cx = Number(x ?? 0)
  const cy = Number(y ?? 0)
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null

  // Inverte para baixo se o ponto estiver alto demais (evita corte no topo)
  const above = cy >= 22
  const labelY = above ? cy - 12 : cy + 16
  const anchor =
    index == null || total == null || total <= 1
      ? 'middle'
      : index <= 0
        ? 'start'
        : index >= total - 1
          ? 'end'
          : 'middle'

  return (
    <text
      x={cx}
      y={labelY}
      textAnchor={anchor}
      dominantBaseline={above ? 'auto' : 'hanging'}
      fill="#334155"
      fontSize={11}
      fontWeight={600}
      className="tabular-nums"
    >
      {formatPercent(num)}
    </text>
  )
}

export function EficienciaEvolucaoChart({
  title,
  subtitle,
  data,
  color = '#0ea5e9',
  metaFixa = null,
  onRacionalClick,
}: Props) {
  const chartExportRef = useRef<HTMLDivElement>(null)
  const pointCount = data.length

  const chartData = data.map((d) => ({
    mesLabel: d.label ?? MESES_LABEL[d.mes - 1] ?? String(d.mes),
    valor: d.valor,
    meta: metaFixa ?? d.meta ?? undefined,
  }))

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <LineChartIcon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRacionalClick && <OverviewRacionalButton onClick={onRacionalClick} className="w-auto" />}
          <ChartCopyButton containerRef={chartExportRef} />
        </div>
      </div>

      {/* ref no wrapper; data-chart-plot no filho — copyChartImage usa querySelector nos descendentes */}
      <div ref={chartExportRef} className="w-full">
        <div data-chart-plot className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <LineChart data={chartData} margin={{ left: 4, right: 20, top: 28, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis dataKey="mesLabel" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => formatPercent(v)}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={52}
                domain={[0, 100]}
                padding={{ top: 18 }}
              />
              <Tooltip content={<EvolucaoTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
              {metaFixa != null && (
                <ReferenceLine
                  y={metaFixa}
                  stroke="#f59e0b"
                  strokeDasharray="6 4"
                  label={{ value: `Meta ${formatPercent(metaFixa)}`, position: 'insideTopRight', fontSize: 11, fill: '#b45309' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="valor"
                name={title}
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="valor"
                  content={(props) => (
                    <EvolucaoPointLabel
                      x={props.x}
                      y={props.y}
                      value={
                        props.value == null || typeof props.value === 'boolean'
                          ? null
                          : (props.value as number | string)
                      }
                      index={typeof props.index === 'number' ? props.index : undefined}
                      total={pointCount}
                    />
                  )}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
