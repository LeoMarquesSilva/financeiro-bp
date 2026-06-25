import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, BarChart3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { MESES_CURTOS, OPEX_COLORS } from '../constants'
import { useOpexMesGrupos } from '../hooks/useOpexMesGrupos'
import { temFiltroMeses } from '../utils/opexPeriodo'
import type { OpexMesGrupoRow, OpexMesRow } from '../types/opex.types'

type Props = {
  rows: OpexMesRow[]
  mesAtual: number
  ano: number
  mesesFiltro: number[]
}

function formatAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function truncateLabel(label: string, max = 28): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

export function OpexPrevistoRealizadoChart({ rows, mesAtual, ano, mesesFiltro }: Props) {
  const [drillMes, setDrillMes] = useState<number | null>(null)
  const filtroAtivo = temFiltroMeses(mesesFiltro)

  useEffect(() => {
    setDrillMes(null)
  }, [ano, mesesFiltro])

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        projetado_fixas_chart: r.mes > mesAtual ? r.projetado_fixas : null,
        ativo: !filtroAtivo || mesesFiltro.includes(r.mes),
      })),
    [rows, mesAtual, mesesFiltro, filtroAtivo],
  )

  const { data: gruposMes, isLoading: loadingGrupos } = useOpexMesGrupos(ano, drillMes)

  const drillChartData = useMemo(
    () =>
      (gruposMes ?? []).slice(0, 16).map((g: OpexMesGrupoRow) => ({
        ...g,
        labelCurta: truncateLabel(g.grupo_conta),
      })),
    [gruposMes],
  )

  const drillMesLabel = drillMes != null ? MESES_CURTOS[drillMes - 1] : ''

  const handleBarClick = (_data: unknown, index: number) => {
    const mes = chartData[index]?.mes
    if (!mes) return
    setDrillMes(mes)
  }

  const handleVoltar = () => {
    setDrillMes(null)
  }

  const drillTotais = useMemo(() => {
    if (!gruposMes?.length) return { previsto: 0, realizado: 0 }
    return gruposMes.reduce(
      (acc: { previsto: number; realizado: number }, g: OpexMesGrupoRow) => ({
        previsto: acc.previsto + g.previsto,
        realizado: acc.realizado + g.realizado,
      }),
      { previsto: 0, realizado: 0 },
    )
  }, [gruposMes])

  const chartHeight = drillMes != null ? Math.max(320, drillChartData.length * 36 + 80) : 320

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
            <BarChart3 className="h-4 w-4 text-rose-700" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {drillMes != null
                ? `Detalhe de ${drillMesLabel} / ${ano}`
                : 'Previsto x realizado mensal'}
            </h2>
            <p className="text-xs text-slate-500">
              {drillMes != null
                ? 'Previsto e realizado por grupo de conta · clique em Voltar para a visão anual'
                : 'Clique no mês para detalhar por grupo · use o seletor acima para filtrar meses'}
            </p>
          </div>
        </div>
        {drillMes != null && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleVoltar}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar
          </Button>
        )}
      </div>

      {drillMes != null && !loadingGrupos && gruposMes && (
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <span>
            Previsto:{' '}
            <strong className="tabular-nums text-slate-800">{formatCurrency(drillTotais.previsto)}</strong>
          </span>
          <span>
            Realizado:{' '}
            <strong className={cn('tabular-nums', OPEX_COLORS.realizado.text)}>
              {formatCurrency(drillTotais.realizado)}
            </strong>
          </span>
          <span>
            Variação:{' '}
            <strong
              className={cn(
                'tabular-nums',
                drillTotais.realizado - drillTotais.previsto > 0 ? 'text-rose-700' : 'text-emerald-700',
              )}
            >
              {formatCurrency(drillTotais.realizado - drillTotais.previsto)}
            </strong>
          </span>
        </div>
      )}

      <div className="w-full" style={{ height: chartHeight, minHeight: 320 }}>
        {drillMes != null && loadingGrupos && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Carregando grupos…
          </div>
        )}

        {drillMes != null && !loadingGrupos && drillChartData.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Sem despesas elegíveis neste mês.
          </div>
        )}

        {drillMes != null && !loadingGrupos && drillChartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
            <BarChart
              data={drillChartData}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 8, bottom: 4 }}
              barCategoryGap="20%"
              barGap={4}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis type="number" tickFormatter={formatAxis} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="labelCurta"
                width={140}
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
                  const item = payload?.[0]?.payload as { grupo_conta?: string } | undefined
                  return item?.grupo_conta ?? ''
                }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', maxWidth: 320 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previsto" name="Previsto" fill={OPEX_COLORS.previsto.hex} radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="realizado" name="Realizado" fill={OPEX_COLORS.realizado.hex} radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {drillMes == null && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
            <ComposedChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis
                dataKey="mesLabel"
                tick={({ x, y, payload }) => {
                  const item = chartData.find((d) => d.mesLabel === payload.value)
                  const ativo = item?.ativo !== false
                  return (
                    <text x={x} y={y} dy={12} textAnchor="middle" fontSize={12} fill={ativo ? '#64748b' : '#cbd5e1'}>
                      {String(payload.value).toUpperCase()}
                    </text>
                  )
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
                  String(name),
                ]}
                labelFormatter={(label) => String(label).toUpperCase()}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="previsto"
                name="Previsto"
                fill={OPEX_COLORS.previsto.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                cursor="pointer"
                onClick={handleBarClick}
              >
                {chartData.map((entry) => (
                  <Cell key={`prev-${entry.mes}`} fillOpacity={entry.ativo ? 1 : 0.25} />
                ))}
              </Bar>
              <Bar
                dataKey="realizado"
                name="Realizado"
                fill={OPEX_COLORS.realizado.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                cursor="pointer"
                onClick={handleBarClick}
              >
                {chartData.map((entry) => (
                  <Cell key={`real-${entry.mes}`} fillOpacity={entry.ativo ? 1 : 0.25} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="projetado_fixas_chart"
                name="Projeção fixas"
                stroke={OPEX_COLORS.projetado.hex}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: OPEX_COLORS.projetado.hex }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
