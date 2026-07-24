import { useMemo } from 'react'
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import { MESES_CURTOS, OPEX_COLORS } from '../constants'
import type { OpexOrcamentoLinha } from '../types/opex.types'

type MesTotal = {
  mes: number
  label: string
  total: number
}

type Props = {
  linhas: OpexOrcamentoLinha[]
  mesSelecionado: number | null
  onMesSelect: (mes: number | null) => void
  compact?: boolean
  className?: string
}

function formatAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function OrcamentoMesDot({
  cx,
  cy,
  payload,
  mesSelecionado,
  onMesSelect,
}: DotItemDotProps & {
  mesSelecionado: number | null
  onMesSelect: (mes: number | null) => void
}) {
  if (cx == null || cy == null || !payload || typeof payload.mes !== 'number') return null

  const mes = payload.mes
  const selecionado = mesSelecionado === mes
  const esmaecido = mesSelecionado != null && !selecionado

  return (
    <circle
      cx={cx}
      cy={cy}
      r={selecionado ? 6 : 4}
      fill={selecionado ? OPEX_COLORS.orcamento.hex : '#a78bfa'}
      stroke="#fff"
      strokeWidth={2}
      opacity={esmaecido ? 0.35 : 1}
      style={{ cursor: 'pointer' }}
      onClick={(event) => {
        event.stopPropagation()
        onMesSelect(selecionado ? null : mes)
      }}
    />
  )
}

export function buildTotaisPorMes(linhas: OpexOrcamentoLinha[]): MesTotal[] {
  const totals = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    label: MESES_CURTOS[i],
    total: 0,
  }))
  for (const l of linhas) {
    if (l.mes >= 1 && l.mes <= 12) totals[l.mes - 1].total += l.valor
  }
  return totals
}

export function OpexOrcamentoMesChart({
  linhas,
  mesSelecionado,
  onMesSelect,
  compact = false,
  className,
}: Props) {
  const chartData = useMemo(() => buildTotaisPorMes(linhas), [linhas])
  const maxTotal = useMemo(() => Math.max(...chartData.map((d) => d.total), 0), [chartData])
  const chartHeight = compact ? 132 : 220

  if (!maxTotal) {
    return (
      <p className={cn('text-xs text-slate-500', compact ? 'py-2' : 'py-6 text-center text-sm', className)}>
        Sem valores no escopo selecionado.
      </p>
    )
  }

  return (
    <div
      className={cn('w-full min-w-0', className)}
      role="group"
      aria-label="Distribuição mensal do orçamento"
    >
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart
          data={chartData}
          margin={{
            top: compact ? 12 : 24,
            right: 8,
            left: compact ? 0 : 4,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: compact ? 9 : 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval={0}
          />
          <YAxis
            tickFormatter={formatAxis}
            width={compact ? 52 : 64}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            domain={[0, (max: number) => Math.max(max * 1.12, maxTotal * 0.05 || 1)]}
            padding={{ top: compact ? 8 : 12 }}
          />
          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as MesTotal
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold uppercase text-slate-700">{row.label}</p>
                  <p className="mt-1 tabular-nums text-slate-900">{formatCurrency(row.total)}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Clique no ponto para filtrar a tabela</p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke={OPEX_COLORS.orcamento.hex}
            strokeWidth={2}
            dot={(props) => (
              <OrcamentoMesDot
                {...props}
                mesSelecionado={mesSelecionado}
                onMesSelect={onMesSelect}
              />
            )}
            activeDot={false}
            opacity={mesSelecionado != null ? 0.45 : 1}
          />
          {!compact && (
            <LabelList
              dataKey="total"
              position="top"
              formatter={(value) => {
                const n = Number(value)
                return n > 0 ? formatCurrencyCompact(n) : ''
              }}
              fill="#64748b"
              fontSize={10}
              offset={8}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
