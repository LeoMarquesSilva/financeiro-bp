import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { mesAbrev } from '@/features/receita/constants'
import { DL_LINHAS, totalDemonstrativo } from '../utils/dlCalc'
import type { DlMesCalculado } from '../types/dl.types'

type Props = {
  titulo: string
  subtitulo?: string
  meses: DlMesCalculado[]
  /** Referência de mercado da margem de contribuição (0–1). */
  referencia: number | null
  /** Mês ainda aberto (marcado com *). */
  mesParcial?: number | null
}

function formatar(key: string, v: number): string {
  if (key === 'margem_pct') return formatPercent(v * 100)
  if (key === 'profissionais') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  if (key === 'custo_hora') return v > 0 ? formatCurrency(v) : '—'
  return formatCurrency(v)
}

export function DlDemonstrativoTable({ titulo, subtitulo, meses, referencia, mesParcial }: Props) {
  const total = totalDemonstrativo(meses)
  const herdou = meses.some((m) => m.herdado)

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium">Linha</th>
              {meses.map((m) => (
                <th key={m.mes} className="whitespace-nowrap px-2 py-2 text-right font-medium">
                  {mesAbrev(m.mes)}
                  {mesParcial === m.mes ? '*' : ''}
                  {m.herdado && <span className="ml-0.5 text-amber-500" title="Parâmetros herdados do último mês cadastrado">•</span>}
                </th>
              ))}
              <th className="whitespace-nowrap py-2 pl-3 text-right font-semibold text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {DL_LINHAS.map((l) => {
              const resultado = l.tipo === 'resultado'
              const valorTotal = total[l.key]
              const corPct = (v: number) =>
                referencia == null ? '' : v >= referencia ? 'text-emerald-700' : 'text-rose-700'
              return (
                <tr
                  key={l.key}
                  className={cn(
                    'border-b border-slate-100 tabular-nums',
                    resultado && 'bg-slate-50 font-semibold text-slate-900',
                    l.tipo === 'saida' && 'text-slate-600',
                    l.tipo === 'info' && 'text-xs text-slate-500',
                    l.key === 'dl_gestor' && 'font-semibold text-amber-800',
                  )}
                >
                  <td className="sticky left-0 whitespace-nowrap bg-inherit py-2 pr-3 text-left">
                    {l.label}
                    {l.key === 'margem_pct' && referencia != null && (
                      <span className="ml-1 text-[11px] font-normal text-slate-400">
                        (ref. {formatPercent(referencia * 100)})
                      </span>
                    )}
                  </td>
                  {meses.map((m) => {
                    const v = m[l.key]
                    return (
                      <td
                        key={m.mes}
                        className={cn(
                          'whitespace-nowrap px-2 py-2 text-right',
                          l.key === 'margem_pct' && m.receita_liquida > 0 && corPct(v),
                          resultado && v < 0 && 'text-rose-700',
                        )}
                      >
                        {l.key === 'margem_pct' && m.receita_liquida <= 0 ? '—' : formatar(l.key, v)}
                      </td>
                    )
                  })}
                  <td
                    className={cn(
                      'whitespace-nowrap py-2 pl-3 text-right font-semibold',
                      l.key === 'margem_pct' && corPct(valorTotal),
                      resultado && valorTotal < 0 && 'text-rose-700',
                    )}
                  >
                    {l.key === 'profissionais' ? `${formatar(l.key, valorTotal)} (média)` : formatar(l.key, valorTotal)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {(herdou || mesParcial) && (
        <p className="mt-2 text-[11px] text-slate-400">
          {mesParcial ? '* mês corrente, ainda parcial. ' : ''}
          {herdou ? '• profissionais e % Controladoria herdados do último mês cadastrado em Parâmetros.' : ''}
        </p>
      )}
    </section>
  )
}
