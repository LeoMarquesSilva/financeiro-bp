import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Check, Copy, Layers, Loader2, Percent, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LabelProps, XAxisTickContentProps } from 'recharts'
import type { MouseHandlerDataParam } from 'recharts/types/synchronisation/types'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { receitaService } from '../services/receitaService'
import { RECEITA_CHART_LABEL, RECEITA_CHART_AXIS, RECEITA_CHART_LAYOUT, RECEITA_COLUNAS_METRICAS, RECEITA_COLORS, RECEITA_DEPARTAMENTO_CORES, RECEITA_DEPARTAMENTO_LABELS, RECEITA_AREA_FALLBACK_PALETTE, RECEITA_PLANO_PALETTE } from '../constants'
import type {
  ReceitaColunasChartPoint,
  ReceitaDepartamentoCoresConfig,
  ReceitaMesRow,
  ReceitaRecebidoItemRow,
} from '../types/receita.types'
import {
  buildAreaSlices,
  buildColunasChartData,
  buildColunasChartDataPorPlano,
  applyAreaScopeToColunasData,
  buildPlanoSlices,
  departamentoNormKey,
  formatColunasBarValueLabel,
  formatPercentLabel,
  formatPercentMeta,
  isLikelyAbsoluteCurrency,
  resolveColunasBarLabelMode,
  toColunasPercentData,
} from '../utils/receitaColunasChart'
import { labelPlanoContas } from '../utils/planoContasLabel'
import {
  agruparRecebidoPorGrupo,
  buildClienteGrupoMap,
  valorRecebidoItem,
} from '../utils/recebidoGrupos'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'
import {
  copyElementImageToClipboard,
  copyLegendDetalheToClipboard,
  LEGEND_DETALHE_EXPORT_COLORS,
  type LegendDetalheExportData,
} from '@/shared/utils/copyChartImage'
import {
  edgeAwareAnchor,
  labelYForPosition,
  resolveLabelVerticalPosition,
} from '../utils/chartLabelPlacement'
import {
  buildReceitaMetaAreaSlices,
  findMetaAreaSlice,
  resolveDepartamentoAreaColor,
} from '../utils/departamentoAreaCores'

type MetricKey = (typeof RECEITA_COLUNAS_METRICAS)[number]['key']

type StackMode = 'area' | 'plano_percent'

type DetalheBreakdown = 'plano' | 'grupo'

type Props = {
  rows: ReceitaMesRow[]
  ano: number
  departamentoCores?: ReceitaDepartamentoCoresConfig
}

function formatYAxisCurrency(value: number): string {
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

function barInsideFontSize(label: string, barWidth: number, barHeight: number): number | null {
  const minHeight = RECEITA_CHART_LABEL.minBarHeight
  if (barHeight < minHeight) return null

  const maxFont = RECEITA_CHART_LABEL.barInside
  const charWidthAtMax = maxFont * 0.58
  if (label.length * charWidthAtMax <= barWidth - 4) return maxFont

  const fitted = Math.floor((barWidth - 4) / (label.length * 0.58))
  return fitted >= 8 ? fitted : maxFont
}

function StackSegmentLabel(
  props: LabelProps & {
    stackTotal?: number
    planoShareLabels?: boolean
    percentMetaMode?: boolean
    segmentColor?: string
  },
) {
  const { x, y, width, height, value, stackTotal, planoShareLabels, percentMetaMode } = props
  const num = typeof value === 'number' ? value : Number(value)
  const total = stackTotal ?? 0
  if (!num || x == null || y == null || width == null || height == null) return null

  const w = Number(width)
  const h = Number(height)
  const labelMode = resolveColunasBarLabelMode(!!percentMetaMode, !!planoShareLabels)
  const label = formatColunasBarValueLabel(num, labelMode, { stackTotal: total })

  if (!label) return null

  const cx = Number(x) + w / 2
  const segmentCy = Number(y) + h / 2
  const fontSize = barInsideFontSize(label, w, h)

  if (fontSize != null) {
    return (
      <text
        x={cx}
        y={segmentCy}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={600}
        pointerEvents="none"
      >
        {label}
      </text>
    )
  }

  return null
}

function ConsolidadoBarLabel(
  props: LabelProps & { percentMetaMode?: boolean },
) {
  const { x, y, width, height, value, percentMetaMode } = props
  const num = typeof value === 'number' ? value : Number(value)
  if (!num || x == null || y == null || width == null || height == null) return null

  const w = Number(width)
  const h = Number(height)
  const labelMode = resolveColunasBarLabelMode(!!percentMetaMode, false)
  const label = formatColunasBarValueLabel(num, labelMode)
  if (!label) return null

  const fontSize = barInsideFontSize(label, w, h)
  if (fontSize == null) return null

  return (
    <text
      x={Number(x) + w / 2}
      y={Number(y) + h / 2}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontWeight={600}
      pointerEvents="none"
    >
      {label}
    </text>
  )
}

function ColunasLinePointLabel({
  color,
  percentMetaMode,
  total,
  offset = 22,
  stagger = 0,
}: {
  color: string
  percentMetaMode: boolean
  total: number
  offset?: number
  stagger?: number
}) {
  return function Label(props: LabelProps & { index?: number }) {
    const { x, y, value, index } = props
    if (value == null || x == null || y == null) return null
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num) || num <= 0) return null

    const text = formatColunasBarValueLabel(
      num,
      resolveColunasBarLabelMode(percentMetaMode, false),
    )
    if (!text) return null

    const cx = Number(x)
    const cy = Number(y)
    const anchor = edgeAwareAnchor(index, total)
    const adjustedOffset = offset + (index != null && stagger > 0 && index % 2 === 1 ? stagger : 0)
    const vertical = resolveLabelVerticalPosition(cy, adjustedOffset, undefined, 'above')
    const labelY = labelYForPosition(cy, adjustedOffset, vertical)
    const labelX = anchor === 'start' ? cx + 8 : anchor === 'end' ? cx - 8 : cx
    const charWidth = 6.4
    const boxWidth = text.length * charWidth + 8
    const boxHeight = 15
    const boxX =
      anchor === 'start' ? labelX - 3 : anchor === 'end' ? labelX - boxWidth + 3 : labelX - boxWidth / 2
    const boxY = Math.max(RECEITA_CHART_LAYOUT.labelMinY, labelY - 12)

    return (
      <g pointerEvents="none">
        <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx={3} fill="#fff" fillOpacity={0.88} />
        <text
          x={labelX}
          y={labelY}
          fill={color}
          textAnchor={anchor}
          dominantBaseline={vertical === 'above' ? 'auto' : 'hanging'}
          fontSize={RECEITA_CHART_LABEL.linePoint}
          fontWeight={600}
        >
          {text}
        </text>
      </g>
    )
  }
}

/** Séries de linha que sempre exibem rótulo de valor em modo R$ (meta e previsto). */
const COLUNAS_LINE_LABEL_SERIES: Partial<
  Record<MetricKey, { offset: number; stagger: number }>
> = {
  meta: { offset: 22, stagger: 0 },
  previsto: { offset: 16, stagger: 14 },
}

function selectMesAtIndex(
  chartData: ReceitaColunasChartPoint[],
  index: number | undefined,
  setSelectedMes: Dispatch<SetStateAction<number | null>>,
) {
  if (index == null || index < 0 || index >= chartData.length) return
  const mes = chartData[index].mes
  setSelectedMes((prev) => (prev === mes ? null : mes))
}

