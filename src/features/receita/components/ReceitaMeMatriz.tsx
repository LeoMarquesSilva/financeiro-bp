import { useMemo, useRef, useState } from 'react'
import { Ban, Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import {
  ordenarLinhasMe,
  proximaOrdenacao,
  type ReceitaMeAreaCalc,
  type ReceitaMeCelula,
  type ReceitaMeLinha,
  type ReceitaMeOrdenacao,
  type ReceitaMeOrdenacaoChave,
} from '../utils/receitaMeCalc'
import { receitaMeDescreverTitulo, receitaMeMesRotulo } from '../utils/receitaMeLabels'
import { ReceitaMeCabecalhoOrdenavel } from './ReceitaMeCabecalhoOrdenavel'

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
  const partes = c.detalhes.map(receitaMeDescreverTitulo)
  if (c.titulos > 1) {
    partes.push(`Total: previsto ${formatCurrency(c.previsto)} · em aberto ${formatCurrency(c.aberto)}`)
  }
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
  return [partes.join('\n'), estado[c.estado], podeEditar ? acao[c.estado] : null]
    .filter(Boolean)
    .join('\n')
}

export function ReceitaMeMatriz({ ano, calc, podeEditar, onClickCelula, onClickLinha }: Props) {
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState<ReceitaMeOrdenacao | null>(null)
  const { meses, mesCorrente } = calc
  /** Mês corrente vira um cabeçalho agrupado (recebido + em aberto); os demais meses ficam soltos. */
  const mesesFuturos = meses.filter((m) => m !== mesCorrente)
  const linhasCabecalho = mesCorrente != null ? 2 : 1
  const bordaMesCorrente = (m: number) => (m === mesCorrente ? 'border-r border-slate-200' : '')

  // A ordem só muda ao clicar no cabeçalho ou quando entram/saem grupos: marcar uma
  // célula muda a ME da linha, e ela não pode pular de lugar sob o cursor.
  const linhasAtuais = useRef(calc.linhas)
  linhasAtuais.current = calc.linhas
  const assinaturaGrupos = useMemo(
    () => `${calc.areaKey}\u0000${calc.linhas.map((l) => l.grupo).sort().join('\u0000')}`,
    [calc.areaKey, calc.linhas],
  )
  const ordem = useMemo(
    () => ordenarLinhasMe(linhasAtuais.current, ordenacao).map((l) => l.grupo),
    [ordenacao, assinaturaGrupos],
  )

  const linhas = useMemo(() => {
    const porGrupo = new Map(calc.linhas.map((l) => [l.grupo, l]))
    const q = busca.trim().toLowerCase()
    return ordem
      .map((g) => porGrupo.get(g))
      .filter((l): l is ReceitaMeLinha => l != null && (!q || l.grupo.toLowerCase().includes(q)))
  }, [calc.linhas, ordem, busca])

  const ordenarPor = (chave: ReceitaMeOrdenacaoChave) => setOrdenacao((atual) => proximaOrdenacao(atual, chave))

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
        <div className="flex w-full max-w-[360px] items-center justify-end gap-2">
          {ordenacao && (
            <button
              type="button"
              onClick={() => setOrdenacao(null)}
              className="shrink-0 text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Ordem padrão
            </button>
          )}
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
            <tr className={cn(mesCorrente == null && 'border-b border-slate-200')}>
              <ReceitaMeCabecalhoOrdenavel
                chave="grupo"
                ordenacao={ordenacao}
                onOrdenar={ordenarPor}
                alinhamento="esquerda"
                rowSpan={linhasCabecalho}
              >
                Grupo
              </ReceitaMeCabecalhoOrdenavel>
              {mesCorrente != null && (
                <th
                  colSpan={2}
                  className="border-b border-l border-r border-slate-200 bg-slate-100/70 px-3 pb-1 pt-2 text-center font-semibold text-slate-700"
                >
                  {receitaMeMesRotulo(ano, mesCorrente)}
                </th>
              )}
              {mesesFuturos.map((m) => (
                <ReceitaMeCabecalhoOrdenavel
                  key={m}
                  chave={m}
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                  rowSpan={linhasCabecalho}
                  title="Valor em aberto dos títulos que vencem no mês"
                >
                  {receitaMeMesRotulo(ano, m)}
                </ReceitaMeCabecalhoOrdenavel>
              ))}
              <ReceitaMeCabecalhoOrdenavel chave="me" ordenacao={ordenacao} onOrdenar={ordenarPor} rowSpan={linhasCabecalho}>
                ME
              </ReceitaMeCabecalhoOrdenavel>
              <th rowSpan={linhasCabecalho} className="w-10 px-2 py-2" aria-label="Ações" />
            </tr>
            {mesCorrente != null && (
              <tr className="border-b border-slate-200">
                <ReceitaMeCabecalhoOrdenavel
                  chave="recebido"
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                  title="Caixa do mês, inclui pagamento de títulos de outros meses"
                >
                  Recebido
                </ReceitaMeCabecalhoOrdenavel>
                <ReceitaMeCabecalhoOrdenavel
                  chave={mesCorrente}
                  ordenacao={ordenacao}
                  onOrdenar={ordenarPor}
                  title="Títulos que vencem no mês e ainda não foram pagos (amarelo = vencido, em atraso)"
                >
                  Em aberto
                </ReceitaMeCabecalhoOrdenavel>
              </tr>
            )}
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
                    <td className="border-l border-slate-200 px-3 py-1.5 text-right text-emerald-700" title={formatCurrency(linha.recebido)}>
                      {linha.recebido > 0 ? formatCurrencyCompact(linha.recebido) : <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {meses.map((m) => {
                    const c = linha.celulas[m]
                    if (c.previsto <= 0) {
                      return (
                        <td key={m} className={cn('px-3 py-1.5 text-right text-slate-300', bordaMesCorrente(m))}>
                          —
                        </td>
                      )
                    }
                    if (c.estado === 'quitado') {
                      return (
                        <td
                          key={m}
                          className={cn('px-3 py-1.5 text-right text-slate-400', bordaMesCorrente(m))}
                          title={tituloCelula(c, podeEditar)}
                        >
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Check className="h-3 w-3" aria-hidden />
                            pago
                          </span>
                        </td>
                      )
                    }
                    return (
                      <td key={m} className={cn('px-2 py-1 text-right', bordaMesCorrente(m))}>
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
                  <td className="border-l border-slate-200 px-3 py-2 text-right text-emerald-700">
                    {formatCurrencyCompact(totais.recebido)}
                  </td>
                )}
                {meses.map((m) => (
                  <td key={m} className={cn('px-3 py-2 text-right', bordaMesCorrente(m))} title="Só o que conta na estimativa">
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
