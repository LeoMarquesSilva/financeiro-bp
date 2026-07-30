import { Banknote, CalendarClock, Clock, Target, TrendingUp } from 'lucide-react'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { RECEITA_COLORS } from '../constants'
import type { GestaoVistaResumo } from '../types/receita.types'

type Props = {
  resumo: GestaoVistaResumo | null
  areaLabel?: string | null
  loading?: boolean
}

function KPISkeleton() {
  return (
    <div className="relative rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <div className="absolute right-3 top-3 h-8 w-8 animate-pulse rounded-lg bg-slate-100 sm:right-4 sm:top-4 sm:h-9 sm:w-9" />
      <div className="min-w-0 pr-10 sm:pr-11">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-5 w-24 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  )
}

type KPIItemProps = {
  icon: React.ElementType
  label: string
  value: string
  valueTitle?: string
  periodo?: string
  hint?: string
  iconColor: string
  valueColor?: string
}

function KPIItem({
  icon: Icon,
  label,
  value,
  valueTitle,
  periodo,
  hint,
  iconColor,
  valueColor = 'text-slate-900',
}: KPIItemProps) {
  return (
    <div className="relative w-full rounded-xl border border-slate-200/60 bg-white p-3 text-left shadow-sm sm:p-4">
      <div
        className={cn(
          'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg sm:right-4 sm:top-4 sm:h-9 sm:w-9',
          iconColor,
        )}
      >
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
      </div>
      <div className="min-w-0 pr-10 sm:pr-11">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">
          {label}
        </p>
        <p
          className={cn(
            'mt-1 text-sm font-bold tabular-nums leading-tight sm:text-base',
            valueColor,
          )}
          title={valueTitle ?? value}
        >
          {value}
        </p>
        {periodo != null && periodo !== '' && (
          <p className="mt-0.5 text-[10px] font-medium text-slate-600 sm:text-[11px]">{periodo}</p>
        )}
        {hint != null && hint !== '' && (
          <p className="mt-1 text-[10px] leading-snug text-slate-500 sm:text-[11px]">{hint}</p>
        )}
      </div>
    </div>
  )
}

export function ReceitaGestaoAVistaKpis({ resumo, areaLabel, loading }: Props) {
  if (loading || !resumo) {
    return (
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <KPISkeleton key={i} />
        ))}
      </div>
    )
  }

  const pctMeta = resumo.pctMeta ?? 0
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

  const escopo = areaLabel ? `${areaLabel} · ` : ''

  return (
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KPIItem
        icon={Target}
        label="Meta acumulada"
        value={formatCurrencyCompact(resumo.metaAcumulada)}
        valueTitle={formatCurrency(resumo.metaAcumulada)}
        periodo={resumo.periodoLabel}
        hint={`${escopo}Meta do período`}
        iconColor={RECEITA_COLORS.meta.bgIcon}
        valueColor={RECEITA_COLORS.meta.textStrong}
      />
      <KPIItem
        icon={CalendarClock}
        label="Previsto acumulado"
        value={formatCurrency(resumo.previstoAcumulado)}
        periodo={resumo.periodoLabel}
        hint="Por vencimento no período"
        iconColor="bg-violet-50 text-violet-600"
        valueColor={RECEITA_COLORS.previsto.textStrong}
      />
      <KPIItem
        icon={Banknote}
        label="Recebido acumulado"
        value={formatCurrency(resumo.recebidoAcumulado)}
        periodo={resumo.periodoLabel}
        hint="Caixa líquido no período"
        iconColor="bg-sky-50 text-sky-600"
        valueColor={RECEITA_COLORS.recebido.textStrong}
      />
      <KPIItem
        icon={TrendingUp}
        label="Atingimento meta"
        value={formatPercent(pctMeta)}
        valueTitle={`${formatPercent(pctMeta)} · ${formatCurrency(resumo.recebidoAcumulado)} de ${formatCurrency(resumo.metaAcumulada)}`}
        periodo={resumo.periodoLabel}
        hint="Recebido ÷ meta acumulada"
        iconColor={pctIcon}
        valueColor={pctColor}
      />
      <KPIItem
        icon={Clock}
        label="Inad. acumulada"
        value={formatCurrency(resumo.inadimplenciaPeriodo)}
        periodo={resumo.periodoLabel}
        hint={
          resumo.inadimplenciaPctPeriodo != null
            ? `${formatPercent(resumo.inadimplenciaPctPeriodo)} do previsto · saldo período`
            : 'Saldo líquido do período (KPI inad.)'
        }
        iconColor="bg-red-50 text-red-700"
        valueColor={RECEITA_COLORS.inadimplencia.textStrong}
      />
    </div>
  )
}
