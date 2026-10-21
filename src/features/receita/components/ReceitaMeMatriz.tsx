import { useMemo, useState } from 'react'
import { Ban, Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import type { ReceitaMeAreaCalc, ReceitaMeCelula, ReceitaMeLinha } from '../utils/receitaMeCalc'
import { receitaMeMesRotulo } from '../utils/receitaMeLabels'

type Props = {
  ano: number
  calc: ReceitaMeAreaCalc
  podeEditar: boolean
  onClickCelula: (linha: ReceitaMeLinha, celula: ReceitaMeCelula) => void
  onClickLinha: (linha: ReceitaMeLinha) => void
}

const ESTADO_CLASS: Record<ReceitaMeCelula['estado'], string> = {
  conta: 'text-slate-800',
  nao_paga: 'bg-red-50 text-red-600 line-through decoration-red-400',
  em_atraso: 'bg-amber-50 text-amber-800',
  vai_pagar: 'bg-emerald-50 text-emerald-800',
  quitado: 'text-slate-400',
}

function tituloCelula(c: ReceitaMeCelula, podeEditar: boolean): string {
  const partes = [
    `${c.titulos} título(s) · previsto ${formatCurrency(c.previsto)}`,
    c.pago > 0 ? `pago ${formatCurrency(c.pago)}` : null,
    c.aberto > 0 ? `em aberto ${formatCurrency(c.aberto)}` : null,
  ].filter(Boolean)
  const estado: Record<ReceitaMeCelula['estado'], string> = {
    conta: 'Conta na estimativa.',
    nao_paga: 'Marcado como não deve pagar: fora da estimativa.',
    em_atraso: `${formatCurrency(c.abertoVencido)} vencido sem pagamento: fora da estimativa por padrão.`,
    vai_pagar: 'Em atraso, mas marcado como vai pagar: conta na estimativa.',
    quitado: 'Sem valor em aberto.',
  }
  const acao: Partial<Record<ReceitaMeCelula['estado'], string>> = {
    conta: 'Clique para marcar como não deve pagar.',
    nao_paga: 'Clique para voltar a contar.',
    em_atraso: 'Clique para marcar que vai pagar.',
    vai_pagar: 'Clique para marcar como não deve pagar.',
  }
  return [partes.join(' · '), estado[c.estado], podeEditar ? acao[c.estado] : null]
    .filter(Boolean)
    .join('\n')
}

export function ReceitaMeMatriz({ ano, calc, podeEditar, onClickCelula, onClickLinha }: Props) {
  const [busca, setBusca] = useState('')
  const { meses, mesCorrente } = calc

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return calc.linhas
    return calc.linhas.filter((l) => l.grupo.toLowerCase().includes(q))
  }, [calc.linhas, busca])

  const totais = useMemo(() => {
    const porMes: Record<number, number> = {}
    for (const m of meses) porMes[m] = linhas.reduce((s, l) => s + (l.celulas[m]?.contado ?? 0), 0)
    return {
      recebido: linhas.reduce((s, l) => s + l.recebido, 0),
      porMes,
      me: linhas.reduce((s, l) => s + l.me, 0),
    }
  }, [linhas, meses])

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Carteira por grupo</h3>
          <p className="text-xs text-slate-500">
            {podeEditar
              ? 'Clique num valor para tirar ou devolver à estimativa. O ícone da linha marca o grupo até dezembro.'
              : 'Somente leitura: só o responsável da área, o admin e a Controladoria alteram.'}
          </p>
        </div>
        <div className="relative w-full max-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar grupo"
            className="h-8 pl-8 text-sm"
            aria-label="Buscar grupo"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 px-4 py-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" />Conta</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-200" />Não deve pagar</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />Em atraso (fora por padrão)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" />Em atraso, vai pagar</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Novidade</span>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[720px] text-sm tabular-nums">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left font-semibold">Grupo</th>
              {mesCorrente != null && (
                <th className="px-3 py-2 text-right font-semibold" title="Caixa do mês corrente, inclui títulos de outros meses">
                  Recebido {receitaMeMesRotulo(ano, mesCorrente)}
                </th>
              )}
              {meses.map((m) => (
                <th key={m} className="px-3 py-2 text-right font-semibold">
                  {m === mesCorrente ? 'A receber ' : ''}
                  {receitaMeMesRotulo(ano, m)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">ME</th>
              <th className="w-10 px-2 py-2" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={meses.length + 4} className="px-4 py-8 text-center text-sm text-slate-500">
                  {busca ? 'Nenhum grupo com esse nome.' : 'Nenhum título em aberto nem recebido no horizonte.'}
                </td>
              </tr>
            )}
            {linhas.map((linha) => {
              const abertos = meses.map((m) => linha.celulas[m]).filter((c) => c.aberto > 0)
              const todasFora = abertos.length > 0 && abertos.every((c) => c.estado === 'nao_paga')
              return (
                <tr key={linha.grupo} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="max-w-[260px] truncate px-3 py-1.5 text-slate-800" title={linha.grupo}>
                    {linha.temNovidade && (
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" aria-label="Novidade" />
                    )}
                    {linha.grupo}
                  </td>
                  {mesCorrente != null && (
                    <td className="px-3 py-1.5 text-right text-emerald-700" title={formatCurrency(linha.recebido)}>
                      {linha.recebido > 0 ? formatCurrencyCompact(linha.recebido) : <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {meses.map((m) => {
                    const c = linha.celulas[m]
                    if (c.previsto <= 0) {
                      return (
                        <td key={m} className="px-3 py-1.5 text-right text-slate-300">
                          —
                        </td>
                      )
                    }
                    if (c.estado === 'quitado') {
                      return (
                        <td key={m} className="px-3 py-1.5 text-right text-slate-400" title={tituloCelula(c, podeEditar)}>
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Check className="h-3 w-3" aria-hidden />
                            pago
                          </span>
                        </td>
                      )
                    }
                    return (
                      <td key={m} className="px-2 py-1 text-right">
                        <button
                          type="button"
                          disabled={!podeEditar}
                          onClick={() => onClickCelula(linha, c)}
                          title={tituloCelula(c, podeEditar)}
                          className={cn(
                            'rounded-md px-1.5 py-0.5 transition-colors',
                            ESTADO_CLASS[c.estado],
                            podeEditar ? 'cursor-pointer hover:ring-1 hover:ring-slate-300' : 'cursor-default',
                          )}
                        >
                          {formatCurrencyCompact(c.aberto)}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right font-semibold text-slate-900" title={formatCurrency(linha.me)}>
                    {formatCurrencyCompact(linha.me)}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {podeEditar && abertos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onClickLinha(linha)}
                        className={cn(
                          'rounded-md p-1 transition-colors',
                          todasFora ? 'bg-red-50 text-red-600' : 'text-slate-400 hover:bg-red-50 hover:text-red-600',
                        )}
                        title={todasFora ? 'Voltar a contar todos os meses' : 'Não deve pagar até dezembro'}
                        aria-label={todasFora ? `Voltar a contar ${linha.grupo}` : `Marcar ${linha.grupo} como não deve pagar até dezembro`}
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {linhas.length > 0 && (
            <tfoot className="sticky bottom-0 bg-slate-50 font-semibold text-slate-900">
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2">{busca ? 'Total filtrado' : 'Total da carteira'}</td>
                {mesCorrente != null && (
                  <td className="px-3 py-2 text-right text-emerald-700">{formatCurrencyCompact(totais.recebido)}</td>
                )}
                {meses.map((m) => (
                  <td key={m} className="px-3 py-2 text-right" title="Só o que conta na estimativa">
                    {formatCurrencyCompact(totais.porMes[m])}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">{formatCurrencyCompact(totais.me)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
