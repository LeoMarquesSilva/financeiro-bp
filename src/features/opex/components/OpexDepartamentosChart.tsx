import { useMemo, useState, useEffect } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { RECEITA_DEPARTAMENTO_CORES } from '@/features/receita/constants'
import { useReceitaDepartamentoCores } from '@/features/receita/hooks/useReceitaDepartamentoCores'
import { OPEX_COLORS } from '../constants'
import { formatPeriodoOpex, temFiltroMeses } from '../utils/opexPeriodo'
import { useOpexDepartamentosMensal } from '../hooks/useOpexDepartamentos'
import {
  buildOpexAreaSlices,
  buildOpexDepartamentosChartData,
  type OpexAreaSlice,
} from '../utils/opexDepartamentosChart'
import { OpexDepartamentoDetalhe } from './OpexDepartamentoDetalhe'

type Props = {
  ano: number
  mesesFiltro: number[]
  somenteFixas: boolean
  mesAtual?: number
}

type Metric = 'realizado' | 'previsto'

function formatAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function mesesVisiveisChart(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1)
}

function tooltipTotal(
  payload: unknown,
  slices: OpexAreaSlice[],
): number {
  if (!Array.isArray(payload)) return 0
  const keys = new Set(slices.map((s) => s.dataKey))
  return payload.reduce((sum: number, item) => {
    const row = item as { dataKey?: string; value?: number | string }
    if (!row.dataKey || !keys.has(String(row.dataKey))) return sum
    return sum + (typeof row.value === 'number' ? row.value : Number(row.value) || 0)
  }, 0)
}

export function OpexDepartamentosChart({ ano, mesesFiltro, somenteFixas, mesAtual = 0 }: Props) {
  const [metric, setMetric] = useState<Metric>('realizado')
  const [selectedSlice, setSelectedSlice] = useState<OpexAreaSlice | null>(null)
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const { cores } = useReceitaDepartamentoCores()
  const departamentoCores = cores ?? RECEITA_DEPARTAMENTO_CORES

  const { data, isLoading, error } = useOpexDepartamentosMensal(ano, mesesFiltro, somenteFixas)

  const mesesChart = useMemo(() => mesesVisiveisChart(), [])

  const areaSlices = useMemo(
    () => buildOpexAreaSlices(data ?? [], mesesChart, metric, departamentoCores),
    [data, mesesChart, metric, departamentoCores],
  )

  const chartData = useMemo(() => {
    const points = buildOpexDepartamentosChartData(
      ano,
      data ?? [],
      areaSlices,
      metric,
      mesesChart,
      mesAtual,
    )
    if (!filtroAtivo) return points
    const ativos = new Set(mesesFiltro)
    return points.map((p) => ({ ...p, ativo: ativos.has(p.mes) }))
  }, [ano, data, areaSlices, metric, mesesChart, mesAtual, filtroAtivo, mesesFiltro])

  const totalMetric = useMemo(
    () => chartData.reduce((sum, row) => sum + (typeof row.total === 'number' ? row.total : 0), 0),
    [chartData],
  )

  const periodoLabel = filtroAtivo ? formatPeriodoOpex(mesesFiltro, mesAtual, ano) : `Ano ${ano}`

  const toggleSlice = (slice: OpexAreaSlice) => {
    setSelectedSlice((prev) => (prev?.dataKey === slice.dataKey ? null : slice))
  }

  useEffect(() => {
    if (selectedSlice && !areaSlices.some((s) => s.dataKey === selectedSlice.dataKey)) {
      setSelectedSlice(null)
    }
  }, [areaSlices, selectedSlice])

  return (
    <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-4 py-5 sm:px-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
            <Building2 className="h-4 w-4 text-slate-600" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Custos por área / departamento</h3>
            <p className="text-xs text-slate-500">
              {periodoLabel}
              {somenteFixas ? ' · somente despesas fixas' : ''}
              {' · barras empilhadas por mês · inclui investimentos por área'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {(['realizado', 'previsto'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  metric === m
                    ? m === 'realizado'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {m === 'realizado' ? 'Realizado' : 'Previsto'}
              </button>
            ))}
          </div>
          {!isLoading && areaSlices.length > 0 && (
            <span className="text-xs text-slate-600">
              Total:{' '}
              <strong
                className={cn(
                  'tabular-nums',
                  metric === 'realizado' ? OPEX_COLORS.realizado.text : OPEX_COLORS.previsto.text,
                )}
              >
                {formatCurrency(totalMetric)}
              </strong>
            </span>
          )}
        </div>
      </div>

      <div className="min-h-[320px] w-full min-w-0" style={{ height: 320 }}>
        {isLoading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Carregando departamentos…
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
            <p className="text-sm font-medium text-red-600">Erro ao carregar custos por departamento.</p>
            <p className="text-xs text-red-500/90">{error.message}</p>
          </div>
        )}

        {!isLoading && !error && areaSlices.length === 0 && (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">
            Sem despesas por departamento no escopo selecionado.
          </p>
        )}

        {!isLoading && !error && areaSlices.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
            <BarChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 8 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis
                dataKey="mesLabel"
                tick={({ x, y, payload }) => {
                  const item = chartData.find((d) => d.mesLabel === payload.value)
                  const ativo = item?.ativo !== false
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={12}
                      textAnchor="middle"
                      fontSize={12}
                      fill={ativo ? '#64748b' : '#cbd5e1'}
                    >
                      {String(payload.value).toUpperCase()}
                    </text>
                  )
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxis}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip
                shared
                formatter={(value, name) => [
                  formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
                  String(name),
                ]}
                labelFormatter={(label, payload) => {
                  const total = tooltipTotal(payload, areaSlices)
                  return `${String(label).toUpperCase()} · ${formatCurrency(total)}`
                }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', maxWidth: 320 }}
              />
              {areaSlices.map((slice) => (
                <Bar
                  key={slice.dataKey}
                  dataKey={slice.dataKey}
                  name={slice.label}
                  stackId="opex-area"
                  fill={slice.color}
                  maxBarSize={48}
                  fillOpacity={selectedSlice && selectedSlice.dataKey !== slice.dataKey ? 0.25 : 1}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`${slice.dataKey}-${entry.mes}`}
                      fill={slice.color}
                      fillOpacity={
                        entry.ativo === false
                          ? 0.28
                          : selectedSlice && selectedSlice.dataKey !== slice.dataKey
                            ? 0.25
                            : 1
                      }
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {!isLoading && !error && areaSlices.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Áreas · clique para detalhar
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {areaSlices.map((slice) => {
              const selected = selectedSlice?.dataKey === slice.dataKey
              return (
                <button
                  key={slice.dataKey}
                  type="button"
                  onClick={() => toggleSlice(slice)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    selected
                      ? 'border-slate-300 bg-slate-900 text-white shadow-sm'
                      : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200/80',
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden
                  />
                  {slice.label}
                </button>
              )
            })}
          </div>

          {selectedSlice && (
            <OpexDepartamentoDetalhe
              ano={ano}
              departamento={selectedSlice.departamento}
              label={selectedSlice.label}
              color={selectedSlice.color}
              metric={metric}
              mesesFiltro={mesesFiltro}
              somenteFixas={somenteFixas}
              mensalRows={data ?? []}
            />
          )}
        </div>
      )}
    </div>
  )
}
