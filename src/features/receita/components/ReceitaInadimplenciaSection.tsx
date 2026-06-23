import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, ChevronRight, ClipboardList, DollarSign, Loader2, Percent, Target } from 'lucide-react'
import { formatCurrency } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type {
  ReceitaInadimplenciaDashboard,
  ReceitaInadimplenciaEvolucaoMes,
  ReceitaInadimplenciaGrupoMes,
  ReceitaInadimplenciaTopCliente,
  ReceitaInadimplenciaGrupoPeriodo,
} from '../types/receitaInadimplencia.types'
import { MESES_NOME, mesAbrev, mesMaxDisponivelInadimplencia, mesNome } from '../constants'
import { useReceitaInadimplencia } from '../hooks/useReceitaInadimplencia'
import { ReceitaInadimplenciaGrupoSheet } from './ReceitaInadimplenciaGrupoSheet'
import { ReceitaInadimplenciaClientesSheet } from './ReceitaInadimplenciaClientesSheet'
import { ReceitaInadimplenciaMesValorButton } from './ReceitaInadimplenciaMesValorButton'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  aplicarSelecaoGruposPeriodo,
  aplicarSelecaoGrupos,
  previstoMesEvolucao,
  type SelecaoGruposPorMes,
} from '../utils/receitaInadimplenciaCalc'

const NAVY = '#1a2744'
const GOLD = '#c9a227'
const CREAM = '#f4efe6'

const SELECT_CLASS =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

type Props = {
  ano: number
}

function periodoReferenciaLabel(data: ReceitaInadimplenciaDashboard): string {
  if (data.mes_fim <= 0) return '—'
  if (data.mes_inicio === data.mes_fim) return mesNome(data.mes_inicio)
  return `${mesNome(data.mes_inicio)} a ${mesNome(data.mes_fim)}`
}

function periodoCurtoLabel(data: ReceitaInadimplenciaDashboard): string {
  if (data.mes_fim <= 0) return '—'
  const ini = mesAbrev(data.mes_inicio).toUpperCase()
  const fim = mesAbrev(data.mes_fim).toUpperCase()
  return ini === fim ? `${ini}/${String(data.ano).slice(-2)}` : `${ini}-${fim}/${String(data.ano).slice(-2)}`
}

function IconCircle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white', className)}
      style={{ backgroundColor: NAVY }}
    >
      {children}
    </div>
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />
}

function LoadingSkeleton() {
  return (
    <section className="space-y-4">
      <SkeletonBlock className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
    </section>
  )
}

