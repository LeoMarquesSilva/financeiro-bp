import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { ReceitaPrevistoFechamentoMes } from '../types/receita.types'
import type { ReceitaRecebidoDetalheKey } from '../utils/recebidoClassificacao'
import {
  RECEBIDO_GERENCIAL_LINHAS,
  type FechamentoDrillKey,
} from '../utils/receitaPrevistoFechamento'
import { ReceitaPrevistoFechamentoContabilPanel } from './ReceitaPrevistoFechamentoContabilPanel'

type Props = {
  fechamento: ReceitaPrevistoFechamentoMes
  onDrillRecebido?: (key: ReceitaRecebidoDetalheKey) => void
  onDrillContabil?: (key: FechamentoDrillKey) => void
}

export function ReceitaMesVisaoGerencialPanel({
  fechamento,
  onDrillRecebido,
  onDrillContabil,
}: Props) {
  const [contabilAberto, setContabilAberto] = useState(false)

  const totalRecebido = fechamento.recebido_classificado
  const pctPrevistoCaixa =
    fechamento.previsto > 0
      ? (fechamento.recebido_previsto_caixa / fechamento.previsto) * 100
      : null
  const pctInadPrevisto =
    fechamento.previsto > 0 ? (fechamento.inadimplencia_kpi / fechamento.previsto) * 100 : null

  const somaLinhas = RECEBIDO_GERENCIAL_LINHAS.reduce(
    (s, linha) => s + fechamento[linha.valorKey],
    0,
  )
  const recebidoFecha = Math.abs(somaLinhas - totalRecebido) < 0.02

  return (
    <div className="mb-4 space-y-4">
      <section className="rounded-xl border border-sky-200/70 bg-sky-50/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
              Composição do recebido
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-sky-800/80">
              Caixa líquido do mês — clique para ver títulos
            </p>
          </div>
          {pctPrevistoCaixa != null ? (
            <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium tabular-nums text-sky-900">
              {formatPercent(pctPrevistoCaixa)} do previsto (venc. mês)
            </span>
          ) : null}
        </div>

        <ul className="mt-3 space-y-1">
          {RECEBIDO_GERENCIAL_LINHAS.map((linha) => {
            const valor = fechamento[linha.valorKey]
            if (Math.abs(valor) < 0.01) return null
            const pct = totalRecebido > 0 ? (valor / totalRecebido) * 100 : 0
            return (
              <li key={linha.key}>
                <button
                  type="button"
                  onClick={() => onDrillRecebido?.(linha.key)}
                  className="group w-full rounded-lg px-1 py-2 text-left transition-colors hover:bg-white/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{linha.label}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{linha.hint}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80">
                          <div
                            className={cn('h-full rounded-full', linha.barClassName)}
                            style={{ width: `${Math.max(Math.min(pct, 100), 2)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-[10px] font-medium tabular-nums text-slate-500">
                          {formatPercent(pct)}
                        </span>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          linha.valorClassName,
                        )}
                      >
                        {formatCurrency(valor)}
                      </span>
                      {onDrillRecebido ? (
                        <ChevronRight
                          className="h-4 w-4 text-slate-400 group-hover:text-sky-600"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-2 flex items-center justify-between border-t border-sky-200/60 pt-2 text-xs font-semibold text-sky-900">
          <span className="flex items-center gap-1.5">
            = Total recebido
            {recebidoFecha ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                fecha
              </span>
            ) : null}
          </span>
          <span className="tabular-nums">{formatCurrency(totalRecebido)}</span>
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => onDrillContabil?.('inad_grupo')}
          className="group w-full rounded-xl border border-red-200/80 bg-red-50/60 p-3 text-left transition-colors hover:border-red-300 hover:bg-red-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-900">
                Inadimplência do mês — por grupo
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-red-800/80">
                O que vale é o grupo: pagamento de qualquer razão social abate a dívida consolidada.
              </p>
              {pctInadPrevisto != null ? (
                <p className="mt-1.5 text-[10px] font-medium tabular-nums text-red-800/70">
                  {formatPercent(pctInadPrevisto)} do previsto
                </p>
              ) : null}
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-lg font-bold tabular-nums text-red-800">
                {formatCurrency(fechamento.inadimplencia_kpi)}
              </span>
              {onDrillContabil ? (
                <ChevronRight
                  className="h-4 w-4 text-red-400 group-hover:text-red-600"
                  aria-hidden
                />
              ) : null}
            </span>
          </div>
        </button>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-slate-50/40">
        <button
          type="button"
          onClick={() => setContabilAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          aria-expanded={contabilAberto}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Validação contábil do previsto
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-slate-400 transition-transform',
              contabilAberto && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {contabilAberto ? (
          <div className="border-t border-slate-200/60 px-3 pb-3">
            <ReceitaPrevistoFechamentoContabilPanel
              fechamento={fechamento}
              onDrillDown={onDrillContabil}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}
