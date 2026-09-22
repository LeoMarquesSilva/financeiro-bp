import { formatPercent } from '@/shared/utils/format'
import type { HeatCell } from '../components/OverviewKpiHeatRow'

/** Fatia mensal da meta anual: 100% ÷ 12. */
export const META_MENSAL_DESENVOLVIMENTO = 100 / 12

/** Horas:minutos para células do heat map (ex.: 25:00). */
export function formatMinutosHeatLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Linha 1 = horas lançadas; linha 2 = % da meta. */
export function buildDesenvolvimentoEquipeHeatCell(
  minutos: number,
  pctAtingimento: number,
): HeatCell {
  return {
    value: pctAtingimento,
    label: formatMinutosHeatLabel(minutos),
    subLabel: formatPercent(pctAtingimento),
  }
}
