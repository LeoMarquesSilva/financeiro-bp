import { useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  HandCoins,
  Landmark,
  Receipt,
  Scale,
  Wallet,
  Wrench,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LabelProps } from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'
import { OPEX_COLORS } from '@/features/opex/constants'
import { MESES_ABREV, MESES_NOME, RECEITA_CHART_AXIS, mesAbrev } from '../constants'
import { useReceitaResultadoCaixa } from '../hooks/useReceitaResultadoCaixa'
import type { ReceitaResultadoCaixaMesRow } from '../types/receita.types'
import {
  SAIDAS_FORA_CALCULO,
  SAIDAS_NAO_OPEX,
  buildCascataResultado,
  mesAtualResultadoCaixa,
  somarResultadoCaixa,
  variacaoPct,
  type CascataLinha,
} from '../utils/receitaResultadoCaixa'

type Props = {
  ano: number
}

const ICONES_NAO_OPEX = {
  distribuicao: HandCoins,
  investimentos: Wrench,
  financeiro: Landmark,
  deducoes: Receipt,
} as const

function periodoLabel(mesIni: number, mesFim: number, ano: number): string {
  const cap = (m: number) => {
    const a = mesAbrev(m)
    return a.charAt(0).toUpperCase() + a.slice(1)
  }
  return mesIni === mesFim ? `${cap(mesIni)}/${ano}` : `${cap(mesIni)}–${cap(mesFim)}/${ano}`
}

function formatVar(pct: number | null): string {
  if (pct == null) return '—'
  return `${pct > 0 ? '+' : ''}${formatPercent(pct)}`
}

/** Despesa subindo é ruim; resultado/receita subindo é bom. */
function corVariacao(pct: number | null, saida: boolean): string {
  if (pct == null || pct === 0) return 'text-slate-500'
  const bom = saida ? pct < 0 : pct > 0
  return bom ? 'text-emerald-700' : 'text-rose-700'
}

function Variacao({ atual, anterior, saida }: { atual: number; anterior: number; saida: boolean }) {
  const pct = variacaoPct(atual, anterior)
  const Icon = pct != null && pct < 0 ? ArrowDownRight : ArrowUpRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', corVariacao(pct, saida))}>
      {pct != null && pct !== 0 && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {formatVar(pct)}
    </span>
  )
}

function MesSelect({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (mes: number) => void
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800"
      >
        {MESES_NOME.slice(0, max).map((nome, i) => (
          <option key={nome} value={i + 1}>
            {nome}
          </option>
        ))}
      </select>
    </label>
  )
}

function SaidaCard({
  icon: Icon,
  label,
  descricao,
  atual,
  anterior,
  ano,
  muted = false,
}: {
  icon: React.ElementType
  label: string
  descricao: string
  atual: number
  anterior: number
  ano: number
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 shadow-sm sm:p-4',
        muted ? 'border-dashed border-slate-200 bg-slate-50/60' : 'border-slate-200/60 bg-white',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', muted ? 'text-slate-600' : 'text-slate-900')}>
        {formatCurrency(atual)}
      </p>
      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
        {ano - 1}: {formatCurrency(anterior)}
      </p>
      <p className="mt-1 text-xs">
        <Variacao atual={atual} anterior={anterior} saida /> <span className="text-slate-400">vs {ano - 1}</span>
      </p>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">{descricao}</p>
    </div>
  )
}

