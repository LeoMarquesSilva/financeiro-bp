import { Banknote, CalendarClock, Target, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { ReceitaMesRow } from '../types/receita.types'
import { RECEITA_COLORS } from '../constants'
import { isMesFuturo } from '../utils/receitaMes'

type Props = {
  rows: ReceitaMesRow[]
  ano: number
  loading?: boolean
}

interface KPIItemProps {
  icon: React.ElementType
  label: string
  value: string
  hint?: string
  iconColor: string
  valueColor?: string
}

function KPIItem({ icon: Icon, label, value, hint, iconColor, valueColor = 'text-slate-900' }: KPIItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p className={cn('mt-0.5 text-lg font-bold tabular-nums leading-tight', valueColor)}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

function KPISkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
      <div className="flex-1">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-5 w-24 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  )
}

export function ReceitaKpis({ rows, ano, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <KPISkeleton key={i} />
        ))}
      </div>
    )
  }

  const rowsComDados = rows.filter((r) => !isMesFuturo(ano, r.mes))
  const totalRecebido = rowsComDados.reduce((s, r) => s + r.recebido, 0)
  const totalPrevisto = rows.reduce((s, r) => s + r.previsto, 0)
  const metaAcumulada = rowsComDados.reduce((s, r) => s + r.meta, 0)
  const pctMeta = metaAcumulada > 0 ? (totalRecebido / metaAcumulada) * 100 : 0
  const mesesLabel =
    rowsComDados.length === 1 ? '1 mês' : `${rowsComDados.length} meses`

  const pctColor =
    pctMeta >= 100
      ? RECEITA_COLORS.meta.textStrong
      : pctMeta >= 80
        ? RECEITA_COLORS.meta.text
        : 'text-emerald-600'
  const pctIcon =
    pctMeta >= 100
      ? 'bg-emerald-100 text-emerald-700'
      : pctMeta >= 80
        ? RECEITA_COLORS.meta.bgIcon
        : 'bg-emerald-50/80 text-emerald-600'

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Resumo {ano}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPIItem
          icon={Banknote}
          label="Recebido"
          value={formatCurrency(totalRecebido)}
          hint={mesesLabel}
          iconColor="bg-sky-50 text-sky-600"
          valueColor={RECEITA_COLORS.recebido.textStrong}
        />
        <KPIItem
          icon={CalendarClock}
          label="Previsto"
          value={formatCurrency(totalPrevisto)}
          hint="Por vencimento"
          iconColor="bg-violet-50 text-violet-600"
          valueColor={RECEITA_COLORS.previsto.textStrong}
        />
        <KPIItem
          icon={Target}
          label="Meta acumulada"
          value={formatCurrency(metaAcumulada)}
          hint={rows[0] ? `${formatCurrency(rows[0].meta)}/mês` : undefined}
          iconColor={RECEITA_COLORS.meta.bgIcon}
          valueColor={RECEITA_COLORS.meta.textStrong}
        />
        <KPIItem
          icon={TrendingUp}
          label="Atingimento da meta"
          value={`${pctMeta.toFixed(1)}%`}
          hint={totalRecebido >= metaAcumulada ? 'Meta atingida no período' : 'Recebido ÷ meta acumulada'}
          iconColor={pctIcon}
          valueColor={pctColor}
        />
      </div>
    </section>
  )
}
