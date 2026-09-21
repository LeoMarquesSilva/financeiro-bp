import {
  RECEITA_CHART_LABEL,
  RECEITA_CHART_LAYOUT,
  receitaChartInnerPlotHeight,
} from '../constants'

/** Altura do backdrop — mesma fórmula de `ChartLabelWithBackdrop`. */
export function chartLabelBoxHeight(
  secondaryText?: string,
  fontSize: number = RECEITA_CHART_LABEL.linePoint,
): number {
  return secondaryText ? fontSize * 2 + 5 : fontSize + 3
}

/**
 * Ancora o rótulo para dentro do gráfico nas pontas (1º e último ponto).
 */
export function edgeAwareAnchor(
  index: number | undefined,
  total: number | undefined,
): 'start' | 'middle' | 'end' {
  if (index == null || total == null || total <= 1) return 'middle'
  if (index <= 0) return 'start'
  if (index >= total - 1) return 'end'
  return 'middle'
}

/**
 * Escolhe acima/abaixo do ponto garantindo que o backdrop não ultrapasse o topo da área útil.
 * Se não couber acima, inverte para abaixo (e vice-versa quando preferido abaixo).
 */
export function resolveLabelVerticalPosition(
  cy: number,
  offset: number,
  secondaryText: string | undefined,
  preferred: 'above' | 'below',
  plotHeight = receitaChartInnerPlotHeight(),
): 'above' | 'below' {
  const boxH = chartLabelBoxHeight(secondaryText)
  const minY = RECEITA_CHART_LAYOUT.labelMinY
  const maxY = plotHeight - RECEITA_CHART_LAYOUT.labelMinBottom

  const topIfAbove = cy - offset - boxH
  const bottomIfBelow = cy + offset + boxH

  const fitsAbove = topIfAbove >= minY
  const fitsBelow = bottomIfBelow <= maxY

  if (preferred === 'above') {
    if (fitsAbove) return 'above'
    if (fitsBelow) return 'below'
    return 'above'
  }
  if (fitsBelow) return 'below'
  if (fitsAbove) return 'above'
  return 'below'
}

/** Coordenada Y do texto conforme posição vertical resolvida. */
export function labelYForPosition(
  cy: number,
  offset: number,
  position: 'above' | 'below',
): number {
  return position === 'above' ? cy - offset : cy + offset
}

export type ClusterLabelEntry = {
  key: string
  value: number | null | undefined
}

export type ClusterLabelSide = 'above' | 'below'

function rankClusterEntries(
  cluster: ClusterLabelEntry[],
): { key: string; value: number }[] {
  return cluster
    .filter((e): e is { key: string; value: number } => e.value != null && Number.isFinite(e.value))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
}

/** Par próximo (abr 100,37% vs 100%) — não empilhar; um acima e o outro no espaço abaixo. */
const CLUSTER_CLOSE_REL = 0.04

function relativeGap(higher: number, lower: number): number {
  return (higher - lower) / Math.max(Math.abs(higher), 1)
}

/**
 * Lados por série no mesmo mês.
 * - Gap largo: maior acima, menor abaixo (mar 95%, mai 77%, jul).
 * - Par próximo no mesmo lado: previsto/meta fica acima; o outro (recebido) vai
 *   para baixo, no espaço livre — nunca um rótulo em cima do outro.
 */
export function resolveClusterLabelSides(
  cluster: ClusterLabelEntry[],
): Map<string, ClusterLabelSide> {
  const ranked = rankClusterEntries(cluster)
  const sides = new Map<string, ClusterLabelSide>()
  if (ranked.length === 0) return sides

  sides.set(ranked[0]!.key, 'above')
  let side: ClusterLabelSide = 'above'
  for (let i = 1; i < ranked.length; i++) {
    const prev = ranked[i - 1]!
    const cur = ranked[i]!
    if (relativeGap(prev.value, cur.value) >= CLUSTER_CLOSE_REL) {
      side = 'below'
    }
    sides.set(cur.key, side)
  }

  const above = ranked.filter((e) => sides.get(e.key) === 'above')
  if (above.length >= 2) {
    const keep =
      above.find((e) => e.key === 'previsto') ??
      above.find((e) => e.key === 'meta') ??
      above[0]!
    for (const e of above) {
      if (e.key !== keep.key) sides.set(e.key, 'below')
    }
  }

  return sides
}

/** true se valores distantes cruzaram (maior abaixo e menor acima). Par próximo pode divergir. */
export function clusterLabelSidesAreInverted(cluster: ClusterLabelEntry[]): boolean {
  const ranked = rankClusterEntries(cluster)
  const sides = resolveClusterLabelSides(cluster)
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      if (relativeGap(ranked[i]!.value, ranked[j]!.value) < CLUSTER_CLOSE_REL) continue
      if (sides.get(ranked[i]!.key) === 'below' && sides.get(ranked[j]!.key) === 'above') {
        return true
      }
    }
  }
  return false
}

