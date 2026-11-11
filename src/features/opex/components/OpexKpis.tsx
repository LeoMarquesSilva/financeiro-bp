import { ArrowDownRight, ArrowUpRight, CalendarRange, GitCompareArrows, Target, TrendingDown, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { OPEX_COLORS } from '../constants'
import { formatPeriodoOpex, temFiltroMeses, yoyPct } from '../utils/opexPeriodo'
import type { OpexKpis, OpexMesRow } from '../types/opex.types'
import type { OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'
import type { FenixExplicar } from '@/shared/fenix/fenix.types'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import {
  explicarOpexOrcamentoAno,
  explicarOpexOrcamentoPeriodo,
  explicarOpexProjecao,
  explicarOpexRealizado,
  explicarOpexVariacao,
  explicarOpexVsAnoAnterior,
  type OpexFenixContexto,
} from '../fenix/opexFenix'

type Props = {
  kpis: OpexKpis
  ano: number
  mesAtual: number
  mesesFiltro: number[]
  orcamentoImportado?: boolean
  loading?: boolean
  realizadoAnoAnterior?: number
  loadingAnoAnterior?: boolean
  /** Evolução mensal do mesmo dashboard (Fênix abre a conta mês a mês). */
  evolucao?: OpexMesRow[]
  /** Filtro de plano de contas aplicado (Fênix cita o que está oculto). */
  planoFiltro?: OpexPlanoFiltroState
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  fenix,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent: string
  fenix?: { chave: string; explicar: FenixExplicar }
}) {
  const fenixId = useFenixAlvo(fenix?.chave, fenix?.explicar)
  return (
    <div data-fenix={fenixId} className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn('mt-1 text-xl font-bold tabular-nums sm:text-2xl', accent)}>{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', OPEX_COLORS.realizado.bg)}>
          <Icon className={cn('h-4 w-4', accent)} aria-hidden />
        </span>
      </div>
    </div>
  )
}

export function OpexKpis({
  kpis,
  ano,
  mesAtual,
  mesesFiltro,
  orcamentoImportado,
  loading,
  realizadoAnoAnterior,
  loadingAnoAnterior,
  evolucao,
  planoFiltro,
}: Props) {
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const varianciaPositiva = kpis.variancia_ytd_pct > 0
  const periodoLabel = formatPeriodoOpex(mesesFiltro, mesAtual, ano)
  const periodoAnoAnterior = formatPeriodoOpex(mesesFiltro, mesAtual, ano - 1)
  const umMes = filtroAtivo && mesesFiltro.length === 1
  const anterior = realizadoAnoAnterior ?? 0
  const yoy = yoyPct(kpis.realizado_ytd, anterior)
  const yoySubiu = (yoy ?? 0) > 0

  const fenixCtx: OpexFenixContexto = {
    ano,
    mesAtual,
    mesesFiltro,
    periodo: periodoLabel,
    orcamentoImportado: Boolean(orcamentoImportado),
    evolucao,
    planoFiltro,
  }
  const tituloVariacao = filtroAtivo ? (umMes ? 'Variação do mês' : 'Variação do período') : 'Variação YTD'
  const fenixVariacao = useFenixAlvo(
    loading ? undefined : 'opex.kpis.variacao',
    loading ? undefined : () => explicarOpexVariacao(kpis, fenixCtx, tituloVariacao),
  )
  const fenixAnoAnterior = useFenixAlvo(
    loading || loadingAnoAnterior ? undefined : 'opex.kpis.ano_anterior',
    loading || loadingAnoAnterior
      ? undefined
      : () => explicarOpexVsAnoAnterior({ ctx: fenixCtx, atual: kpis.realizado_ytd, anterior, yoy, periodoAnterior: periodoAnoAnterior }),
  )

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  const tituloRealizado = filtroAtivo ? (umMes ? 'Realizado no mês' : 'Realizado no período') : 'Realizado no período'
  const tituloOrcamento = filtroAtivo ? (umMes ? 'Orçamento no mês' : 'Orçamento no período') : 'Orçamento no período'

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        label={tituloRealizado}
        value={formatCurrency(kpis.realizado_ytd)}
        sub={periodoLabel}
        icon={Wallet}
        accent={OPEX_COLORS.realizado.text}
        fenix={{ chave: 'opex.kpis.realizado', explicar: () => explicarOpexRealizado(kpis, fenixCtx, tituloRealizado) }}
      />
      <KpiCard
        label={tituloOrcamento}
        value={formatCurrency(kpis.previsto_ytd)}
        fenix={{
          chave: 'opex.kpis.orcamento',
          explicar: () => explicarOpexOrcamentoPeriodo(kpis, fenixCtx, tituloOrcamento),
        }}
        sub={
          orcamentoImportado
            ? `Previsto VIOS: ${formatCurrency(kpis.previsto_vios_ytd)}`
            : 'Orçamento não importado — usando VIOS'
        }
        icon={Target}
        accent="text-slate-800"
      />
      <KpiCard
        label={filtroAtivo ? 'Orçamento no ano' : 'Projeção até dez'}
        value={formatCurrency(filtroAtivo ? kpis.previsto_ano : kpis.projetado_ano)}
        sub={
          orcamentoImportado
            ? `Previsto VIOS anual: ${formatCurrency(kpis.previsto_vios_ano)}`
            : filtroAtivo
              ? 'Compromissos anuais por vencimento'
              : 'Realizado + orçamento futuro'
        }
        icon={CalendarRange}
        accent={OPEX_COLORS.projetado.text}
        fenix={
          filtroAtivo
            ? { chave: 'opex.kpis.orcamento_ano', explicar: () => explicarOpexOrcamentoAno(kpis, fenixCtx) }
            : { chave: 'opex.kpis.projecao', explicar: () => explicarOpexProjecao(kpis, fenixCtx) }
        }
      />
      <div data-fenix={fenixVariacao} className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {tituloVariacao}
            </p>
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-xl font-bold tabular-nums sm:text-2xl',
                varianciaPositiva ? 'text-rose-700' : 'text-emerald-700',
              )}
            >
              {varianciaPositiva ? (
                <ArrowUpRight className="h-5 w-5" aria-hidden />
              ) : (
                <ArrowDownRight className="h-5 w-5" aria-hidden />
              )}
              {formatPercent(Math.abs(kpis.variancia_ytd_pct))}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {filtroAtivo ? 'Realizado vs orçamento no período selecionado' : 'Realizado vs orçamento no período'}
            </p>
          </div>
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', 'bg-slate-100')}>
            <TrendingDown className="h-4 w-4 text-slate-600" aria-hidden />
          </span>
        </div>
      </div>
      <div data-fenix={fenixAnoAnterior} className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Vs. ano anterior
            </p>
            {loadingAnoAnterior ? (
              <p className="mt-1 text-xl font-bold text-slate-300 sm:text-2xl">…</p>
            ) : yoy == null ? (
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-400 sm:text-2xl">—</p>
            ) : (
              <p
                className={cn(
                  'mt-1 flex items-center gap-1 text-xl font-bold tabular-nums sm:text-2xl',
                  yoy === 0 ? 'text-slate-600' : yoySubiu ? 'text-rose-700' : 'text-emerald-700',
                )}
              >
                {yoy === 0 ? null : yoySubiu ? (
                  <ArrowUpRight className="h-5 w-5" aria-hidden />
                ) : (
                  <ArrowDownRight className="h-5 w-5" aria-hidden />
                )}
                {formatPercent(Math.abs(yoy))}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {loadingAnoAnterior
                ? `Carregando ${ano - 1}…`
                : yoy == null
                  ? `Sem realizado em ${periodoAnoAnterior}`
                  : `Realizado ${ano - 1}: ${formatCurrency(anterior)} · ${periodoAnoAnterior}`}
            </p>
          </div>
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', OPEX_COLORS.anoAnterior.bg)}>
            <GitCompareArrows className={cn('h-4 w-4', OPEX_COLORS.anoAnterior.text)} aria-hidden />
          </span>
        </div>
      </div>
    </div>
  )
}
