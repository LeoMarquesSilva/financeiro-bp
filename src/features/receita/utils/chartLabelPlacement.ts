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
