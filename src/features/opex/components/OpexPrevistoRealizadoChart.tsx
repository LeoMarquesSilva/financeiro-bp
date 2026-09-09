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
import { ArrowLeft, ArrowUpDown, BarChart3, Download, GitCompareArrows, Loader2 } from 'lucide-react'
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
  realizadoAnterior: number
  variacao: number
  variacaoYoY: number
}

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

function sortByVariacao<T extends { variacao: number; variacaoYoY: number }>(
  rows: T[],
  enabled: boolean,
  porYoY = false,
): T[] {
  if (!enabled) return rows
  return [...rows].sort((a, b) => (porYoY ? b.variacaoYoY - a.variacaoYoY : b.variacao - a.variacao))
}

function mergeDrillYoY(
  atual: Array<{ key: string; label: string; previsto: number; realizado: number; variacao: number }>,
  anterior: Array<{ key: string; realizado: number }>,
): DrillBarRow[] {
  const prevMap = new Map(anterior.map((row) => [row.key, row.realizado]))
  const keys = new Set([...atual.map((row) => row.key), ...anterior.map((row) => row.key)])
  return [...keys].map((key) => {
    const cur = atual.find((row) => row.key === key)
    const realizado = cur?.realizado ?? 0
    const previsto = cur?.previsto ?? 0
    const realizadoAnterior = prevMap.get(key) ?? 0
    return {
      key,
      label: cur?.label ?? key,
      previsto,
      realizado,
      realizadoAnterior,
      variacao: cur?.variacao ?? realizado - previsto,
      variacaoYoY: realizado - realizadoAnterior,
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

function OpexBarValueLabelHorizontal({
  x,
  y,
  width,
  height,
  value,
  color = '#334155',
}: {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: number | string | null
  color?: string
}) {
  const nx = Number(x)
  const ny = Number(y)
  const nw = Number(width)
  const nh = Number(height)
  const n = Number(value)
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nw) || !Number.isFinite(nh) || !n || n <= 0) {
    return null
  }
  return (
    <text
      x={nx + nw + 6}
      y={ny + nh / 2}
      dy={4}
      textAnchor="start"
      fill={color}
      fontSize={10}
      fontWeight={600}
    >
      {formatCurrencyCompact(n)}
    </text>
  )
}

function renderOpexBarLabel(color: string) {
  return (props: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }) => (
    <OpexBarValueLabel {...props} value={props.value as number | string | null | undefined} color={color} />
  )
}

function renderOpexBarLabelHorizontal(color: string) {
  return (props: {
    x?: number | string
    y?: number | string
    width?: number | string
    height?: number | string
    value?: unknown
  }) => (
    <OpexBarValueLabelHorizontal
      {...props}
      value={props.value as number | string | null | undefined}
      color={color}
    />
  )
}

function OpexHorizontalCompareChart({
  data,
  onBarClick,
  compararAnoAnterior,
  ano,
  anoAnterior,
}: {
  data: DrillBarRow[]
  onBarClick: (row: DrillBarRow) => void
  compararAnoAnterior: boolean
  ano: number
  anoAnterior: number
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 12, right: 80, top: 8, bottom: 4 }}
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
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              <LabelList dataKey="realizadoAnterior" content={renderOpexBarLabelHorizontal('#475569')} />
            </Bar>
            <Bar
              dataKey="realizado"
              name={`Realizado ${ano}`}
              fill={OPEX_COLORS.realizado.hex}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              <LabelList dataKey="realizado" content={renderOpexBarLabelHorizontal('#047857')} />
            </Bar>
          </>
        ) : (
          <>
            <Bar
              dataKey="previsto"
              name="Orçamento"
              fill={OPEX_COLORS.previsto.hex}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              <LabelList dataKey="previsto" content={renderOpexBarLabelHorizontal('#6b21a8')} />
            </Bar>
            <Bar
              dataKey="realizado"
              name="Realizado"
              fill={OPEX_COLORS.realizado.hex}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              cursor="pointer"
              onClick={(data) => {
                const row = clickPayload(data) as DrillBarRow | null
                if (row?.key) onBarClick(row)
              }}
            >
              <LabelList dataKey="realizado" content={renderOpexBarLabelHorizontal('#047857')} />
            </Bar>
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
  const [drillMes, setDrillMes] = useState<number | null>(null)
  const [drillGrupo, setDrillGrupo] = useState<string | null>(null)
  const [drillPlano, setDrillPlano] = useState<string | null>(null)
  const [drillSortVariacao, setDrillSortVariacao] = useState(false)
  const [compararAnoAnterior, setCompararAnoAnterior] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [erroExport, setErroExport] = useState<string | null>(null)
  const anoAnterior = ano - 1
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const mesesDrill = drillMes != null ? [drillMes] : []
  const planoFiltroKeyValue = planoFiltroKey(planoFiltro ?? { gruposExcluidos: [], planosExcluidos: [] })

  useEffect(() => {
    setDrillMes(null)
    setDrillGrupo(null)
    setDrillPlano(null)
    setDrillSortVariacao(false)
    setCompararAnoAnterior(false)
    setErroExport(null)
  }, [ano, mesesFiltro, planoFiltro])

  useEffect(() => {
    setDrillGrupo(null)
    setDrillPlano(null)
    setDrillSortVariacao(false)
  }, [drillMes])

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        projetado_fixas_chart: r.mes > mesAtual ? r.projetado_fixas : null,
        ativo: !filtroAtivo || mesesFiltro.includes(r.mes),
      })),
    [rows, mesAtual, mesesFiltro, filtroAtivo],
  )

  const { data: gruposMes, isLoading: loadingGrupos } = useOpexMesGrupos(ano, drillMes, planoFiltro)
  const { data: gruposAnoAnterior, isLoading: loadingGruposAA } = useOpexMesGrupos(
    anoAnterior,
    compararAnoAnterior ? drillMes : null,
    planoFiltro,
  )
  const { data: deParaLinhas } = useOpexGrupoDePara(anoAnterior, ano)
  const deParaKey = (deParaLinhas ?? []).map((l) => `${l.nomeOrigem}>${l.nomeDestino}`).join('|')

  const { data: planosGrupo, isLoading: loadingPlanos } = useQuery({
    queryKey: ['opex', 'planos', ano, drillGrupo, mesesFiltroKey(mesesDrill), planoFiltroKeyValue],
    queryFn: () => opexService.fetchPlanosGrupo(ano, drillGrupo!, mesesDrill, planoFiltro),
    enabled: drillGrupo != null && drillMes != null,
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
    enabled: compararAnoAnterior && drillGrupo != null && drillMes != null,
    staleTime: 60_000,
  })

  const grupoChartData = useMemo(() => {
    const atual = (gruposMes ?? []).map((g: OpexMesGrupoRow) => ({
      key: g.grupo_conta,
      label: g.grupo_conta,
      previsto: g.previsto,
      realizado: g.realizado,
      variacao: g.variacao,
    }))
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
  }, [gruposMes, gruposAnoAnterior, deParaLinhas, deParaKey, drillSortVariacao, compararAnoAnterior])

  const planoChartData = useMemo(() => {
    const atual = (planosGrupo ?? []).map((p: OpexPlanoRow) => ({
      key: p.plano_contas,
      label: p.plano_contas,
      previsto: p.previsto_ano,
      realizado: p.realizado_ytd,
      variacao: p.realizado_ytd - p.previsto_ano,
    }))
    const anterior = (planosAnoAnterior ?? []).map((p: OpexPlanoRow) => ({
      key: p.plano_contas,
      realizado: p.realizado_ytd,
    }))
    return sortByVariacao(
      mergeDrillYoY(atual, compararAnoAnterior ? anterior : []),
      drillSortVariacao,
      compararAnoAnterior,
    )
  }, [planosGrupo, planosAnoAnterior, drillSortVariacao, compararAnoAnterior])

  const drillMesLabel = drillMes != null ? MESES_CURTOS[drillMes - 1] : ''

  const handleBarClick = (_data: unknown, index: number) => {
    const mes = chartData[index]?.mes
    if (!mes) return
    setDrillMes(mes)
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
    setDrillMes(null)
  }

  const handleExportar = async () => {
    if (drillMes == null || !gruposMes?.length) return
    setExportando(true)
    setErroExport(null)
    try {
      await exportOpexMesGruposExcel(gruposMes, {
        ano,
        mes: drillMes,
        mesLabel: drillMesLabel,
      })
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : 'Erro ao exportar planilha.')
    } finally {
      setExportando(false)
    }
  }

  const drillTotais = useMemo(() => {
    const vazio = { previsto: 0, realizado: 0, realizadoAnterior: 0 }
    if (drillPlano) {
      const plano = planoChartData.find((p) => p.key === drillPlano)
      return plano
        ? { previsto: plano.previsto, realizado: plano.realizado, realizadoAnterior: plano.realizadoAnterior }
        : vazio
    }
    if (drillGrupo) {
      const grupo = grupoChartData.find((g) => g.key === drillGrupo)
      if (grupo) {
        return { previsto: grupo.previsto, realizado: grupo.realizado, realizadoAnterior: grupo.realizadoAnterior }
      }
      return planoChartData.reduce(
        (acc, p) => ({
          previsto: acc.previsto + p.previsto,
          realizado: acc.realizado + p.realizado,
          realizadoAnterior: acc.realizadoAnterior + p.realizadoAnterior,
        }),
        { ...vazio },
      )
    }
    if (!grupoChartData.length && !gruposMes?.length) return vazio
    return grupoChartData.reduce(
      (acc, g) => ({
        previsto: acc.previsto + g.previsto,
        realizado: acc.realizado + g.realizado,
        realizadoAnterior: acc.realizadoAnterior + g.realizadoAnterior,
      }),
      { ...vazio },
    )
  }, [gruposMes, grupoChartData, planoChartData, drillGrupo, drillPlano])

  const drillVariacao = drillTotais.realizado - drillTotais.previsto
  const drillYoY = drillTotais.realizado - drillTotais.realizadoAnterior
  const drillYoYPct = yoyPct(drillTotais.realizado, drillTotais.realizadoAnterior)
  const chartBars = drillGrupo ? planoChartData : grupoChartData
  const loadingDrill =
    (drillGrupo ? loadingPlanos : loadingGrupos) ||
    (compararAnoAnterior && (drillGrupo ? loadingPlanosAA : loadingGruposAA))
  const chartHeight = drillMes != null && !drillPlano ? Math.max(320, chartBars.length * 48 + 88) : 320

  const tituloDrill = drillPlano
    ? drillPlano
    : drillGrupo
      ? drillGrupo
      : `Detalhe de ${drillMesLabel} / ${ano}`

  const subtituloDrill = drillPlano
    ? compararAnoAnterior
      ? `Títulos de ${drillMesLabel}/${ano} · totais vs ${anoAnterior} no cabeçalho`
      : 'Títulos do plano — os de maior variação (realizado − orçamento) aparecem primeiro'
    : drillGrupo
      ? compararAnoAnterior
        ? `Planos · realizado ${ano} vs ${anoAnterior}`
        : 'Clique no plano para ver os títulos'
      : compararAnoAnterior
        ? `Clique no grupo · barras = realizado ${ano} vs ${anoAnterior}`
        : 'Clique no grupo para ver os planos · botão Maior variação ordena o estouro'

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
            <BarChart3 className="h-4 w-4 text-rose-700" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {drillMes != null
                ? tituloDrill
                : orcamentoImportado
                  ? 'Orçamento x realizado mensal'
                  : 'Previsto x realizado mensal'}
            </h2>
            <p className="text-xs text-slate-500">
              {drillMes != null
                ? subtituloDrill
                : 'Clique no mês para detalhar · barras = orçamento (ou VIOS se não importado)'}
            </p>
            {drillMes != null && (drillGrupo || drillPlano) && (
              <p className="mt-1 text-[11px] text-slate-400">
                {drillMesLabel} / {ano}
                {drillGrupo ? ` · ${drillGrupo}` : ''}
                {drillPlano ? ` · ${drillPlano}` : ''}
              </p>
            )}
          </div>
        </div>
        {drillMes != null && (
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
              variant={drillSortVariacao ? 'default' : 'outline'}
              size="sm"
              className={cn('gap-1.5', drillSortVariacao && 'bg-rose-600 hover:bg-rose-700')}
              aria-pressed={drillSortVariacao}
              onClick={() => setDrillSortVariacao((v) => !v)}
            >
              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
              Maior variação
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

      {drillMes != null && !loadingDrill && (
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
          <span>
            Variação:{' '}
            <button
              type="button"
              onClick={() => setDrillSortVariacao((v) => !v)}
              className={cn(
                'rounded px-1 -mx-1 tabular-nums underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300',
                variacaoClass(drillVariacao),
              )}
              title="Ordenar pela maior variação (realizado − orçamento)"
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

      {drillMes != null && drillPlano && drillGrupo && (
        <OpexPlanoTitulos
          ano={ano}
          grupo={drillGrupo}
          plano={drillPlano}
          mesesFiltro={mesesDrill}
          orcamentoImportado={orcamentoImportado}
          planoFiltro={planoFiltro}
          sortByVariacao={drillSortVariacao}
          orcamentoPlano={planoChartData.find((p) => p.key === drillPlano)?.previsto}
        />
      )}

      {drillMes != null && !drillPlano && (
        <div className="w-full" style={{ height: chartHeight, minHeight: 320 }}>
          {loadingDrill && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {drillGrupo ? 'Carregando planos…' : 'Carregando grupos…'}
            </div>
          )}

          {!loadingDrill && chartBars.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {drillGrupo ? 'Sem planos neste grupo.' : 'Sem despesas elegíveis neste mês.'}
            </div>
          )}

          {!loadingDrill && chartBars.length > 0 && (
            <OpexHorizontalCompareChart
              key={`${compararAnoAnterior ? 'yoy' : 'orc'}-${deParaKey}`}
              data={chartBars}
              compararAnoAnterior={compararAnoAnterior}
              ano={ano}
              anoAnterior={anoAnterior}
              onBarClick={(row) => {
                if (drillGrupo) {
                  setDrillPlano(row.key)
                  return
                }
                setDrillGrupo(row.key)
                setDrillSortVariacao(true)
              }}
            />
          )}
        </div>
      )}

      {drillMes == null && (
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
