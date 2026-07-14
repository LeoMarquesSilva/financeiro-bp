import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ListTree,
  Loader2,
  Percent,
  Search,
  Table2,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import type { ReceitaMesRow, ReceitaRecebidoDepartamentoRow } from '../types/receita.types'
import type { ReceitaInadimplenciaDepartamentoMensalRow } from '../types/receitaInadimplencia.types'
import {
  RECEITA_CHART_AXIS,
  RECEITA_CHART_LABEL,
  RECEITA_COLORS,
  RECEITA_DEPARTAMENTO_CORES,
  RECEITA_DEPARTAMENTO_LABELS,
  RECEITA_META_CONTRIBUICAO_AREA,
} from '../constants'
import { ReceitaRecebidoDetalheSheet } from './ReceitaRecebidoDetalheSheet'
import { ReceitaSemAreaDetalheSheet } from './ReceitaSemAreaDetalheSheet'
import { isMesFuturo, valorRecebidoGrafico } from '../utils/receitaMes'
import {
  departamentoNormKey,
  formatPercentLabel,
  formatColunaLabel,
  formatPercentMeta,
} from '../utils/receitaColunasChart'
import { receitaService } from '../services/receitaService'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'

const SERIES = [
  {
    key: 'meta',
    legend: 'Meta',
    color: RECEITA_COLORS.meta.hex,
    type: 'line' as const,
    strokeDasharray: '6 4',
    defaultOn: true,
  },
  {
    key: 'projetadoBaseAbril',
    legend: 'Proj. base abril',
    color: RECEITA_COLORS.projetadoBaseAbril.hex,
    type: 'line' as const,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'projetadoReal',
    legend: 'Proj. real',
    color: RECEITA_COLORS.projetadoReal.hex,
    type: 'line' as const,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'recebido',
    legend: 'Recebido',
    color: RECEITA_COLORS.recebido.hex,
    gradientId: 'receitaRecebidoGradient',
    type: 'area' as const,
    defaultOn: true,
  },
  {
    key: 'previsto',
    legend: 'Previsto',
    color: RECEITA_COLORS.previsto.hex,
    gradientId: 'receitaPrevistoGradient',
    type: 'area' as const,
    defaultOn: true,
  },
] as const

type SeriesKey = (typeof SERIES)[number]['key']

const DEFAULT_VISIBLE = new Set(
  SERIES.filter((s) => s.defaultOn).map((s) => s.key),
)

type ChartPoint = {
  mesLabel: string
  meta: number | null
  projetadoBaseAbril: number | null
  projetadoReal: number | null
  recebido: number | null
  previsto: number | null
}

