import { RECEITA_CHART_LAYOUT, receitaChartInnerPlotHeight } from '../constants'

/** Altura estimada do backdrop do rótulo (1 ou 2 linhas). */
export function chartLabelBoxHeight(secondaryText?: string): number {
  return secondaryText ? 29 : 15
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

/**
 * Lado e afastamento do rótulo conforme a ordem dos valores no mesmo mês.
 * Valor maior fica acima do ponto; valor menor, abaixo — nunca invertido.
 */
export function resolveClusteredLabelPlacement(
  cluster: ClusterLabelEntry[],
  seriesKey: string,
  baseOffset = 12,
): { position: ClusterLabelSide; offset: number } | null {
  const ranked = rankClusterEntries(cluster)
  const idx = ranked.findIndex((e) => e.key === seriesKey)
  if (idx < 0) return null

  const sides = resolveClusterLabelSides(cluster)
  const position = sides.get(seriesKey) ?? 'above'
  const sameSide = ranked.filter((e) => sides.get(e.key) === position)
  const rankOnSide = sameSide.findIndex((e) => e.key === seriesKey)
  const stagger =
    sameSide.length > 1 && rankOnSide >= 0
      ? (position === 'above' ? sameSide.length - 1 - rankOnSide : rankOnSide) * 14
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