export type ClusteredLabelPlacementOptions = {
  /** Distância extra entre rótulos no mesmo lado (padrão 14). Use ~32 com rótulo de 2 linhas. */
  sameSideStep?: number
  /** Séries que devem ficar abaixo do ponto quando há mais de uma no mês. */
  pinBelow?: readonly string[]
}

/**
 * Lado e afastamento do rótulo conforme a ordem dos valores no mesmo mês.
 * Valor maior fica acima do ponto; valor menor, abaixo — nunca invertido.
 */
export function resolveClusteredLabelPlacement(
  cluster: ClusterLabelEntry[],
  seriesKey: string,
  baseOffset = 12,
  options?: ClusteredLabelPlacementOptions,
): { position: ClusterLabelSide; offset: number } | null {
  const ranked = rankClusterEntries(cluster)
  const idx = ranked.findIndex((e) => e.key === seriesKey)
  if (idx < 0) return null

  const sides = resolveClusterLabelSides(cluster)
  if (ranked.length > 1) {
    for (const key of options?.pinBelow ?? []) {
      if (sides.has(key)) sides.set(key, 'below')
    }
  }
  const position = sides.get(seriesKey) ?? 'above'
  const sameSide = ranked.filter((e) => sides.get(e.key) === position)
  const rankOnSide = sameSide.findIndex((e) => e.key === seriesKey)
  const step = options?.sameSideStep ?? 14
  const stagger =
    sameSide.length > 1 && rankOnSide >= 0
      ? (position === 'above' ? sameSide.length - 1 - rankOnSide : rankOnSide) * step
      : 0

  return { position, offset: baseOffset + stagger }
}

/**
 * Mantém o lado do cluster (não inverte no topo). Se não couber acima, reduz o offset.
 */
export function lockClusterLabelOffset(
  cy: number,
  offset: number,
  secondaryText: string | undefined,
  position: ClusterLabelSide,
  plotHeight = receitaChartInnerPlotHeight(),
): number {
  const boxH = chartLabelBoxHeight(secondaryText)
  const minY = RECEITA_CHART_LAYOUT.labelMinY
  const maxY = plotHeight - RECEITA_CHART_LAYOUT.labelMinBottom
  if (position === 'above') {
    const top = cy - offset - boxH
    if (top >= minY) return offset
    return Math.max(8, cy - minY - boxH)
  }
  const bottom = cy + offset + boxH
  if (bottom <= maxY) return offset
  return Math.max(8, maxY - cy - boxH)
}

export type ClusterLabelPixelEntry = ClusterLabelEntry & {
  boxHeight?: number
  /** cy real da escala do gráfico. Sem isso, estima pelo domínio. */
  pointY?: number
  /** Força o rótulo abaixo do ponto (recebido / linha azul). */
  preferBelow?: boolean
}

export type ClusterLabelPixelBounds = {
  minY?: number
  maxY?: number
}

export type ClusterLabelPixelPlacement = {
  /** Y do texto com dominantBaseline="hanging" (topo da caixa + 2). */
  y: number
  position: ClusterLabelSide
  boxTop: number
  boxHeight: number
}

/** Folga vertical entre caixas do mesmo mês. */
export const CLUSTER_LABEL_PIXEL_GAP = 8
const PIXEL_SOLO_OFFSET = 12

/** Camadas de cima para baixo — não ordenar por valor. */
export const RECEITA_LABEL_LAYER_ORDER = [
  'meta',
  'projetadoBaseAbril',
  'projetadoReal',
  'previsto',
  'recebido',
  'inadimplencia',
] as const

export function receitaLabelLayerRank(key: string): number {
  const i = (RECEITA_LABEL_LAYER_ORDER as readonly string[]).indexOf(key)
  return i >= 0 ? i : RECEITA_LABEL_LAYER_ORDER.length + 1
}

function labelPlotBounds(plotHeight: number): { minY: number; maxY: number } {
  const marginTop = RECEITA_CHART_LAYOUT.marginWithPointLabels.top
  return {
    minY: RECEITA_CHART_LAYOUT.labelMinY,
    maxY: marginTop + plotHeight - RECEITA_CHART_LAYOUT.labelMinBottom,
  }
}

function estimatePointY(
  value: number,
  domainMax: number,
  plotHeight: number,
): number {
  const marginTop = RECEITA_CHART_LAYOUT.marginWithPointLabels.top
  const padTop = RECEITA_CHART_LAYOUT.yAxisPaddingTopWithLabels
  const usable = Math.max(plotHeight - padTop, 1)
  if (domainMax <= 0) return marginTop + plotHeight
  return marginTop + padTop + (1 - value / domainMax) * usable
}

function pinLabelBelow(entry: ClusterLabelPixelEntry): boolean {
  return entry.preferBelow === true || entry.key === 'recebido'
}

function clusterPixelItems(
  cluster: ClusterLabelPixelEntry[],
  domainMax: number,
  plotHeight: number,
): Array<{ key: string; value: number; pointY: number; h: number; below: boolean }> {
  return cluster
    .filter((e): e is ClusterLabelPixelEntry & { value: number } => {
      if (e.value == null || !Number.isFinite(e.value)) return false
      return e.value > 0.005
    })
    .map((e) => ({
      key: e.key,
      value: e.value,
      pointY:
        e.pointY != null && Number.isFinite(e.pointY)
          ? e.pointY
          : estimatePointY(e.value, domainMax, plotHeight),
      h: e.boxHeight ?? chartLabelBoxHeight(),
      below: pinLabelBelow(e),
    }))
}

