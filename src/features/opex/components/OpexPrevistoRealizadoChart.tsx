import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CalendarRange,
  Download,
  GitCompareArrows,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import { MESES_CURTOS, OPEX_COLORS } from '../constants'
import { useOpexMesGrupos } from '../hooks/useOpexMesGrupos'
import { useOpexGrupoDePara } from '../hooks/useOpexGrupoDePara'
import { opexService } from '../services/opexService'
import { exportOpexMesGruposExcel } from '../utils/opexMesGruposExport'
import { aplicarDeParaLinhas, origensDoDestino, mergePlanosGrupo } from '../utils/opexDePara'
import { mesesFiltroKey, planoFiltroKey, temFiltroMeses, yoyPct } from '../utils/opexPeriodo'
import { projetadoRestanteFixas } from '../utils/opexProjecao'
import type { OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'
import type { OpexMesGrupoRow, OpexMesRow, OpexPlanoRow } from '../types/opex.types'
import { OpexPlanoTitulos } from './OpexPlanoTitulos'

type Props = {
  rows: OpexMesRow[]
  mesAtual: number
  ano: number
  mesesFiltro: number[]
  orcamentoImportado?: boolean
  planoFiltro?: OpexPlanoFiltroState
}

type DrillBarRow = {
  key: string
  label: string
  previsto: number
  realizado: number
  projetado: number
  realizadoTotal: number
  realizadoAnterior: number
  variacao: number
  variacaoYoY: number
}

const PROJETADO_BARRA = '#fdba74'

const Y_AXIS_WIDTH = 248
const Y_AXIS_LINE_CHARS = 26

function formatAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function wrapAxisLabel(label: string, maxChars = Y_AXIS_LINE_CHARS): string[] {
  const text = label.trim().replace(/\//g, ' / ')
  if (text.length <= maxChars) return [text]

  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)

  if (lines.length <= 2) return lines
  const rest = lines.slice(1).join(' ')
  return [lines[0], rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest]
}

function clickPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  if (rec.payload && typeof rec.payload === 'object') {
    return rec.payload as Record<string, unknown>
  }
  return rec
}

type VariacaoSort = 'off' | 'desc' | 'asc'
type DrillPeriodo = number | 'ano' | null

function nextVariacaoSort(atual: VariacaoSort): VariacaoSort {
  if (atual === 'off') return 'desc'
  if (atual === 'desc') return 'asc'
  return 'off'
}

function sortByVariacao<T extends { variacao: number; variacaoYoY: number }>(
  rows: T[],
  modo: VariacaoSort,
  porYoY = false,
): T[] {
  if (modo === 'off') return rows
  const sign = modo === 'desc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = porYoY ? a.variacaoYoY : a.variacao
    const bv = porYoY ? b.variacaoYoY : b.variacao
    return sign * (bv - av)
  })
}

function mergeDrillYoY(
  atual: Array<{ key: string; label: string; previsto: number; realizado: number; projetado?: number; variacao: number }>,
  anterior: Array<{ key: string; realizado: number }>,
): DrillBarRow[] {
  const prevMap = new Map(anterior.map((row) => [row.key, row.realizado]))
  const keys = new Set([...atual.map((row) => row.key), ...anterior.map((row) => row.key)])
  return [...keys].map((key) => {
    const cur = atual.find((row) => row.key === key)
    const realizado = cur?.realizado ?? 0
    const projetado = cur?.projetado ?? 0
    const previsto = cur?.previsto ?? 0
    const realizadoAnterior = prevMap.get(key) ?? 0
    const realizadoAno = realizado + projetado
    return {
      key,
      label: cur?.label ?? key,
      previsto,
      realizado,
      projetado,
      realizadoTotal: realizadoAno,
      realizadoAnterior,
      variacao: cur?.variacao ?? realizadoAno - previsto,
      variacaoYoY: realizadoAno - realizadoAnterior,
    }
  })
}

