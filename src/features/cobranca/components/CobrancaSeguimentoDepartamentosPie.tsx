import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { RECEITA_DEPARTAMENTO_CORES } from '@/features/receita/constants'
import { useReceitaDepartamentoCores } from '@/features/receita/hooks/useReceitaDepartamentoCores'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import type { CobrancaSeguimentoGrupo } from '../types/cobrancaSeguimento.types'
import { calcularSlicesPorDepartamento } from '../utils/cobrancaSeguimentoKpis'

type Props = {
  grupos: CobrancaSeguimentoGrupo[]
  loading?: boolean
}

type TooltipPayload = {
  name?: string
  value?: number
  payload?: { pct?: number; color?: string }
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const valor = typeof item.value === 'number' ? item.value : 0
  const pct = item.payload?.pct ?? 0
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-slate-800">{item.name}</p>
      <p className="text-slate-600">{formatCurrency(valor)}</p>
      <p className="text-slate-500">{formatPercent(pct)}</p>
    </div>
  )
}

export function CobrancaSeguimentoDepartamentosPie({ grupos, loading }: Props) {
  const { cores } = useReceitaDepartamentoCores()
  const departamentoCores = cores ?? RECEITA_DEPARTAMENTO_CORES

  const slices = useMemo(
    () => calcularSlicesPorDepartamento(grupos, departamentoCores),
    [grupos, departamentoCores],
  )

  const chartData = useMemo(
    () =>
      slices.map((s) => ({
        name: s.departamento,
        value: s.valor,
        pct: s.pct,
        color: s.color,
      })),
    [slices],
  )

  return (
    <Card className="cobranca-kpi-card flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Por departamento
        </span>
        <PieChartIcon className="h-4 w-4 text-slate-500" />
      </div>

      {loading ? (
        <div className="mt-3 flex h-[72px] items-center justify-center text-sm text-slate-400">…</div>
      ) : slices.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Sem alocação por departamento</p>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <div className="h-[72px] w-[72px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={16}
                  outerRadius={32}
                  paddingAngle={1}
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="min-w-0 flex-1 space-y-1">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5 text-[11px] leading-tight">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="truncate text-slate-600">{s.departamento}</span>
                <span className="ml-auto shrink-0 font-medium text-slate-800">
                  {formatPercent(s.pct)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
