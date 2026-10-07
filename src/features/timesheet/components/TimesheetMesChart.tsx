import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MESES_EFICIENCIA } from '@/features/eficiencia/constants'
import { formatTimesheetHoras } from '../utils/formatTimesheetHoras'
import type { TimesheetMes } from '../services/timesheetService'

type Props = {
  meses: TimesheetMes[]
  loading?: boolean
}

export function TimesheetMesChart({ meses, loading }: Props) {
  const data = Array.from({ length: 12 }, (_, i) => {
    const row = meses.find((m) => m.mes === i + 1)
    return {
      mes: MESES_EFICIENCIA[i] ?? String(i + 1),
      minutos: row?.minutos ?? 0,
      lancamentos: row?.lancamentos ?? 0,
    }
  })

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => formatTimesheetHoras(v).split(':')[0] ?? '0'}
          />
          <Tooltip
            cursor={{ fill: 'rgba(198, 163, 97, 0.12)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]?.payload as { mes: string; minutos: number; lancamentos: number }
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-slate-800">{item.mes}</p>
                  <p className="mt-1 tabular-nums text-slate-700">{formatTimesheetHoras(item.minutos)}</p>
                  <p className="text-slate-500">
                    {item.lancamentos.toLocaleString('pt-BR')} lançamentos
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="minutos" fill="#C6A361" radius={[4, 4, 0, 0]} maxBarSize={36}>
            <LabelList
              dataKey="minutos"
              content={({ x, y, width, value }) => {
                const minutos = Number(value)
                if (!Number.isFinite(minutos) || minutos <= 0) return null
                const cx = Number(x) + Number(width) / 2
                const cy = Number(y)
                if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
                return (
                  <text
                    x={cx}
                    y={cy - 6}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {formatTimesheetHoras(minutos)}
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