function sumRecebidoSlices(
  point: ReceitaColunasChartPoint,
  stackSlices: { dataKey: string }[],
): number {
  return stackSlices.reduce((sum, s) => sum + (Number(point[s.dataKey]) || 0), 0)
}

function resolveRecebidoMes(
  point: ReceitaColunasChartPoint,
  stackSlices: { dataKey: string }[],
): {
  recebidoMes: number
  recebidoOficial: number
  semArea: number
  diffOficial: number
} {
  const recebidoOficial =
    typeof point.recebidoTotal === 'number' ? point.recebidoTotal : 0
  const recebidoSlices = sumRecebidoSlices(point, stackSlices)
  const recebidoMes = recebidoSlices > 0 ? recebidoSlices : recebidoOficial
  const diffOficial = recebidoOficial - recebidoSlices
  const semArea = diffOficial > 1 ? diffOficial : 0
  return { recebidoMes, recebidoOficial, semArea, diffOficial }
}

function pctDaMeta(valor: number, meta: number): number | null {
  if (!meta) return null
  return (valor / meta) * 100
}

type MesDetalheItem = {
  key: string
  name: string
  color: string
  valor: number
  pctShare: number | null
  /** Recebido da área ÷ meta do mês. */
  pctMeta: number | null
}

function buildMesDetalheItems(
  point: ReceitaColunasChartPoint,
  stackSlices: { dataKey: string; departamento: string; color: string }[],
  planoShareMode: boolean,
  percentMetaMode: boolean,
): MesDetalheItem[] {
  const { recebidoMes } = resolveRecebidoMes(point, stackSlices)
  const metaMes = Number(point.meta) || 0

  return stackSlices
    .map((s) => {
      const valor = Number(point[s.dataKey]) || 0
      return {
        key: s.dataKey,
        name: s.departamento,
        color: s.color,
        valor,
        pctShare:
          planoShareMode && !percentMetaMode && recebidoMes > 0
            ? (valor / recebidoMes) * 100
            : null,
        pctMeta:
          percentMetaMode
            ? valor
            : metaMes > 0
              ? (valor / metaMes) * 100
              : null,
      }
    })
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor)
}

function buildPlanoDetalheItemsFromItens(
  itens: ReceitaRecebidoItemRow[],
  metaMes: number,
  percentMetaMode: boolean,
): MesDetalheItem[] {
  const byPlano = new Map<string, number>()
  for (const item of itens) {
    const plano = item.plano_contas?.trim() || 'Sem plano'
    byPlano.set(plano, (byPlano.get(plano) ?? 0) + valorRecebidoItem(item))
  }
  const totalArea = [...byPlano.values()].reduce((s, v) => s + v, 0)

  return [...byPlano.entries()]
    .map(([plano, valor], i) => ({
      key: plano,
      name: labelPlanoContas(plano),
      color: RECEITA_PLANO_PALETTE[i % RECEITA_PLANO_PALETTE.length],
      valor: percentMetaMode && metaMes > 0 ? (valor / metaMes) * 100 : valor,
      pctShare: !percentMetaMode && totalArea > 0 ? (valor / totalArea) * 100 : null,
      pctMeta:
        percentMetaMode
          ? valor
          : metaMes > 0
            ? (valor / metaMes) * 100
            : null,
    }))
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor)
}

function buildGrupoDetalheItemsFromItens(
  itens: ReceitaRecebidoItemRow[],
  clienteGrupoMap: Map<string, string>,
  metaMes: number,
  percentMetaMode: boolean,
): MesDetalheItem[] {
  return agruparRecebidoPorGrupo(itens, clienteGrupoMap)
    .map((g, i) => ({
      key: g.grupo,
      name: g.grupo,
      color: RECEITA_AREA_FALLBACK_PALETTE[i % RECEITA_AREA_FALLBACK_PALETTE.length],
      valor: percentMetaMode && metaMes > 0 ? (g.total / metaMes) * 100 : g.total,
      pctShare: null,
      pctMeta:
        percentMetaMode
          ? g.total
          : metaMes > 0
            ? (g.total / metaMes) * 100
            : null,
    }))
    .filter((i) => i.valor > 0)
}

function MesDetalheItemValor({
  item,
  planoShareMode,
  percentMetaMode,
  subClassName = 'text-[10px]',
}: {
  item: MesDetalheItem
  planoShareMode: boolean
  percentMetaMode: boolean
  subClassName?: string
}) {
  if (percentMetaMode) {
    if (isLikelyAbsoluteCurrency(item.valor)) {
      return (
        <>
          <p className="m-0 font-semibold leading-5">{formatCurrency(item.valor)}</p>
          {item.pctMeta != null && (
            <p className={cn('m-0 mt-0.5 font-normal leading-4 text-sky-700', subClassName)}>
              {formatPercentMeta(item.pctMeta)} da meta
            </p>
          )}
        </>
      )
    }
    return (
      <>
        <p className="m-0 font-semibold leading-5">{formatPercentLabel(item.valor)}</p>
        <p className={cn('m-0 mt-0.5 font-normal leading-4 text-sky-700', subClassName)}>da meta</p>
      </>
    )
  }

  if (planoShareMode && item.pctShare != null) {
    return (
      <>
        <p className="m-0 font-semibold leading-5">{formatPercentLabel(item.pctShare)}</p>
        <p className={cn('m-0 mt-0.5 font-normal leading-4 text-slate-500', subClassName)}>
          {formatCurrency(item.valor)}
        </p>
        {item.pctMeta != null && (
          <p className={cn('m-0 mt-0.5 font-normal leading-4 text-sky-700', subClassName)}>
            {formatPercentMeta(item.pctMeta)} da meta
          </p>
        )}
      </>
    )
  }

  return (
    <>
      <p className="m-0 font-semibold leading-5">{formatCurrency(item.valor)}</p>
      {item.pctMeta != null && (
        <p className={cn('m-0 mt-0.5 font-normal leading-4 text-sky-700', subClassName)}>
          {formatPercentMeta(item.pctMeta)} da meta
        </p>
      )}
    </>
  )
}

function formatRecebidoMesDisplay(recebidoMes: number, percentMetaMode: boolean): string {
  if (percentMetaMode) {
    if (isLikelyAbsoluteCurrency(recebidoMes)) return formatCurrency(recebidoMes)
    return `${formatPercentLabel(recebidoMes)} da meta`
  }
  return formatCurrency(recebidoMes)
}

function resolveChartHoverIndex(
  state: MouseHandlerDataParam,
  dataLength: number,
): number | null {
  if (!state.isTooltipActive) return null
  const raw = state.activeTooltipIndex ?? state.activeIndex
  const idx = typeof raw === 'number' ? raw : null
  if (idx == null || idx < 0 || idx >= dataLength) return null
  return idx
}

