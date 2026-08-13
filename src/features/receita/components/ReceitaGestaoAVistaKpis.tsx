import { AlertTriangle, Target } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { RECEITA_COLORS, RECEITA_META_INADIMPLENCIA_PCT } from '../constants'
import type { GestaoVistaResumo } from '../types/receita.types'

type Props = {
  resumo: GestaoVistaResumo | null
  areaLabel?: string | null
  loading?: boolean
  /** `row` = faixa horizontal; `column` = pilha ao lado da tabela */
  layout?: 'row' | 'column'
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

const KPI_VALUE_CLASS =
  'mt-0.5 text-xl font-bold tabular-nums leading-none tracking-tight'

const KPI_CARD_PROGRESS_CLASS = 'min-h-[148px] p-3'

type KPIProgressProps =
  | {
      mode: 'higher-is-better'
      pct: number
      barClassName?: string
    }
  | {
      mode: 'lower-is-better'
      atualPct: number
      metaPct: number
    }

type KPIItemProps = {
  icon: React.ElementType
  label: string
  value: string
  valueTitle?: string
  periodo?: string
  hint?: string
  secondaryLine?: string
  progress?: KPIProgressProps | null
  iconColor: string
  valueColor?: string
  compact?: boolean
}

function KPIProgressBar({ progress }: { progress: KPIProgressProps }) {
  if (progress.mode === 'higher-is-better') {
    const pct = Math.min(Math.max(progress.pct, 0), 100)
    return (
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
          <span className="text-slate-500">Atingimento</span>
          <span className="font-semibold tabular-nums text-slate-800">{formatPercent(pct)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              progress.barClassName ?? 'bg-sky-600',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="relative mt-1 h-3 text-[9px] text-transparent select-none" aria-hidden>
          <span className="absolute left-0">.</span>
          <span className="absolute right-0">.</span>
        </div>
      </div>
    )
  }

  const atualPct = Math.max(progress.atualPct, 0)
  const metaPct = Math.min(Math.max(progress.metaPct, 0), 100)
  const escalaMax = Math.max(100, metaPct * 2, atualPct * 1.05)
  const atualPos = Math.min((atualPct / escalaMax) * 100, 100)
  const metaPos = Math.min((metaPct / escalaMax) * 100, 100)
  const dentroMeta = atualPct <= metaPct + 0.01
  const gapPp = atualPct - metaPct

  return (
    <div className="mt-2.5">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="text-slate-500">Inad. / previsto</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            dentroMeta ? 'text-emerald-700' : 'text-red-700',
          )}
        >
          {formatPercent(atualPct)}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-100"
          style={{ width: `${metaPos}%` }}
          aria-hidden
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width]',
            dentroMeta ? 'bg-emerald-600' : 'bg-red-600',
          )}
          style={{ width: `${atualPos}%` }}
        />
        <div
          className="absolute top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-slate-700"
          style={{ left: `${metaPos}%` }}
          title={`Meta ${formatPercent(metaPct)}`}
          aria-hidden
        />
      </div>
      <div className="relative mt-1 h-3 text-[9px] text-slate-400">
        <span className="absolute left-0">0%</span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-slate-600"
          style={{ left: `${metaPos}%` }}
        >
          Meta {formatPercent(metaPct)}
        </span>
        <span className="absolute right-0">
          {dentroMeta ? 'dentro da meta' : gapPp > 0 ? 'acima da meta' : 'abaixo da meta'}
        </span>
      </div>
    </div>
  )
}