function DestaqueCard({
  titulo,
  linha,
  receitaAtual,
  receitaAnterior,
  ano,
}: {
  titulo: string
  linha: CascataLinha
  receitaAtual: number
  receitaAnterior: number
  ano: number
}) {
  const margemAtual = receitaAtual > 0 ? (linha.atual / receitaAtual) * 100 : null
  const margemAnterior = receitaAnterior > 0 ? (linha.anterior / receitaAnterior) * 100 : null
  const diffPp = margemAtual != null && margemAnterior != null ? margemAtual - margemAnterior : null
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums sm:text-2xl',
          linha.atual < 0 ? 'text-rose-700' : 'text-slate-900',
        )}
      >
        {formatCurrency(linha.atual)}
      </p>
      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
        {ano - 1}: {formatCurrency(linha.anterior)}
      </p>
      <p className="mt-1 text-xs">
        <Variacao atual={linha.atual} anterior={linha.anterior} saida={false} />{' '}
        <span className="text-slate-400">vs {ano - 1}</span>
      </p>
      {linha.margem && margemAtual != null && (
        <p className="mt-2 text-[11px] text-slate-500">
          {linha.margem}: <span className="font-semibold text-slate-700">{formatPercent(margemAtual)}</span>
          {diffPp != null && (
            <span className={cn('ml-1 font-semibold', diffPp >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
              ({diffPp >= 0 ? '+' : ''}
              {diffPp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.)
            </span>
          )}
        </p>
      )}
    </div>
  )
}

type ChartPoint = {
  mes: number
  label: string
  anterior: number
  atual: number
  varPct: number | null
}

function VarPctLabel(props: LabelProps & { serie: ChartPoint[] }) {
  const { x, y, width, index, serie } = props
  const p = index != null ? serie[index] : undefined
  if (!p || p.varPct == null || x == null || y == null) return null
  const cx = Number(x) + Number(width ?? 0) / 2
  const fill = p.varPct > 0 ? '#be123c' : '#047857'
  return (
    <text x={cx} y={Number(y) - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill={fill}>
      {formatVar(p.varPct).replace(',00', '')}
    </text>
  )
}

function OpexTooltip({
  active,
  payload,
  ano,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
  ano: number
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-800">{MESES_NOME[p.mes - 1]}</p>
      <p className="tabular-nums text-slate-600">
        {ano - 1}: <span className="font-semibold">{formatCurrency(p.anterior)}</span>
      </p>
      <p className="tabular-nums text-slate-600">
        {ano}: <span className="font-semibold">{formatCurrency(p.atual)}</span>
      </p>
      <p className="mt-1">
        <Variacao atual={p.atual} anterior={p.anterior} saida />
      </p>
    </div>
  )
}

export function ReceitaResultadoCaixaSection({ ano }: Props) {
  const { data: rows, isLoading, error } = useReceitaResultadoCaixa(ano)
  const mesAtual = mesAtualResultadoCaixa(ano)
  const [mesIni, setMesIni] = useState(1)
  const [mesFim, setMesFim] = useState(mesAtual)
  const chartRef = useRef<HTMLDivElement>(null)

  const ini = Math.min(mesIni, mesFim)
  const fim = Math.max(mesIni, mesFim)
  const parcial = fim === mesAtual && ano === new Date().getFullYear()

  const { atual, anterior, cascata, chartData } = useMemo(() => {
    const lista: ReceitaResultadoCaixaMesRow[] = rows ?? []
    const atual = somarResultadoCaixa(lista, ano, ini, fim)
    const anterior = somarResultadoCaixa(lista, ano - 1, ini, fim)
    const chartData: ChartPoint[] = []
    for (let mes = ini; mes <= fim; mes++) {
      const a = lista.find((r) => r.ano === ano && r.mes === mes)?.opex ?? 0
      const b = lista.find((r) => r.ano === ano - 1 && r.mes === mes)?.opex ?? 0
      chartData.push({
        mes,
        label: MESES_ABREV[mes - 1] + (parcial && mes === mesAtual ? '*' : ''),
        anterior: b,
        atual: a,
        varPct: variacaoPct(a, b),
      })
    }
    return { atual, anterior, cascata: buildCascataResultado(atual, anterior), chartData }
  }, [rows, ano, ini, fim, parcial, mesAtual])

  const linha = (key: string) => cascata.find((l) => l.key === key)!

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Scale className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Custos e resultado de caixa</h2>
            <p className="text-xs text-slate-500">
              {periodoLabel(ini, fim, ano)} vs {periodoLabel(ini, fim, ano - 1)} · base caixa (data de pagamento)
              {parcial && ' · mês corrente parcial (*)'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MesSelect label="De" value={mesIni} max={mesAtual} onChange={setMesIni} />
          <MesSelect label="Até" value={mesFim} max={mesAtual} onChange={setMesFim} />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar custos. Verifique se a função{' '}
          <code className="rounded bg-red-100/80 px-1 text-xs">receita_resultado_caixa_mensal</code> está aplicada no
          Supabase.
        </p>
      ) : isLoading || !rows ? (
        <div className="space-y-4">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
        </div>
      ) : (
        <>
          {/* OPEX mês a mês */}
          <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', OPEX_COLORS.realizado.bg)}>
                  <Wallet className={cn('h-4 w-4', OPEX_COLORS.realizado.text)} aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Despesas operacionais (OPEX) mês a mês</h3>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(atual.opex)} em {ano} vs {formatCurrency(anterior.opex)} em {ano - 1} ·{' '}
                    <Variacao atual={atual.opex} anterior={anterior.opex} saida />
                  </p>
                </div>
              </div>
              <ChartCopyButton containerRef={chartRef} />
            </div>
            <div ref={chartRef} className="bg-white">
              <div data-chart-legend className="mb-1 flex items-center justify-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OPEX_COLORS.anoAnterior.hex }} />
                  {ano - 1}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OPEX_COLORS.realizado.hex }} />
                  {ano}
                </span>
                <span className="text-slate-400">% acima da barra = variação vs {ano - 1}</span>
              </div>
              <div data-chart-plot className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 22, right: 8, bottom: 0, left: 8 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: RECEITA_CHART_AXIS.tick, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatCurrencyCompact(v)}
                      tick={{ fill: RECEITA_CHART_AXIS.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={76}
                    />
                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<OpexTooltip ano={ano} />} />
                    <Bar
                      dataKey="anterior"
                      name={String(ano - 1)}
                      fill={OPEX_COLORS.anoAnterior.hex}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="atual"
                      name={String(ano)}
                      fill={OPEX_COLORS.realizado.hex}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    >
                      <LabelList dataKey="atual" content={(p) => <VarPctLabel {...p} serie={chartData} />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Saídas fora do OPEX */}
          <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-start gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Banknote className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Saídas fora do OPEX</h3>
                <p className="text-xs text-slate-500">
                  Pagamentos que não são despesa operacional, mas saem do caixa · {periodoLabel(ini, fim, ano)}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SAIDAS_NAO_OPEX.map((s) => (
                <SaidaCard
                  key={s.key}
                  icon={ICONES_NAO_OPEX[s.key]}
                  label={s.label}
                  descricao={s.descricao}
                  atual={atual[s.key]}
                  anterior={anterior[s.key]}
                  ano={ano}
                />
              ))}
            </div>
            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Fora do cálculo do resultado
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SAIDAS_FORA_CALCULO.map((s) => (
                <SaidaCard
                  key={s.key}
                  icon={s.key === 'repasses' ? HandCoins : Landmark}
                  label={s.label}
                  descricao={s.descricao}
                  atual={atual[s.key]}
                  anterior={anterior[s.key]}
                  ano={ano}
                  muted
                />
              ))}
            </div>
          </section>

          {/* Cascata do resultado */}
          <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-start gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Scale className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Resultado de caixa (DRE gerencial)</h3>
                <p className="text-xs text-slate-500">
                  Receita Bruta − OPEX − saídas fora do OPEX = crescimento real do caixa ·{' '}
                  {periodoLabel(ini, fim, ano)} vs {periodoLabel(ini, fim, ano - 1)}
                </p>
              </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <DestaqueCard
                titulo="Receita Bruta"
                linha={linha('receita')}
                receitaAtual={atual.receita}
                receitaAnterior={anterior.receita}
                ano={ano}
              />
              <DestaqueCard
                titulo="Resultado Operacional de Caixa"
                linha={linha('resultado_operacional')}
                receitaAtual={atual.receita}
                receitaAnterior={anterior.receita}
                ano={ano}
              />
              <DestaqueCard
                titulo="Geração de Caixa Líquida"
                linha={linha('geracao_caixa_liquida')}
                receitaAtual={atual.receita}
                receitaAnterior={anterior.receita}
                ano={ano}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">Indicador</th>
                    <th className="px-3 py-2 text-right font-medium">{ano - 1}</th>
                    <th className="px-3 py-2 text-right font-medium">% receita</th>
                    <th className="px-3 py-2 text-right font-medium">{ano}</th>
                    <th className="px-3 py-2 text-right font-medium">% receita</th>
                    <th className="px-3 py-2 text-right font-medium">Variação</th>
                    <th className="py-2 pl-3 text-right font-medium">Var. %</th>
                  </tr>
                </thead>
                <tbody>
                  {cascata.map((l) => {
                    const resultado = l.tipo === 'resultado'
                    const pctRec = (v: number, rec: number) => (rec > 0 ? formatPercent((v / rec) * 100) : '—')
                    const diff = l.atual - l.anterior
                    return (
                      <tr
                        key={l.key}
                        className={cn(
                          'border-b border-slate-100 tabular-nums',
                          resultado && 'bg-slate-50 font-semibold text-slate-900',
                          l.tipo === 'receita' && 'font-semibold text-slate-900',
                          l.tipo === 'saida' && 'text-slate-600',
                        )}
                      >
                        <td className="whitespace-nowrap py-2 pr-3 text-left">{l.label}</td>
                        <td className={cn('whitespace-nowrap px-3 py-2 text-right', l.anterior < 0 && 'text-rose-700')}>
                          {formatCurrency(l.anterior)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-500">
                          {pctRec(l.anterior, anterior.receita)}
                        </td>
                        <td className={cn('whitespace-nowrap px-3 py-2 text-right', l.atual < 0 && 'text-rose-700')}>
                          {formatCurrency(l.atual)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-500">
                          {pctRec(l.atual, atual.receita)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                          {diff > 0 ? '+' : diff < 0 ? '−' : ''}
                          {formatCurrency(Math.abs(diff))}
                        </td>
                        <td className="whitespace-nowrap py-2 pl-3 text-right text-xs">
                          <Variacao atual={l.atual} anterior={l.anterior} saida={l.tipo === 'saida'} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-slate-400">
              Resultado Operacional de Caixa ≈ EBITDA em regime de caixa. Fluxo de Caixa Livre = resultado operacional
              após investimentos (CAPEX), movimentações financeiras e deduções. Geração de Caixa Líquida = o que sobrou
              após a distribuição aos sócios. Repasses a terceiros e transferências entre contas ficam fora da conta.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
