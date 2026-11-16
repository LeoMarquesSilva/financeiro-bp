import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import {
  ordenarPorColuna,
  proximaOrdenacao,
  type ReceitaMeAreaCalc,
  type ReceitaMeCelula,
  type ReceitaMeLinha,
  type ReceitaMeOrdenacao,
} from '../utils/receitaMeCalc'
import { receitaMeDescreverTitulo, receitaMeMesRotulo } from '../utils/receitaMeLabels'
import { ReceitaMeCabecalhoOrdenavel } from './ReceitaMeCabecalhoOrdenavel'

/** Colunas: grupo, situação, um mês (valor fora) ou total fora. */
type ChaveFora = 'grupo' | 'situacao' | 'total' | number
type LinhaFora = { linha: ReceitaMeLinha; estados: Set<ReceitaMeCelula['estado']> }

type Props = {
  ano: number
  calc: ReceitaMeAreaCalc
}

const ESTADO_FORA: Partial<Record<ReceitaMeCelula['estado'], { label: string; celula: string; badge: string }>> = {
  em_atraso: {
    label: 'Em atraso',
    celula: 'bg-amber-50 text-amber-800',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  nao_paga: {
    label: 'Não deve pagar',
    celula: 'bg-red-50 text-red-600',
    badge: 'border-red-200 bg-red-50 text-red-600',
  },
}

function tituloFora(c: ReceitaMeCelula): string {
  const titulos = c.detalhes.filter((d) => !d.pago).map(receitaMeDescreverTitulo)
  const estado =
    c.estado === 'em_atraso'
      ? 'Vencido sem pagamento: fora da estimativa por padrão.'
      : 'Marcado como não deve pagar.'
  return [...titulos, estado].join('\n')
}

/**
 * Quem está fora da estimativa na área: títulos do mês em atraso (fora por padrão) e o
 * que o gerente marcou como "não deve pagar". Mesmos valores da matriz, isolados.
 */
function situacaoTexto(estados: Set<ReceitaMeCelula['estado']>): string {
  return (['em_atraso', 'nao_paga'] as const)
    .filter((e) => estados.has(e))
    .map((e) => ESTADO_FORA[e]?.label ?? e)
    .join(', ')
}

function valorColuna({ linha, estados }: LinhaFora, chave: ChaveFora): number | string {
  if (chave === 'grupo') return linha.grupo
  if (chave === 'situacao') return situacaoTexto(estados)
  if (chave === 'total') return linha.fora
  return linha.celulas[chave]?.fora ?? 0
}

export function ReceitaMeForaEstimativa({ ano, calc }: Props) {
  const { meses } = calc
  const [ordenacao, setOrdenacao] = useState<ReceitaMeOrdenacao<ChaveFora> | null>(null)
  const ordenarPor = (chave: ChaveFora) =>
    setOrdenacao((atual) => proximaOrdenacao(atual, chave, chave === 'grupo' || chave === 'situacao' ? 'asc' : 'desc'))

  const linhasPadrao = useMemo(
    () =>
      calc.linhas
        .filter((l) => l.fora > 0)
        .map((l) => {
          const estados = new Set(meses.map((m) => l.celulas[m]).filter((c) => c.fora > 0).map((c) => c.estado))
          return { linha: l, estados }
        })
        .sort((a, b) => b.linha.fora - a.linha.fora || a.linha.grupo.localeCompare(b.linha.grupo, 'pt-BR')),
    [calc.linhas, meses],
  )
  const linhas = useMemo(
    () => ordenarPorColuna(linhasPadrao, ordenacao, valorColuna, (x) => x.linha.grupo),
    [linhasPadrao, ordenacao],
  )

  const totalPorMes = useMemo(() => {
    const out: Record<number, number> = {}
    for (const m of meses) out[m] = linhas.reduce((s, { linha }) => s + (linha.celulas[m]?.fora ?? 0), 0)
    return out
  }, [linhas, meses])

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Fora da estimativa</h3>
          <p className="text-xs text-slate-500">
            Clientes com título do mês em atraso (fora por padrão) ou marcados como não deve pagar. Os mesmos valores da
            carteira acima, isolados; para mudar, clique na célula da carteira.
          </p>
        </div>
        {ordenacao && (
          <button
            type="button"
            onClick={() => setOrdenacao(null)}
            className="shrink-0 text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Ordem padrão
          </button>
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhum valor fora da estimativa.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-200">
                <ReceitaMeCabecalhoOrdenavel chave="grupo" ordenacao={ordenacao} onOrdenar={ordenarPor} alinhamento="esquerda">
                  Grupo
                </ReceitaMeCabecalhoOrdenavel>
                <ReceitaMeCabecalhoOrdenavel
                  chave="situacao"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                  alinhamento="esquerda"
                >
                  Situação
                </ReceitaMeCabecalhoOrdenavel>
                {meses.map((m) => (
                  <ReceitaMeCabecalhoOrdenavel key={m} chave={m} ordenacao={ordenacao} onOrdenar={ordenarPor}>
                    {receitaMeMesRotulo(ano, m)}
                  </ReceitaMeCabecalhoOrdenavel>
                ))}
                <ReceitaMeCabecalhoOrdenavel chave="total" ordenacao={ordenacao} onOrdenar={ordenarPor}>
                  Total fora
                </ReceitaMeCabecalhoOrdenavel>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ linha, estados }) => (
                <tr key={linha.grupo} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-[260px] truncate px-3 py-1.5 text-slate-800" title={linha.grupo}>
                    {linha.grupo}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {(['em_atraso', 'nao_paga'] as const)
                        .filter((e) => estados.has(e))
                        .map((e) => (
                          <span
                            key={e}
                            className={cn(
                              'inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              ESTADO_FORA[e]?.badge,
                            )}
                          >
                            {ESTADO_FORA[e]?.label}
                          </span>
                        ))}
                    </div>
                  </td>
                  {meses.map((m) => {
                    const c = linha.celulas[m]
                    if (!c || c.fora <= 0) {
                      return (
                        <td key={m} className="px-3 py-1.5 text-right text-slate-300">
                          —
                        </td>
                      )
                    }
                    return (
                      <td key={m} className="px-2 py-1 text-right">
                        <span
                          className={cn('rounded-md px-1.5 py-0.5', ESTADO_FORA[c.estado]?.celula)}
                          title={tituloFora(c)}
                        >
                          {formatCurrencyCompact(c.fora)}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right font-semibold text-red-600" title={formatCurrency(linha.fora)}>
                    {formatCurrencyCompact(linha.fora)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-slate-900">
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2" colSpan={2}>
                  Total · {linhas.length} {linhas.length === 1 ? 'grupo' : 'grupos'}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    em atraso {formatCurrencyCompact(calc.foraAtraso)} · não deve pagar{' '}
                    {formatCurrencyCompact(calc.foraNaoPaga)}
                  </span>
                </td>
                {meses.map((m) => (
                  <td key={m} className="px-3 py-2 text-right">
                    {formatCurrencyCompact(totalPorMes[m])}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-red-600" title={formatCurrency(calc.fora)}>
                  {formatCurrencyCompact(calc.fora)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
