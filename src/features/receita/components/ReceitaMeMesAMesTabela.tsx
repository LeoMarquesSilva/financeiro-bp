import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import type { ReceitaMeMesAMes } from '../utils/receitaMeCalc'
import { receitaMeMesRotulo } from '../utils/receitaMeLabels'

type Props = {
  ano: number
  linhas: ReceitaMeMesAMes[]
  /** Versão enxuta (tela do gerente): só meta, valor, diferença e gap acumulado. */
  compacta?: boolean
}

function pct(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function corDiferenca(v: number): string {
  return v >= 0 ? 'text-emerald-700' : 'text-red-600'
}

/** Bloco "Mês a mês" da planilha do escritório: meta do SIOE × realizado (fechado) ou ME (aberto). */
export function ReceitaMeMesAMesTabela({ ano, linhas, compacta = false }: Props) {
  if (linhas.length === 0) return null
  const total = linhas[linhas.length - 1]
  const metaTotal = total.metaAcumulada
  const valorTotal = total.projecaoAcumulada

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2 text-left font-semibold">Mês</th>
            <th className="px-3 py-2 text-left font-semibold">Base</th>
            <th className="px-3 py-2 text-right font-semibold">Meta</th>
            <th className="px-3 py-2 text-right font-semibold">Realizado ou ME</th>
            <th className="px-3 py-2 text-right font-semibold">Diferença</th>
            <th className="px-3 py-2 text-right font-semibold">% da meta</th>
            {!compacta && (
              <>
                <th className="px-3 py-2 text-right font-semibold">Meta acum.</th>
                <th className="px-3 py-2 text-right font-semibold">Projeção acum.</th>
              </>
            )}
            <th className="px-3 py-2 text-right font-semibold">Gap acum.</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.mes} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 font-medium text-slate-800">{receitaMeMesRotulo(ano, l.mes)}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    l.base === 'realizado'
                      ? 'border-slate-200 bg-slate-100 text-slate-600'
                      : 'border-sky-200 bg-sky-50 text-sky-700',
                  )}
                >
                  {l.base === 'realizado' ? 'Realizado' : 'Melhor estimativa'}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-slate-600" title={formatCurrency(l.meta)}>
                {formatCurrencyCompact(l.meta)}
              </td>
              <td className="px-3 py-2 text-right font-medium text-slate-900" title={formatCurrency(l.valor)}>
                {formatCurrencyCompact(l.valor)}
              </td>
              <td className={cn('px-3 py-2 text-right', corDiferenca(l.diferenca))} title={formatCurrency(l.diferenca)}>
                {formatCurrencyCompact(l.diferenca)}
              </td>
              <td className={cn('px-3 py-2 text-right', l.pctMeta >= 100 ? 'text-emerald-700' : 'text-slate-700')}>
                {l.meta > 0 ? pct(l.pctMeta) : '—'}
              </td>
              {!compacta && (
                <>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrencyCompact(l.metaAcumulada)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrencyCompact(l.projecaoAcumulada)}</td>
                </>
              )}
              <td className={cn('px-3 py-2 text-right font-medium', corDiferenca(l.gapAcumulado))} title={formatCurrency(l.gapAcumulado)}>
                {formatCurrencyCompact(l.gapAcumulado)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/80 font-semibold text-slate-900">
            <td className="px-3 py-2" colSpan={2}>
              Total
            </td>
            <td className="px-3 py-2 text-right" title={formatCurrency(metaTotal)}>
              {formatCurrencyCompact(metaTotal)}
            </td>
            <td className="px-3 py-2 text-right" title={formatCurrency(valorTotal)}>
              {formatCurrencyCompact(valorTotal)}
            </td>
            <td className={cn('px-3 py-2 text-right', corDiferenca(valorTotal - metaTotal))}>
              {formatCurrencyCompact(valorTotal - metaTotal)}
            </td>
            <td className="px-3 py-2 text-right">{metaTotal > 0 ? pct((valorTotal / metaTotal) * 100) : '—'}</td>
            {!compacta && (
              <>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
              </>
            )}
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