export function ReceitaInadimplenciaSection({ ano }: Props) {
  const mesMaxDefault = mesMaxDisponivelInadimplencia(ano)
  const [mesInicio, setMesInicio] = useState(1)
  const [mesFim, setMesFim] = useState(mesMaxDefault > 0 ? mesMaxDefault : 1)
  const [mesDetalhe, setMesDetalhe] = useState<number | null>(null)
  const [clientesSheetOpen, setClientesSheetOpen] = useState(false)
  const [gruposPeriodo, setGruposPeriodo] = useState<ReceitaInadimplenciaGrupoPeriodo[] | null>(null)
  const [gruposIncluidos, setGruposIncluidos] = useState<Set<string> | null>(null)
  const [gruposPorMes, setGruposPorMes] = useState<Record<number, ReceitaInadimplenciaGrupoMes[]>>({})
  const [selecaoPorMes, setSelecaoPorMes] = useState<SelecaoGruposPorMes>({})

  useEffect(() => {
    const max = mesMaxDisponivelInadimplencia(ano)
    setMesInicio(1)
    setMesFim(max > 0 ? max : 1)
    setMesDetalhe(null)
    setGruposPeriodo(null)
    setGruposIncluidos(null)
    setGruposPorMes({})
    setSelecaoPorMes({})
  }, [ano])

  useEffect(() => {
    setGruposPeriodo(null)
    setGruposIncluidos(null)
  }, [mesInicio, mesFim])

  const { data, isLoading, isFetching, error, refetch } = useReceitaInadimplencia(
    ano,
    mesInicio,
    mesFim,
  )

  const mesMax = data?.mes_max_disponivel ?? mesMaxDefault
  const mesesDisponiveis = useMemo(
    () => Array.from({ length: mesMax }, (_, i) => i + 1),
    [mesMax],
  )

  const handleMesInicio = (value: number) => {
    setMesInicio(value)
    if (value > mesFim) setMesFim(value)
  }

  const dashboard = useMemo(() => {
    if (!data || data.mes_fim <= 0) return null
    const comGrupos = aplicarSelecaoGrupos(data, gruposPorMes, selecaoPorMes)
    return aplicarSelecaoGruposPeriodo(comGrupos, gruposPeriodo, gruposIncluidos)
  }, [data, gruposPorMes, selecaoPorMes, gruposPeriodo, gruposIncluidos])

  const handleAplicarGrupos = (
    mes: number,
    grupos: ReceitaInadimplenciaGrupoMes[],
    incluidos: Set<string>,
  ) => {
    setGruposPorMes((prev) => ({ ...prev, [mes]: grupos }))
    setSelecaoPorMes((prev) => ({ ...prev, [mes]: incluidos }))
  }

  if (mesMaxDefault <= 0 && !isLoading) {
    return (
      <section className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        Ainda não há meses encerrados no ano {ano} para exibir inadimplência.
      </section>
    )
  }

  if (isLoading && !data) return <LoadingSkeleton />

  if (error) {
    return (
      <section className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        <p className="font-medium">Inadimplência indisponível</p>
        <p className="mt-1">{error.message}</p>
      </section>
    )
  }

  if (!dashboard) return null

  const periodoCurto = periodoCurtoLabel(dashboard)
  const periodoRef = periodoReferenciaLabel(dashboard)
  const primeiroMes = dashboard.evolucao[0]
  const ultimoMes = dashboard.evolucao[dashboard.evolucao.length - 1]
  const mesDetalheRow = mesDetalhe != null ? dashboard.evolucao.find((m) => m.mes === mesDetalhe) : null
  const mesDetalheBase =
    mesDetalhe != null && data
      ? data.evolucao.find((m: ReceitaInadimplenciaEvolucaoMes) => m.mes === mesDetalhe)
      : null

  return (
    <TooltipProvider delayDuration={200}>
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: NAVY }}>
            Inadimplência | {dashboard.ano}
          </h2>
          <p className="mt-1 text-sm font-medium" style={{ color: NAVY }}>
            Período de referência | {periodoRef}
            {isFetching && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-slate-400" />}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="inadimplencia-mes-inicio" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Mês inicial
            </label>
            <select
              id="inadimplencia-mes-inicio"
              value={mesInicio}
              onChange={(e) => handleMesInicio(Number(e.target.value))}
              className={cn(SELECT_CLASS, 'min-w-[132px]')}
            >
              {mesesDisponiveis.map((m) => (
                <option key={m} value={m} disabled={m > mesFim}>
                  {MESES_NOME[m - 1]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="inadimplencia-mes-fim" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Mês final
            </label>
            <select
              id="inadimplencia-mes-fim"
              value={mesFim}
              onChange={(e) => setMesFim(Number(e.target.value))}
              className={cn(SELECT_CLASS, 'min-w-[132px]')}
            >
              {mesesDisponiveis.filter((m) => m >= mesInicio).map((m) => (
                <option key={m} value={m}>
                  {MESES_NOME[m - 1]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setClientesSheetOpen(true)}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border border-slate-200/50 px-4 py-4 text-left shadow-sm transition-colors sm:gap-4 sm:px-5',
            'cursor-pointer hover:border-slate-300 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2',
          )}
          style={{ backgroundColor: CREAM }}
        >
          <IconCircle className="h-10 w-10 sm:h-11 sm:w-11">
            <DollarSign className="h-5 w-5" strokeWidth={2.5} />
          </IconCircle>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:text-[11px]">
              Inadimplência acumulada – {periodoCurto}
            </p>
            <p
              className={cn(
                'mt-1 text-xl font-bold tabular-nums sm:text-2xl',
                dashboard.clientes_ajustado && 'text-amber-800',
              )}
              style={dashboard.clientes_ajustado ? undefined : { color: GOLD }}
            >
              {formatCurrency(dashboard.valor_total_periodo)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
              Saldo do período por grupo (Σ vencimento − Σ pagamento) — somente clientes ativos — clique para ver
              empresas e títulos
              {dashboard.clientes_ajustado && (
                <span className="block text-amber-700/90">Total ajustado pela seleção de grupos</span>
              )}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </button>

        <div
          className="flex items-center gap-3 rounded-2xl border border-slate-200/50 px-4 py-4 shadow-sm sm:gap-4 sm:px-5"
          style={{ backgroundColor: CREAM }}
        >
          <IconCircle className="h-10 w-10 sm:h-11 sm:w-11">
            <Percent className="h-5 w-5" strokeWidth={2.5} />
          </IconCircle>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:text-[11px]">
              % de inadimplência
            </p>
            <p
              className="mt-1 text-xl font-bold tabular-nums sm:text-2xl"
              style={{ color: GOLD }}
            >
              {dashboard.pct_periodo.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
              Saldo proporcional do período ÷ previsto acumulado (regra planilha VIOS)
            </p>
          </div>
        </div>
      </div>

      <ReceitaInadimplenciaClientesSheet
        open={clientesSheetOpen}
        onOpenChange={setClientesSheetOpen}
        ano={dashboard.ano}
        mesInicio={dashboard.mes_inicio}
        mesFim={dashboard.mes_fim}
        periodoLabel={periodoCurto}
        incluidos={gruposIncluidos}
        onGruposLoaded={setGruposPeriodo}
        onIncluidosChange={setGruposIncluidos}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="overflow-hidden rounded-2xl border border-slate-200/50 shadow-sm"
          style={{ backgroundColor: CREAM }}
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <IconCircle className="h-10 w-10">
              <ClipboardList className="h-5 w-5" />
            </IconCircle>
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              5 maiores inadimplentes
            </h3>
          </div>

          <div className="overflow-x-auto px-4 pb-2">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-slate-300/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="pb-2 pl-1 pr-2">Grupo</th>
                  <th className="pb-2 pl-2 text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.top5.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-slate-500">
                      Nenhum inadimplente no período
                    </td>
                  </tr>
                ) : (
                  dashboard.top5.map((row: ReceitaInadimplenciaTopCliente, idx: number) => (
                    <tr key={`${row.cliente}-${idx}`} className="border-b border-slate-200/50 last:border-0">
                      <td className="py-2.5 pl-1 pr-2 font-medium text-slate-800">{row.cliente}</td>
                      <td className="py-2.5 pl-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatCurrency(row.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {dashboard.top5.length > 0 && (
                <tfoot>
                  <tr className="text-white" style={{ backgroundColor: NAVY }}>
                    <td className="rounded-bl-lg py-2.5 pl-3 pr-2 text-xs font-bold uppercase tracking-wide">
                      Total dos 5 maiores
                    </td>
                    <td className="rounded-br-lg py-2.5 pl-2 pr-3 text-right text-sm font-bold tabular-nums">
                      {formatCurrency(dashboard.top5_total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-slate-200/50 shadow-sm"
          style={{ backgroundColor: CREAM }}
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <IconCircle className="h-10 w-10">
              <BarChart3 className="h-5 w-5" />
            </IconCircle>
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: NAVY }}>
              Evolução da inadimplência
            </h3>
          </div>

          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr>
                  <th className="pb-2 pl-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    &nbsp;
                  </th>
                  {dashboard.evolucao.map((m: ReceitaInadimplenciaEvolucaoMes) => (
                    <th
                      key={m.mes}
                      className="pb-2 px-2 text-center text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: NAVY }}
                      title={m.congelado ? undefined : 'Valor calculado ao vivo — será congelado no próximo mês'}
                    >
                      {m.mes_label}
                      {!m.congelado && <span className="text-amber-600">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200/50">
                  <td className="py-2.5 pl-1 pr-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Valor (R$)
                  </td>
                  {dashboard.evolucao.map((m: ReceitaInadimplenciaEvolucaoMes) => (
                    <td key={`v-${m.mes}`} className="px-1 py-1.5 text-center sm:px-2">
                      <ReceitaInadimplenciaMesValorButton
                        ano={dashboard.ano}
                        mes={m.mes}
                        valor={m.valor}
                        ajustado={m.ajustado}
                        onClick={() => setMesDetalhe(m.mes)}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pl-1 pr-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    %
                  </td>
                  {dashboard.evolucao.map((m: ReceitaInadimplenciaEvolucaoMes) => (
                    <td key={`p-${m.mes}`} className="px-2 py-2.5 text-center font-bold tabular-nums" style={{ color: GOLD }}>
                      {m.pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Valores faturados no mês (vencimento) em inadimplência — clique no valor para selecionar grupos
              {dashboard.evolucao.some((m: ReceitaInadimplenciaEvolucaoMes) => !m.congelado) && (
                <span className="block text-amber-700/90">
                  * Mês ainda não congelado — valor calculado com dados atuais do VIOS
                </span>
              )}
              {dashboard.evolucao.some((m) => m.ajustado) && (
                <span className="block text-amber-800/90">
                  Valores destacados foram ajustados pela seleção manual de grupos
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {dashboard.destaque_reducao_pct != null && dashboard.destaque_reducao_pct > 0 && primeiroMes && ultimoMes && (
          <div
            className="flex items-start gap-4 rounded-2xl border border-slate-200/50 px-5 py-4 shadow-sm"
            style={{ backgroundColor: CREAM }}
          >
            <IconCircle>
              <Target className="h-5 w-5" />
            </IconCircle>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Destaque do período</p>
              <p className="mt-1 text-sm font-medium leading-snug text-slate-800">
                Redução de{' '}
                <span className="text-lg font-bold" style={{ color: GOLD }}>
                  {dashboard.destaque_reducao_pct}%
                </span>{' '}
                no valor da inadimplência de {primeiroMes.mes_label} para {ultimoMes.mes_label}/
                {String(dashboard.ano).slice(-2)}
              </p>
            </div>
          </div>
        )}

        <div
          className={cn(
            'flex items-start gap-4 rounded-2xl border border-slate-200/50 px-5 py-4 shadow-sm',
            dashboard.destaque_reducao_pct == null || dashboard.destaque_reducao_pct <= 0 ? 'md:col-span-2' : '',
          )}
          style={{ backgroundColor: CREAM }}
        >
          <IconCircle>
            <AlertTriangle className="h-5 w-5" />
          </IconCircle>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Concentração</p>
            <p className="mt-1 text-sm font-medium leading-snug text-slate-800">
              Os 5 maiores inadimplentes representam do total da inadimplência do período{' '}
              <span className="text-lg font-bold" style={{ color: GOLD }}>
                {dashboard.top5_pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </span>
            </p>
          </div>
        </div>
      </div>

      {mesDetalhe != null && mesDetalheRow && mesDetalheBase && (
        <ReceitaInadimplenciaGrupoSheet
          open={mesDetalhe != null}
          onOpenChange={(open) => {
            if (!open) setMesDetalhe(null)
          }}
          ano={dashboard.ano}
          mes={mesDetalhe}
          mesLabel={mesDetalheRow.mes_label}
          valorOriginal={mesDetalheBase.valor}
          previstoMes={
            mesDetalheBase?.previsto != null && mesDetalheBase.previsto > 0
              ? mesDetalheBase.previsto
              : previstoMesEvolucao(mesDetalheRow)
          }
          congeladoInicial={mesDetalheRow.congelado}
          congeladoEmInicial={mesDetalheRow.congelado_em ?? mesDetalheBase.congelado_em}
          incluidosInicial={selecaoPorMes[mesDetalhe]}
          onAplicar={handleAplicarGrupos}
          onCongelado={() => void refetch()}
        />
      )}
    </section>
    </TooltipProvider>
  )
}
