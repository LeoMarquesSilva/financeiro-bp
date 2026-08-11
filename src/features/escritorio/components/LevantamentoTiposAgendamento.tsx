import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LevantamentoTipoRow } from '../services/escritorioLevantamentoService'

type Props = {
  rows: LevantamentoTipoRow[]
  loading?: boolean
  onSelectTipo: (tipo: string) => void
}

export function LevantamentoTiposAgendamento({ rows, loading, onSelectTipo }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.qtd))

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Tarefas por tipo de agendamento</h2>
        <p className="text-xs text-slate-500">
          Distinct count em <code className="text-[11px]">sp_agendamento</code>. Clique para abrir o
          racional.
        </p>
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Sem dados no filtro atual.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const pct = (row.qtd / max) * 100
            return (
              <li key={row.tipo_agendamento}>
                <button
                  type="button"
                  className="group w-full rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-slate-200 hover:bg-slate-50"
                  onClick={() => onSelectTipo(row.tipo_agendamento)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800 group-hover:text-slate-950">
                      {row.tipo_agendamento}
                    </span>
                    <span className="tabular-nums text-slate-600">
                      {row.qtd.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full bg-emerald-500/80 transition-all')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
