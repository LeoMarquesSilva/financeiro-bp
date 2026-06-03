import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Layers, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { receitaService } from '../services/receitaService'
import { RECEITA_CHART_LABEL, RECEITA_COLUNAS_METRICAS } from '../constants'
import type {
  ReceitaColunasChartPoint,
  ReceitaDepartamentoCoresConfig,
  ReceitaMesRow,
} from '../types/receita.types'
import { RECEITA_DEPARTAMENTO_CORES } from '../constants'
import {
  buildAreaSlices,
  buildColunasChartData,
  buildColunasChartDataPorPlano,
  buildPlanoSlices,
  formatColunaLabel,
  formatPercentLabel,
} from '../utils/receitaColunasChart'

type MetricKey = (typeof RECEITA_COLUNAS_METRICAS)[number]['key']

type StackMode = 'area' | 'plano_percent'

type Props = {
  rows: ReceitaMesRow[]
  ano: number
  departamentoCores?: ReceitaDepartamentoCoresConfig
}

function formatYAxisCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function StackSegmentLabel(
  props: LabelProps & { stackTotal?: number; percentMode?: boolean },
) {
  const { x, y, width, height, value, stackTotal, percentMode } = props
  const num = typeof value === 'number' ? value : Number(value)
  const total = stackTotal ?? 0
  if (!num || !total || x == null || y == null || width == null || height == null) return null

  const w = Number(width)
  const h = Number(height)
  const share = num / total
  const minShare = percentMode ? 0.06 : 0.07
  if (share < minShare || h < RECEITA_CHART_LABEL.minStackHeight) return null

  const cx = Number(x) + w / 2
  const cy = Number(y) + h / 2
  const label = percentMode
    ? formatPercentLabel(share * 100)
    : formatColunaLabel(num)

  return (
    <text
      x={cx}
      y={cy}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={RECEITA_CHART_LABEL.barInside}
      fontWeight={600}
      pointerEvents="none"
    >
      {label}
    </text>
  )
}

function selectMesAtIndex(
  chartData: ReceitaColunasChartPoint[],
  index: number | undefined,
  setSelectedMes: Dispatch<SetStateAction<number | null>>,
) {
  if (index == null || index < 0 || index >= chartData.length) return
  const mes = chartData[index].mes
  setSelectedMes((prev) => (prev === mes ? null : mes))
}

type MesDetalheItem = {
  key: string
  name: string
  color: string
  valor: number
  pctShare: number | null
}

function buildMesDetalheItems(
  point: ReceitaColunasChartPoint,
  stackSlices: { dataKey: string; departamento: string; color: string }[],
  percentMode: boolean,
): MesDetalheItem[] {
  const recebidoMes =
    typeof point.recebidoTotal === 'number' ? point.recebidoTotal : 0

  return stackSlices
    .map((s) => {
      const valor = Number(point[s.dataKey]) || 0
      return {
        key: s.dataKey,
        name: s.departamento,
        color: s.color,
        valor,
        pctShare:
          percentMode && recebidoMes > 0 ? (valor / recebidoMes) * 100 : null,
      }
    })
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor)
}

function ColunasHoverHint({
  active,
  label,
}: {
  active?: boolean
  label?: string
}) {
  if (!active || !label) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-md">
      <span className="font-semibold capitalize text-slate-800">{label}</span>
      <span className="text-slate-500"> — clique na coluna para ver o detalhe</span>
    </div>
  )
}

