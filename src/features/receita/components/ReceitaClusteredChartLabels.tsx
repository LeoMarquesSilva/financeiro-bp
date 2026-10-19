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

type LabelBox = { boxX: number; boxTop: number; boxWidth: number; boxHeight: number }

/** Folga mínima entre rótulos de meses/séries diferentes. */
const LABEL_BOX_GAP = 3
/** Passo e alcance da busca vertical por uma posição livre. */
const LABEL_SEARCH_STEP = 2
const LABEL_SEARCH_MAX_SHIFT = 140
/** A partir daqui o afastamento do ponto pesa o triplo. */
const LABEL_FAR_SHIFT = 40
/** Deslocamentos laterais tentados quando meses vizinhos disputam o mesmo espaço. */
const LABEL_SEARCH_DX = [0, 8, -8, 16, -16, 24, -24, 32, -32] as const
/** Raio do ponto que o rótulo não deve cobrir. */
const POINT_CLEARANCE = 5

function boxesOverlap(a: LabelBox, b: LabelBox, gap = 0) {
  return (
    a.boxX < b.boxX + b.boxWidth + gap - 1 &&
    b.boxX < a.boxX + a.boxWidth + gap - 1 &&
    a.boxTop < b.boxTop + b.boxHeight + gap - 1 &&
    b.boxTop < a.boxTop + a.boxHeight + gap - 1
  )
}

type Segment = { key: string; x1: number; y1: number; x2: number; y2: number }
type Point = { key: string; x: number; y: number }

