import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, ChevronRight, ClipboardList, DollarSign, Loader2, Percent, Target } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type {
  ReceitaInadimplenciaDashboard,
  ReceitaInadimplenciaEvolucaoMes,
  ReceitaInadimplenciaGrupoDepartamentoPeriodo,
  ReceitaInadimplenciaGrupoMes,
  ReceitaInadimplenciaTopCliente,
  ReceitaInadimplenciaGrupoPeriodo,
} from '../types/receitaInadimplencia.types'
import { MESES_NOME, mesAbrev, mesMaxDisponivelInadimplencia, mesNome, RECEITA_DEPARTAMENTO_LABELS, RECEITA_META_CONTRIBUICAO_AREA } from '../constants'
import { useReceitaInadimplencia } from '../hooks/useReceitaInadimplencia'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import { receitaService } from '../services/receitaService'
import { ReceitaInadimplenciaGrupoSheet } from './ReceitaInadimplenciaGrupoSheet'
import { ReceitaInadimplenciaClientesSheet } from './ReceitaInadimplenciaClientesSheet'
import { ReceitaInadimplenciaAreaGruposSheet } from './ReceitaInadimplenciaAreaGruposSheet'
import { ReceitaInadimplenciaMesValorButton } from './ReceitaInadimplenciaMesValorButton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ElementCopyButton } from '@/shared/components/ElementCopyButton'
import {
  aplicarSelecaoGruposPeriodo,
  aplicarSelecaoGrupos,
  calcularIncluidosEfetivosPeriodo,
  normalizarEvolucaoCalculada,
  previstoMesEvolucao,
  valorExibicaoEvolucao,
  type SelecaoGruposPorMes,
} from '../utils/receitaInadimplenciaCalc'
import { aplicarFiltroAreaInadimplencia } from '../utils/receitaInadimplenciaAreaFilter'