function variacaoClass(valor: number): string {
  if (valor > 0) return 'text-rose-700'
  if (valor < 0) return 'text-emerald-700'
  return 'text-slate-600'
}

function OpexBarValueLabel({
  x,
  y,
  width,
  value,
  color = '#334155',
}: {
  x?: number | string
  y?: number | string
  width?: number | string
  value?: number | string | null
  color?: string
}) {
  const nx = Number(x)
  const ny = Number(y)
  const nw = Number(width)
  const n = Number(value)
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nw) || !n || n <= 0) return null
  return (
    <text
      x={nx + nw / 2}
      y={ny - 6}
      textAnchor="middle"
      fill={color}
      fontSize={10}
      fontWeight={600}
    >
      {formatCurrencyCompact(n)}
    </text>
  )
}

function opexCompactLabel(value: unknown): string {
  const n = Number(value)
  return n > 0 ? formatCurrencyCompact(n) : ''
}

const OPEX_END_LABEL = {
  position: 'right' as const,
  offset: 6,
  formatter: opexCompactLabel,
  fontSize: 10,
  fontWeight: 600,
}

function renderOpexBarLabel(color: string) {
  return (props: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }) => (
    <OpexBarValueLabel {...props} value={props.value as number | string | null | undefined} color={color} />
  )
}

