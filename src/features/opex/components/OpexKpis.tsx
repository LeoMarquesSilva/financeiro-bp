import { ArrowDownRight, ArrowUpRight, CalendarRange, Target, TrendingDown, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { OPEX_COLORS } from '../constants'
import { formatPeriodoOpex, temFiltroMeses } from '../utils/opexPeriodo'
import type { OpexKpis } from '../types/opex.types'

type Props = {
  kpis: OpexKpis
  ano: number
  mesAtual: number
  mesesFiltro: number[]
  loading?: boolean
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn('mt-1 text-xl font-bold tabular-nums sm:text-2xl', accent)}>{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', OPEX_COLORS.realizado.bg)}>
          <Icon className={cn('h-4 w-4', accent)} aria-hidden />
        </span>
      </div>
    </div>
  )
}

export function OpexKpis({ kpis, ano, mesAtual, mesesFiltro, loading }: Props) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const varianciaPositiva = kpis.variancia_ytd_pct > 0
  const periodoLabel = formatPeriodoOpex(mesesFiltro, mesAtual, ano)
  const umMes = filtroAtivo && mesesFiltro.length === 1

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={filtroAtivo ? (umMes ? 'Realizado no mês' : 'Realizado no período') : 'Realizado no período'}
        value={formatCurrency(kpis.realizado_ytd)}
        sub={periodoLabel}
        icon={Wallet}
        accent={OPEX_COLORS.realizado.text}
      />
      <KpiCard
        label={filtroAtivo ? (umMes ? 'Previsto no mês' : 'Previsto no período') : 'Previsto no período'}
        value={formatCurrency(kpis.previsto_ytd)}
        sub="Compromissos por vencimento"
        icon={Target}
        accent="text-slate-800"
      />
      <KpiCard
        label={filtroAtivo ? 'Previsto no ano' : 'Projeção até dez'}
        value={formatCurrency(filtroAtivo ? kpis.previsto_ano : kpis.projetado_ano)}
        sub={filtroAtivo ? 'Compromissos anuais por vencimento' : 'Realizado + previsto futuro'}
        icon={CalendarRange}
        accent={OPEX_COLORS.projetado.text}
      />
      <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {filtroAtivo ? (umMes ? 'Variação do mês' : 'Variação do período') : 'Variação YTD'}
            </p>
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-xl font-bold tabular-nums sm:text-2xl',
                varianciaPositiva ? 'text-rose-700' : 'text-emerald-700',
              )}
            >
              {varianciaPositiva ? (
                <ArrowUpRight className="h-5 w-5" aria-hidden />
              ) : (
                <ArrowDownRight className="h-5 w-5" aria-hidden />
              )}
              {formatPercent(Math.abs(kpis.variancia_ytd_pct))}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {filtroAtivo ? 'Realizado vs previsto no período selecionado' : 'Realizado vs previsto no período'}
            </p>
          </div>
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', 'bg-slate-100')}>
            <TrendingDown className="h-4 w-4 text-slate-600" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  )
}