const NAVY = '#1a2744'
const GOLD = '#c9a227'
const CREAM = '#fdfbf7'

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
  const [areaSelecionada, setAreaSelecionada] = useState<string>('')
  const [areaGruposSheetOpen, setAreaGruposSheetOpen] = useState(false)
  const [areaGruposSheetMes, setAreaGruposSheetMes] = useState<number | null>(null)
  const pctCardRef = useRef<HTMLDivElement>(null)
  const acumuladaCardRef = useRef<HTMLDivElement>(null)
  const top5CardRef = useRef<HTMLDivElement>(null)
  const evolucaoCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const max = mesMaxDisponivelInadimplencia(ano)
    setMesInicio(1)
    setMesFim(max > 0 ? max : 1)
    setMesDetalhe(null)
    setGruposPeriodo(null)
    setGruposIncluidos(null)
    setGruposPorMes({})
    setSelecaoPorMes({})
    setAreaSelecionada('')
  }, [ano])

  useEffect(() => {
    setGruposPeriodo(null)
    setGruposIncluidos(null)
    setGruposPorMes({})
    setSelecaoPorMes({})
    setMesDetalhe(null)
  }, [mesInicio, mesFim])

  useEffect(() => {
    setMesDetalhe(null)
    setAreaGruposSheetOpen(false)
    setAreaGruposSheetMes(null)
  }, [areaSelecionada])

  const { data, isLoading, isFetching, error, refetch } = useReceitaInadimplencia(
    ano,
    mesInicio,
    mesFim,
  )

  useEffect(() => {
    if (!data || data.mes_fim <= 0) return
    let cancelled = false

    ;(async () => {
      try {
        const [selecoesMensais, gruposPeriodoSalvos, gruposPeriodoData] = await Promise.all([
          receitaInadimplenciaService.fetchSelecoesMesPeriodo(data.ano, data.mes_inicio, data.mes_fim),
          receitaInadimplenciaService.fetchSelecaoPeriodo(data.ano, data.mes_inicio, data.mes_fim),
          receitaInadimplenciaService.fetchGruposPeriodo(data.ano, data.mes_inicio, data.mes_fim),
        ])
        if (cancelled) return

        setGruposPeriodo(gruposPeriodoData)

        if (selecoesMensais.length > 0) {
          const selecao: SelecaoGruposPorMes = {}
          const porMes: Record<number, ReceitaInadimplenciaGrupoMes[]> = {}
          await Promise.all(
            selecoesMensais.map(async ({ mes, grupos_incluidos }) => {
              const grupos = await receitaInadimplenciaService.fetchGruposMes(data.ano, mes)
              if (cancelled) return
              porMes[mes] = grupos
              selecao[mes] = new Set(grupos_incluidos)
            }),
          )
          if (!cancelled) {
            setGruposPorMes(porMes)
            setSelecaoPorMes(selecao)
          }
        }

        if (gruposPeriodoSalvos && !cancelled) {
          setGruposIncluidos(new Set(gruposPeriodoSalvos))
        }
      } catch {
        // Mantém defaults do servidor se a tabela de seleção ainda não existir.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [data])

  const mesMax = data?.mes_max_disponivel ?? mesMaxDefault
  const mesesDisponiveis = useMemo(
    () => Array.from({ length: mesMax }, (_, i) => i + 1),
    [mesMax],
  )

  const handleMesInicio = (value: number) => {
    setMesInicio(value)
    if (value > mesFim) setMesFim(value)
  }

  const incluidosEfetivos = useMemo(() => {
    if (!data || data.mes_fim <= 0) return null
    return calcularIncluidosEfetivosPeriodo(
      data.mes_inicio,
      data.mes_fim,
      gruposPeriodo,
      gruposPorMes,
      selecaoPorMes,
      gruposIncluidos,
    )
  }, [data, gruposPeriodo, gruposPorMes, selecaoPorMes, gruposIncluidos])

  const dashboardConsolidado = useMemo(() => {
    if (!data || data.mes_fim <= 0) return null
    const comGrupos = aplicarSelecaoGrupos(data, gruposPorMes, selecaoPorMes)
    const comCalculo = normalizarEvolucaoCalculada(comGrupos)
    const comPeriodo = aplicarSelecaoGruposPeriodo(comCalculo, gruposPeriodo, incluidosEfetivos)
    if (comGrupos.evolucao.some((m) => m.ajustado) && !comPeriodo.clientes_ajustado) {
      return { ...comPeriodo, clientes_ajustado: true }
    }
    return comPeriodo
  }, [data, gruposPorMes, selecaoPorMes, gruposPeriodo, incluidosEfetivos])

  const mesesPeriodo = useMemo(() => {
    if (mesFim < mesInicio) return []
    return Array.from({ length: mesFim - mesInicio + 1 }, (_, i) => mesInicio + i)
  }, [mesInicio, mesFim])

  const areaKey = areaSelecionada || null

  const { data: deptPorMes, isLoading: deptAreaLoading, isError: deptAreaError, error: deptAreaErrorObj } = useQuery({
    queryKey: ['receita', 'inadimplencia', 'dept-area', ano, mesInicio, mesFim, areaKey],
    queryFn: async () => {
      const entries = await Promise.all(
        mesesPeriodo.map(async (mes) => {
          const rows = await receitaInadimplenciaService.fetchDepartamentosMes(ano, mes)
          return [mes, rows] as const
        }),
      )
      return Object.fromEntries(entries)
    },
    enabled: areaKey != null && mesesPeriodo.length > 0,
  })

  const { data: previstoDept, isLoading: previstoAreaLoading, isError: previstoAreaError, error: previstoAreaErrorObj } = useQuery({
    queryKey: ['receita', 'previsto-departamento', ano, 'inadimplencia-area'],
    queryFn: () => receitaService.fetchPrevistoPorDepartamento(ano),
    enabled: areaKey != null,
  })

  const { data: gruposDeptPorMes, isLoading: gruposDeptLoading, isError: gruposDeptError } = useQuery({
    queryKey: ['receita', 'inadimplencia', 'grupos-dept-area', ano, mesInicio, mesFim, areaKey],
    queryFn: async () => {
      const entries = await Promise.all(
        mesesPeriodo.map(async (mes) => {
          const rows = await receitaInadimplenciaService.fetchGruposDepartamentoMes(ano, mes, true)
          return [mes, rows] as const
        }),
      )
      return Object.fromEntries(entries) as Record<number, ReceitaInadimplenciaGrupoDepartamentoPeriodo[]>
    },
    enabled: areaKey != null && mesesPeriodo.length > 0,
  })

  const { data: gruposAreaPorMes, isLoading: gruposAreaLoading } = useQuery({
    queryKey: ['receita', 'inadimplencia', 'grupos-area', ano, mesInicio, mesFim, areaKey],
    queryFn: async () => {
      const entries = await Promise.all(
        mesesPeriodo.map(async (mes) => {
          const rows = await receitaInadimplenciaService.fetchGruposMes(ano, mes, true)
          return [mes, rows] as const
        }),
      )
      return Object.fromEntries(entries) as Record<number, ReceitaInadimplenciaGrupoMes[]>
    },
    enabled: areaKey != null && mesesPeriodo.length > 0,
  })

  const areaFilterPending =
    areaKey != null && (deptAreaLoading || previstoAreaLoading)

  const areaFilterError =
    areaKey != null
      ? deptAreaError
        ? deptAreaErrorObj
        : previstoAreaError
          ? previstoAreaErrorObj
          : null
      : null

  const dashboard = useMemo(() => {
    if (!dashboardConsolidado) return null
    if (!areaKey) return dashboardConsolidado
    if (!deptPorMes || !previstoDept) return null
    return aplicarFiltroAreaInadimplencia(
      dashboardConsolidado,
      areaKey,
      deptPorMes,
      previstoDept,
      gruposDeptPorMes ?? {},
      gruposAreaPorMes ?? {},
      mesesPeriodo,
    )
  }, [dashboardConsolidado, areaKey, deptPorMes, previstoDept, gruposDeptPorMes, gruposAreaPorMes, mesesPeriodo])

  const abrirDetalheAreaPeriodo = () => {
    setAreaGruposSheetMes(null)
    setAreaGruposSheetOpen(true)
  }

  const abrirDetalheAreaMes = (mes: number) => {
    setAreaGruposSheetMes(mes)
    setAreaGruposSheetOpen(true)
  }

  const handleAplicarGrupos = (
    mes: number,
    grupos: ReceitaInadimplenciaGrupoMes[],
    incluidos: Set<string>,
  ) => {
    setGruposPorMes((prev) => ({ ...prev, [mes]: grupos }))
    setSelecaoPorMes((prev) => ({ ...prev, [mes]: incluidos }))
    void receitaInadimplenciaService
      .salvarSelecaoMes(ano, mes, [...incluidos])
      .catch(() => {
        // Falha silenciosa: estado local permanece até próximo refresh.
      })
    if (!gruposPeriodo && data) {
      void receitaInadimplenciaService
        .fetchGruposPeriodo(data.ano, data.mes_inicio, data.mes_fim)
        .then(setGruposPeriodo)
        .catch(() => {})
    }
  }

  const handleAplicarSelecaoPeriodo = (incluidos: Set<string>) => {
    setGruposIncluidos(incluidos)
    if (!data) return
    void receitaInadimplenciaService
      .salvarSelecaoPeriodo(data.ano, data.mes_inicio, data.mes_fim, [...incluidos])
      .catch(() => {})
  }

  if (mesMaxDefault <= 0 && !isLoading) {
    return (
      <section className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        Ainda não há meses disponíveis no ano {ano} para exibir inadimplência.
      </section>
    )
  }

  if (isLoading && !data) return <LoadingSkeleton />

  if (error && !data) {
    return (
      <section className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        <p className="font-medium">Inadimplência indisponível</p>
        <p className="mt-1">{error.message}</p>
      </section>
    )
  }

  if (!data || data.mes_fim <= 0) return null

  const areaLabel = areaKey ? RECEITA_DEPARTAMENTO_LABELS[areaKey] : null
  const periodoBase = {
    ano: data.ano,
    mes_inicio: mesInicio,
    mes_fim: mesFim,
  } as ReceitaInadimplenciaDashboard
  const periodoRefPreview = areaLabel
    ? `${periodoReferenciaLabel(periodoBase)} · ${areaLabel}`
    : periodoReferenciaLabel(periodoBase)

  if (areaFilterPending) {
    return (
      <section className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: NAVY }}>
              Inadimplência | {data.ano}
            </h2>
            <p className="mt-1 text-sm font-medium" style={{ color: NAVY }}>
              Período de referência | {periodoRefPreview}
              <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-slate-400" />
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="inadimplencia-area" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Área
              </label>
              <select
                id="inadimplencia-area"
                value={areaSelecionada}
                onChange={(e) => setAreaSelecionada(e.target.value)}
                className={cn(SELECT_CLASS, 'min-w-[168px]')}
              >
                <option value="">Todas as áreas</option>
                {RECEITA_META_CONTRIBUICAO_AREA.map((a) => (
                  <option key={a.key} value={a.key}>
                    {RECEITA_DEPARTAMENTO_LABELS[a.key] ?? a.key}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="inadimplencia-mes-inicio-pending" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Mês inicial
              </label>
              <select
                id="inadimplencia-mes-inicio-pending"
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
              <label htmlFor="inadimplencia-mes-fim-pending" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Mês final
              </label>
              <select
                id="inadimplencia-mes-fim-pending"
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
        <LoadingSkeleton />
      </section>
    )
  }

  if (areaFilterError) {
    return (
      <section className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: NAVY }}>
              Inadimplência | {data.ano}
            </h2>
            <p className="mt-1 text-sm font-medium" style={{ color: NAVY }}>
              Período de referência | {periodoRefPreview}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="inadimplencia-area-err" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Área
              </label>
              <select
                id="inadimplencia-area-err"
                value={areaSelecionada}
                onChange={(e) => setAreaSelecionada(e.target.value)}
                className={cn(SELECT_CLASS, 'min-w-[168px]')}
              >
                <option value="">Todas as áreas</option>
                {RECEITA_META_CONTRIBUICAO_AREA.map((a) => (
                  <option key={a.key} value={a.key}>
                    {RECEITA_DEPARTAMENTO_LABELS[a.key] ?? a.key}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">Não foi possível filtrar por área</p>
          <p className="mt-1">{areaFilterError.message}</p>
          <button
            type="button"
            onClick={() => setAreaSelecionada('')}
            className="mt-3 text-sm font-medium text-amber-900 underline underline-offset-2"
          >
            Voltar para todas as áreas
          </button>
        </div>
      </section>
    )
  }

  if (!dashboard) return null

  const periodoCurto = periodoCurtoLabel(dashboard)
  const periodoRef = areaLabel
    ? `${periodoReferenciaLabel(dashboard)} · ${areaLabel}`
    : periodoReferenciaLabel(dashboard)
  const filtroAreaAtivo = areaKey != null
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
            {(isFetching || areaFilterPending) && (
              <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-slate-400" />
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="inadimplencia-area" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Área
            </label>
            <select
              id="inadimplencia-area"
              value={areaSelecionada}
              onChange={(e) => setAreaSelecionada(e.target.value)}
              className={cn(SELECT_CLASS, 'min-w-[168px]')}
            >
              <option value="">Todas as áreas</option>
              {RECEITA_META_CONTRIBUICAO_AREA.map((a) => (
                <option key={a.key} value={a.key}>
                  {RECEITA_DEPARTAMENTO_LABELS[a.key] ?? a.key}
                </option>
              ))}
            </select>
          </div>
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
        <div className="relative w-full self-start">
          <div className="relative">
            <div
              ref={acumuladaCardRef}
              data-chart-export-preserve-bg
              data-chart-export-bg={CREAM}
              data-chart-export-fit-content
              className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/50 px-4 py-4 shadow-sm sm:gap-4 sm:px-5"
              style={{ backgroundColor: CREAM }}
            >
              <IconCircle className="h-10 w-10 sm:h-11 sm:w-11">
                <DollarSign className="h-5 w-5" strokeWidth={2.5} />
              </IconCircle>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:text-[11px]">
                  Inadimplência R$ - {periodoCurto}
                </p>
                <p
                  className={cn(
                    'mt-1 text-xl font-bold tabular-nums sm:text-2xl',
                    (dashboard.clientes_ajustado || dashboard.evolucao.some((m) => m.ajustado)) &&
                      'text-amber-800',
                  )}
                  style={
                    dashboard.clientes_ajustado || dashboard.evolucao.some((m) => m.ajustado)
                      ? undefined
                      : { color: GOLD }
                  }
                >
                  {formatCurrency(dashboard.valor_total_periodo)}
                </p>
                {(!filtroAreaAtivo ||
                  dashboard.clientes_ajustado ||
                  (!dashboard.clientes_ajustado && dashboard.evolucao.some((m) => m.ajustado))) && (
                  <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                    {!filtroAreaAtivo &&
                      'Soma da inadimplência mensal no período (mesma regra da evolução) — clique para ver empresas e títulos'}
                    {dashboard.clientes_ajustado && (
                      <span className="block text-amber-700/90">Total ajustado pela seleção de grupos</span>
                    )}
                    {!dashboard.clientes_ajustado && dashboard.evolucao.some((m) => m.ajustado) && (
                      <span className="block text-amber-700/90">
                        Total ajustado pela seleção mensal de grupos
                      </span>
                    )}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => (filtroAreaAtivo ? abrirDetalheAreaPeriodo() : setClientesSheetOpen(true))}
              className="absolute inset-0 z-10 cursor-pointer rounded-2xl hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-inset"
              aria-label={`Ver detalhes inadimplência acumulada ${periodoCurto}`}
            />
          </div>
          <div className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4" data-chart-export-ignore>
            <ElementCopyButton containerRef={acumuladaCardRef} preserveBackground />
          </div>
        </div>

        <div className="relative w-full self-start">
          <div
            ref={pctCardRef}
            data-chart-export-preserve-bg
            data-chart-export-bg={CREAM}
            data-chart-export-fit-content
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/50 px-4 py-4 shadow-sm sm:gap-4 sm:px-5"
            style={{ backgroundColor: CREAM }}
          >
            <IconCircle className="h-10 w-10 sm:h-11 sm:w-11">
              <Percent className="h-5 w-5" strokeWidth={2.5} />
            </IconCircle>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:text-[11px]">
                Resultado % de inadimplência
              </p>
              <p
                className="mt-1 text-xl font-bold tabular-nums sm:text-2xl"
                style={{ color: GOLD }}
              >
                {formatPercent(dashboard.pct_periodo)}
              </p>
              {!filtroAreaAtivo && (
                <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                  Saldo proporcional do período ÷ previsto acumulado — inclui clientes inativos (regra planilha VIOS)
                </p>
              )}
            </div>
          </div>
          <div className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4" data-chart-export-ignore>
            <ElementCopyButton containerRef={pctCardRef} preserveBackground />
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
        incluidos={gruposIncluidos ?? incluidosEfetivos}
        onGruposLoaded={setGruposPeriodo}
        onIncluidosChange={setGruposIncluidos}
        onAplicarSelecao={handleAplicarSelecaoPeriodo}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          ref={top5CardRef}
          data-chart-export-preserve-bg
          data-chart-export-bg={CREAM}
          className="w-full self-start overflow-hidden rounded-2xl border border-slate-200/50 shadow-sm"
          style={{ backgroundColor: CREAM }}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <IconCircle className="h-10 w-10">
                <ClipboardList className="h-5 w-5" />
              </IconCircle>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: NAVY }}>
                5 maiores inadimplentes
              </h3>
            </div>
            <div data-chart-export-ignore>
              <ElementCopyButton containerRef={top5CardRef} preserveBackground />
            </div>
          </div>

          <p className="px-5 pb-2 text-[11px] text-slate-500">
            {filtroAreaAtivo
              ? 'Parcela do grupo alocada à área (mesma base dos KPIs — inclui inativos)'
              : 'Somente clientes ativos'}
          </p>

          <div className="overflow-x-auto px-4 pb-2">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-slate-300/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <th className="pb-2 pl-1 pr-2">Grupo</th>
                  <th className="pb-2 pl-2 text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {filtroAreaAtivo && (gruposDeptLoading || gruposAreaLoading) ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando ranking por área…
                    </td>
                  </tr>
                ) : filtroAreaAtivo && gruposDeptError ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-amber-800">
                      Não foi possível carregar o ranking por área.
                    </td>
                  </tr>
                ) : dashboard.top5.length === 0 ? (
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
          ref={evolucaoCardRef}
          data-chart-export-preserve-bg
          data-chart-export-bg={CREAM}
          data-chart-export-expand-width
          className="w-full self-start overflow-hidden rounded-2xl border border-slate-200/50 shadow-sm"
          style={{ backgroundColor: CREAM }}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <IconCircle className="h-10 w-10">
                <BarChart3 className="h-5 w-5" />
              </IconCircle>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: NAVY }}>
                Evolução da inadimplência
              </h3>
            </div>
            <div data-chart-export-ignore>
              <ElementCopyButton containerRef={evolucaoCardRef} preserveBackground />
            </div>
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
                  {dashboard.evolucao.map((m: ReceitaInadimplenciaEvolucaoMes) => {
                    const exibicao = valorExibicaoEvolucao(m)
                    return (
                    <td key={`v-${m.mes}`} className="px-1 py-1.5 text-center sm:px-2">
                      <ReceitaInadimplenciaMesValorButton
                        ano={dashboard.ano}
                        mes={m.mes}
                        valor={exibicao.valor}
                        ajustado={m.ajustado}
                        onClick={() =>
                          filtroAreaAtivo ? abrirDetalheAreaMes(m.mes) : setMesDetalhe(m.mes)
                        }
                        title={
                          filtroAreaAtivo
                            ? 'Ver grupos alocados à área neste mês'
                            : undefined
                        }
                      />
                    </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="py-2.5 pl-1 pr-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    %
                  </td>
                  {dashboard.evolucao.map((m: ReceitaInadimplenciaEvolucaoMes) => (
                    <td key={`p-${m.mes}`} className="px-2 py-2.5 text-center font-bold tabular-nums" style={{ color: GOLD }}>
                      {formatPercent(valorExibicaoEvolucao(m).pct)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {!filtroAreaAtivo && (
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Valores faturados no mês (vencimento) em inadimplência — inclui clientes inativos — clique no valor para selecionar grupos
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
            )}
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
                  {formatPercent(dashboard.destaque_reducao_pct)}
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
                {filtroAreaAtivo && (gruposDeptLoading || gruposAreaLoading) ? (
                  <Loader2 className="inline h-4 w-4 animate-spin" />
                ) : (
                  formatPercent(dashboard.top5_pct)
                )}
              </span>
            </p>
          </div>
        </div>
      </div>

      {filtroAreaAtivo && areaKey && deptPorMes && (
        <ReceitaInadimplenciaAreaGruposSheet
          open={areaGruposSheetOpen}
          onOpenChange={setAreaGruposSheetOpen}
          areaKey={areaKey}
          areaLabel={areaLabel ?? areaKey}
          ano={dashboard.ano}
          mesInicio={dashboard.mes_inicio}
          mesFim={dashboard.mes_fim}
          mesDetalhe={areaGruposSheetMes}
          periodoLabel={periodoCurto}
          valorTotal={
            areaGruposSheetMes != null
              ? (dashboard.evolucao.find((m) => m.mes === areaGruposSheetMes)?.valor ?? 0)
              : dashboard.valor_total_periodo
          }
          gruposDeptPorMes={gruposDeptPorMes ?? {}}
          gruposPorMes={gruposAreaPorMes ?? {}}
          loading={gruposDeptLoading || gruposAreaLoading}
        />
      )}

      {mesDetalhe != null && mesDetalheRow && mesDetalheBase && !filtroAreaAtivo && (
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