function MonthTick(
  props: XAxisTickContentProps & {
    onHoverIndex: (index: number) => void
    onSelectIndex?: (index: number) => void
  },
) {
  const { x, y, payload, index, onHoverIndex, onSelectIndex } = props
  const xNum = Number(x)
  const yNum = Number(y)
  if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) return null
  const label = payload?.value ?? ''

  return (
    <g transform={`translate(${xNum},${yNum})`}>
      <rect
        x={-32}
        y={-300}
        width={64}
        height={320}
        fill="transparent"
        style={{ cursor: onSelectIndex ? 'pointer' : undefined }}
        onMouseEnter={() => onHoverIndex(index)}
        onClick={(e) => {
          e.stopPropagation()
          onSelectIndex?.(index)
        }}
      />
      <text
        dy={16}
        textAnchor="middle"
        fill={RECEITA_CHART_AXIS.tick}
        fontSize={12}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  )
}

function formatMesDetalheItemExportValueLines(
  item: MesDetalheItem,
  planoShareMode: boolean,
  percentMetaMode: boolean,
): string[] {
  const lines: string[] = []

  if (percentMetaMode) {
    if (isLikelyAbsoluteCurrency(item.valor)) {
      lines.push(formatCurrency(item.valor))
      if (item.pctMeta != null) lines.push(`${formatPercentMeta(item.pctMeta)} da meta`)
    } else {
      lines.push(`${formatPercentLabel(item.valor)} da meta`)
    }
    return lines
  }

  if (planoShareMode && item.pctShare != null) {
    lines.push(formatPercentLabel(item.pctShare))
    lines.push(formatCurrency(item.valor))
    if (item.pctMeta != null) lines.push(`${formatPercentMeta(item.pctMeta)} da meta`)
    return lines
  }

  lines.push(formatCurrency(item.valor))
  if (item.pctMeta != null) lines.push(`${formatPercentMeta(item.pctMeta)} da meta`)
  return lines
}

const GRUPO_COPY_TOP_N = 10
const GRUPO_COPY_OUTROS_COLOR = '#64748b'

type MesDetalheExportItem = MesDetalheItem & { exportSubtitle?: string }

function grupoItemCurrencyValor(
  item: MesDetalheItem,
  metaMes: number,
  percentMetaMode: boolean,
): number {
  if (percentMetaMode && metaMes > 0 && !isLikelyAbsoluteCurrency(item.valor)) {
    return (item.valor / 100) * metaMes
  }
  return item.valor
}

function aggregateGrupoItemsForCopyExport(
  items: MesDetalheItem[],
  metaMes: number,
  percentMetaMode: boolean,
): MesDetalheExportItem[] {
  const sorted = [...items].sort((a, b) => b.valor - a.valor)
  if (sorted.length <= GRUPO_COPY_TOP_N) return sorted

  const top = sorted.slice(0, GRUPO_COPY_TOP_N)
  const rest = sorted.slice(GRUPO_COPY_TOP_N)
  const restTotal = rest.reduce(
    (sum, item) => sum + grupoItemCurrencyValor(item, metaMes, percentMetaMode),
    0,
  )

  const outros: MesDetalheExportItem = {
    key: '__demais_grupos__',
    name: 'Demais grupos',
    color: GRUPO_COPY_OUTROS_COLOR,
    valor:
      percentMetaMode && metaMes > 0
        ? (restTotal / metaMes) * 100
        : restTotal,
    pctShare: null,
    pctMeta:
      percentMetaMode
        ? restTotal
        : metaMes > 0
          ? (restTotal / metaMes) * 100
          : null,
    exportSubtitle: `(${rest.map((item) => item.name).join(', ')})`,
  }

  return [...top, outros]
}

function buildColunasDetalheExportData({
  mesLabel,
  areaLabel,
  recebidoMes,
  metaMes,
  pctAtingido,
  percentMetaMode,
  detalheBreakdown,
  items,
  detalheLoading,
  planoShareMode,
}: {
  mesLabel: string
  areaLabel?: string | null
  recebidoMes: number
  metaMes: number
  pctAtingido: number | null
  percentMetaMode: boolean
  detalheBreakdown?: DetalheBreakdown | null
  items: MesDetalheItem[]
  detalheLoading?: boolean
  planoShareMode: boolean
}): LegendDetalheExportData {
  const C = LEGEND_DETALHE_EXPORT_COLORS
  const titleFont = '600 14px system-ui, -apple-system, sans-serif'
  const bodyFont = '400 12px system-ui, -apple-system, sans-serif'
  const smallFont = '400 11px system-ui, -apple-system, sans-serif'

  const headerLines: LegendDetalheExportData['headerLines'] = [
    areaLabel
      ? {
          segments: [
            { text: mesLabel, color: C.title, font: titleFont },
            { text: ` · ${areaLabel}`, color: C.area, font: '500 14px system-ui, -apple-system, sans-serif' },
          ],
        }
      : { text: mesLabel, color: C.title, font: titleFont },
  ]

  if (recebidoMes > 0) {
    headerLines.push({
      segments: [
        { text: 'Recebido ', color: C.label, font: bodyFont },
        {
          text: formatRecebidoMesDisplay(recebidoMes, percentMetaMode),
          color: C.value,
          font: '600 12px system-ui, -apple-system, sans-serif',
        },
      ],
    })
  }

  if (detalheBreakdown) {
    headerLines.push({
      text:
        detalheBreakdown === 'grupo'
          ? 'Detalhe por grupo de empresas'
          : 'Detalhe por plano de contas',
      font: smallFont,
      color: C.muted,
    })
  }

  if (!percentMetaMode && metaMes > 0) {
    headerLines.push({
      text: `Meta ${formatCurrency(metaMes)}`,
      font: bodyFont,
      color: C.label,
    })
    if (pctAtingido != null && recebidoMes > 0) {
      headerLines.push({
        text: `${formatPercentMeta(pctAtingido)} atingido`,
        font: '600 12px system-ui, -apple-system, sans-serif',
        color: C.area,
      })
    }
  }

  const exportItems: MesDetalheExportItem[] =
    detalheBreakdown === 'grupo'
      ? aggregateGrupoItemsForCopyExport(items, metaMes, percentMetaMode)
      : items

  const mapValueLines = (lines: string[]) =>
    lines.map((text, index) => ({
      text,
      color: index === 0 ? C.value : C.accent,
      font:
        index === 0
          ? '600 12px system-ui, -apple-system, sans-serif'
          : smallFont,
    }))

  return {
    headerLines,
    rows: exportItems.map((item) => ({
      name: item.name,
      nameColor: C.rowName,
      color: item.color,
      subtitle: item.exportSubtitle,
      subtitleColor: C.muted,
      valueLines: mapValueLines(
        formatMesDetalheItemExportValueLines(
          item,
          planoShareMode && !detalheBreakdown,
          percentMetaMode,
        ),
      ),
    })),
    emptyMessage: detalheLoading
      ? 'Carregando detalhe…'
      : items.length === 0
        ? 'Sem recebido neste mês.'
        : undefined,
    preferSingleColumn: !!detalheBreakdown,
  }
}

function findAreaSliceForKey(
  slices: { dataKey: string; departamento: string; color: string }[],
  areaKey: string,
): (typeof slices)[number] | null {
  const byKey = slices.find((s) => departamentoNormKey(s.departamento) === areaKey)
  if (byKey) return byKey

  const label = RECEITA_DEPARTAMENTO_LABELS[areaKey]
  if (!label) return null
  const labelKey = departamentoNormKey(label)
  return slices.find((s) => departamentoNormKey(s.departamento) === labelKey) ?? null
}