function ColunasMesDetalhePanel({
  point,
  stackSlices,
  percentMode,
  visibleMetrics,
  chartData,
  selectedMes,
  onSelectMes,
  onClose,
}: {
  point: ReceitaColunasChartPoint
  stackSlices: { dataKey: string; departamento: string; color: string }[]
  percentMode: boolean
  visibleMetrics: Set<MetricKey>
  chartData: ReceitaColunasChartPoint[]
  selectedMes: number
  onSelectMes: (mes: number) => void
  onClose: () => void
}) {
  const items = buildMesDetalheItems(point, stackSlices, percentMode)
  const recebidoMes =
    typeof point.recebidoTotal === 'number' ? point.recebidoTotal : 0

  return (
    <div className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/40 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-sky-800/80">
            Detalhe do mês
          </p>
          <p className="text-sm font-semibold capitalize text-slate-900">
            {point.mesLabel}
            {recebidoMes > 0 && (
              <span className="ml-2 font-normal text-slate-600">
                recebido {formatCurrency(recebidoMes)}
              </span>
            )}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Fechar
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {chartData.map((d) => (
          <button
            key={d.mes}
            type="button"
            onClick={() => onSelectMes(d.mes)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors',
              d.mes === selectedMes
                ? 'border-sky-300 bg-white text-sky-900 shadow-sm'
                : 'border-transparent bg-white/60 text-slate-600 hover:bg-white',
            )}
          >
            {d.mesLabel}
          </button>
        ))}
      </div>

      {RECEITA_COLUNAS_METRICAS.filter((m) => visibleMetrics.has(m.key)).length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 border-b border-sky-100 pb-3 text-sm">
          {RECEITA_COLUNAS_METRICAS.filter((m) => visibleMetrics.has(m.key)).map((m) => {
            const v = Number(point[m.key]) || 0
            if (!v) return null
            return (
              <li key={m.key} className="flex items-center gap-1.5 text-slate-700">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                <span>{m.legend}:</span>
                <span className="font-semibold tabular-nums">{formatCurrency(v)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <ul className="max-h-64 space-y-2 overflow-y-auto overscroll-y-contain pr-1 text-sm">
        {items.length === 0 ? (
          <li className="text-slate-500">Sem recebido neste mês.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-lg bg-white/80 px-2.5 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 text-right font-semibold tabular-nums text-slate-900">
                {item.pctShare != null ? (
                  <>
                    {formatPercentLabel(item.pctShare)}
                    <span className="block text-xs font-normal text-slate-500">
                      {formatCurrency(item.valor)}
                    </span>
                  </>
                ) : (
                  formatCurrency(item.valor)
                )}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

export function ReceitaComparativoColunasChart({
  rows,
  ano,
  departamentoCores = RECEITA_DEPARTAMENTO_CORES,
}: Props) {
  const [stackMode, setStackMode] = useState<StackMode>('area')
  const [showRecebidoStack, setShowRecebidoStack] = useState(true)
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(
    () =>
      new Set(
        RECEITA_COLUNAS_METRICAS.filter((m) => m.defaultOn).map((m) => m.key),
      ),
  )

  const percentMode = stackMode === 'plano_percent'
  const [selectedMes, setSelectedMes] = useState<number | null>(null)
  const meses = useMemo(() => rows.map((r) => r.mes), [rows])

  useEffect(() => {
    setSelectedMes(null)
  }, [stackMode, ano])

  const { data: deptRows, isLoading: deptLoading, error: deptError } = useQuery({
    queryKey: ['receita', 'recebido-departamento', ano, meses],
    queryFn: () => receitaService.fetchRecebidoPorDepartamento(ano),
    enabled: meses.length > 0,
  })

  const { data: planoRows, isLoading: planoLoading, error: planoError } = useQuery({
    queryKey: ['receita', 'recebido-plano-mensal', ano, meses],
    queryFn: () => receitaService.fetchRecebidoPorPlanoMensal(ano),
    enabled: meses.length > 0,
  })

  const areaSlices = useMemo(
    () => buildAreaSlices(deptRows ?? [], meses, departamentoCores),
    [deptRows, meses, departamentoCores],
  )

  const planoSlices = useMemo(
    () => buildPlanoSlices(planoRows ?? [], meses),
    [planoRows, meses],
  )

  const stackSlices = percentMode ? planoSlices : areaSlices

  const chartData = useMemo(() => {
    if (percentMode) {
      return buildColunasChartDataPorPlano(ano, rows, planoRows ?? [], planoSlices)
    }
    return buildColunasChartData(ano, rows, deptRows ?? [], areaSlices)
  }, [ano, percentMode, rows, planoRows, planoSlices, deptRows, areaSlices])

  const isLoading = percentMode ? planoLoading : deptLoading
  const error = percentMode ? planoError : deptError

  const selectedPoint = useMemo(
    () => chartData.find((d) => d.mes === selectedMes) ?? null,
    [chartData, selectedMes],
  )

  const handleSelectMes = (mes: number) => {
    setSelectedMes((prev) => (prev === mes ? null : mes))
  }

  const handleBarClick = (_data: unknown, index: number) => {
    selectMesAtIndex(chartData, index, setSelectedMes)
  }

  const toggleMetric = (key: MetricKey) => {
    setVisibleMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1 && !showRecebidoStack) return prev
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
          <BarChart3 className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {percentMode ? 'Recebido por plano de contas' : 'Recebido por área'}
          </h2>
          <p className="text-xs text-slate-500">
            {percentMode
              ? `Colunas por plano (R$ no eixo, % no rótulo) · clique no mês para detalhar · ${ano}`
              : `Colunas por departamento · clique no mês para detalhar · ${ano}`}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex h-[340px] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando…
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          Erro ao carregar recebido{' '}
          {percentMode ? 'por plano de contas' : 'por área'}. Aplique a migration{' '}
          <code className="text-xs">
            {percentMode
              ? 'receita_recebido_por_plano_mensal'
              : 'receita_recebido_por_departamento_mensal'}
          </code>
          .
        </p>
      )}

      {!isLoading && !error && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setStackMode((m) => (m === 'area' ? 'plano_percent' : 'area'))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                percentMode
                  ? 'border-violet-200 bg-violet-50 text-violet-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
              aria-pressed={percentMode}
            >
              <Layers className="h-3 w-3 shrink-0" aria-hidden />
              {percentMode ? 'Ver por área (R$)' : 'Ver por plano (%)'}
            </button>

            <button
              type="button"
              onClick={() => setShowRecebidoStack((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                showRecebidoStack
                  ? 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm'
                  : 'border-transparent bg-slate-100/80 text-slate-400 line-through',
              )}
              aria-pressed={showRecebidoStack}
            >
              <span
                className="h-2 w-2 rounded-sm bg-gradient-to-r from-sky-600 to-sky-300"
                aria-hidden
              />
              {percentMode ? 'Recebido (%)' : 'Recebido (por área)'}
            </button>

            {RECEITA_COLUNAS_METRICAS.map((m) => {
                const on = visibleMetrics.has(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMetric(m.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                      on
                        ? 'border-slate-200 bg-white text-slate-700 shadow-sm'
                        : 'border-transparent bg-slate-100/80 text-slate-400 line-through',
                    )}
                    aria-pressed={on}
                  >
                    <span
                      className="h-0.5 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: m.color }}
                      aria-hidden
                    />
                    {m.legend}
                  </button>
                )
              })}
          </div>

          {stackSlices.length > 0 && (
            <div className="mb-3 flex flex-wrap justify-center gap-x-3 gap-y-1 px-1">
              {stackSlices.map((a) => (
                <span
                  key={a.dataKey}
                  className="inline-flex max-w-[200px] items-center gap-1 text-[10px] text-slate-500"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                    aria-hidden
                  />
                  <span className="truncate">{a.departamento}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Detalhe do mês:</span>
            {chartData.map((d) => (
              <button
                key={d.mes}
                type="button"
                onClick={() => handleSelectMes(d.mes)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                  selectedMes === d.mes
                    ? 'border-sky-400 bg-sky-100 text-sky-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50',
                )}
              >
                {d.mesLabel}
              </button>
            ))}
          </div>

          <div className="h-[360px] min-h-[360px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
              {percentMode ? (
                <ComposedChart
                  key="receita-colunas-plano-pct"
                  data={chartData}
                  margin={{ left: 4, right: 12, top: 32, bottom: 4 }}
                  barCategoryGap="18%"
                  barGap={2}
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
                    tickFormatter={formatYAxisCurrency}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={<ColunasHoverHint />}
                  />
                  {showRecebidoStack &&
                    stackSlices.map((seg, segIndex) => (
                      <Bar
                        key={seg.dataKey}
                        dataKey={seg.dataKey}
                        name={seg.departamento}
                        stackId="recebido"
                        fill={seg.color}
                        maxBarSize={56}
                        cursor="pointer"
                        onClick={handleBarClick}
                        style={
                          segIndex === stackSlices.length - 1
                            ? { cursor: 'pointer' }
                            : undefined
                        }
                      >
                        <LabelList
                          dataKey={seg.dataKey}
                          content={(props) => (
                            <StackSegmentLabel
                              {...props}
                              percentMode
                              stackTotal={
                                typeof props.index === 'number'
                                  ? (chartData[props.index]?.recebidoTotal ?? undefined)
                                  : undefined
                              }
                            />
                          )}
                        />
                      </Bar>
                    ))}
                  {RECEITA_COLUNAS_METRICAS.filter((m) => visibleMetrics.has(m.key)).map(
                    (m) => (
                      <Line
                        key={m.key}
                        type="monotone"
                        dataKey={m.key}
                        name={m.legend}
                        stroke={m.color}
                        strokeWidth={2}
                        strokeDasharray={m.strokeDasharray}
                        dot={false}
                        activeDot={{ r: 4, fill: m.color, stroke: '#fff', strokeWidth: 2 }}
                        connectNulls
                      />
                    ),
                  )}
                </ComposedChart>
              ) : (
                <ComposedChart
                  key="receita-colunas-area"
                  data={chartData}
                  margin={{ left: 4, right: 12, top: 32, bottom: 4 }}
                  barCategoryGap="18%"
                  barGap={2}
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
                    tickFormatter={formatYAxisCurrency}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={<ColunasHoverHint />}
                  />
                  {showRecebidoStack &&
                    stackSlices.map((seg, segIndex) => (
                      <Bar
                        key={seg.dataKey}
                        dataKey={seg.dataKey}
                        name={seg.departamento}
                        stackId="recebido"
                        fill={seg.color}
                        maxBarSize={56}
                        cursor="pointer"
                        onClick={handleBarClick}
                        style={
                          segIndex === stackSlices.length - 1
                            ? { cursor: 'pointer' }
                            : undefined
                        }
                      >
                        <LabelList
                          dataKey={seg.dataKey}
                          content={(props) => (
                            <StackSegmentLabel
                              {...props}
                              percentMode={false}
                              stackTotal={
                                typeof props.index === 'number'
                                  ? (chartData[props.index]?.recebidoTotal ?? undefined)
                                  : undefined
                              }
                            />
                          )}
                        />
                      </Bar>
                    ))}
                  {RECEITA_COLUNAS_METRICAS.filter((m) => visibleMetrics.has(m.key)).map(
                    (m) => (
                      <Line
                        key={m.key}
                        type="monotone"
                        dataKey={m.key}
                        name={m.legend}
                        stroke={m.color}
                        strokeWidth={2}
                        strokeDasharray={m.strokeDasharray}
                        dot={false}
                        activeDot={{ r: 4, fill: m.color, stroke: '#fff', strokeWidth: 2 }}
                        connectNulls
                      />
                    ),
                  )}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {selectedPoint && selectedMes != null && (
            <ColunasMesDetalhePanel
              point={selectedPoint}
              stackSlices={stackSlices}
              percentMode={percentMode}
              visibleMetrics={visibleMetrics}
              chartData={chartData}
              selectedMes={selectedMes}
              onSelectMes={handleSelectMes}
              onClose={() => setSelectedMes(null)}
            />
          )}
        </>
      )}
    </section>
  )
}
