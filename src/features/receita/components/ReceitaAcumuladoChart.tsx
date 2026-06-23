import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChartColumnIncreasing, Layers, Loader2, Percent } from 'lucide-react'
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
import { RECEITA_CHART_LABEL, RECEITA_CHART_AXIS, RECEITA_COLORS, RECEITA_DEPARTAMENTO_CORES } from '../constants'
import { receitaService } from '../services/receitaService'
import type {
  ReceitaAcumuladoChartPoint,
  ReceitaAreaChartSlice,
  ReceitaDepartamentoCoresConfig,
  ReceitaMesRow,
} from '../types/receita.types'
import {
  buildAcumuladoAreaPercentData,
  buildAcumuladoChartData,
  toAcumuladoPercentData,
} from '../utils/receitaAcumuladoChart'
import { buildAreaSlices, formatColunaLabel, formatPercentLabel } from '../utils/receitaColunasChart'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'

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
  departamentoCores?: ReceitaDepartamentoCoresConfig
}

function AcumuladoBarLabel({
  percentMode,
  ...props
}: LabelProps & { percentMode: boolean }) {
  const { x, y, width, height, value } = props
  const num = typeof value === 'number' ? value : Number(value)
  if (!num || x == null || y == null || width == null || height == null) return null
  if (Number(height) < RECEITA_CHART_LABEL.minBarHeight) return null

  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 6}
      fill={RECEITA_CHART_AXIS.label}
      textAnchor="middle"
      fontSize={RECEITA_CHART_LABEL.barTop}
      fontWeight={600}
    >
      {percentMode ? formatPercentLabel(num) : formatColunaLabel(num)}
    </text>
  )
}

function AcumuladoAreaSegmentLabel(props: LabelProps) {
  const { x, y, width, height, value } = props
  const num = typeof value === 'number' ? value : Number(value)
  if (!num || x == null || y == null || width == null || height == null) return null
  if (num < 5 || Number(height) < RECEITA_CHART_LABEL.minStackHeight) return null

  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) + Number(height) / 2}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={RECEITA_CHART_LABEL.barInside}
      fontWeight={600}
      pointerEvents="none"
    >
      {formatPercentLabel(num)}
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
      fill={RECEITA_CHART_AXIS.label}
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

function formatYAxisPercent(value: number): string {
  if (value >= 100) return `${Math.round(value)}%`
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
}

type TooltipPayload = {
  dataKey?: string | number
  value?: number
  color?: string
  name?: string
}

