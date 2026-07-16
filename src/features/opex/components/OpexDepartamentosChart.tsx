import { useMemo } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { OPEX_COLORS } from '../constants'
import { formatPeriodoOpex, temFiltroMeses } from '../utils/opexPeriodo'
import { departamentoLabel } from '../utils/departamentoLabel'
import { useOpexDepartamentos } from '../hooks/useOpexDepartamentos'
import type { OpexDepartamentoRow } from '../types/opex.types'

type Props = {
  ano: number
  mesesFiltro: number[]
  somenteFixas: boolean
}

type ChartRow = OpexDepartamentoRow & {
  label: string
  labelCurta: string
  pctRealizado: number | null
}

function formatAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function truncateLabel(label: string, max = 24): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

function buildChartRows(data: OpexDepartamentoRow[]): ChartRow[] {
  return data.map((row) => ({
    ...row,
    label: departamentoLabel(row.departamento),
    labelCurta: truncateLabel(departamentoLabel(row.departamento)),
    pctRealizado: row.previsto > 0 ? (row.realizado / row.previsto) * 100 : null,
  }))
}

export function OpexDepartamentosChart({ ano, mesesFiltro, somenteFixas }: Props) {
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const { data, isLoading, isFetching, error } = useOpexDepartamentos(ano, mesesFiltro, somenteFixas)

  const chartData = useMemo(() => buildChartRows(data ?? []), [data])

  const totais = useMemo(
    () =>
      chartData.reduce(
        (acc, row) => ({
          previsto: acc.previsto + row.previsto,
          realizado: acc.realizado + row.realizado,
        }),
        { previsto: 0, realizado: 0 },
      ),
    [chartData],
  )

  const chartHeight = Math.max(280, chartData.length * 40 + 88)
  const periodoLabel = filtroAtivo ? formatPeriodoOpex(mesesFiltro, 0, ano) : `YTD ${ano}`

  return (
    <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
            <Building2 className="h-4 w-4 text-slate-600" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Custos por área / departamento</h3>
            <p className="text-xs text-slate-500">
              {periodoLabel}
              {somenteFixas ? ' · somente despesas fixas' : ''}
              {filtroAtivo ? ' · previsto e realizado no período' : ' · realizado YTD vs previsto ano'}
            </p>
          </div>
        </div>
        {!isLoading && chartData.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span>
              Previsto:{' '}
              <strong className={cn('tabular-nums', OPEX_COLORS.previsto.text)}>
                {formatCurrency(totais.previsto)}
              </strong>
            </span>
            <span>
              Realizado:{' '}
              <strong className={cn('tabular-nums', OPEX_COLORS.realizado.text)}>
                {formatCurrency(totais.realizado)}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className="w-full min-h-[280px]" style={{ height: chartHeight }}>
        {(isLoading || isFetching) && chartData.length === 0 && (
          <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Carregando departamentos…
          </div>
        )}

        {error && (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-1 px-4 text-center">
            <p className="text-sm font-medium text-red-600">Erro ao carregar custos por departamento.</p>
            <p className="text-xs text-red-500/90">{error.message}</p>
          </div>
        )}

        {!isLoading && !error && chartData.length === 0 && (
          <p className="flex h-full min-h-[280px] items-center justify-center text-sm text-slate-500">
            Sem despesas por departamento no escopo selecionado.
          </p>
        )}

        {!error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 20, top: 8, bottom: 8 }}
              barCategoryGap="20%"
              barGap={4}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis
                type="number"
                tickFormatter={formatAxis}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="labelCurta"
                width={136}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
                  String(name),
                ]}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload as ChartRow | undefined
                  const pct =
                    item?.pctRealizado != null ? ` · ${formatPercent(item.pctRealizado)} do previsto` : ''
                  return `${item?.label ?? ''}${pct}`
                }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', maxWidth: 320 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar
                dataKey="previsto"
                name={filtroAtivo ? 'Previsto período' : 'Previsto ano'}
                fill={OPEX_COLORS.previsto.hex}
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
              />
              <Bar
                dataKey="realizado"
                name={filtroAtivo ? 'Realizado período' : 'Realizado YTD'}
                fill={OPEX_COLORS.realizado.hex}
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
