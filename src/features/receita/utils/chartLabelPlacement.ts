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

/**
 * Lado e afastamento do rótulo conforme a ordem dos valores no mesmo mês.
 * Valor maior fica acima do ponto; valor menor, abaixo — evita invertido/encavalado.
 */
export function resolveClusteredLabelPlacement(
  cluster: ClusterLabelEntry[],
  seriesKey: string,
  baseOffset = 12,
): { position: 'above' | 'below'; offset: number } | null {
  const ranked = cluster
    .filter((e): e is { key: string; value: number } => e.value != null && Number.isFinite(e.value))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))

  const idx = ranked.findIndex((e) => e.key === seriesKey)
  if (idx < 0) return null

  const n = ranked.length
  const sides = new Map<string, 'above' | 'below'>()

  for (let i = 0; i < n; i++) {
    sides.set(ranked[i]!.key, i < n / 2 ? 'above' : 'below')
  }

  for (let i = 0; i < n - 1; i++) {
    const higher = ranked[i]!
    const lower = ranked[i + 1]!
    if (sides.get(higher.key) !== sides.get(lower.key)) continue
    const close = (higher.value - lower.value) / Math.max(Math.abs(higher.value), 1) < 0.2
    if (close) {
      sides.set(higher.key, 'above')
      sides.set(lower.key, 'below')
    }
  }

  const position = sides.get(seriesKey) ?? 'above'
  const neighborIdx = position === 'above' ? idx - 1 : idx + 1
  const neighbor = neighborIdx >= 0 && neighborIdx < n ? ranked[neighborIdx] : undefined
  const relGap = neighbor
    ? Math.abs(ranked[idx]!.value - neighbor.value) / Math.max(Math.abs(ranked[idx]!.value), 1)
    : 1
  const extra = relGap < 0.08 ? 16 : relGap < 0.16 ? 8 : 0

  return { position, offset: baseOffset + extra }
}
