import { Pin } from 'lucide-react'
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
  const fixas = grupos.filter((g) => g.fixo).sort((a, b) => b.projetado_ano - a.projetado_ano)
  const mesesRestantes = Math.max(0, 12 - mesAtual)
  const totalProjetadoFixas = fixas.reduce((s, g) => s + g.projetado_ano, 0)

  return (
    <section className="rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
            <Pin className="h-4 w-4 text-violet-700" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Projeção de despesas fixas</h2>
            <p className="text-xs text-slate-600">
              Média mensal global das fixas{' '}
              <strong className="tabular-nums">{formatCurrency(kpis.media_mensal_fixas)}</strong>
              {mesesRestantes > 0 && (
                <> · cada grupo extrapola o próprio YTD por <strong>{mesesRestantes}</strong> meses restantes</>
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700/80">Total projetado fixas</p>
          <p className="text-lg font-bold tabular-nums text-violet-900">{formatCurrency(totalProjetadoFixas)}</p>
        </div>
      </div>

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
    </section>
  )
}