function ColunasLegendaCopyButton({
  getExportData,
  exportRef,
  className,
}: {
  getExportData?: () => LegendDetalheExportData | null
  exportRef?: RefObject<HTMLElement | null>
  className?: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  const handleCopy = async () => {
    setStatus('loading')
    try {
      const exportData = getExportData?.()
      if (exportData) {
        await copyLegendDetalheToClipboard(exportData)
      } else {
        const element = exportRef?.current
        if (!element) {
          toast.error('Legenda não disponível para cópia')
          return
        }
        await copyElementImageToClipboard(element)
      }
      setStatus('done')
      toast.success('Legenda copiada — cole no PowerPoint com Ctrl+V')
      window.setTimeout(() => setStatus('idle'), 2000)
    } catch (error) {
      setStatus('idle')
      const message =
        error instanceof Error ? error.message : 'Não foi possível copiar a legenda'
      toast.error(message)
    }
  }

  const Icon = status === 'loading' ? Loader2 : status === 'done' ? Check : Copy

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('pointer-events-auto h-7 shrink-0 gap-1 px-2 text-[11px] text-slate-500', className)}
      onClick={(e) => {
        e.stopPropagation()
        void handleCopy()
      }}
      disabled={status === 'loading'}
      aria-label="Copiar legenda como imagem com fundo transparente"
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'loading' && 'animate-spin')} aria-hidden />
      Copiar
    </Button>
  )
}

