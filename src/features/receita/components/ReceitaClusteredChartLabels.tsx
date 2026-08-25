import {
  DefaultZIndexes,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  ZIndexLayer,
} from 'recharts'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { RECEITA_CHART_LABEL, RECEITA_CHART_LAYOUT } from '../constants'
import {
  CLUSTER_LABEL_PIXEL_GAP,
  chartLabelBoxHeight,
  edgeAwareAnchor,
  layoutClusterLabelPixels,
} from '../utils/chartLabelPlacement'

function labelBackdropWidth(text: string, secondaryText: string | undefined, fontSize: number) {
  return Math.max(text.length, secondaryText?.length ?? 0) * fontSize * 0.54 + 8
}

function labelBackdropX(
  x: number,
  width: number,
  textAnchor: 'start' | 'middle' | 'end',
) {
  return textAnchor === 'start' ? x - 3 : textAnchor === 'end' ? x - width + 3 : x - width / 2
}

function boxesOverlap(
  a: { boxX: number; boxTop: number; boxWidth: number; boxHeight: number },
  b: { boxX: number; boxTop: number; boxWidth: number; boxHeight: number },
) {
  return (
    a.boxX < b.boxX + b.boxWidth - 1 &&
    b.boxX < a.boxX + a.boxWidth - 1 &&
    a.boxTop < b.boxTop + b.boxHeight - 1 &&
    b.boxTop < a.boxTop + a.boxHeight - 1
  )
}

export type ReceitaClusteredLabelSeries<T> = {
  key: string
  color: string
  getValue: (row: T) => number | null | undefined
  getText?: (row: T, value: number) => string
  getSecondary?: (row: T) => string | undefined
  /** Omite meses intermediários quando o valor é igual ao anterior (meta flat). */
  dedupeFlat?: boolean
}

function ChartLabelWithBackdrop({
  text,
  secondaryText,
  x,
  y,
  color,
  textAnchor,
  fontSize = RECEITA_CHART_LABEL.linePointCluster,
}: {
  text: string
  secondaryText?: string
  x: number
  y: number
  color: string
  textAnchor: 'start' | 'middle' | 'end'
  fontSize?: number
}) {
  const charWidth = fontSize * 0.54
  const boxWidth = Math.max(text.length, secondaryText?.length ?? 0) * charWidth + 8
  const boxHeight = chartLabelBoxHeight(secondaryText, fontSize)
  const boxX =
    textAnchor === 'start' ? x - 3 : textAnchor === 'end' ? x - boxWidth + 3 : x - boxWidth / 2
  const boxY = y - 2

  return (
    <g pointerEvents="none">
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={3}
        fill={color}
        fillOpacity={0.12}
        stroke={color}
        strokeOpacity={0.32}
        strokeWidth={0.75}
        style={{ fill: color, stroke: color }}
      />
      <text
        x={x}
        y={y}
        fill={color}
        style={{ fill: color }}
        textAnchor={textAnchor}
        dominantBaseline="hanging"
        fontSize={fontSize}
        fontWeight={600}
      >
        <tspan x={x}>{text}</tspan>
        {secondaryText && (
          <tspan x={x} dy={fontSize}>
            {secondaryText}
          </tspan>
        )}
      </text>
    </g>
  )
}

/**
 * Rótulos de todas as séries no mesmo mês, empacotados sem sobrepor.
 * Usa a escala real do Recharts (um único layout por mês).
 */
export function ReceitaClusteredChartLabels<T>({
  data,
  series,
  percentMode = false,
  fontSize = RECEITA_CHART_LABEL.linePointCluster,
  xKey = 'mesLabel' as keyof T,
}: {
  data: T[]
  series: ReceitaClusteredLabelSeries<T>[]
  percentMode?: boolean
  fontSize?: number
  xKey?: keyof T
}) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  const plotArea = usePlotArea()

  if (!xScale || !yScale || !plotArea || data.length === 0 || series.length === 0) {
    return null
  }

  const minY = RECEITA_CHART_LAYOUT.labelMinY
  const maxY = plotArea.y + plotArea.height - RECEITA_CHART_LAYOUT.labelMinBottom

  const months = data.flatMap((row, index) => {
    const rawX = xScale(row[xKey] as string | number, { position: 'middle' })
    if (rawX == null || !Number.isFinite(rawX)) return []

    const cluster = series.flatMap((s) => {
      const value = s.getValue(row)
      if (value == null || !Number.isFinite(value) || value <= 0.005) return []
      if (s.dedupeFlat && data.length > 1 && index > 0 && index < data.length - 1) {
        const prev = s.getValue(data[index - 1]!)
        if (prev != null && Math.abs(value - prev) < 0.01) return []
      }
      const pointY = yScale(value)
      if (pointY == null || !Number.isFinite(pointY)) return []
      const secondaryText = s.getSecondary?.(row)
      return [
        {
          key: s.key,
          value,
          pointY,
          boxHeight: chartLabelBoxHeight(secondaryText, fontSize),
          text: s.getText?.(row, value) ?? (percentMode ? formatPercent(value) : formatCurrency(value)),
          secondaryText,
          color: s.color,
        },
      ]
    })
    if (cluster.length === 0) return []

    const layout = layoutClusterLabelPixels(cluster, 1, undefined, { minY, maxY })
    const anchor = edgeAwareAnchor(index, data.length)
    const labelX = anchor === 'start' ? rawX + 8 : anchor === 'end' ? rawX - 8 : rawX

    const labels = cluster.flatMap((item) => {
      const packed = layout.get(item.key)
      if (!packed) return []
      const boxWidth = labelBackdropWidth(item.text, item.secondaryText, fontSize)
      return [
        {
          ...item,
          monthIndex: index,
          labelX,
          textAnchor: anchor,
          boxTop: packed.boxTop,
          boxWidth,
          boxX: labelBackdropX(labelX, boxWidth, anchor),
        },
      ]
    })
    return labels.length ? [{ index, key: String(row[xKey] as string | number), labels }] : []
  })

  for (let m = 1; m < months.length; m++) {
    const prevs = months[m - 1]!.labels
    for (const cur of months[m]!.labels) {
      for (const prev of prevs) {
        if (!boxesOverlap(cur, prev)) continue
        const need = prev.boxTop + prev.boxHeight + CLUSTER_LABEL_PIXEL_GAP - cur.boxTop
        if (need > 0 && cur.boxTop + need + cur.boxHeight <= maxY) {
          cur.boxTop += need
        }
      }
    }
  }

  return (
    <ZIndexLayer zIndex={DefaultZIndexes.label}>
      <g className="receita-clustered-labels" pointerEvents="none">
        {months.map((month) => (
          <g key={`labels-${month.key}-${month.index}`}>
            {month.labels.map((item) => (
              <ChartLabelWithBackdrop
                key={item.key}
                text={item.text}
                secondaryText={item.secondaryText}
                x={item.labelX}
                y={item.boxTop + 2}
                color={item.color}
                textAnchor={item.textAnchor}
                fontSize={fontSize}
              />
            ))}
          </g>
        ))}
      </g>
    </ZIndexLayer>
  )
}
