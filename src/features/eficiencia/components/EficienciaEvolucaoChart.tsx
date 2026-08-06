import { useRef } from 'react'
import {
  CartesianGrid,
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

export type EvolucaoPoint = { mes: number; valor: number; meta?: number | null }

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

export function EficienciaEvolucaoChart({
  title,
  subtitle,
  data,
  color = '#0ea5e9',
  metaFixa = null,
  onRacionalClick,
}: Props) {
  const chartExportRef = useRef<HTMLDivElement>(null)

  const chartData = data.map((d) => ({
    mesLabel: MESES_LABEL[d.mes - 1] ?? String(d.mes),
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
        <div data-chart-plot className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={280}>
            <LineChart data={chartData} margin={{ left: 4, right: 16, top: 16, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis dataKey="mesLabel" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => formatPercent(v)}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={48}
                domain={[0, 100]}
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
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