type LayerBox = {
  key: string
  value: number
  pointY: number
  h: number
  below: boolean
  boxTop: number
}

function clampBoxTop(top: number, h: number, minY: number, maxY: number): number {
  return Math.min(Math.max(top, minY), Math.max(minY, maxY - h))
}

function preferredBoxTop(
  item: { pointY: number; h: number; below: boolean },
  minY: number,
  maxY: number,
): number {
  const raw = item.below
    ? item.pointY + PIXEL_SOLO_OFFSET
    : item.pointY - PIXEL_SOLO_OFFSET - item.h
  return clampBoxTop(raw, item.h, minY, maxY)
}

/** Separa sobreposição com o menor deslocamento — cada rótulo fica perto do próprio ponto. */
function separateOverlappingBoxes(boxes: LayerBox[], minY: number, maxY: number, gap: number): void {
  for (let pass = 0; pass < boxes.length + 2; pass++) {
    boxes.sort((a, b) => a.boxTop - b.boxTop || a.key.localeCompare(b.key))
    let moved = false
    for (let i = 0; i < boxes.length - 1; i++) {
      const a = boxes[i]!
      const b = boxes[i + 1]!
      const need = a.boxTop + a.h + gap - b.boxTop
      if (need <= 0.01) continue
      moved = true

      const aCanUp = a.boxTop - minY
      const bCanDown = Math.max(0, maxY - b.h - b.boxTop)

      if (b.below && !a.below) {
        const down = Math.min(need, bCanDown)
        b.boxTop += down
        const still = a.boxTop + a.h + gap - b.boxTop
        if (still > 0.01) a.boxTop = clampBoxTop(a.boxTop - still, a.h, minY, maxY)
      } else if (a.below && !b.below) {
        const up = Math.min(need, aCanUp)
        a.boxTop -= up
        const still = a.boxTop + a.h + gap - b.boxTop
        if (still > 0.01) b.boxTop = clampBoxTop(b.boxTop + still, b.h, minY, maxY)
      } else {
        const up = Math.min(need, aCanUp)
        a.boxTop -= up
        const still = a.boxTop + a.h + gap - b.boxTop
        if (still > 0.01) b.boxTop = clampBoxTop(b.boxTop + still, b.h, minY, maxY)
      }
    }
    if (!moved) break
  }

  for (const box of boxes) {
    box.boxTop = clampBoxTop(box.boxTop, box.h, minY, maxY)
  }
}

/**
 * Empacota os rótulos do mês sem sobrepor.
 * Cada série fica ancorada no próprio ponto: recebido (azul) abaixo da linha;
 * as demais (previsto, inadimplência, meta) acima da respectiva linha.
 */
export function layoutClusterLabelPixels(
  cluster: ClusterLabelPixelEntry[],
  domainMax: number,
  plotHeight = receitaChartInnerPlotHeight(),
  bounds?: ClusterLabelPixelBounds,
): Map<string, ClusterLabelPixelPlacement> {
  const fallback = labelPlotBounds(plotHeight)
  const minY = bounds?.minY ?? fallback.minY
  const maxY = bounds?.maxY ?? fallback.maxY
  const gap = CLUSTER_LABEL_PIXEL_GAP
  const items = clusterPixelItems(cluster, domainMax, plotHeight)
  const result = new Map<string, ClusterLabelPixelPlacement>()
  if (items.length === 0) return result

  const boxes: LayerBox[] = items.map((item) => ({
    ...item,
    boxTop: preferredBoxTop(item, minY, maxY),
  }))
  separateOverlappingBoxes(boxes, minY, maxY, gap)

  for (const box of boxes) {
    result.set(box.key, {
      y: box.boxTop + 2,
      position: box.below || box.boxTop + box.h / 2 > box.pointY ? 'below' : 'above',
      boxTop: box.boxTop,
      boxHeight: box.h,
    })
  }

  return result
}

export function resolveClusterLabelPixelLayout(
  cluster: ClusterLabelPixelEntry[],
  seriesKey: string,
  domainMax: number,
  plotHeight = receitaChartInnerPlotHeight(),
): ClusterLabelPixelPlacement | null {
  return layoutClusterLabelPixels(cluster, domainMax, plotHeight).get(seriesKey) ?? null
}

export function clusterLabelBoxesOverlap(
  placements: Iterable<Pick<ClusterLabelPixelPlacement, 'boxTop' | 'boxHeight'>>,
  gap = CLUSTER_LABEL_PIXEL_GAP,
): boolean {
  const boxes = [...placements].sort((a, b) => a.boxTop - b.boxTop)
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1]!
    const cur = boxes[i]!
    if (cur.boxTop < prev.boxTop + prev.boxHeight + gap - 0.01) return true
  }
  return false
}