function ColunasTooltipContent({
  point,
  breakdownPoint,
  mesLabel,
  stackSlices,
  planoShareMode,
  percentMetaMode,
  porArea,
  visibleMetrics,
  pinned = false,
  onUnpin,
  areaSelecionada,
  areaLabel,
  detalheBreakdown,
  detalheItems,
  detalheLoading,
}: {
  point: ReceitaColunasChartPoint
  breakdownPoint?: ReceitaColunasChartPoint
  mesLabel?: string
  stackSlices: { dataKey: string; departamento: string; color: string }[]
  planoShareMode: boolean
  percentMetaMode: boolean
  porArea: boolean
  visibleMetrics: Set<MetricKey>
  pinned?: boolean
  onUnpin?: () => void
  areaSelecionada?: string | null
  areaLabel?: string | null
  detalheBreakdown?: DetalheBreakdown | null
  detalheItems?: MesDetalheItem[]
  detalheLoading?: boolean
}) {
  const areaPoint = breakdownPoint ?? point
  const itemsDefault = porArea && !areaSelecionada
    ? buildMesDetalheItems(areaPoint, stackSlices, planoShareMode, percentMetaMode)
    : []
  const items: MesDetalheItem[] =
    areaSelecionada && detalheBreakdown ? (detalheItems ?? []) : itemsDefault
  const recebidoMes = resolveRecebidoMes(point, stackSlices).recebidoMes
  const semArea = porArea && !areaSelecionada ? resolveRecebidoMes(areaPoint, stackSlices).semArea : 0
  const metaMes = Number(point.meta) || 0
  const pctAtingido = percentMetaMode
    ? recebidoMes > 0
      ? recebidoMes
      : null
    : pctDaMeta(recebidoMes, metaMes)
  const metricEntries = RECEITA_COLUNAS_METRICAS.filter((m) => visibleMetrics.has(m.key))
    .map((m) => ({ ...m, valor: Number(point[m.key]) || 0 }))
    .filter((m) => m.valor > 0)
  const exportData = useMemo(
    () =>
      buildColunasDetalheExportData({
        mesLabel: mesLabel ?? point.mesLabel,
        areaLabel,
        recebidoMes,
        metaMes,
        pctAtingido,
        percentMetaMode,
        detalheBreakdown,
        items,
        detalheLoading,
        planoShareMode,
      }),
    [
      mesLabel,
      point.mesLabel,
      areaLabel,
      recebidoMes,
      metaMes,
      pctAtingido,
      percentMetaMode,
      detalheBreakdown,
      items,
      detalheLoading,
      planoShareMode,
    ],
  )

  return (
    <div
      className={cn(
        'z-50 w-max min-w-[16rem] max-w-lg rounded-xl border bg-white text-sm shadow-lg',
        pinned
          ? 'pointer-events-auto border-sky-300 ring-2 ring-sky-200/80'
          : 'pointer-events-none border-slate-200/80',
      )}
    >
      <div data-legend-export className="px-3 py-2.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold capitalize text-slate-800">{mesLabel ?? point.mesLabel}</p>
            {areaLabel && (
              <p className="mt-0.5 text-xs font-medium text-sky-800">{areaLabel}</p>
            )}
            {detalheBreakdown && (
              <p className="mt-0.5 text-[10px] text-slate-500">
                {detalheBreakdown === 'grupo' ? 'Por grupo de empresas' : 'Por plano de contas'}
              </p>
            )}
          </div>
        </div>

      {!percentMetaMode && metaMes > 0 && (
        <div className="mb-2 space-y-1 text-xs text-slate-500">
          <p className="m-0 leading-4">
            Meta do mês:{' '}
            <span className="font-semibold tabular-nums text-slate-800">
              {formatCurrency(metaMes)}
            </span>
          </p>
          {pctAtingido != null && recebidoMes > 0 && (
            <p className="m-0 font-medium leading-4 text-sky-700">
              {formatPercentMeta(pctAtingido)} atingido
            </p>
          )}
        </div>
      )}

      {recebidoMes > 0 && (
        <p className="mb-3 mt-0 text-xs leading-4 text-slate-500">
          {areaSelecionada ? 'Recebido da área' : 'Total recebido'}:{' '}
          <span className="font-semibold tabular-nums text-slate-800">
            {formatRecebidoMesDisplay(recebidoMes, percentMetaMode)}
          </span>
          {!percentMetaMode && semArea > 1 && !areaSelecionada && (
            <span className="mt-1 block text-[10px] leading-4 text-amber-700">
              + {formatCurrency(semArea)} recebido sem departamento (não entra no rateio)
            </span>
          )}
        </p>
      )}

      {areaSelecionada && !detalheBreakdown && (
        <p className="mb-2 text-xs text-sky-700">
          Selecione <strong>Por plano</strong> ou <strong>Por grupo</strong> para detalhar esta área.
        </p>
      )}

      {detalheLoading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando detalhe…
        </div>
      )}

      {items.length > 0 ? (
        <table className="mb-2 w-full border-collapse">
          <tbody>
            {items.map((item) => (
              <tr key={item.key} className="align-top">
                <td className="pb-2.5 pr-4 text-slate-600">
                  <span className="inline-flex items-start gap-1.5">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="min-w-0 whitespace-normal">{item.name}</span>
                  </span>
                </td>
                <td
                  data-legend-item-value
                  className="pb-2.5 text-right align-top tabular-nums text-slate-900"
                >
                  <MesDetalheItemValor
                    item={item}
                    planoShareMode={planoShareMode || detalheBreakdown === 'plano'}
                    percentMetaMode={percentMetaMode}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : recebidoMes <= 0 && !detalheLoading ? (
        <p className="mb-2 text-xs text-slate-500">Sem recebido neste mês.</p>
      ) : !porArea && !areaSelecionada ? (
        <p className="mb-2 text-[10px] text-slate-400">
          Clique no mês para ver o detalhe por {planoShareMode ? 'plano' : 'área'}.
        </p>
      ) : areaSelecionada && detalheBreakdown && !detalheLoading && items.length === 0 ? (
        <p className="mb-2 text-xs text-slate-500">Nenhum item neste recorte.</p>
      ) : null}

      {metricEntries.length > 0 && (
        <ul className="mb-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
          {metricEntries.map((m) => (
            <li key={m.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="h-1.5 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.legend}
                {percentMetaMode && m.key !== 'meta' && (
                  <span className="text-slate-400">(% da meta)</span>
                )}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {percentMetaMode
                  ? formatPercentLabel(m.valor)
                  : formatCurrency(m.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}

      </div>

      {pinned && (
        <div
          data-chart-export-ignore
          className="flex items-center justify-end gap-0.5 border-t border-slate-100 px-2 py-1"
        >
          <ColunasLegendaCopyButton getExportData={() => exportData} />
          {onUnpin && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0 text-slate-500"
              onClick={onUnpin}
              aria-label="Fechar legenda fixada"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      <p className="px-3 pb-2 text-[10px] text-slate-400" data-chart-export-ignore>
        {pinned
          ? 'Legenda fixada · use Copiar para colar no PowerPoint'
          : 'Clique na coluna para fixar a legenda e copiar'}
      </p>
    </div>
  )
}

function ColunasMesDetalhePanel({
  point,
  breakdownPoint,
  stackSlices,
  planoShareMode,
  percentMetaMode,
  visibleMetrics,
  chartData,
  selectedMes,
  onSelectMes,
  onClose,
  areaSelecionada,
  areaLabel,
  detalheBreakdown,
  detalheItems,
  detalheLoading,
}: {
  point: ReceitaColunasChartPoint
  breakdownPoint?: ReceitaColunasChartPoint
  stackSlices: { dataKey: string; departamento: string; color: string }[]
  planoShareMode: boolean
  percentMetaMode: boolean
  visibleMetrics: Set<MetricKey>
  chartData: ReceitaColunasChartPoint[]
  selectedMes: number
  onSelectMes: (mes: number) => void
  onClose: () => void
  areaSelecionada?: string | null
  areaLabel?: string | null
  detalheBreakdown?: DetalheBreakdown | null
  detalheItems?: MesDetalheItem[]
  detalheLoading?: boolean
}) {
  const areaPoint = breakdownPoint ?? point
  const itemsDefault = !areaSelecionada
    ? buildMesDetalheItems(areaPoint, stackSlices, planoShareMode, percentMetaMode)
    : []
  const items: MesDetalheItem[] =
    areaSelecionada && detalheBreakdown ? (detalheItems ?? []) : itemsDefault
  const recebidoMes = resolveRecebidoMes(point, stackSlices).recebidoMes
  const semArea = !areaSelecionada ? resolveRecebidoMes(areaPoint, stackSlices).semArea : 0
  const metaMes = Number(point.meta) || 0
  const pctAtingido = percentMetaMode
    ? recebidoMes > 0
      ? recebidoMes
      : null
    : pctDaMeta(recebidoMes, metaMes)
  const exportData = useMemo(
    () =>
      buildColunasDetalheExportData({
        mesLabel: point.mesLabel,
        areaLabel,
        recebidoMes,
        metaMes,
        pctAtingido,
        percentMetaMode,
        detalheBreakdown,
        items,
        detalheLoading,
        planoShareMode,
      }),
    [
      point.mesLabel,
      areaLabel,
      recebidoMes,
      metaMes,
      pctAtingido,
      percentMetaMode,
      detalheBreakdown,
      items,
      detalheLoading,
      planoShareMode,
    ],
  )

  return (
    <div className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/40 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2" data-chart-export-ignore>
        <p className="text-xs font-medium uppercase tracking-wide text-sky-800/80">
          Detalhe do mês
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <ColunasLegendaCopyButton
            getExportData={() => exportData}
            className="text-sky-700 hover:text-sky-900"
          />
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Fechar
          </Button>
        </div>
      </div>

      <div data-legend-export className="space-y-2">
        <div className="space-y-1">
          <p className="m-0 text-sm font-semibold capitalize text-slate-900">
            {point.mesLabel}
            {areaLabel && (
              <span className="font-medium normal-case text-sky-800"> · {areaLabel}</span>
            )}
          </p>
          {recebidoMes > 0 && (
            <p className="m-0 text-sm text-slate-600">
              Recebido{' '}
              <span className="font-semibold tabular-nums text-slate-900">
                {formatRecebidoMesDisplay(recebidoMes, percentMetaMode)}
              </span>
            </p>
          )}
          {detalheBreakdown && (
            <p className="m-0 text-[11px] text-slate-500">
              {detalheBreakdown === 'grupo' ? 'Detalhe por grupo de empresas' : 'Detalhe por plano de contas'}
            </p>
          )}
          {!percentMetaMode && metaMes > 0 && (
            <div className="space-y-0.5 text-xs text-slate-600">
              <p className="m-0">Meta {formatCurrency(metaMes)}</p>
              {pctAtingido != null && recebidoMes > 0 && (
                <p className="m-0 font-medium text-sky-800">
                  {formatPercentMeta(pctAtingido)} atingido
                </p>
              )}
            </div>
          )}
          {!percentMetaMode && semArea > 1 && !areaSelecionada && (
            <p className="m-0 text-[11px] text-amber-800">
              Há {formatCurrency(semArea)} recebido sem departamento fora do rateio por área.
            </p>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5" data-chart-export-ignore>
          {chartData.map((d) => (
            <button
              key={d.mes}
              type="button"
              onClick={() => onSelectMes(d.mes)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors',
                d.mes === selectedMes
                  ? 'border-sky-300 bg-white text-sky-900 shadow-sm'
                  : 'border-transparent bg-white/60 text-slate-600 hover:bg-white',
              )}
            >
              {d.mesLabel}
            </button>
          ))}
        </div>

        {RECEITA_COLUNAS_METRICAS.filter((m) => visibleMetrics.has(m.key)).length > 0 && (
          <ul
            className="mb-3 flex flex-wrap gap-x-4 gap-y-1 border-b border-sky-100 pb-3 text-sm"
            data-chart-export-ignore
          >
            {RECEITA_COLUNAS_METRICAS.filter((m) => visibleMetrics.has(m.key)).map((m) => {
              const v = Number(point[m.key]) || 0
              if (!v) return null
              return (
                <li key={m.key} className="flex items-center gap-1.5 text-slate-700">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  <span>{m.legend}:</span>
                  <span className="font-semibold tabular-nums">
                    {percentMetaMode ? formatPercentLabel(v) : formatCurrency(v)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <table className="w-full border-collapse pr-1 text-sm">
          <tbody>
            {detalheLoading ? (
              <tr>
                <td colSpan={2} className="py-2 text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando detalhe…
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-1 text-slate-500">
                  {detalheBreakdown
                    ? 'Nenhum item neste recorte.'
                    : 'Sem recebido neste mês.'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.key} className="align-top">
                  <td className="rounded-l-lg bg-white/80 px-2.5 py-2 text-slate-700">
                    <span className="inline-flex items-start gap-2">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="min-w-0 whitespace-normal">{item.name}</span>
                    </span>
                  </td>
                  <td
                    data-legend-item-value
                    className="rounded-r-lg bg-white/80 px-2.5 py-2 text-right align-top tabular-nums text-slate-900"
                  >
                    <MesDetalheItemValor
                      item={item}
                      planoShareMode={planoShareMode || detalheBreakdown === 'plano'}
                      percentMetaMode={percentMetaMode}
                      subClassName="text-xs"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ReceitaComparativoColunasChart({
  rows,
  ano,
  departamentoCores = RECEITA_DEPARTAMENTO_CORES,
}: Props) {
  const [stackMode, setStackMode] = useState<StackMode>('area')
  const [percentMetaMode, setPercentMetaMode] = useState(false)
  const [porArea, setPorArea] = useState(true)
  const [showRecebidoStack, setShowRecebidoStack] = useState(true)
  const [areaSelecionada, setAreaSelecionada] = useState<string | null>(null)
  const [detalheBreakdown, setDetalheBreakdown] = useState<DetalheBreakdown | null>(null)
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(
    () =>
      new Set(
        RECEITA_COLUNAS_METRICAS.filter((m) => m.defaultOn).map((m) => m.key),
      ),
  )

  const planoMode = stackMode === 'plano_percent'
  const [selectedMes, setSelectedMes] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const chartExportRef = useRef<HTMLDivElement>(null)
  const meses = useMemo(() => rows.map((r) => r.mes), [rows])

  const metaAreaSlices = useMemo(
    () => buildReceitaMetaAreaSlices(departamentoCores),
    [departamentoCores],
  )

  useEffect(() => {
    setSelectedMes(null)
    setHoveredIndex(null)
    setAreaSelecionada(null)
    setDetalheBreakdown(null)
  }, [stackMode, percentMetaMode, porArea, ano])

  useEffect(() => {
    if (!showRecebidoStack || !porArea || planoMode) {
      setAreaSelecionada(null)
      setDetalheBreakdown(null)
    }
  }, [showRecebidoStack, porArea, planoMode])

  useEffect(() => {
    if (!percentMetaMode) {
      setPorArea(true)
    } else {
      setPorArea(false)
    }
  }, [percentMetaMode])

  const showStackBreakdown = showRecebidoStack && porArea

  const { data: deptRows, isLoading: deptLoading, error: deptError } = useQuery({
    queryKey: ['receita', 'recebido-departamento', ano, meses],
    queryFn: () => receitaService.fetchRecebidoPorDepartamento(ano),
    enabled: meses.length > 0,
  })

  const { data: planoRows, isLoading: planoLoading, error: planoError } = useQuery({
    queryKey: ['receita', 'recebido-plano-mensal', ano, meses],
    queryFn: () => receitaService.fetchRecebidoPorPlanoMensal(ano),
    enabled: meses.length > 0,
  })

  const areaSlices = useMemo(
    () => buildAreaSlices(deptRows ?? [], meses, departamentoCores),
    [deptRows, meses, departamentoCores],
  )

  const planoSlices = useMemo(
    () => buildPlanoSlices(planoRows ?? [], meses),
    [planoRows, meses],
  )

  const stackSlices = planoMode ? planoSlices : areaSlices

  const showAreaDrilldown = showRecebidoStack && porArea && !planoMode && !percentMetaMode

  const areaMetaPct = useMemo(
    () => findMetaAreaSlice(metaAreaSlices, areaSelecionada ?? '')?.pct ?? null,
    [metaAreaSlices, areaSelecionada],
  )

  const { data: previstoDeptRows, isLoading: previstoDeptLoading } = useQuery({
    queryKey: ['receita', 'previsto-departamento', ano],
    queryFn: () => receitaService.fetchPrevistoPorDepartamento(ano),
    enabled: showAreaDrilldown && !!areaSelecionada,
  })

  const { data: itensMesDetalheData, isLoading: loadingItensMes } = useQuery({
    queryKey: ['receita', 'colunas-area-itens', ano, selectedMes, areaSelecionada],
    queryFn: () =>
      receitaService.fetchRecebidoItensPorArea(ano, selectedMes!, areaSelecionada!),
    enabled:
      showAreaDrilldown &&
      !!areaSelecionada &&
      detalheBreakdown != null &&
      selectedMes != null,
  })

  const { data: empresasNomeGrupo } = useQuery({
    queryKey: ['receita', 'empresas-nome-grupo'],
    queryFn: () => receitaService.fetchEmpresasNomeGrupo(),
    enabled: showAreaDrilldown && detalheBreakdown === 'grupo' && !!areaSelecionada,
    staleTime: 30 * 60 * 1000,
  })

  const clienteGrupoMap = useMemo(
    () => buildClienteGrupoMap(empresasNomeGrupo ?? []),
    [empresasNomeGrupo],
  )

  const singleAreaSlice = useMemo(() => {
    if (!areaSelecionada) return null
    const slice = findAreaSliceForKey(areaSlices, areaSelecionada)
    if (!slice) return null
    return {
      ...slice,
      color: resolveDepartamentoAreaColor(areaSelecionada, departamentoCores),
    }
  }, [areaSelecionada, areaSlices, departamentoCores])

  const baseRawChartData = useMemo(() => {
    if (planoMode) {
      return buildColunasChartDataPorPlano(ano, rows, planoRows ?? [], planoSlices)
    }
    return buildColunasChartData(ano, rows, deptRows ?? [], areaSlices)
  }, [ano, planoMode, rows, planoRows, planoSlices, deptRows, areaSlices])

  const rawChartData = useMemo(() => {
    if (!areaSelecionada || areaMetaPct == null) return baseRawChartData
    return applyAreaScopeToColunasData(
      baseRawChartData,
      rows,
      areaSelecionada,
      areaMetaPct,
      previstoDeptRows ?? [],
    )
  }, [baseRawChartData, areaSelecionada, areaMetaPct, rows, previstoDeptRows])

  const effectiveStackSlices = singleAreaSlice ? [singleAreaSlice] : stackSlices

  const chartData = useMemo(() => {
    if (!percentMetaMode) return rawChartData
    return toColunasPercentData(rawChartData, effectiveStackSlices)
  }, [percentMetaMode, rawChartData, effectiveStackSlices])

  const chartVisibleMetrics = useMemo(() => {
    if (!percentMetaMode) return visibleMetrics
    const next = new Set(visibleMetrics)
    next.delete('meta')
    return next
  }, [percentMetaMode, visibleMetrics])

  const isLoading =
    (planoMode ? planoLoading : deptLoading) ||
    (!!areaSelecionada && showAreaDrilldown && previstoDeptLoading)
  const error = planoMode ? planoError : deptError

  const selectedPoint = useMemo(
    () => chartData.find((d) => d.mes === selectedMes) ?? null,
    [chartData, selectedMes],
  )

  const breakdownSelectedPoint = useMemo(() => {
    const raw = rawChartData.find((d) => d.mes === selectedMes)
    if (!raw) return null
    if (!percentMetaMode) return raw
    return toColunasPercentData([raw], effectiveStackSlices)[0]
  }, [rawChartData, selectedMes, percentMetaMode, effectiveStackSlices])

  const handleSelectMes = (mes: number) => {
    setSelectedMes((prev) => (prev === mes ? null : mes))
  }

  const handleSelectMesAtIndex = (index: number) => {
    selectMesAtIndex(chartData, index, setSelectedMes)
  }

  const handleBarClick = (_data: unknown, index: number) => {
    handleSelectMesAtIndex(index)
  }

  const handleChartMouseMove = (state: MouseHandlerDataParam) => {
    const idx = resolveChartHoverIndex(state, chartData.length)
    if (idx != null) setHoveredIndex(idx)
  }

  const handleChartMouseLeave = () => {
    if (selectedMes == null) setHoveredIndex(null)
  }

  const hoveredPoint = hoveredIndex != null ? chartData[hoveredIndex] : null
  const legendPinned = selectedMes != null && selectedPoint != null
  const legendPoint = legendPinned ? selectedPoint : hoveredPoint

  const areaLabelAtual = useMemo(
    () => findMetaAreaSlice(metaAreaSlices, areaSelecionada ?? '')?.label ?? null,
    [metaAreaSlices, areaSelecionada],
  )

  const detalheItems = useMemo(() => {
    if (!itensMesDetalheData?.length || !detalheBreakdown || !selectedPoint) return []
    const metaMes = Number(selectedPoint.meta) || 0
    if (detalheBreakdown === 'grupo') {
      return buildGrupoDetalheItemsFromItens(
        itensMesDetalheData,
        clienteGrupoMap,
        metaMes,
        percentMetaMode,
      )
    }
    return buildPlanoDetalheItemsFromItens(itensMesDetalheData, metaMes, percentMetaMode)
  }, [itensMesDetalheData, detalheBreakdown, selectedPoint, clienteGrupoMap, percentMetaMode])

  const selectArea = (key: string) => {
    if (areaSelecionada === key) {
      setAreaSelecionada(null)
      setDetalheBreakdown(null)
      return
    }
    setAreaSelecionada(key)
    setDetalheBreakdown('plano')
  }

  const renderColunasTooltip = () => null

  const toggleMetric = (key: MetricKey) => {
    setVisibleMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1 && !showRecebidoStack) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-start gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <BarChart3 className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {percentMetaMode
                ? porArea
                  ? planoMode
                    ? 'Recebido por plano (% da meta)'
                    : 'Recebido por área (% da meta)'
                  : 'Recebido consolidado (% da meta)'
                : planoMode
                  ? 'Recebido por plano de contas'
                  : porArea
                    ? areaLabelAtual
                      ? areaLabelAtual
                      : 'Recebido por área'
                    : 'Recebido consolidado'}
            </h2>
            <p className="text-xs text-slate-500">
              {percentMetaMode
                ? porArea
                  ? `Recebido e séries em % da meta mensal · ideal para apresentação · ${ano}`
                  : `Total recebido em % da meta · clique no mês para detalhar por ${planoMode ? 'plano' : 'área'} · ${ano}`
                : planoMode
                  ? `Colunas por plano (R$ no eixo, % no rótulo) · clique no mês para detalhar · ${ano}`
                  : porArea
                    ? areaLabelAtual
                      ? `Recebido da área · meta e previsto da área · ${ano}`
                      : `Colunas por departamento · clique no mês para detalhar · ${ano}`
                    : `Recebido total por mês · clique no mês para detalhar por área · ${ano}`}
            </p>
          </div>
        </div>
        {!isLoading && !error && <ChartCopyButton containerRef={chartExportRef} />}
      </div>

      {isLoading && (
        <div className="flex h-[340px] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando…
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          Erro ao carregar recebido{' '}
          {planoMode ? 'por plano de contas' : 'por área'}. Aplique a migration{' '}
          <code className="text-xs">
            {planoMode
              ? 'receita_recebido_por_plano_mensal'
              : 'receita_recebido_por_departamento_mensal'}
          </code>
          .
        </p>
      )}

      {!isLoading && !error && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPercentMetaMode((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                percentMetaMode
                  ? 'border-violet-200 bg-violet-50 text-violet-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
              aria-pressed={percentMetaMode}
            >
              <Percent className="h-3 w-3 shrink-0" aria-hidden />
              {percentMetaMode ? 'Ver valores (R$)' : 'Ver % da meta'}
            </button>

            {showRecebidoStack && (
              <button
                type="button"
                onClick={() => setPorArea((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                  porArea
                    ? 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
                aria-pressed={porArea}
              >
                <Layers className="h-3 w-3 shrink-0" aria-hidden />
                {porArea
                  ? 'Visão consolidada'
                  : planoMode
                    ? 'Quebrar por plano'
                    : 'Quebrar por área'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setStackMode((m) => (m === 'area' ? 'plano_percent' : 'area'))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                planoMode
                  ? 'border-violet-200 bg-violet-50 text-violet-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
              aria-pressed={planoMode}
            >
              <Layers className="h-3 w-3 shrink-0" aria-hidden />
              {planoMode ? 'Ver por área (R$)' : 'Ver por plano (%)'}
            </button>

            <button
              type="button"
              onClick={() => setShowRecebidoStack((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                showRecebidoStack
                  ? 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm'
                  : 'border-transparent bg-slate-100/80 text-slate-400 line-through',
              )}
              aria-pressed={showRecebidoStack}
            >
              <span
                className="h-2 w-2 rounded-sm bg-gradient-to-r from-sky-600 to-sky-300"
                aria-hidden
              />
              {percentMetaMode
                ? 'Recebido (% meta)'
                : planoMode
                  ? 'Recebido (%)'
                  : 'Recebido (por área)'}
            </button>
          </div>

          {showAreaDrilldown && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">Área:</span>
              {metaAreaSlices.map((area) => {
                const ativo = areaSelecionada === area.key
                const chipColor = area.color
                return (
                  <button
                    key={area.key}
                    type="button"
                    onClick={() => selectArea(area.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                      ativo
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                    style={ativo ? { backgroundColor: chipColor } : undefined}
                    aria-pressed={ativo}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: ativo ? '#fff' : chipColor }}
                    />
                    {area.label}
                  </button>
                )
              })}
            </div>
          )}

          {showAreaDrilldown && areaSelecionada && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">Detalhar área:</span>
              <button
                type="button"
                onClick={() => setDetalheBreakdown((m) => (m === 'plano' ? null : 'plano'))}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                  detalheBreakdown === 'plano'
                    ? 'border-violet-200 bg-violet-50 text-violet-800 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
                aria-pressed={detalheBreakdown === 'plano'}
              >
                <Layers className="h-3 w-3 shrink-0" aria-hidden />
                Por plano
              </button>
              <button
                type="button"
                onClick={() => setDetalheBreakdown((m) => (m === 'grupo' ? null : 'grupo'))}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                  detalheBreakdown === 'grupo'
                    ? 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
                aria-pressed={detalheBreakdown === 'grupo'}
              >
                <Users className="h-3 w-3 shrink-0" aria-hidden />
                Por grupo
              </button>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Detalhe do mês:</span>
            {chartData.map((d) => (
              <button
                key={d.mes}
                type="button"
                onClick={() => handleSelectMes(d.mes)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                  selectedMes === d.mes
                    ? 'border-sky-400 bg-sky-100 text-sky-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50',
                )}
              >
                {d.mesLabel}
              </button>
            ))}
          </div>

          <div ref={chartExportRef} className="flex flex-col">
          <div
            data-chart-plot
            className="relative h-[360px] min-h-[360px] w-full min-w-0 overflow-visible"
            onMouseLeave={handleChartMouseLeave}
          >
            {legendPoint && !legendPinned && (
              <div
                className="absolute left-1/2 top-3 z-[70] w-max max-w-[min(32rem,calc(100%-1rem))] -translate-x-1/2"
              >
                <ColunasTooltipContent
                  point={legendPoint}
                  breakdownPoint={undefined}
                  stackSlices={effectiveStackSlices}
                  planoShareMode={planoMode}
                  percentMetaMode={percentMetaMode}
                  porArea={porArea}
                  visibleMetrics={chartVisibleMetrics}
                  pinned={false}
                  areaSelecionada={showAreaDrilldown ? areaSelecionada : null}
                  areaLabel={areaLabelAtual}
                  detalheBreakdown={null}
                  detalheItems={undefined}
                  detalheLoading={false}
                />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
              <ComposedChart
                key={
                  areaSelecionada
                    ? `receita-colunas-area-${areaSelecionada}`
                    : planoMode
                      ? `receita-colunas-plano-${porArea ? 'stack' : 'cons'}`
                      : `receita-colunas-area-${porArea ? 'stack' : 'cons'}`
                }
                data={chartData}
                margin={{
                  left: 4,
                  right: showStackBreakdown ? 68 : 28,
                  top: percentMetaMode ? 32 : RECEITA_CHART_LAYOUT.marginWithPointLabels.top,
                  bottom: 4,
                }}
                barCategoryGap="18%"
                barGap={2}
                onMouseMove={handleChartMouseMove}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.35)"
                />
                <XAxis
                  dataKey="mesLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={(tickProps) => (
                    <MonthTick
                      {...tickProps}
                      onHoverIndex={(index) => setHoveredIndex(index)}
                      onSelectIndex={handleSelectMesAtIndex}
                    />
                  )}
                />
                <YAxis
                  tickFormatter={percentMetaMode ? formatYAxisPercent : formatYAxisCurrency}
                  tick={{ fontSize: 11, fill: RECEITA_CHART_AXIS.tick }}
                  axisLine={false}
                  tickLine={false}
                  width={percentMetaMode ? 48 : 60}
                  domain={[0, 'auto']}
                  padding={
                    percentMetaMode ? undefined : { top: RECEITA_CHART_LAYOUT.yAxisPaddingTopWithLabels }
                  }
                />
                <Tooltip
                  shared
                  filterNull={false}
                  wrapperStyle={{ pointerEvents: 'none', zIndex: 40 }}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={renderColunasTooltip}
                />
                {showStackBreakdown &&
                  effectiveStackSlices.map((seg, segIndex) => (
                    <Bar
                      key={seg.dataKey}
                      dataKey={seg.dataKey}
                      name={seg.departamento}
                      stackId="recebido"
                      fill={seg.color}
                      maxBarSize={56}
                      cursor="pointer"
                      onClick={handleBarClick}
                      style={
                        segIndex === effectiveStackSlices.length - 1
                          ? { cursor: 'pointer' }
                          : undefined
                      }
                    >
                      <LabelList
                        dataKey={seg.dataKey}
                        content={(props) => (
                          <StackSegmentLabel
                            {...props}
                            segmentColor={seg.color}
                            planoShareLabels={planoMode && !percentMetaMode}
                            percentMetaMode={percentMetaMode}
                            stackTotal={
                              typeof props.index === 'number'
                                ? (chartData[props.index]?.recebidoTotal ?? undefined)
                                : undefined
                            }
                          />
                        )}
                      />
                    </Bar>
                  ))}
                {showRecebidoStack && !porArea && (
                  <Bar
                    dataKey="recebidoTotal"
                    name={percentMetaMode ? 'Recebido (% meta)' : 'Recebido'}
                    fill={RECEITA_COLORS.recebido.hex}
                    maxBarSize={56}
                    cursor="pointer"
                    onClick={handleBarClick}
                  >
                    <LabelList
                      dataKey="recebidoTotal"
                      content={(props) => (
                        <ConsolidadoBarLabel {...props} percentMetaMode={percentMetaMode} />
                      )}
                    />
                  </Bar>
                )}
                {RECEITA_COLUNAS_METRICAS.filter((m) => chartVisibleMetrics.has(m.key)).map(
                  (m) => (
                    <Line
                      key={m.key}
                      type="monotone"
                      dataKey={m.key}
                      name={m.legend}
                      stroke={m.color}
                      strokeWidth={2}
                      strokeDasharray={m.strokeDasharray}
                      dot={
                        !percentMetaMode && COLUNAS_LINE_LABEL_SERIES[m.key]
                          ? { r: 3, fill: m.color, stroke: '#fff', strokeWidth: 1.5 }
                          : false
                      }
                      activeDot={{ r: 4, fill: m.color, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls
                    >
                      {!percentMetaMode && COLUNAS_LINE_LABEL_SERIES[m.key] && (
                        <LabelList
                          dataKey={m.key}
                          content={ColunasLinePointLabel({
                            color: m.color,
                            percentMetaMode: false,
                            total: chartData.length,
                            offset: COLUNAS_LINE_LABEL_SERIES[m.key]!.offset,
                            stagger: COLUNAS_LINE_LABEL_SERIES[m.key]!.stagger,
                          })}
                        />
                      )}
                    </Line>
                  ),
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

            <div
              data-chart-legend
              className="mt-3 flex flex-col items-center gap-2"
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
            {RECEITA_COLUNAS_METRICAS.filter(
              (m) => !percentMetaMode || m.key !== 'meta',
            ).map((m) => {
                const on = visibleMetrics.has(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMetric(m.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                      on
                        ? 'border-slate-200 bg-white text-slate-700 shadow-sm'
                        : 'border-transparent bg-slate-100/80 text-slate-400 line-through',
                    )}
                    aria-pressed={on}
                  >
                    <span
                      className="h-0.5 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: m.color }}
                      aria-hidden
                    />
                    {percentMetaMode && m.key !== 'meta'
                      ? `${m.legend} (% meta)`
                      : m.legend}
                  </button>
                )
              })}
              </div>

          {showStackBreakdown && effectiveStackSlices.length > 0 && !areaSelecionada && (
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-1">
              {effectiveStackSlices.map((a) => (
                <span
                  key={a.dataKey}
                  className="inline-flex max-w-[200px] items-center gap-1 text-[10px] text-slate-500"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                    aria-hidden
                  />
                  <span className="truncate">{a.departamento}</span>
                </span>
              ))}
            </div>
          )}
            </div>
          </div>

          {selectedPoint && selectedMes != null && (
            <ColunasMesDetalhePanel
              point={selectedPoint}
              breakdownPoint={breakdownSelectedPoint ?? selectedPoint}
              stackSlices={effectiveStackSlices}
              planoShareMode={planoMode}
              percentMetaMode={percentMetaMode}
              visibleMetrics={chartVisibleMetrics}
              chartData={chartData}
              selectedMes={selectedMes}
              onSelectMes={handleSelectMes}
              onClose={() => setSelectedMes(null)}
              areaSelecionada={showAreaDrilldown ? areaSelecionada : null}
              areaLabel={areaLabelAtual}
              detalheBreakdown={showAreaDrilldown ? detalheBreakdown : null}
              detalheItems={detalheItems}
              detalheLoading={loadingItensMes}
            />
          )}
        </>
      )}
    </section>
  )
}
