import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type {
  ReceitaPrevistoFechamentoMes,
  ReceitaPrevistoFechamentoBucket,
} from '../types/receita.types'
import {
  FECHAMENTO_BUCKET_HINTS,
  FECHAMENTO_BUCKET_LABELS,
  type FechamentoDrillKey,
} from '../utils/receitaPrevistoFechamento'

function FechamentoRow({
  label,
  valor,
  hint,
  valorClassName,
  prefix = '+',
  onClick,
}: {
  label: string
  valor: number
  hint?: string
  valorClassName?: string
  prefix?: '+' | '−' | '='
  onClick?: () => void
}) {
  if (Math.abs(valor) < 0.01 && prefix !== '=') return null

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">
          {prefix !== '=' ? (
            <span className="mr-1.5 inline-block w-3 shrink-0 font-medium text-slate-400">
              {prefix}
            </span>
          ) : null}
          {label}
        </p>
        {hint ? <p className="mt-0.5 pl-4 text-[10px] leading-snug text-slate-500">{hint}</p> : null}
      </div>
      <span className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            valorClassName ?? 'text-slate-800',
          )}
        >
          {formatCurrency(valor)}
        </span>
        {onClick ? (
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600" aria-hidden />
        ) : null}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-start justify-between gap-3 rounded-lg py-1.5 text-left transition-colors hover:bg-slate-100/80"
      >
        {content}
      </button>
    )
  }

  return <div className="flex items-start justify-between gap-3 py-1.5">{content}</div>
}

type Props = {
  fechamento: ReceitaPrevistoFechamentoMes
  onDrillDown?: (key: FechamentoDrillKey) => void
}

/** Fechamento item a item do previsto — visão contábil / auditoria. */
export function ReceitaPrevistoFechamentoContabilPanel({ fechamento, onDrillDown }: Props) {
  const somaPrevistoDecomp =
    fechamento.quitado_no_mes +
    fechamento.quitado_antecipado +
    fechamento.quitado_pago_depois +
    fechamento.em_aberto

  const previstoFecha = Math.abs(somaPrevistoDecomp - fechamento.previsto) < 0.02

  const drill = (bucket: ReceitaPrevistoFechamentoBucket) =>
    onDrillDown ? () => onDrillDown(bucket) : undefined

  return (
    <div className="space-y-3 pt-1">
      <p className="text-[11px] leading-snug text-slate-500">
        Vencimentos do mês em valor item. Clique nas linhas para validar título a título.
      </p>
      <div className="divide-y divide-slate-100">
        <FechamentoRow
          label={FECHAMENTO_BUCKET_LABELS.quitado_no_mes}
          valor={fechamento.quitado_no_mes}
          hint={FECHAMENTO_BUCKET_HINTS.quitado_no_mes}
          prefix="+"
          onClick={drill('quitado_no_mes')}
        />
        <FechamentoRow
          label={FECHAMENTO_BUCKET_LABELS.quitado_antecipado}
          valor={fechamento.quitado_antecipado}
          hint={FECHAMENTO_BUCKET_HINTS.quitado_antecipado}
          prefix="+"
          onClick={drill('quitado_antecipado')}
        />
        <FechamentoRow
          label={FECHAMENTO_BUCKET_LABELS.quitado_pago_depois}
          valor={fechamento.quitado_pago_depois}
          hint={FECHAMENTO_BUCKET_HINTS.quitado_pago_depois}
          prefix="+"
          onClick={drill('quitado_pago_depois')}
        />
        <FechamentoRow
          label={FECHAMENTO_BUCKET_LABELS.em_aberto}
          valor={fechamento.em_aberto}
          hint={FECHAMENTO_BUCKET_HINTS.em_aberto}
          prefix="+"
          onClick={drill('em_aberto')}
        />
      </div>
      <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs font-semibold text-slate-800">
        <span className="flex items-center gap-1.5">
          = Previsto
          {previstoFecha ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
              fecha
            </span>
          ) : null}
        </span>
        <span className="tabular-nums">{formatCurrency(fechamento.previsto)}</span>
      </div>
      <p className="text-[10px] leading-snug text-slate-500">
        Previsto usa base de vencimento (valor item); recebido usa caixa (pagamentos do mês).
        Caixa ligado ao previsto:{' '}
        <span className="font-medium tabular-nums text-slate-700">
          {formatCurrency(fechamento.recebido_previsto_caixa)}
        </span>
        {' · '}
        quitado no mês:{' '}
        <span className="font-medium tabular-nums text-slate-700">
          {formatCurrency(fechamento.quitado_no_mes)}
        </span>
      </p>
    </div>
  )
}
