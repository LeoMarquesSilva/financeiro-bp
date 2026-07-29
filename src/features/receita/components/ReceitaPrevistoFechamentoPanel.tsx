import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { ReceitaPrevistoFechamentoMes } from '../types/receita.types'

function FechamentoRow({
  label,
  valor,
  hint,
  valorClassName,
  prefix = '+',
}: {
  label: string
  valor: number
  hint?: string
  valorClassName?: string
  prefix?: '+' | '−' | '='
}) {
  if (Math.abs(valor) < 0.01 && prefix !== '=') return null
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
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
      <span
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          valorClassName ?? 'text-slate-800',
        )}
      >
        {formatCurrency(valor)}
      </span>
    </div>
  )
}

type Props = {
  fechamento: ReceitaPrevistoFechamentoMes
}

export function ReceitaPrevistoFechamentoPanel({ fechamento }: Props) {
  return (
    <div className="mb-4">
      <section className="rounded-xl border border-sky-200/70 bg-sky-50/40 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
          Composição do caixa recebido
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-sky-800/80">
          Pagamentos registrados neste mês, por natureza (caixa líquido recebido).
        </p>
        <div className="mt-3 divide-y divide-sky-100/80">
          <FechamentoRow
            label="Inadimplência (recuperada)"
            valor={fechamento.inad_recebida}
            hint="Atrasos de meses anteriores pagos neste mês — extra ao previsto do mês"
            valorClassName="text-red-700"
          />
          <FechamentoRow
            label="Novos contratos"
            valor={fechamento.novos_total}
            hint="1º recebimento na cota (já compõe o previsto se venceu neste mês)"
            valorClassName="text-violet-700"
          />
          <FechamentoRow
            label="Receita do mês"
            valor={fechamento.receita_mes_caixa}
            hint="Vencimento neste mês, caixa neste mês (exceto 1º pagamento → novos)"
            valorClassName="text-emerald-700"
          />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-sky-200/60 pt-2 text-xs font-semibold text-sky-900">
          <span>Total recebido classificado</span>
          <span className="tabular-nums">{formatCurrency(fechamento.recebido_classificado)}</span>
        </div>
      </section>
    </div>
  )
}