function formatYAxis(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatYAxisPercent(value: number): string {
  return formatPercent(value)
}

function toComparativoPercentData(data: ChartPoint[]): ChartPoint[] {
  return data.map((p) => {
    const meta = p.meta ?? 0
    if (meta <= 0) {
      return {
        ...p,
        meta: null,
        projetadoBaseAbril: null,
        projetadoReal: null,
        previsto: null,
        recebido: null,
      }
    }
    return {
      mesLabel: p.mesLabel,
      meta: 100,
      projetadoBaseAbril: ((p.projetadoBaseAbril ?? 0) / meta) * 100,
      projetadoReal: ((p.projetadoReal ?? 0) / meta) * 100,
      previsto: ((p.previsto ?? 0) / meta) * 100,
      recebido: p.recebido != null ? (p.recebido / meta) * 100 : null,
    }
  })
}

const SERIES_PERCENT_LEGEND: Partial<Record<SeriesKey, string>> = {
  meta: 'Meta (100%)',
  recebido: 'Recebido (% meta)',
  previsto: 'Previsto (% meta)',
  projetadoBaseAbril: 'Proj. base abril (% meta)',
  projetadoReal: 'Proj. real (% meta)',
}

function pctMeta(recebido: number, meta: number): number | null {
  if (!meta) return null
  return (recebido / meta) * 100
}

const AREA_META_SLICES = RECEITA_META_CONTRIBUICAO_AREA.map((a) => ({
  ...a,
  label: RECEITA_DEPARTAMENTO_LABELS[a.key] ?? a.key,
  color: RECEITA_DEPARTAMENTO_CORES[a.key] ?? '#64748b',
}))

type AreaGapRow = {
  key: string
  label: string
  color: string
  pct: number
  meta: number
  recebido: number
  gap: number
  pctAtingido: number | null
}

/**
 * Meta vs. recebido real por área — recebido vem do banco (por departamento);
 * meta é a meta do período × % de contribuição fixa da área. `mes` = null → acumulado
 * (soma dos meses já com dado); caso contrário, apenas o mês selecionado.
 */
function buildAreaGapData(
  rows: ReceitaMesRow[],
  rowsComDados: ReceitaMesRow[],
  deptRows: ReceitaRecebidoDepartamentoRow[],
  mes: number | null,
): AreaGapRow[] {
  const escopo = (mes == null ? rowsComDados : rows.filter((r) => r.mes === mes)).filter(
    (r) => r.meta > 0,
  )
  const metaTotalEscopo = escopo.reduce((s, r) => s + r.meta, 0)
  const mesesEscopo = new Set(escopo.map((r) => r.mes))

  const recebidoPorArea = new Map<string, number>()
  for (const d of deptRows) {
    if (!mesesEscopo.has(d.mes)) continue
    const key = departamentoNormKey(d.departamento)
    recebidoPorArea.set(key, (recebidoPorArea.get(key) ?? 0) + d.total)
  }

  return AREA_META_SLICES.map((area) => {
    const meta = (metaTotalEscopo * area.pct) / 100
    const recebido = recebidoPorArea.get(area.key) ?? 0
    const gap = recebido - meta
    return {
      key: area.key,
      label: area.label,
      color: area.color,
      pct: area.pct,
      meta,
      recebido,
      gap,
      pctAtingido: meta > 0 ? (recebido / meta) * 100 : null,
    }
  })
}

function formatGap(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatCurrency(Math.abs(value))}`
}

type AreaLinhaPoint = {
  mes: number
  mesLabel: string
  meta: number | null
  previsto: number
  recebido: number | null
  inadimplencia: number | null
}

const AREA_LINHA_SERIES = [
  {
    key: 'meta',
    legend: 'Meta da área',
    color: RECEITA_COLORS.meta.hex,
    type: 'line' as const,
    strokeDasharray: '6 4',
  },
  {
    key: 'previsto',
    legend: 'Previsto',
    color: RECEITA_COLORS.previsto.hex,
    gradientId: 'areaLinhaPrevistoGradient',
    type: 'area' as const,
  },
  {
    key: 'recebido',
    legend: 'Recebido',
    color: RECEITA_COLORS.recebido.hex,
    gradientId: 'areaLinhaRecebidoGradient',
    type: 'area' as const,
  },
  {
    key: 'inadimplencia',
    legend: 'Inadimplência (congelada)',
    color: RECEITA_COLORS.inadimplencia.hex,
    type: 'line' as const,
    strokeDasharray: '3 3',
  },
] as const

/**
 * Série mensal (ano todo) de uma única área: meta individual (meta do mês × % da área),
 * previsto e recebido vindos do banco por departamento, e inadimplência somente nos meses
 * já congelados (não recalcula ao vivo — usa o snapshot do fechamento mensal).
 */
function buildAreaLinhaData(
  rows: ReceitaMesRow[],
  deptRowsRecebido: ReceitaRecebidoDepartamentoRow[],
  deptRowsPrevisto: ReceitaRecebidoDepartamentoRow[],
  inadRows: ReceitaInadimplenciaDepartamentoMensalRow[],
  areaKey: string,
  ano: number,
): AreaLinhaPoint[] {
  const areaSlice = AREA_META_SLICES.find((a) => a.key === areaKey)
  const pct = areaSlice?.pct ?? 0

  const recebidoPorMes = new Map<number, number>()
  for (const d of deptRowsRecebido) {
    if (departamentoNormKey(d.departamento) !== areaKey) continue
    recebidoPorMes.set(d.mes, (recebidoPorMes.get(d.mes) ?? 0) + d.total)
  }

  const previstoPorMes = new Map<number, number>()
  for (const d of deptRowsPrevisto) {
    if (departamentoNormKey(d.departamento) !== areaKey) continue
    previstoPorMes.set(d.mes, (previstoPorMes.get(d.mes) ?? 0) + d.total)
  }

  const inadimplenciaPorMes = new Map<number, number>()
  for (const d of inadRows) {
    if (departamentoNormKey(d.departamento) !== areaKey) continue
    inadimplenciaPorMes.set(d.mes, (inadimplenciaPorMes.get(d.mes) ?? 0) + d.inadimplencia)
  }

  return rows.map((r) => ({
    mes: r.mes,
    mesLabel: r.mesLabel,
    meta: r.meta > 0 ? (r.meta * pct) / 100 : null,
    previsto: previstoPorMes.get(r.mes) ?? 0,
    recebido: valorRecebidoGrafico(recebidoPorMes.get(r.mes) ?? 0, ano, r.mes),
    inadimplencia: inadimplenciaPorMes.get(r.mes) ?? null,
  }))
}

/** Rótulo do ponto da série de uma área. */
function AreaLinhaChangeLabel({
  color,
  data,
  position = 'above',
  offset = 10,
  stagger = 0,
  pctOfKey,
}: {
  color: string
  data: AreaLinhaPoint[]
  position?: 'above' | 'below' | 'right'
  offset?: number
  /** Alterna a altura entre meses consecutivos para impedir colisão de rótulos completos. */
  stagger?: number
  /** Se informado, exibe na segunda linha o percentual do valor sobre este campo no mesmo mês. */
  pctOfKey?: keyof AreaLinhaPoint
}) {
  return function Label(props: LabelProps & { index?: number }) {
    const { x, y, value, index } = props
    if (value == null || x == null || y == null || index == null) return null
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return null

    const text = formatCurrency(num)
    let secondaryText: string | undefined
    if (pctOfKey) {
      const denomRaw = data[index]?.[pctOfKey]
      const denomNum = typeof denomRaw === 'number' ? denomRaw : null
      if (denomNum != null && denomNum > 0) {
        secondaryText = formatPercent((num / denomNum) * 100)
      }
    }
    const cx = Number(x)
    const cy = Number(y)
    const anchor = edgeAwareAnchor(index, data.length)
    const adjustedOffset = offset + (index % 2 === 0 ? 0 : stagger)

    if (position === 'below') {
      return (
        <ChartLabelWithBackdrop
          text={text}
          secondaryText={secondaryText}
          x={cx}
          y={cy + adjustedOffset}
          color={color}
          textAnchor={anchor}
          dominantBaseline="hanging"
        />
      )
    }

    if (position === 'right') {
      const rightAnchor = anchor === 'end' ? 'end' : 'start'
      return (
        <ChartLabelWithBackdrop
          text={text}
          secondaryText={secondaryText}
          x={rightAnchor === 'end' ? cx - 8 : cx + 8}
          y={cy + (index % 2 === 0 ? -stagger / 2 : stagger / 2)}
          color={color}
          textAnchor={rightAnchor}
          dominantBaseline="middle"
        />
      )
    }

    return (
      <ChartLabelWithBackdrop
        text={text}
        secondaryText={secondaryText}
        x={cx}
        y={cy - adjustedOffset}
        color={color}
        textAnchor={anchor}
        dominantBaseline="auto"
      />
    )
  }
}

function AreaLinhaTooltip({
  active,
  payload,
  label,
  color,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number; payload?: AreaLinhaPoint }>
  label?: string
  color: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div
      className="pointer-events-auto z-50 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm shadow-lg"
      style={{ pointerEvents: 'auto' }}
      onWheel={(e) => e.stopPropagation()}
    >
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold capitalize text-slate-800">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <ul className="space-y-1">
        <li className="flex items-center justify-between gap-6">
          <span className="text-slate-600">Meta da área</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {row.meta == null ? '—' : formatCurrency(row.meta)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-6">
          <span className="text-slate-600">Previsto</span>
          <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(row.previsto)}</span>
        </li>
        <li className="flex items-center justify-between gap-6">
          <span className="text-slate-600">Recebido</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {row.recebido == null ? '—' : formatCurrency(row.recebido)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-6 border-t border-slate-100 pt-1.5">
          <span className="font-medium text-slate-600">Inadimplência</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              row.inadimplencia == null ? 'text-slate-400' : 'text-red-600',
            )}
          >
            {row.inadimplencia == null ? 'não congelado' : formatCurrency(row.inadimplencia)}
          </span>
        </li>
      </ul>
    </div>
  )
}

function AreaGapBarLabel(props: LabelProps & { fill?: string }) {
  const { x, y, width, height, value, fill } = props
  const num = typeof value === 'number' ? value : Number(value)
  if (!num || x == null || y == null || width == null) return null
  const h = Number(height) || 0

  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 6}
      fill={typeof fill === 'string' ? fill : RECEITA_CHART_AXIS.label}
      textAnchor="middle"
      fontSize={h >= 20 ? RECEITA_CHART_LABEL.barTop : 10}
      fontWeight={600}
      pointerEvents="none"
    >
      {formatColunaLabel(num)}
    </text>
  )
}

function AreaGapTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number; payload?: AreaGapRow }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div
      className="pointer-events-auto z-50 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm shadow-lg"
      style={{ pointerEvents: 'auto' }}
      onWheel={(e) => e.stopPropagation()}
    >
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold capitalize text-slate-800">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: row.color }}
        />
        {label ?? row.label}
        <span className="text-xs font-normal text-slate-400">
          ({formatPercentMeta(row.pct)} da meta)
        </span>
      </p>
      <ul className="space-y-1">
        <li className="flex items-center justify-between gap-6">
          <span className="text-slate-600">Recebido da área</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {formatCurrency(row.recebido)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-6">
          <span className="text-slate-600">Meta da área</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {formatCurrency(row.meta)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-6 border-t border-slate-100 pt-1.5">
          <span className="font-medium text-slate-600">Gap</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              row.gap >= 0 ? 'text-emerald-700' : 'text-red-600',
            )}
          >
            {formatGap(row.gap)}
          </span>
        </li>
      </ul>
      {row.pctAtingido != null && (
        <p className="mt-1.5 text-xs font-medium text-sky-700">
          {formatPercentMeta(row.pctAtingido)} atingido
        </p>
      )}
    </div>
  )
}

/**
 * Ancora o rótulo pra dentro do gráfico nas pontas (1º e último ponto) — evita que o texto
 * "vaze" pra fora da área do gráfico e fique sobreposto ao eixo Y ou cortado no eixo direito.
 */
function edgeAwareAnchor(
  index: number | undefined,
  total: number | undefined,
): 'start' | 'middle' | 'end' {
  if (index == null || total == null || total <= 1) return 'middle'
  if (index <= 0) return 'start'
  if (index >= total - 1) return 'end'
  return 'middle'
}

/** Texto do rótulo com um fundo claro por trás — garante legibilidade mesmo se algo cruzar por baixo. */
function ChartLabelWithBackdrop({
  text,
  secondaryText,
  x,
  y,
  color,
  textAnchor,
  dominantBaseline,
}: {
  text: string
  secondaryText?: string
  x: number
  y: number
  color: string
  textAnchor: 'start' | 'middle' | 'end'
  dominantBaseline: 'auto' | 'hanging' | 'middle'
}) {
  const charWidth = 6.4
  const boxWidth = Math.max(text.length, secondaryText?.length ?? 0) * charWidth + 8
  const boxHeight = secondaryText ? 29 : 15
  const boxX =
    textAnchor === 'start' ? x - 3 : textAnchor === 'end' ? x - boxWidth + 3 : x - boxWidth / 2
  const boxY =
    dominantBaseline === 'hanging'
      ? y - 2
      : dominantBaseline === 'middle'
        ? y - boxHeight / 2
        : y - 12

  return (
    <g pointerEvents="none">
      <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx={3} fill="#fff" fillOpacity={0.88} />
      <text
        x={x}
        y={y}
        fill={color}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
        fontSize={RECEITA_CHART_LABEL.linePoint}
        fontWeight={600}
      >
        <tspan x={x}>{text}</tspan>
        {secondaryText && <tspan x={x} dy={12}>{secondaryText}</tspan>}
      </text>
    </g>
  )
}

function ComparativoDotLabel({
  color,
  percentMode,
  position = 'right',
  total,
}: {
  color: string
  percentMode: boolean
  position?: 'right' | 'above' | 'below'
  total?: number
}) {
  return function Label(props: LabelProps & { index?: number }) {
    const { x, y, value, index } = props
    if (value == null || x == null || y == null) return null
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return null

    const text = percentMode ? formatPercentLabel(num) : formatCurrency(num)
    if (!text) return null

    const cx = Number(x)
    const cy = Number(y)
    const anchor = edgeAwareAnchor(index, total)

    if (position === 'above') {
      return (
        <ChartLabelWithBackdrop text={text} x={cx} y={cy - 10} color={color} textAnchor={anchor} dominantBaseline="auto" />
      )
    }

    if (position === 'below') {
      return (
        <ChartLabelWithBackdrop text={text} x={cx} y={cy + 14} color={color} textAnchor={anchor} dominantBaseline="hanging" />
      )
    }

    const rightAnchor = anchor === 'end' ? 'end' : 'start'
    return (
      <ChartLabelWithBackdrop
        text={text}
        x={rightAnchor === 'end' ? cx - 8 : cx + 8}
        y={cy}
        color={color}
        textAnchor={rightAnchor}
        dominantBaseline="middle"
      />
    )
  }
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-slate-400">—</span>
  const color =
    pct >= 100
      ? 'bg-emerald-100 text-emerald-800 ring-emerald-300/80'
      : pct >= 80
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
        : 'bg-green-50/80 text-emerald-600 ring-emerald-100'
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.25rem] justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1',
        color,
      )}
    >
      {formatPercent(pct)}
    </span>
  )
}

type TooltipEntry = {
  dataKey?: string | number
  value?: number
}

function ReceitaChartTooltip({
  active,
  payload,
  label,
  visible,
  percentMode,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  visible: Set<SeriesKey>
  percentMode: boolean
}) {
  if (!active || !payload?.length) return null

  const entries = payload.filter((e) => visible.has(e.dataKey as SeriesKey))
  if (!entries.length) return null

  return (
    <div
      className="pointer-events-auto z-50 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm shadow-lg"
      style={{ pointerEvents: 'auto' }}
      onWheel={(e) => e.stopPropagation()}
    >
      <p className="mb-1.5 font-semibold capitalize text-slate-800">{label}</p>
      <ul className="space-y-1">
        {entries.map((entry) => {
          const series = SERIES.find((s) => s.key === entry.dataKey)
          if (!series) return null
          const value = typeof entry.value === 'number' ? entry.value : null
          if (value == null) return null
          return (
            <li key={series.key} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                {percentMode && series.key !== 'meta'
                  ? (SERIES_PERCENT_LEGEND[series.key] ?? `${series.legend} (% meta)`)
                  : percentMode && series.key === 'meta'
                    ? SERIES_PERCENT_LEGEND.meta
                    : series.legend}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {percentMode ? formatPercentLabel(value) : formatCurrency(value)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ReceitaChartLegend({
  visible,
  percentMode,
  onToggle,
}: {
  visible: Set<SeriesKey>
  percentMode: boolean
  onToggle: (key: SeriesKey) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 px-1">
      {SERIES.map((s) => {
        const on = visible.has(s.key)
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
              on
                ? 'border-slate-200 bg-white text-slate-700 shadow-sm'
                : 'border-transparent bg-slate-100/80 text-slate-400 line-through',
            )}
            aria-pressed={on}
          >
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', !on && 'opacity-40')}
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            {percentMode
              ? (SERIES_PERCENT_LEGEND[s.key] ?? `${s.legend} (% meta)`)
              : s.legend}
          </button>
        )
      })}
      <span className="hidden text-[10px] text-slate-400 sm:inline" data-chart-export-ignore>
        Clique para exibir/ocultar
      </span>
    </div>
  )
}

type Props = {
  rows: ReceitaMesRow[]
  ano: number
}

export function ReceitaComparativoChart({ rows, ano }: Props) {
  const [detalheMes, setDetalheMes] = useState<ReceitaMesRow | null>(null)
  const [semAreaAberto, setSemAreaAberto] = useState(false)
  const [tabelaAberta, setTabelaAberta] = useState(false)
  const [percentMode, setPercentMode] = useState(false)
  const [porAreaMode, setPorAreaMode] = useState(false)
  const [areaMesSelecionado, setAreaMesSelecionado] = useState<number | null>(() => {
    const hoje = new Date()
    if (ano !== hoje.getFullYear()) return null
    const mesAtual = hoje.getMonth() + 1
    return rows.some((r) => r.mes === mesAtual) ? mesAtual : null
  })
  const [visible, setVisible] = useState<Set<SeriesKey>>(() => new Set(DEFAULT_VISIBLE))
  const [areaLinhaSelecionada, setAreaLinhaSelecionada] = useState<string | null>(null)
  const chartExportRef = useRef<HTMLDivElement>(null)
  const meses = useMemo(() => rows.map((r) => r.mes), [rows])

  const {
    data: deptRows,
    isLoading: deptLoading,
    error: deptError,
  } = useQuery({
    queryKey: ['receita', 'recebido-departamento', ano, meses],
    queryFn: () => receitaService.fetchRecebidoPorDepartamento(ano),
    enabled: porAreaMode && meses.length > 0,
  })

  const {
    data: previstoDeptRows,
    isLoading: previstoDeptLoading,
    error: previstoDeptError,
  } = useQuery({
    queryKey: ['receita', 'previsto-departamento', ano],
    queryFn: () => receitaService.fetchPrevistoPorDepartamento(ano),
    enabled: porAreaMode && areaLinhaSelecionada != null,
  })

  const {
    data: inadDeptRows,
    isLoading: inadDeptLoading,
    error: inadDeptError,
  } = useQuery({
    queryKey: ['receita-inadimplencia', 'departamento-mensal-congelado', ano],
    queryFn: () => receitaInadimplenciaService.fetchDepartamentosMensalCongelado(ano),
    enabled: porAreaMode && areaLinhaSelecionada != null,
  })

  const togglePercentMode = () => {
    setPercentMode((v) => {
      const next = !v
      if (next) {
        setPorAreaMode(false)
        setAreaLinhaSelecionada(null)
      }
      return next
    })
  }

  const togglePorAreaMode = () => {
    setPorAreaMode((v) => {
      const next = !v
      if (next) setPercentMode(false)
      setAreaLinhaSelecionada(null)
      return next
    })
  }

  const selectAreaLinha = (key: string) => {
    setPercentMode(false)
    setPorAreaMode(true)
    setAreaLinhaSelecionada((prev) => (prev === key ? null : key))
  }

  const toggleSeries = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const rawChartData: ChartPoint[] = useMemo(
    () =>
      rows.map((r) => ({
        mesLabel: r.mesLabel,
        meta: r.meta > 0 ? r.meta : null,
        projetadoBaseAbril: r.projetadoBaseAbril,
        projetadoReal: r.projetadoReal,
        recebido: valorRecebidoGrafico(r.recebido, ano, r.mes),
        previsto: r.previsto,
      })),
    [rows, ano],
  )

  const chartData = useMemo(
    () => (percentMode ? toComparativoPercentData(rawChartData) : rawChartData),
    [percentMode, rawChartData],
  )

  const visibleSeries = visible

  const rowsComDados = useMemo(
    () => rows.filter((r) => !isMesFuturo(ano, r.mes)),
    [rows, ano],
  )

  const areaGapData = useMemo(
    () => buildAreaGapData(rows, rowsComDados, deptRows ?? [], areaMesSelecionado),
    [rows, rowsComDados, deptRows, areaMesSelecionado],
  )

  const areaLinhaAtual = useMemo(
    () => AREA_META_SLICES.find((a) => a.key === areaLinhaSelecionada) ?? null,
    [areaLinhaSelecionada],
  )

  const areaLinhaData = useMemo(() => {
    if (!areaLinhaSelecionada) return []
    return buildAreaLinhaData(
      rows,
      deptRows ?? [],
      previstoDeptRows ?? [],
      inadDeptRows ?? [],
      areaLinhaSelecionada,
      ano,
    )
  }, [rows, deptRows, previstoDeptRows, inadDeptRows, areaLinhaSelecionada, ano])

  const areaGapMetaTotal = useMemo(
    () => areaGapData.reduce((s, a) => s + a.meta, 0),
    [areaGapData],
  )
  const areaGapRecebidoTotal = useMemo(
    () => areaGapData.reduce((s, a) => s + a.recebido, 0),
    [areaGapData],
  )

  const totais = useMemo(
    () => ({
      meta: rowsComDados.reduce((s, r) => s + r.meta, 0),
      projetadoBaseAbril: rowsComDados.reduce((s, r) => s + r.projetadoBaseAbril, 0),
      projetadoReal: rowsComDados.reduce((s, r) => s + r.projetadoReal, 0),
      recebido: rowsComDados.reduce((s, r) => s + r.recebido, 0),
      previsto: rows.reduce((s, r) => s + r.previsto, 0),
    }),
    [rowsComDados],
  )

  const pctTotal = pctMeta(totais.recebido, totais.meta)

  const areaGapRecebidoOficial = useMemo(() => {
    if (areaMesSelecionado == null) return totais.recebido
    return rows.find((r) => r.mes === areaMesSelecionado)?.recebido ?? 0
  }, [areaMesSelecionado, rows, totais.recebido])
  const areaGapRecebidoSemDepartamento = Math.max(
    0,
    areaGapRecebidoOficial - areaGapRecebidoTotal,
  )

  const semAreaPeriodoLabel = useMemo(() => {
    if (areaMesSelecionado == null) return `Acumulado ${ano}`
    const row = rows.find((r) => r.mes === areaMesSelecionado)
    return row ? `${row.mesLabel} / ${ano}` : `${ano}`
  }, [areaMesSelecionado, rows, ano])

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                RECEITA_COLORS.meta.bgIcon,
              )}
            >
              <TrendingUp className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {porAreaMode
                  ? areaLinhaAtual
                    ? `Meta · Previsto · Recebido · Inadimplência — ${areaLinhaAtual.label}`
                    : 'Meta vs. recebido por área'
                  : percentMode
                    ? 'Comparativo mensal (% da meta)'
                    : 'Comparativo mensal'}
              </h2>
            </div>
          </div>
          <ChartCopyButton containerRef={chartExportRef} />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={togglePercentMode}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
              percentMode
                ? 'border-violet-200 bg-violet-50 text-violet-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
            aria-pressed={percentMode}
          >
            <Percent className="h-3 w-3 shrink-0" aria-hidden />
            {percentMode ? 'Ver valores (R$)' : 'Ver % da meta'}
          </button>

          <button
            type="button"
            onClick={togglePorAreaMode}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
              porAreaMode
                ? 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
            aria-pressed={porAreaMode}
          >
            <Building2 className="h-3 w-3 shrink-0" aria-hidden />
            {porAreaMode ? 'Ver consolidado' : 'Ver por área'}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {AREA_META_SLICES.map((area) => {
            const ativo = areaLinhaSelecionada === area.key
            return (
              <button
                key={area.key}
                type="button"
                onClick={() => selectAreaLinha(area.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                  ativo
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
                style={ativo ? { backgroundColor: area.color } : undefined}
                aria-pressed={ativo}
              >
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ativo ? '#fff' : area.color }}
                />
                {area.label}
              </button>
            )
          })}
        </div>

        {porAreaMode && areaLinhaSelecionada == null && (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Período:</span>
            <button
              type="button"
              onClick={() => setAreaMesSelecionado(null)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                areaMesSelecionado == null
                  ? 'border-sky-400 bg-sky-100 text-sky-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50',
              )}
            >
              Acumulado {ano}
            </button>
            {rowsComDados.map((r) => (
              <button
                key={r.mes}
                type="button"
                onClick={() => setAreaMesSelecionado(r.mes)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                  areaMesSelecionado === r.mes
                    ? 'border-sky-400 bg-sky-100 text-sky-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50',
                )}
              >
                {r.mesLabel}
              </button>
            ))}
          </div>
        )}

        <div ref={chartExportRef} className="flex flex-col">
          {porAreaMode ? (
          areaLinhaSelecionada != null ? (
          deptLoading || previstoDeptLoading || inadDeptLoading ? (
            <div className="flex h-[300px] items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando dados da área…
            </div>
          ) : deptError || previstoDeptError || inadDeptError ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              Erro ao carregar dados da área selecionada.
            </p>
          ) : (
          <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setAreaLinhaSelecionada(null)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              ← Todas as áreas
            </button>
            <span className="text-[11px] text-slate-500">
              {formatPercentMeta(areaLinhaAtual?.pct ?? 0)} da meta total · {ano}
            </span>
          </div>
          <div data-chart-plot className="h-[300px] min-h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <ComposedChart data={areaLinhaData} margin={{ left: 4, right: 12, top: 16, bottom: 4 }}>
              <defs>
                <linearGradient id="areaLinhaPrevistoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RECEITA_COLORS.previsto.hex} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={RECEITA_COLORS.previsto.hex} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="areaLinhaRecebidoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RECEITA_COLORS.recebido.hex} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={RECEITA_COLORS.recebido.hex} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />

              <XAxis
                dataKey="mesLabel"
                tick={{ fontSize: 12, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                width={60}
                domain={[0, 'auto']}
              />

              <Tooltip
                wrapperStyle={{ pointerEvents: 'auto', zIndex: 60 }}
                allowEscapeViewBox={{ x: true, y: true }}
                content={<AreaLinhaTooltip color={areaLinhaAtual?.color ?? '#64748b'} />}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
              />

              {AREA_LINHA_SERIES.filter((s) => s.type === 'area').map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill={`url(#${'gradientId' in s ? s.gradientId : ''})`}
                  dot={({ cx, cy, value }) => {
                    if (value == null || cx == null || cy == null) return null
                    return <circle cx={cx} cy={cy} r={3} fill={s.color} />
                  }}
                  activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls={false}
                >
                  {(s.key === 'previsto' || s.key === 'recebido') && (
                    <LabelList
                      dataKey={s.key}
                      content={AreaLinhaChangeLabel({
                        color: s.color,
                        data: areaLinhaData,
                        position: s.key === 'recebido' ? 'right' : 'above',
                        offset: s.key === 'previsto' ? 16 : 10,
                        stagger: 18,
                      })}
                    />
                  )}
                </Area>
              ))}

              {AREA_LINHA_SERIES.filter((s) => s.type === 'line').map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.strokeDasharray}
                  dot={s.key === 'inadimplencia' ? { r: 3, fill: s.color, strokeWidth: 0 } : false}
                  activeDot={{ r: 4, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls={false}
                >
                  {(s.key === 'meta' || s.key === 'inadimplencia') && (
                    <LabelList
                      dataKey={s.key}
                      content={AreaLinhaChangeLabel({
                        color: s.color,
                        data: areaLinhaData,
                        position: 'above',
                        offset: s.key === 'inadimplencia' ? 22 : 6,
                        stagger: 18,
                        pctOfKey: s.key === 'inadimplencia' ? 'previsto' : undefined,
                      })}
                    />
                  )}
                </Line>
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          </div>

          <div data-chart-legend className="mt-3 flex flex-wrap items-center justify-center gap-3 px-1">
            {AREA_LINHA_SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                {s.legend}
              </span>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Inadimplência exibida apenas para meses já congelados na aba Inadimplência.
          </p>
          </>
          )
          ) : (
          deptLoading ? (
            <div className="flex h-[300px] items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando recebido por área…
            </div>
          ) : deptError ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              Erro ao carregar recebido por área. Aplique a migration{' '}
              <code className="text-xs">receita_recebido_por_departamento_mensal</code>.
            </p>
          ) : (
          <>
          <div data-chart-plot className="h-[300px] min-h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <ComposedChart data={areaGapData} margin={{ left: 4, right: 12, top: 24, bottom: 4 }} barCategoryGap="22%" barGap={2}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                dy={4}
                interval={0}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                width={60}
                domain={[0, 'auto']}
              />

              <Tooltip
                wrapperStyle={{ pointerEvents: 'auto', zIndex: 60 }}
                allowEscapeViewBox={{ x: true, y: true }}
                content={<AreaGapTooltip />}
                cursor={{ fill: 'rgba(148,163,184,0.12)' }}
              />

              <Bar dataKey="recebido" name="Recebido da área" maxBarSize={56}>
                {areaGapData.map((a) => (
                  <Cell key={a.key} fill={a.color} />
                ))}
                <LabelList dataKey="recebido" content={(p) => <AreaGapBarLabel {...p} />} />
              </Bar>
              <Bar dataKey="meta" name="Meta da área" fill="#14532d" maxBarSize={56}>
                <LabelList dataKey="meta" content={(p) => <AreaGapBarLabel {...p} fill="#14532d" />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="py-2 pr-3">Área</th>
                  <th className="px-3 py-2 text-center">% meta</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2 text-right">Meta</th>
                  <th className="px-3 py-2 text-center">Gap</th>
                  <th className="px-3 py-2 text-center">Atingido</th>
                </tr>
              </thead>
              <tbody>
                {areaGapData.map((a, i) => (
                  <tr
                    key={a.key}
                    className={cn(
                      'border-b border-slate-100 last:border-0',
                      i % 2 === 1 && 'bg-slate-50/40',
                    )}
                  >
                    <td className="py-2.5 pr-3 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: a.color }}
                          aria-hidden
                        />
                        {a.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                      {formatPercentMeta(a.pct)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">
                      {formatCurrency(a.recebido)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-700">
                      {formatCurrency(a.meta)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-center tabular-nums font-semibold',
                        a.gap >= 0 ? 'text-emerald-700' : 'text-red-600',
                      )}
                    >
                      {formatGap(a.gap)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PctBadge pct={a.pctAtingido} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold text-slate-800">
                  <td className="py-2.5 pr-3">Total</td>
                  <td className="px-3 py-2.5 text-center text-slate-400">100%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCurrency(areaGapRecebidoTotal)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCurrency(areaGapMetaTotal)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-center tabular-nums',
                      areaGapRecebidoTotal - areaGapMetaTotal >= 0
                        ? 'text-emerald-700'
                        : 'text-red-600',
                    )}
                  >
                    {formatGap(areaGapRecebidoTotal - areaGapMetaTotal)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <PctBadge
                      pct={
                        areaGapMetaTotal > 0
                          ? (areaGapRecebidoTotal / areaGapMetaTotal) * 100
                          : null
                      }
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {areaGapRecebidoSemDepartamento > 1 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-amber-700">
              <span>
                + {formatCurrency(areaGapRecebidoSemDepartamento)} recebido sem departamento
                vinculado (não entra no rateio por área).
              </span>
              <button
                type="button"
                onClick={() => setSemAreaAberto(true)}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 transition-colors hover:border-amber-400 hover:bg-amber-100"
              >
                <Search className="h-3 w-3 shrink-0" aria-hidden />
                Ver títulos
              </button>
            </p>
          )}
          </>
          )
          )
          ) : (
          <div data-chart-plot className="h-[300px] min-h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <ComposedChart
              data={chartData}
              margin={{ left: 4, right: percentMode ? 48 : 12, top: percentMode ? 8 : 16, bottom: 4 }}
            >
              <defs>
                <linearGradient id="receitaRecebidoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RECEITA_COLORS.recebido.hex} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={RECEITA_COLORS.recebido.hex} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="receitaPrevistoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RECEITA_COLORS.previsto.hex} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={RECEITA_COLORS.previsto.hex} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />

              <XAxis
                dataKey="mesLabel"
                tick={{ fontSize: 12, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis
                tickFormatter={percentMode ? formatYAxisPercent : formatYAxis}
                tick={{ fontSize: 11, fill: RECEITA_CHART_AXIS.tick }}
                axisLine={false}
                tickLine={false}
                width={percentMode ? 48 : 60}
                domain={[0, 'auto']}
              />

              <Tooltip
                wrapperStyle={{ pointerEvents: 'auto', zIndex: 60 }}
                allowEscapeViewBox={{ x: true, y: true }}
                content={<ReceitaChartTooltip visible={visibleSeries} percentMode={percentMode} />}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
              />

              {SERIES.filter((s) => s.type === 'area' && visibleSeries.has(s.key)).map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill={`url(#${'gradientId' in s ? s.gradientId : ''})`}
                  dot={({ cx, cy, value }) => {
                    if (value == null || cx == null || cy == null) return null
                    return <circle cx={cx} cy={cy} r={3} fill={s.color} />
                  }}
                  activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls={false}
                >
                  {s.key === 'recebido' && (
                    <LabelList
                      dataKey="recebido"
                      content={ComparativoDotLabel({
                        color: s.color,
                        percentMode,
                        position: percentMode ? 'right' : 'above',
                        total: chartData.length,
                      })}
                    />
                  )}
                </Area>
              ))}

              {SERIES.filter((s) => s.type === 'line' && visibleSeries.has(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={'strokeDasharray' in s ? s.strokeDasharray : undefined}
                  dot={false}
                  activeDot={{ r: 4, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          </div>
          )}

          {!porAreaMode && (
            <div data-chart-legend className="mt-3">
              <ReceitaChartLegend
                visible={visibleSeries}
                percentMode={percentMode}
                onToggle={toggleSeries}
              />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-slate-500" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-800">Detalhamento por mês</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-slate-600"
            onClick={() => setTabelaAberta((v) => !v)}
            aria-expanded={tabelaAberta}
          >
            {tabelaAberta ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                Expandir
              </>
            )}
          </Button>
        </div>

        {tabelaAberta && (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 backdrop-blur-sm">Mês</th>
                <th className={cn('px-4 py-3 text-right', RECEITA_COLORS.meta.header)}>Meta</th>
                <th
                  className={cn(
                    'hidden px-4 py-3 text-right md:table-cell',
                    RECEITA_COLORS.projetadoBaseAbril.header,
                  )}
                >
                  Proj. base abril
                </th>
                <th
                  className={cn(
                    'hidden px-4 py-3 text-right lg:table-cell',
                    RECEITA_COLORS.projetadoReal.header,
                  )}
                >
                  Proj. real
                </th>
                <th className="px-4 py-3 text-right">Recebido</th>
                <th className={cn('px-4 py-3 text-center', RECEITA_COLORS.meta.header)}>% meta</th>
                <th className="px-4 py-3 text-right">Previsto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const futuro = isMesFuturo(ano, r.mes)
                const pct = futuro ? null : pctMeta(r.recebido, r.meta)
                return (
                  <tr
                    key={r.mes}
                    className={cn(
                      'border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80',
                      i % 2 === 1 && 'bg-slate-50/40',
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium capitalize text-slate-800 even:bg-slate-50/40">
                      {r.mesLabel}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums font-medium',
                        RECEITA_COLORS.meta.text,
                      )}
                    >
                      {formatCurrency(r.meta)}
                    </td>
                    <td
                      className={cn(
                        'hidden px-4 py-2.5 text-right tabular-nums font-medium md:table-cell',
                        RECEITA_COLORS.projetadoBaseAbril.text,
                      )}
                    >
                      {formatCurrency(r.projetadoBaseAbril)}
                    </td>
                    <td
                      className={cn(
                        'hidden px-4 py-2.5 text-right tabular-nums font-medium lg:table-cell',
                        RECEITA_COLORS.projetadoReal.text,
                      )}
                    >
                      {formatCurrency(r.projetadoReal)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums font-medium',
                        futuro ? 'text-slate-400' : RECEITA_COLORS.recebido.text,
                      )}
                    >
                      {futuro ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>{formatCurrency(r.recebido)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-7 w-7 shrink-0 hover:bg-sky-50',
                              RECEITA_COLORS.recebido.text,
                              'hover:text-sky-900',
                            )}
                            title="Ver descritivo por plano de contas"
                            aria-label={`Descritivo recebido ${r.mesLabel} ${ano}`}
                            onClick={() => setDetalheMes(r)}
                          >
                            <ListTree className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <PctBadge pct={pct} />
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums font-medium',
                        RECEITA_COLORS.previsto.text,
                      )}
                    >
                      {formatCurrency(r.previsto)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold text-slate-800">
                <td className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 backdrop-blur-sm">Total</td>
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    RECEITA_COLORS.meta.textStrong,
                  )}
                >
                  {formatCurrency(totais.meta)}
                </td>
                <td
                  className={cn(
                    'hidden px-4 py-3 text-right tabular-nums md:table-cell',
                    RECEITA_COLORS.projetadoBaseAbril.textStrong,
                  )}
                >
                  {formatCurrency(totais.projetadoBaseAbril)}
                </td>
                <td
                  className={cn(
                    'hidden px-4 py-3 text-right tabular-nums lg:table-cell',
                    RECEITA_COLORS.projetadoReal.textStrong,
                  )}
                >
                  {formatCurrency(totais.projetadoReal)}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    RECEITA_COLORS.recebido.textStrong,
                  )}
                >
                  {formatCurrency(totais.recebido)}
                </td>
                <td className="px-4 py-3 text-center">
                  <PctBadge pct={pctTotal} />
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    RECEITA_COLORS.previsto.textStrong,
                  )}
                >
                  {formatCurrency(totais.previsto)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        )}
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        <strong>Recebido:</strong> valor pago por data de pagamento. <strong>Previsto:</strong> valor
        por data de vencimento. Planos da cota: honorários mensais, spot, sucumbência, êxito,
        manutenção, por hora e advocatícios.
      </p>

      {detalheMes && (
        <ReceitaRecebidoDetalheSheet
          open={!!detalheMes}
          onOpenChange={(open) => {
            if (!open) setDetalheMes(null)
          }}
          ano={ano}
          mes={detalheMes.mes}
          mesLabel={detalheMes.mesLabel}
          totalRecebido={detalheMes.recebido}
        />
      )}

      <ReceitaSemAreaDetalheSheet
        open={semAreaAberto}
        onOpenChange={setSemAreaAberto}
        ano={ano}
        mes={areaMesSelecionado}
        periodoLabel={semAreaPeriodoLabel}
        totalSemArea={areaGapRecebidoSemDepartamento}
      />
    </div>
  )
}
