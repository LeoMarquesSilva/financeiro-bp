import type { ElementType, ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Lightbulb, Pin, TrendingDown, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { OPEX_COLORS } from '../constants'
import { buildOpexInsights, insightUsaCompromissoVios, type OpexInsightLinha } from '../utils/opexInsights'
import type { OpexGrupoRow, OpexMesRow } from '../types/opex.types'

type Props = {
  grupos: OpexGrupoRow[]
  evolucao: OpexMesRow[]
  mesesFiltro: number[]
  mesAtual: number
  orcamentoImportado?: boolean
}

function variacaoClass(valor: number): string {
  if (valor > 0) return 'text-rose-700'
  if (valor < 0) return 'text-emerald-700'
  return 'text-slate-500'
}

function InsightCard({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string
  hint: string
  icon: ElementType
  children: ReactNode
}) {
  return (
    <article className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
          <Icon className="h-4 w-4 text-rose-700" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
      </div>
      {children}
    </article>
  )
}

function nomeComQuebra(nome: string): string {
  return nome.replace(/\//g, '/\u200b')
}

function RankingList({
  itens,
  empty,
  showVariacao,
  usarCompromisso,
}: {
  itens: OpexInsightLinha[]
  empty: string
  showVariacao?: boolean
  usarCompromisso?: boolean
}) {
  if (!itens.length) {
    return <p className="text-xs text-slate-400">{empty}</p>
  }

  return (
    <ol className="space-y-2">
      {itens.map((item, i) => (
        <li key={item.nome} className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-1 items-start gap-1.5">
            <span className="shrink-0 text-[11px] font-semibold text-slate-400">{i + 1}.</span>
            <span className="min-w-0 break-words text-xs font-medium leading-snug text-slate-800" title={item.nome}>
              {nomeComQuebra(item.nome)}
            </span>
          </span>
          <span className="w-[7.25rem] shrink-0 text-right">
            <span className={cn('block whitespace-nowrap text-xs font-semibold tabular-nums', OPEX_COLORS.realizado.text)}>
              {formatCurrency(usarCompromisso ? item.compromisso : item.realizado)}
            </span>
            {showVariacao && (
              <span className={cn('block whitespace-nowrap text-[11px] tabular-nums', variacaoClass(item.variacao))}>
                {item.variacao > 0 ? '+' : ''}
                {formatCurrency(item.variacao)}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function OpexInsights({
  grupos,
  evolucao,
  mesesFiltro,
  mesAtual,
  orcamentoImportado,
}: Props) {
  const usaCompromisso = insightUsaCompromissoVios(mesesFiltro, mesAtual)
  const insights = buildOpexInsights(grupos, evolucao, usaCompromisso)
  const baseLabel = orcamentoImportado ? 'orçado' : 'previsto VIOS'
  const comparacaoHint = usaCompromisso
    ? `Pago + VIOS a vencer vs ${baseLabel} do ano`
    : `Realizado vs ${baseLabel} no período`

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
          <Lightbulb className="h-4 w-4 text-amber-700" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Leitura operacional</h2>
          <p className="text-xs text-slate-500">
            O que concentra o gasto, onde estourou ou sobrou e alertas do período. {comparacaoHint}.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard title="O que mais gasta" hint="Maiores grupos no realizado" icon={Wallet}>
          <RankingList itens={insights.topGastos} empty="Sem realizado no período." />
          {insights.topGastos.length > 0 && (
            <p className="mt-3 text-[11px] text-slate-500">
              Top 3 concentram <strong>{formatPercent(insights.concentracaoTop3Pct)}</strong> do realizado.
            </p>
          )}
        </InsightCard>

        <InsightCard title="Onde estourou" hint={comparacaoHint} icon={ArrowUpRight}>
          <RankingList
            itens={insights.maioresEstouros}
            empty={`Nenhum grupo acima do ${baseLabel}.`}
            showVariacao
            usarCompromisso={usaCompromisso}
          />
        </InsightCard>

        <InsightCard title="Onde sobrou" hint={comparacaoHint} icon={ArrowDownRight}>
          <RankingList
            itens={insights.maioresEconomias}
            empty={`Nenhum grupo abaixo do ${baseLabel}.`}
            showVariacao
            usarCompromisso={usaCompromisso}
          />
        </InsightCard>

        <InsightCard title="Composição e alertas" hint="Fixas, furos de cadastro e mês crítico" icon={Pin}>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">Fixas no realizado</dt>
              <dd className={cn('font-semibold tabular-nums', OPEX_COLORS.fixo.text)}>
                {formatPercent(insights.pctFixas)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">Variáveis</dt>
              <dd className="font-semibold tabular-nums text-slate-800">
                {formatCurrency(insights.realizadoVariaveis)}
              </dd>
            </div>
            {insights.mesMaisPressionado && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Mês mais pressionado</dt>
                <dd className="text-right">
                  <span className="block font-semibold uppercase text-slate-800">
                    {insights.mesMaisPressionado.mesLabel}
                  </span>
                  <span className={cn('tabular-nums', variacaoClass(insights.mesMaisPressionado.variacao))}>
                    +{formatCurrency(insights.mesMaisPressionado.variacao)}
                  </span>
                </dd>
              </div>
            )}
            {insights.mesMaisFolgado && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Mês com mais folga</dt>
                <dd className="text-right">
                  <span className="block font-semibold uppercase text-slate-800">
                    {insights.mesMaisFolgado.mesLabel}
                  </span>
                  <span className={cn('tabular-nums', variacaoClass(insights.mesMaisFolgado.variacao))}>
                    {formatCurrency(insights.mesMaisFolgado.variacao)}
                  </span>
                </dd>
              </div>
            )}
          </dl>

          {insights.semOrcamento.length > 0 && (
            <p className="mt-3 text-[11px] text-amber-800">
              Gasto sem {baseLabel}:{' '}
              {insights.semOrcamento.map((g) => g.nome).join(', ')}.
            </p>
          )}
          {insights.orcadoNaoRealizado.length > 0 && (
            <p className="mt-2 flex items-start gap-1 text-[11px] text-slate-500">
              <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {baseLabel.charAt(0).toUpperCase() + baseLabel.slice(1)} sem realizado:{' '}
              {insights.orcadoNaoRealizado.map((g) => g.nome).join(', ')}.
            </p>
          )}
        </InsightCard>
      </div>
    </section>
  )
}
