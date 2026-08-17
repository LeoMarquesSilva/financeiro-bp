import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/shared/utils/format'
import { toPriMaiuscula } from '../utils/textFormat'

type Props = {
  title: string
  value: string
  hint?: string
  meta?: string
  atingiuMeta?: boolean | null
  icon: LucideIcon
  accentClass?: string
  loading?: boolean
  /** Com filtro de pessoa: card da equipe (Gestão à Vista) não muda. */
  scopeEquipe?: boolean
  /** Com filtro de pessoa: este KPI é o recorte individual. */
  pessoaNome?: string | null
  /** % da pessoa (para a seta vs equipe). */
  currentPct?: number | null
  /** % da equipe no card Gestão à Vista. */
  vsEquipePct?: number | null
}

function formatPp(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} p.p.`
}

export function EficienciaKpiCard({
  title,
  value,
  hint,
  meta,
  atingiuMeta,
  icon: Icon,
  accentClass = 'bg-slate-100 text-slate-700',
  loading,
  scopeEquipe = false,
  pessoaNome = null,
  currentPct = null,
  vsEquipePct = null,
}: Props) {
  const temPessoa = Boolean(pessoaNome?.trim())
  const delta =
    temPessoa &&
    currentPct != null &&
    vsEquipePct != null &&
    Number.isFinite(currentPct) &&
    Number.isFinite(vsEquipePct)
      ? currentPct - vsEquipePct
      : null
  const direcao =
    delta == null ? null : delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : 'flat'

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="truncate text-xs font-medium text-slate-500">
          {toPriMaiuscula(title)}
        </h3>
      </div>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded bg-slate-200/60" />
      ) : (
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      )}

      {temPessoa && !loading && scopeEquipe && (
        <Badge
          variant="secondary"
          className="mt-1.5 h-5 w-fit px-2 py-0 text-[10px] font-medium text-slate-500"
        >
          Equipe · filtro de pessoa não altera
        </Badge>
      )}

      {temPessoa && !loading && !scopeEquipe && (
        <div className="mt-1.5 flex flex-col gap-1">
          <Badge
            variant="secondary"
            className="h-5 w-fit max-w-full truncate px-2 py-0 text-[10px] font-medium text-slate-600"
            title={pessoaNome ?? undefined}
          >
            Filtrado por {pessoaNome}
          </Badge>
          {direcao && delta != null && vsEquipePct != null && (
            <p
              className={cn(
                'inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
                direcao === 'up' && 'text-emerald-600',
                direcao === 'down' && 'text-rose-600',
                direcao === 'flat' && 'text-slate-500',
              )}
            >
              {direcao === 'up' && <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              {direcao === 'down' && <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              {direcao === 'flat' && <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              {direcao === 'flat'
                ? `Igual à equipe (${formatPercent(vsEquipePct)})`
                : `${direcao === 'up' ? '+' : '−'}${formatPp(Math.abs(delta))} vs equipe (${formatPercent(vsEquipePct)})`}
            </p>
          )}
        </div>
      )}

      {(hint || meta) && !loading && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {hint && <span className="text-slate-400">{hint}</span>}
          {meta && (
            <span
              className={cn(
                'font-medium',
                atingiuMeta == null
                  ? 'text-slate-400'
                  : atingiuMeta
                    ? 'text-emerald-600'
                    : 'text-amber-600',
              )}
            >
              meta: {meta}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