/** Liang–Barsky: o trecho da linha passa por dentro da caixa do rótulo? */
function segmentHitsBox(s: Segment, b: LabelBox): boolean {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const p = [-dx, dx, -dy, dy]
  const q = [
    s.x1 - b.boxX,
    b.boxX + b.boxWidth - s.x1,
    s.y1 - b.boxTop,
    b.boxTop + b.boxHeight - s.y1,
  ]
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i]! < 0) return false
      continue
    }
    const t = q[i]! / p[i]!
    if (p[i]! < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

function pointHitsBox(pt: Point, b: LabelBox): boolean {
  return (
    pt.x > b.boxX - POINT_CLEARANCE &&
    pt.x < b.boxX + b.boxWidth + POINT_CLEARANCE &&
    pt.y > b.boxTop - POINT_CLEARANCE &&
    pt.y < b.boxTop + b.boxHeight + POINT_CLEARANCE
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
    const category = row[xKey] as string | number
    const rawX =
      xScale(category, { position: 'middle' }) ??
      xScale(category)
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
          preferBelow: s.key === 'recebido',
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

  // Linhas e pontos de todas as séries (as linhas do gráfico são `linear`).
  const segments: Segment[] = []
  const points: Point[] = []
  for (const s of series) {
    let prev: { x: number; y: number } | null = null
    data.forEach((row) => {
      const value = s.getValue(row)
      if (value == null || !Number.isFinite(value)) return
      const category = row[xKey] as string | number
      const x = xScale(category, { position: 'middle' }) ?? xScale(category)
      const y = yScale(value)
      if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return
      points.push({ key: s.key, x, y })
      if (prev) segments.push({ key: s.key, x1: prev.x, y1: prev.y, x2: x, y2: y })
      prev = { x, y }
    })
  }

  // Cada rótulo parte da posição do empacotamento do mês e procura, o mais perto
  // possível, um lugar que não cubra outro rótulo, a linha de outra série nem um ponto.
  const labels = months.flatMap((m) => [...m.labels].sort((a, b) => a.boxTop - b.boxTop))
  type Rotulo = (typeof labels)[number]
  const origem = new Map(labels.map((l) => [l, { top: l.boxTop, boxX: l.boxX, labelX: l.labelX }]))

  /** Afastar do ponto custa cada vez mais: rótulo longe da linha confunde tanto quanto encavalar. */
  const distancia = (shift: number, dx: number) =>
    shift + Math.max(0, shift - LABEL_FAR_SHIFT) * 2 + Math.abs(dx) * 2

  const custo = (item: Rotulo, boxX: number, top: number, outros: LabelBox[]) => {
    const box = { ...item, boxX, boxTop: top }
    const rotulos = outros.filter((p) => boxesOverlap(box, p, LABEL_BOX_GAP)).length
    const linhas = segments.filter((s) => s.key !== item.key && segmentHitsBox(s, box)).length
    const pontos = points.filter((pt) => pointHitsBox(pt, box)).length
    const base = origem.get(item)!
    return (
      rotulos * 1000 +
      (linhas + pontos) * 100 +
      distancia(Math.abs(top - base.top), boxX - base.boxX)
    )
  }

  const posicionar = (item: Rotulo, outros: LabelBox[]) => {
    const base = origem.get(item)!
    let best = { top: base.top, dx: 0, cost: Number.POSITIVE_INFINITY }
    for (let shift = 0; shift <= LABEL_SEARCH_MAX_SHIFT; shift += LABEL_SEARCH_STEP) {
      for (const top of shift === 0 ? [base.top] : [base.top - shift, base.top + shift]) {
        if (top < minY || top + item.boxHeight > maxY) continue
        for (const dx of LABEL_SEARCH_DX) {
          const boxX = base.boxX + dx
          const sai = boxX < plotArea.x || boxX + item.boxWidth > plotArea.x + plotArea.width
          if (dx !== 0 && sai) continue
          const cost = custo(item, boxX, top, outros)
          if (cost < best.cost) best = { top, dx, cost }
        }
      }
      // Achou posição limpa: qualquer outra fica mais longe do ponto.
      if (best.cost <= distancia(shift, 0)) break
    }
    item.boxTop = best.top
    item.boxX = base.boxX + best.dx
    item.labelX = base.labelX + best.dx
  }

  // O resultado depende de quem é posicionado primeiro (ele ocupa os melhores lugares).
  // Testa algumas ordens, ajusta cada uma reposicionando rótulo a rótulo contra todos
  // os outros e fica com o arranjo de menor custo total.
  const conflitosNaOrigem = new Map(
    labels.map((l) => [l, custo(l, l.boxX, l.boxTop, labels.filter((o) => o !== l))]),
  )
  const ordens: Rotulo[][] = [
    labels,
    months.slice().reverse().flatMap((m) => labels.filter((l) => l.monthIndex === m.index)),
    labels.slice().sort((a, b) => conflitosNaOrigem.get(b)! - conflitosNaOrigem.get(a)!),
  ]
  let melhor: { total: number; pos: Map<Rotulo, { boxTop: number; boxX: number; labelX: number }> } | null =
    null
  for (const ordem of ordens) {
    for (const l of labels) {
      const o = origem.get(l)!
      l.boxTop = o.top
      l.boxX = o.boxX
      l.labelX = o.labelX
    }
    ordem.forEach((item, i) => posicionar(item, ordem.slice(0, i)))
    for (let passada = 0; passada < 3; passada++) {
      let mudou = false
      for (const item of ordem) {
        const antes = `${item.boxTop}|${item.boxX}`
        posicionar(
          item,
          labels.filter((o) => o !== item),
        )
        if (`${item.boxTop}|${item.boxX}` !== antes) mudou = true
      }
      if (!mudou) break
    }
    const total = labels.reduce(
      (s, l) => s + custo(l, l.boxX, l.boxTop, labels.filter((o) => o !== l)),
      0,
    )
    if (!melhor || total < melhor.total) {
      melhor = {
        total,
        pos: new Map(labels.map((l) => [l, { boxTop: l.boxTop, boxX: l.boxX, labelX: l.labelX }])),
      }
    }
  }
  for (const [l, p] of melhor?.pos ?? []) Object.assign(l, p)

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
