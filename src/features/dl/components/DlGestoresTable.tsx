import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { mesAbrev } from '@/features/receita/constants'
import type { DlArea, DlGestorLinha } from '../types/dl.types'

type Props = {
  titulo: string
  linhas: DlGestorLinha[]
  meses: number[]
  areas: DlArea[]
  /** Mostra a coluna de área (visão do escritório). */
  comArea?: boolean
}

const sinal = (v: number) => `${v > 0 ? '+' : '−'}${formatCurrency(Math.abs(v))}`

/** DL a pagar por gestor; o ajuste de meses já fechados aparece embaixo do valor. */
export function DlGestoresTable({ titulo, linhas, meses, areas, comArea }: Props) {
  if (linhas.length === 0) return null
  const nomeArea = new Map(areas.map((a) => [a.area_key, a.nome]))
  const fechado = (mes: number) => linhas.some((l) => l.meses[meses.indexOf(mes)]?.fechado)
  const temAjuste = linhas.some((l) => l.meses.some((m) => m && Math.abs(m.ajuste) >= 0.01))
  const totalMes = meses.map((_, i) => linhas.reduce((s, l) => s + (l.meses[i]?.dl ?? 0), 0))

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <p className="text-xs text-slate-500">
          Valor a pagar no mês. Mês fechado mostra o valor gravado no fechamento; mudanças posteriores no VIOS entram
          como ajuste no primeiro mês aberto.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium">Gestor</th>
              {comArea && <th className="px-2 py-2 text-left font-medium">Área</th>}
              {meses.map((m) => (
                <th key={m} className="whitespace-nowrap px-2 py-2 text-right font-medium">
                  {fechado(m) && <Lock className="mr-1 inline h-3 w-3 text-slate-400" aria-label="Mês fechado" />}
                  {mesAbrev(m)}
                </th>
              ))}
              <th className="whitespace-nowrap py-2 pl-3 text-right font-semibold text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.gestor.id} className="border-b border-slate-100 tabular-nums">
                <td className="sticky left-0 whitespace-nowrap bg-white py-2 pr-3 text-left text-slate-800">
                  {l.gestor.nome} <span className="text-xs text-slate-400">{l.gestor.pct.toLocaleString('pt-BR')}%</span>
                </td>
                {comArea && (
                  <td className="whitespace-nowrap px-2 py-2 text-left text-xs text-slate-500">
                    {nomeArea.get(l.gestor.area_key) ?? l.gestor.area_key}
                  </td>
                )}
                {l.meses.map((m, i) => (
                  <td key={meses[i]} className="whitespace-nowrap px-2 py-2 text-right align-top">
                    {m == null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <>
                        <span className={cn(m.dl > 0 ? 'text-amber-800' : 'text-slate-400')}>{formatCurrency(m.dl)}</span>
                        {Math.abs(m.ajuste) >= 0.01 && (
                          <span
                            className={cn('block text-[10px]', m.ajuste < 0 ? 'text-rose-600' : 'text-emerald-700')}
                            title={`Calculado no mês ${formatCurrency(m.dl_calculado)} ${sinal(m.ajuste)} de ajuste de meses fechados`}
                          >
                            aj. {sinal(m.ajuste)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                ))}
                <td className="whitespace-nowrap py-2 pl-3 text-right font-semibold text-amber-800">{formatCurrency(l.total)}</td>
              </tr>
            ))}
            {linhas.length > 1 && (
              <tr className="bg-slate-50 font-semibold tabular-nums text-slate-900">
                <td className="sticky left-0 bg-slate-50 py-2 pr-3 text-left">Total</td>
                {comArea && <td />}
                {totalMes.map((t, i) => (
                  <td key={meses[i]} className="whitespace-nowrap px-2 py-2 text-right">
                    {formatCurrency(t)}
                  </td>
                ))}
                <td className="whitespace-nowrap py-2 pl-3 text-right text-amber-800">
                  {formatCurrency(totalMes.reduce((s, t) => s + t, 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {temAjuste && (
        <p className="mt-2 text-[11px] text-slate-400">
          aj. = diferença de meses já fechados (lançamento alterado no VIOS depois do fechamento). Não deixa o DL do
          mês negativo; o que sobrar passa para o mês seguinte.
        </p>
      )}
    </section>
  )
}