function AcumuladoTooltip({
  active,
  payload,
  label,
  percentMode,
  porArea,
  areaSlices,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  percentMode: boolean
  porArea: boolean
  areaSlices: ReceitaAreaChartSlice[]
}) {
  if (!active || !payload?.length) return null

  const areaKeys = new Set(areaSlices.map((s) => s.dataKey))

  if (porArea && percentMode) {
    const areaItems = payload
      .filter((e) => typeof e.value === 'number' && areaKeys.has(String(e.dataKey ?? '')))
      .map((entry) => {
        const key = String(entry.dataKey ?? '')
        const slice = areaSlices.find((s) => s.dataKey === key)
        return {
          key,
          name: slice?.departamento ?? key,
          color: slice?.color ?? '#64748b',
          value: entry.value ?? 0,
        }
      })
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)

    const totalRecebido = areaItems.reduce((sum, i) => sum + i.value, 0)
    const previstoEntry = payload.find((e) => e.dataKey === 'previstoAcumulado')

    return (
      <div
        className="pointer-events-auto z-50 max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-lg"
        style={{ pointerEvents: 'auto' }}
        onWheel={(e) => e.stopPropagation()}
      >
        <p className="mb-1.5 font-semibold capitalize text-slate-800">{label}</p>
        {totalRecebido > 0 && (
          <p className="mb-2 text-xs font-medium text-slate-700">
            Total recebido: {formatPercentLabel(totalRecebido)} da meta
          </p>
        )}
        <ul className="space-y-1">
          {areaItems.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                {formatPercentLabel(item.value)}
              </span>
            </li>
          ))}
        </ul>
        {typeof previstoEntry?.value === 'number' && previstoEntry.value > 0 && (
          <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Previsto acumulado:{' '}
            <span className="font-semibold text-slate-900">
              {formatPercentLabel(previstoEntry.value)} da meta
            </span>
          </p>
        )}
      </div>
    )
  }

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
            if (!series || (percentMode && series.key === 'metaAcumulada')) return null
            const color =
              typeof entry.color === 'string' ? entry.color : series.color
            const legend = percentMode
              ? series.key === 'recebidoAcumulado'
                ? 'Recebido acumulado'
                : 'Previsto acumulado'
              : series.legend
            return (
              <li key={key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {legend}
                  {percentMode && (
                    <span className="text-slate-400">(% da meta)</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {percentMode
                    ? formatPercentLabel(entry.value ?? 0)
                    : formatCurrency(entry.value ?? 0)}
                </span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

const SERIES_PERCENT_LEGEND: Partial<Record<SeriesKey, string>> = {
  recebidoAcumulado: 'Recebido acumulado (% meta)',
  previstoAcumulado: 'Previsto acumulado (% meta)',
}

export function ReceitaAcumuladoChart({
  rows,
  ano,
  departamentoCores = RECEITA_DEPARTAMENTO_CORES,
}: Props) {
  const [percentMode, setPercentMode] = useState(false)
  const [porArea, setPorArea] = useState(false)
  const [visible, setVisible] = useState<Set<SeriesKey>>(
    () => new Set(SERIES.filter((s) => s.defaultOn).map((s) => s.key)),
  )
  const chartExportRef = useRef<HTMLDivElement>(null)

  const meses = useMemo(() => rows.map((r) => r.mes), [rows])

  const { data: deptRows, isLoading: deptLoading, error: deptError } = useQuery({
    queryKey: ['receita', 'recebido-departamento-acumulado', ano, meses],
    queryFn: () => receitaService.fetchRecebidoPorDepartamento(ano),
    enabled: meses.length > 0 && percentMode && porArea,
  })

  const areaSlices = useMemo(
    () => buildAreaSlices(deptRows ?? [], meses, departamentoCores),
    [deptRows, meses, departamentoCores],
  )

  useEffect(() => {
    if (!percentMode) setPorArea(false)
  }, [percentMode])

  const rawChartData = useMemo(() => buildAcumuladoChartData(ano, rows), [ano, rows])

  const chartData = useMemo((): ReceitaAcumuladoChartPoint[] => {
    if (!percentMode) return rawChartData
    if (porArea && deptRows) {
      return buildAcumuladoAreaPercentData(ano, rows, deptRows, areaSlices)
    }
    return toAcumuladoPercentData(rawChartData)
  }, [percentMode, porArea, deptRows, areaSlices, rawChartData, ano, rows])

  const visibleSeries = useMemo(() => {
    if (!percentMode) return visible
    const next = new Set(visible)
    next.delete('metaAcumulada')
    return next
  }, [percentMode, visible])

  const showRecebidoPorArea = percentMode && porArea && !deptLoading && !deptError

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
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-start gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <ChartColumnIncreasing className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {percentMode
                ? porArea
                  ? 'Atingimento acumulado por área (% da meta)'
                  : 'Atingimento acumulado (% da meta)'
                : 'Valores acumulados'}
            </h2>
            <p className="text-xs text-slate-500">
              {percentMode && porArea
                ? `Cada área mostra sua contribuição em % da meta acumulada · ${ano}`
                : percentMode
                  ? `Recebido e previsto em % da meta acumulada · ideal para apresentação (${ano})`
                  : `Recebido acumulado só até o mês atual · previsto e meta em todos os meses (${ano})`}
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

        {percentMode && (
          <button
            type="button"
            onClick={() => setPorArea((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
              porArea
                ? 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
            aria-pressed={porArea}
          >
            <Layers className="h-3 w-3 shrink-0" aria-hidden />
            {porArea ? 'Visão consolidada' : 'Quebrar por área'}
          </button>
        )}
      </div>

      <div ref={chartExportRef} className="flex flex-col">
      {porArea && percentMode && deptError && (
        <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Não foi possível carregar recebido por área. Verifique a função{' '}
          <code className="rounded bg-amber-100/80 px-1">receita_recebido_por_departamento_mensal</code>.
        </p>
      )}

      <div
        data-chart-plot
        className="relative h-[340px] min-h-[340px] w-full min-w-0"
      >
        {porArea && percentMode && deptLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
          </div>
        )}
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
              tick={{ fontSize: 12, fill: RECEITA_CHART_AXIS.tick }}
              axisLine={false}
              tickLine={false}
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
              shared
              filterNull={false}
              wrapperStyle={{ pointerEvents: 'auto', zIndex: 60 }}
              allowEscapeViewBox={{ x: false, y: true }}
              reverseDirection={{ x: true, y: true }}
              offset={12}
              content={
                <AcumuladoTooltip
                  percentMode={percentMode}
                  porArea={showRecebidoPorArea}
                  areaSlices={areaSlices}
                />
              }
              cursor={{ fill: 'rgba(148,163,184,0.1)' }}
            />

            {showRecebidoPorArea &&
              visibleSeries.has('recebidoAcumulado') &&
              areaSlices.map((seg, segIndex) => (
                <Bar
                  key={seg.dataKey}
                  dataKey={seg.dataKey}
                  name={seg.departamento}
                  stackId="recebido-acum"
                  fill={seg.color}
                  maxBarSize={48}
                  radius={
                    segIndex === areaSlices.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                  }
                >
                  <LabelList dataKey={seg.dataKey} content={<AcumuladoAreaSegmentLabel />} />
                  {segIndex === areaSlices.length - 1 && (
                    <LabelList
                      dataKey="recebidoAcumulado"
                      content={(props) => (
                        <AcumuladoBarLabel percentMode {...props} />
                      )}
                    />
                  )}
                </Bar>
              ))}

            {!showRecebidoPorArea && visibleSeries.has('recebidoAcumulado') && (
              <Bar
                dataKey="recebidoAcumulado"
                name={
                  percentMode
                    ? 'Recebido acumulado (% meta)'
                    : 'Recebido real acumulado'
                }
                fill={RECEITA_COLORS.recebido.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                <LabelList
                  dataKey="recebidoAcumulado"
                  content={<AcumuladoBarLabel percentMode={percentMode} />}
                />
              </Bar>
            )}
            {visibleSeries.has('previstoAcumulado') && (
              <Bar
                dataKey="previstoAcumulado"
                name={
                  percentMode ? 'Previsto acumulado (% meta)' : 'Previsto acumulado'
                }
                fill={RECEITA_COLORS.previsto.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                <LabelList
                  dataKey="previstoAcumulado"
                  content={<AcumuladoBarLabel percentMode={percentMode} />}
                />
              </Bar>
            )}
            {!percentMode && visibleSeries.has('metaAcumulada') && (
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

        <div
          data-chart-legend
          className="mt-3 flex flex-wrap items-center justify-center gap-2"
        >
        {!showRecebidoPorArea &&
          SERIES.filter((s) => !percentMode || s.key !== 'metaAcumulada').map((s) => {
            const on = visibleSeries.has(s.key)
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
                {percentMode
                  ? (SERIES_PERCENT_LEGEND[s.key] ?? s.legend)
                  : s.legend}
              </button>
            )
          })}

        {showRecebidoPorArea &&
          areaSlices.map((s) => (
            <span
              key={s.dataKey}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.departamento}
            </span>
          ))}

        {showRecebidoPorArea && visibleSeries.has('previstoAcumulado') && (
          <button
            type="button"
            onClick={() => toggle('previstoAcumulado')}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm"
            aria-pressed
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: RECEITA_COLORS.previsto.hex }}
              aria-hidden
            />
            Previsto acumulado (% meta)
          </button>
        )}
        </div>
      </div>
    </section>
  )
}
