import { useState } from 'react'
import { ChevronDown, ChevronRight, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { OPEX_COLORS } from '../constants'
import type { OpexGrupoRow, OpexKpis } from '../types/opex.types'

type Props = {
  grupos: OpexGrupoRow[]
  kpis: OpexKpis
  mesAtual: number
}

export function OpexProjecaoFixas({ grupos, kpis, mesAtual }: Props) {
  const [expandido, setExpandido] = useState(true)
  const fixas = grupos.filter((g) => g.fixo).sort((a, b) => b.projetado_ano - a.projetado_ano)
  const mesesRestantes = Math.max(0, 12 - mesAtual)
  const totalProjetadoFixas = fixas.reduce((s, g) => s + g.projetado_ano, 0)

  return (
    <section className="rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-violet-50/40 sm:p-5"
      >
        <div className="flex min-w-0 items-start gap-2">
          {expandido ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          )}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
            <Pin className="h-4 w-4 text-violet-700" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Projeção de despesas fixas</h2>
            <p className="text-xs text-slate-600">
              Média mensal global das fixas{' '}
              <strong className="tabular-nums">{formatCurrency(kpis.media_mensal_fixas)}</strong>
              {mesesRestantes > 0 && (
                <> · cada grupo extrapola o próprio YTD por <strong>{mesesRestantes}</strong> meses restantes</>
              )}
              {!expandido && fixas.length > 0 && (
                <> · {fixas.length} grupo{fixas.length > 1 ? 's' : ''}</>
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700/80">Total projetado fixas</p>
          <p className="text-lg font-bold tabular-nums text-violet-900">{formatCurrency(totalProjetadoFixas)}</p>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-violet-100/80 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fixas.slice(0, 9).map((g) => (
              <div
                key={g.grupo_conta}
                className="rounded-lg border border-violet-100/80 bg-white/90 px-3 py-2.5"
              >
                <p className="truncate text-xs font-medium text-slate-800" title={g.grupo_conta}>
                  {g.grupo_conta}
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className={cn('text-sm font-semibold tabular-nums', OPEX_COLORS.fixo.text)}>
                    {formatCurrency(g.projetado_ano)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    YTD {formatCurrency(g.realizado_ytd)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