function OpexHorizontalCompareChart({
  data,
  onBarClick,
  compararAnoAnterior,
  ano,
  anoAnterior,
  mostrarProjecao = false,
}: {
  data: DrillBarRow[]
  onBarClick: (row: DrillBarRow) => void
  compararAnoAnterior: boolean
  ano: number
  anoAnterior: number
  mostrarProjecao?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 12, right: 88, top: 8, bottom: 4 }}
        barCategoryGap="22%"
        barGap={4}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
        <XAxis type="number" tickFormatter={formatAxis} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={Y_AXIS_WIDTH}
          interval={0}
          axisLine={false}
          tickLine={false}
          tick={({ y, payload, index }) => {
            const row = data[index]
            const full = row?.label ?? String(payload.value)
            const lines = wrapAxisLabel(full)
            const lineHeight = 13
            const startY = Number(y) - ((lines.length - 1) * lineHeight) / 2 + 4
            return (
              <g
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (row) onBarClick(row)
                }}
              >
                <title>{full}</title>
                {lines.map((line, lineIndex) => (
                  <text
                    key={`${lineIndex}-${line}`}
                    x={Y_AXIS_WIDTH - 10}
                    y={startY + lineIndex * lineHeight}
                    textAnchor="end"
                    fontSize={11}
                    fill="#334155"
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          }}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
            String(name),
          ]}
          labelFormatter={(_, payload) => {
            const item = payload?.[0]?.payload as DrillBarRow | undefined
            return item?.label ?? ''
          }}
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', maxWidth: 320 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {compararAnoAnterior ? (
          <>
            <Bar
              dataKey="realizadoAnterior"
              name={`Realizado ${anoAnterior}`}
              fill={OPEX_COLORS.anoAnterior.hex}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              <LabelList dataKey="realizadoAnterior" fill="#475569" {...OPEX_END_LABEL} />
            </Bar>
            <Bar
              dataKey="realizado"
              name={`Realizado ${ano}`}
              fill={OPEX_COLORS.realizado.hex}
              stackId={mostrarProjecao ? 'ano' : undefined}
              radius={mostrarProjecao ? [0, 0, 0, 0] : [0, 4, 4, 0]}
              maxBarSize={14}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              {!mostrarProjecao && <LabelList dataKey="realizado" fill="#047857" {...OPEX_END_LABEL} />}
            </Bar>
            {mostrarProjecao && (
              <Bar
                dataKey="projetado"
                name="Projetado"
                fill={PROJETADO_BARRA}
                stackId="ano"
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
                minPointSize={1}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(data) => {
                  const row = clickPayload(data) as DrillBarRow | null
                  if (row?.key) onBarClick(row)
                }}
              >
                <LabelList dataKey="realizadoTotal" fill="#047857" {...OPEX_END_LABEL} />
              </Bar>
            )}
          </>
        ) : (
          <>
            <Bar
              dataKey="previsto"
              name="Orçamento"
              fill={OPEX_COLORS.previsto.hex}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              <LabelList dataKey="previsto" fill="#6b21a8" {...OPEX_END_LABEL} />
            </Bar>
            <Bar
              dataKey="realizado"
              name="Realizado"
              fill={OPEX_COLORS.realizado.hex}
              stackId={mostrarProjecao ? 'ano' : undefined}
              radius={mostrarProjecao ? [0, 0, 0, 0] : [0, 4, 4, 0]}
              maxBarSize={14}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              {!mostrarProjecao && <LabelList dataKey="realizado" fill="#047857" {...OPEX_END_LABEL} />}
            </Bar>
            {mostrarProjecao && (
              <Bar
                dataKey="projetado"
                name="Projetado"
                fill={PROJETADO_BARRA}
                stackId="ano"
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
                minPointSize={1}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(data) => {
                  const row = clickPayload(data) as DrillBarRow | null
                  if (row?.key) onBarClick(row)
                }}
              >
                <LabelList dataKey="realizadoTotal" fill="#047857" {...OPEX_END_LABEL} />
              </Bar>
            )}
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function OpexPrevistoRealizadoChart({
  rows,
  mesAtual,
  ano,
  mesesFiltro,
  orcamentoImportado,
  planoFiltro,
}: Props) {
  const [drillPeriodo, setDrillPeriodo] = useState<DrillPeriodo>(null)
  const [drillGrupo, setDrillGrupo] = useState<string | null>(null)
  const [drillPlano, setDrillPlano] = useState<string | null>(null)
  const [drillSortVariacao, setDrillSortVariacao] = useState<VariacaoSort>('off')
  const [compararAnoAnterior, setCompararAnoAnterior] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [erroExport, setErroExport] = useState<string | null>(null)
  const anoAnterior = ano - 1
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const drillAberto = drillPeriodo != null
  const drillAno = drillPeriodo === 'ano'
  const drillMes = typeof drillPeriodo === 'number' ? drillPeriodo : null
  const mesesDrill = drillMes != null ? [drillMes] : []
  const planoFiltroKeyValue = planoFiltroKey(planoFiltro ?? { gruposExcluidos: [], planosExcluidos: [] })

  useEffect(() => {
    setDrillPeriodo(null)
    setDrillGrupo(null)
    setDrillPlano(null)
    setDrillSortVariacao('off')
    setCompararAnoAnterior(false)
    setErroExport(null)
  }, [ano, mesesFiltro, planoFiltro])

  useEffect(() => {
    setDrillGrupo(null)
    setDrillPlano(null)
    setDrillSortVariacao('off')
  }, [drillPeriodo])

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        projetado_fixas_chart: r.mes > mesAtual ? r.projetado_fixas : null,
        ativo: !filtroAtivo || mesesFiltro.includes(r.mes),
      })),
    [rows, mesAtual, mesesFiltro, filtroAtivo],
  )

  const { data: gruposMes, isLoading: loadingGrupos } = useOpexMesGrupos(ano, drillPeriodo, planoFiltro)
  const { data: gruposAnoAnterior, isLoading: loadingGruposAA } = useOpexMesGrupos(
    anoAnterior,
    compararAnoAnterior ? drillPeriodo : null,
    planoFiltro,
  )
  const { data: deParaLinhas } = useOpexGrupoDePara(anoAnterior, ano)
  const deParaKey = (deParaLinhas ?? [])
    .map((l) => `${l.nomeOrigem}>${l.nomeDestino}`)
    .join('|')

  const { data: planosGrupo, isLoading: loadingPlanos } = useQuery({
    queryKey: ['opex', 'planos', ano, drillGrupo, mesesFiltroKey(mesesDrill), planoFiltroKeyValue],
    queryFn: () => opexService.fetchPlanosGrupo(ano, drillGrupo!, mesesDrill, planoFiltro),
    enabled: drillGrupo != null && drillAberto,
    staleTime: 60_000,
  })

  const { data: planosAnoAnterior, isLoading: loadingPlanosAA } = useQuery({
    queryKey: [
      'opex',
      'planos-yoy',
      anoAnterior,
      drillGrupo,
      mesesFiltroKey(mesesDrill),
      planoFiltroKeyValue,
      deParaKey,
    ],
    queryFn: async () => {
      const origens = origensDoDestino(deParaLinhas ?? [], drillGrupo!)
      const batches = await Promise.all(
        origens.map((grupo) => opexService.fetchPlanosGrupo(anoAnterior, grupo, mesesDrill, planoFiltro)),
      )
      return mergePlanosGrupo(batches.flat())
    },
    enabled: compararAnoAnterior && drillGrupo != null && drillAberto,
    staleTime: 60_000,
  })

  const grupoChartData = useMemo(() => {
    const atual = (gruposMes ?? []).map((g: OpexMesGrupoRow) => {
      const projetado = drillAno ? projetadoRestanteFixas(g.realizado, g.fixo, mesAtual) : 0
      return {
        key: g.grupo_conta,
        label: g.grupo_conta,
        previsto: g.previsto,
        realizado: g.realizado,
        projetado,
        variacao: g.realizado + projetado - g.previsto,
      }
    })
    const anteriorBruto = (gruposAnoAnterior ?? []).map((g: OpexMesGrupoRow) => ({
      key: g.grupo_conta,
      label: g.grupo_conta,
      realizado: g.realizado,
    }))
    const anterior = aplicarDeParaLinhas(anteriorBruto, deParaLinhas ?? [])
    return sortByVariacao(
      mergeDrillYoY(atual, compararAnoAnterior ? anterior : []),
      drillSortVariacao,
      compararAnoAnterior,
    )
  }, [gruposMes, gruposAnoAnterior, deParaLinhas, deParaKey, drillSortVariacao, compararAnoAnterior, drillAno, mesAtual])

  const grupoFixoSelecionado = Boolean(
    drillGrupo &&
      (gruposMes ?? []).find((g: OpexMesGrupoRow) => g.grupo_conta === drillGrupo)?.fixo,
  )

  const planoChartData = useMemo(() => {
    const atual = (planosGrupo ?? []).map((p: OpexPlanoRow) => {
      const projetado = drillAno ? projetadoRestanteFixas(p.realizado_ytd, grupoFixoSelecionado, mesAtual) : 0
      return {
        key: p.plano_contas,
        label: p.plano_contas,
        previsto: p.previsto_ano,
        realizado: p.realizado_ytd,
        projetado,
        variacao: p.realizado_ytd + projetado - p.previsto_ano,
      }
    })
    const anterior = (planosAnoAnterior ?? []).map((p: OpexPlanoRow) => ({
      key: p.plano_contas,
      realizado: p.realizado_ytd,
    }))
    return sortByVariacao(
      mergeDrillYoY(atual, compararAnoAnterior ? anterior : []),
      drillSortVariacao,
      compararAnoAnterior,
    )
  }, [planosGrupo, planosAnoAnterior, drillSortVariacao, compararAnoAnterior, drillAno, mesAtual, grupoFixoSelecionado])

  const drillMesLabel = drillAno ? 'Ano' : drillMes != null ? MESES_CURTOS[drillMes - 1] : ''

  const handleBarClick = (_data: unknown, index: number) => {
    const mes = chartData[index]?.mes
    if (!mes) return
    setDrillPeriodo(mes)
  }

  const handleVoltar = () => {
    setErroExport(null)
    if (drillPlano) {
      setDrillPlano(null)
      return
    }
    if (drillGrupo) {
      setDrillGrupo(null)
      return
    }
    setDrillPeriodo(null)
  }

  const handleExportar = async () => {
    if (!drillAberto || !gruposMes?.length) return
    setExportando(true)
    setErroExport(null)
    try {
      await exportOpexMesGruposExcel(gruposMes, {
        ano,
        mes: drillMes,
        mesLabel: drillAno ? `ano-${ano}` : drillMesLabel,
      })
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : 'Erro ao exportar planilha.')
    } finally {
      setExportando(false)
    }
  }

  const drillTotais = useMemo(() => {
    const vazio = { previsto: 0, realizado: 0, projetado: 0, realizadoAnterior: 0 }
    const somar = (rows: DrillBarRow[]) =>
      rows.reduce(
        (acc, row) => ({
          previsto: acc.previsto + row.previsto,
          realizado: acc.realizado + row.realizado,
          projetado: acc.projetado + row.projetado,
          realizadoAnterior: acc.realizadoAnterior + row.realizadoAnterior,
        }),
        { ...vazio },
      )
    if (drillPlano) {
      const plano = planoChartData.find((p) => p.key === drillPlano)
      return plano
        ? {
            previsto: plano.previsto,
            realizado: plano.realizado,
            projetado: plano.projetado,
            realizadoAnterior: plano.realizadoAnterior,
          }
        : vazio
    }
    if (drillGrupo) {
      const grupo = grupoChartData.find((g) => g.key === drillGrupo)
      if (grupo) {
        return {
          previsto: grupo.previsto,
          realizado: grupo.realizado,
          projetado: grupo.projetado,
          realizadoAnterior: grupo.realizadoAnterior,
        }
      }
      return somar(planoChartData)
    }
    if (!grupoChartData.length && !gruposMes?.length) return vazio
    return somar(grupoChartData)
  }, [gruposMes, grupoChartData, planoChartData, drillGrupo, drillPlano])

  const drillRealizadoAno = drillTotais.realizado + drillTotais.projetado
  const drillVariacao = drillRealizadoAno - drillTotais.previsto
  const drillYoY = drillRealizadoAno - drillTotais.realizadoAnterior
  const drillYoYPct = yoyPct(drillRealizadoAno, drillTotais.realizadoAnterior)
  const chartBars = drillGrupo ? planoChartData : grupoChartData
  const loadingDrill =
    (drillGrupo ? loadingPlanos : loadingGrupos) ||
    (compararAnoAnterior && (drillGrupo ? loadingPlanosAA : loadingGruposAA))
  const chartHeight = drillAberto && !drillPlano ? Math.max(320, chartBars.length * 48 + 88) : 320

  const tituloDrill = drillPlano
    ? drillPlano
    : drillGrupo
      ? drillGrupo
      : drillAno
        ? `Detalhe de ${ano}`
        : `Detalhe de ${drillMesLabel} / ${ano}`

  const subtituloDrill = drillPlano
    ? compararAnoAnterior
      ? `Títulos de ${drillMesLabel}/${ano} · totais vs ${anoAnterior} no cabeçalho`
      : 'Títulos do plano — os de maior variação (realizado − orçamento) aparecem primeiro'
    : drillGrupo
      ? compararAnoAnterior
        ? `Planos · realizado ${ano} vs ${anoAnterior}`
        : drillAno
          ? 'Clique no plano para ver os títulos · realizado das fixas inclui projeção até dez'
          : 'Clique no plano para ver os títulos'
      : compararAnoAnterior
        ? `Clique no grupo · barras = realizado ${ano} vs ${anoAnterior}`
        : drillAno
          ? 'Clique no grupo · realizado das fixas inclui a projeção até dezembro'
          : 'Clique no grupo para ver os planos · o botão de variação alterna maior gasto e economia'

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
            <BarChart3 className="h-4 w-4 text-rose-700" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {drillAberto
                ? tituloDrill
                : orcamentoImportado
                  ? 'Orçamento x realizado mensal'
                  : 'Previsto x realizado mensal'}
            </h2>
            <p className="text-xs text-slate-500">
              {drillAberto
                ? subtituloDrill
                : 'Clique no mês para detalhar · ou abra o ano inteiro à direita'}
            </p>
            {drillAberto && (drillGrupo || drillPlano) && (
              <p className="mt-1 text-[11px] text-slate-400">
                {drillAno ? `Ano / ${ano}` : `${drillMesLabel} / ${ano}`}
                {drillGrupo ? ` · ${drillGrupo}` : ''}
                {drillPlano ? ` · ${drillPlano}` : ''}
              </p>
            )}
          </div>
        </div>
        {!drillAberto && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDrillPeriodo('ano')}
          >
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            Ver ano
          </Button>
        )}
        {drillAberto && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={compararAnoAnterior ? 'default' : 'outline'}
              size="sm"
              className={cn('gap-1.5', compararAnoAnterior && 'bg-slate-700 hover:bg-slate-800')}
              aria-pressed={compararAnoAnterior}
              onClick={() => setCompararAnoAnterior((v) => !v)}
            >
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
              vs {anoAnterior}
            </Button>
            <Button
              type="button"
              variant={drillSortVariacao === 'off' ? 'outline' : 'default'}
              size="sm"
              className={cn(
                'gap-1.5',
                drillSortVariacao === 'desc' && 'bg-rose-600 hover:bg-rose-700',
                drillSortVariacao === 'asc' && 'bg-emerald-600 hover:bg-emerald-700',
              )}
              aria-pressed={drillSortVariacao !== 'off'}
              aria-label={
                drillSortVariacao === 'desc'
                  ? 'Ordenado pelo maior gasto. Clique para ver o que mais economizou.'
                  : drillSortVariacao === 'asc'
                    ? 'Ordenado pelo que mais economizou. Clique para voltar à ordem padrão.'
                    : 'Ordenar pelo maior gasto'
              }
              onClick={() => setDrillSortVariacao(nextVariacaoSort)}
            >
              {drillSortVariacao === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              ) : drillSortVariacao === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
              )}
              {drillSortVariacao === 'asc' ? 'Mais economizou' : 'Maior variação'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loadingGrupos || exportando || !gruposMes?.length}
              onClick={() => void handleExportar()}
            >
              {exportando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden />
              )}
              Excel
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleVoltar}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Voltar
            </Button>
          </div>
        )}
      </div>

      {erroExport && (
        <p className="mb-3 text-xs text-red-600" role="alert">
          {erroExport}
        </p>
      )}

      {drillAberto && !loadingDrill && (
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <span>
            Orçamento:{' '}
            <strong className="tabular-nums text-slate-800">{formatCurrency(drillTotais.previsto)}</strong>
          </span>
          <span>
            Realizado:{' '}
            <strong className={cn('tabular-nums', OPEX_COLORS.realizado.text)}>
              {formatCurrency(drillTotais.realizado)}
            </strong>
          </span>
          {drillAno && drillTotais.projetado > 0 && (
            <span>
              Projetado:{' '}
              <strong className="tabular-nums text-orange-700">{formatCurrency(drillTotais.projetado)}</strong>
            </span>
          )}
          <span>
            Variação:{' '}
            <button
              type="button"
              onClick={() => setDrillSortVariacao(nextVariacaoSort)}
              className={cn(
                'rounded px-1 -mx-1 tabular-nums underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300',
                variacaoClass(drillVariacao),
              )}
              title="Alternar ordem: maior gasto → mais economizou → padrão"
            >
              <strong>{formatCurrency(drillVariacao)}</strong>
            </button>
          </span>
          {compararAnoAnterior && (
            <>
              <span>
                Realizado {anoAnterior}:{' '}
                <strong className={cn('tabular-nums', OPEX_COLORS.anoAnterior.text)}>
                  {formatCurrency(drillTotais.realizadoAnterior)}
                </strong>
              </span>
              <span>
                Δ vs {anoAnterior}:{' '}
                <strong className={cn('tabular-nums', variacaoClass(drillYoY))}>
                  {formatCurrency(drillYoY)}
                  {drillYoYPct != null ? ` (${formatPercent(drillYoYPct)})` : ''}
                </strong>
              </span>
            </>
          )}
        </div>
      )}

      {drillAberto && drillPlano && drillGrupo && (
        <OpexPlanoTitulos
          ano={ano}
          grupo={drillGrupo}
          plano={drillPlano}
          mesesFiltro={mesesDrill}
          orcamentoImportado={orcamentoImportado}
          planoFiltro={planoFiltro}
          sortVariacao={drillSortVariacao === 'off' ? undefined : drillSortVariacao}
          orcamentoPlano={planoChartData.find((p) => p.key === drillPlano)?.previsto}
        />
      )}

      {drillAberto && !drillPlano && (
        <div className="w-full" style={{ height: chartHeight, minHeight: 320 }}>
          {loadingDrill && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {drillGrupo ? 'Carregando planos…' : 'Carregando grupos…'}
            </div>
          )}

          {!loadingDrill && chartBars.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {drillGrupo ? 'Sem planos neste grupo.' : 'Sem despesas elegíveis neste período.'}
            </div>
          )}

          {!loadingDrill && chartBars.length > 0 && (
            <OpexHorizontalCompareChart
              key={`${compararAnoAnterior ? 'yoy' : 'orc'}-${deParaKey}-${drillAno ? 'proj' : 'raw'}`}
              data={chartBars}
              compararAnoAnterior={compararAnoAnterior}
              ano={ano}
              anoAnterior={anoAnterior}
              mostrarProjecao={drillAno}
              onBarClick={(row) => {
                if (drillGrupo) {
                  setDrillPlano(row.key)
                  return
                }
                setDrillGrupo(row.key)
                setDrillSortVariacao('desc')
              }}
            />
          )}
        </div>
      )}

      {!drillAberto && (
        <div className="w-full" style={{ height: 320, minHeight: 320 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
            <ComposedChart data={chartData} margin={{ left: 4, right: 12, top: 28, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis
                dataKey="mesLabel"
                tick={({ x, y, payload }) => {
                  const item = chartData.find((d) => d.mesLabel === payload.value)
                  const ativo = item?.ativo !== false
                  return (
                    <text x={x} y={y} dy={12} textAnchor="middle" fontSize={12} fill={ativo ? '#64748b' : '#cbd5e1'}>
                      {String(payload.value).toUpperCase()}
                    </text>
                  )
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxis}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={60}
                padding={{ top: 20 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(typeof value === 'number' ? value : Number(value) || 0),
                  String(name),
                ]}
                labelFormatter={(label) => String(label).toUpperCase()}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="previsto"
                name="Orçamento"
                fill={OPEX_COLORS.previsto.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                cursor="pointer"
                onClick={handleBarClick}
              >
                {chartData.map((entry) => (
                  <Cell key={`prev-${entry.mes}`} fillOpacity={entry.ativo ? 1 : 0.25} />
                ))}
                <LabelList dataKey="previsto" content={renderOpexBarLabel('#6b21a8')} />
              </Bar>
              <Bar
                dataKey="realizado"
                name="Realizado"
                fill={OPEX_COLORS.realizado.hex}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                cursor="pointer"
                onClick={handleBarClick}
              >
                {chartData.map((entry) => (
                  <Cell key={`real-${entry.mes}`} fillOpacity={entry.ativo ? 1 : 0.25} />
                ))}
                <LabelList dataKey="realizado" content={renderOpexBarLabel('#047857')} />
              </Bar>
              <Line
                type="monotone"
                dataKey="projetado_fixas_chart"
                name="Projeção fixas"
                stroke={OPEX_COLORS.projetado.hex}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: OPEX_COLORS.projetado.hex }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