function KPIItem({
  icon: Icon,
  label,
  value,
  valueTitle,
  periodo,
  hint,
  secondaryLine,
  progress,
  iconColor,
  valueColor = 'text-slate-900',
  compact = false,
}: KPIItemProps) {
  const withProgress = progress != null

  return (
    <div
      className={cn(
        'relative w-full rounded-xl border border-slate-200/60 bg-white text-left shadow-sm',
        withProgress ? KPI_CARD_PROGRESS_CLASS : compact ? 'p-3' : 'p-3 sm:p-4',
      )}
    >
      <div
        className={cn(
          'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg',
          iconColor,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 pr-9">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p
          className={cn(KPI_VALUE_CLASS, valueColor)}
          title={valueTitle ?? value}
        >
          {value}
        </p>
        {secondaryLine != null && secondaryLine !== '' ? (
          <p className="mt-1 text-[10px] leading-snug text-slate-500">{secondaryLine}</p>
        ) : (
          <>
            {periodo != null && periodo !== '' && (
              <p className="mt-0.5 text-[10px] font-medium text-slate-600">{periodo}</p>
            )}
            {hint != null && hint !== '' && (
              <p className="mt-1 text-[10px] leading-snug text-slate-500">{hint}</p>
            )}
          </>
        )}
        {withProgress ? <KPIProgressBar progress={progress} /> : null}
      </div>
    </div>
  )
}

export function ReceitaGestaoAVistaKpis({
  resumo,
  areaLabel,
  loading,
  layout = 'row',
}: Props) {
  const gridClassName =
    layout === 'column'
      ? 'flex flex-col gap-3'
      : 'grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2'

  if (loading || !resumo) {
    return (
      <div className={gridClassName}>
        {[1, 2].map((i) => (
          <KPISkeleton key={i} />
        ))}
      </div>
    )
  }

  const pctMeta = resumo.pctMeta ?? 0

  const gapMeta = resumo.metaAcumulada - resumo.recebidoAtingimento
  const metaSecondaryLine =
    gapMeta > 0.01
      ? `Meta ${formatCurrency(resumo.metaAcumulada)} · faltam ${formatCurrency(gapMeta)}`
      : gapMeta < -0.01
        ? `Meta ${formatCurrency(resumo.metaAcumulada)} · ${formatCurrency(-gapMeta)} acima`
        : `Meta ${formatCurrency(resumo.metaAcumulada)} · atingida`

  const metaProgressBarClassName =
    pctMeta >= 100
      ? 'bg-emerald-600'
      : pctMeta >= 80
        ? 'bg-amber-500'
        : 'bg-sky-600'

  const pctInad = resumo.inadimplenciaVencidoPctAno ?? 0
  const gapInadPp = pctInad - RECEITA_META_INADIMPLENCIA_PCT
  const inadSecondaryLine =
    gapInadPp > 0.01
      ? `Meta ${formatPercent(RECEITA_META_INADIMPLENCIA_PCT)} · ${formatPercent(gapInadPp)} acima da meta`
      : gapInadPp < -0.01
        ? `Meta ${formatPercent(RECEITA_META_INADIMPLENCIA_PCT)} · ${formatPercent(-gapInadPp)} abaixo da meta`
        : `Meta ${formatPercent(RECEITA_META_INADIMPLENCIA_PCT)} · na meta`
  const inadValueColor =
    pctInad <= RECEITA_META_INADIMPLENCIA_PCT
      ? 'text-emerald-700'
      : pctInad <= RECEITA_META_INADIMPLENCIA_PCT * 1.5
        ? 'text-amber-600'
        : RECEITA_COLORS.inadimplencia.textStrong

  return (
    <div className={gridClassName}>
      <KPIItem
        icon={Target}
        label={`Meta · ${resumo.periodoMetaAnualLabel}${areaLabel ? ` (${areaLabel})` : ''}`}
        value={formatCurrency(resumo.recebidoAtingimento)}
        valueTitle={`${formatCurrency(resumo.recebidoAtingimento)} recebido · meta ${formatCurrency(resumo.metaAcumulada)}`}
        secondaryLine={metaSecondaryLine}
        progress={{
          mode: 'higher-is-better',
          pct: resumo.pctMeta ?? 0,
          barClassName: metaProgressBarClassName,
        }}
        iconColor={RECEITA_COLORS.meta.bgIcon}
        valueColor="text-slate-900"
        compact
      />
      <KPIItem
        icon={AlertTriangle}
        label={`Inad. vencida · ${resumo.periodoAnualLabel}${areaLabel ? ` (${areaLabel})` : ''}`}
        value={formatCurrency(resumo.inadimplenciaVencidoAno)}
        valueTitle={`${formatCurrency(resumo.inadimplenciaVencidoAno)} · ${formatPercent(pctInad)} do previsto (${resumo.periodoAnoLabel})`}
        secondaryLine={inadSecondaryLine}
        progress={{
          mode: 'lower-is-better',
          atualPct: pctInad,
          metaPct: RECEITA_META_INADIMPLENCIA_PCT,
        }}
        iconColor="bg-red-50 text-red-700"
        valueColor={inadValueColor}
        compact
      />
    </div>
  )
}
