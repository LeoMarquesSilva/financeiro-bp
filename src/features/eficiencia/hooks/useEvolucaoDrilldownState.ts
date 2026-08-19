import { useEffect, useState } from 'react'
import { isPeriodoCurtoFiltro, type MesFiltroEficiencia } from '../constants'
import type { EvolucaoPoint } from '../components/EficienciaEvolucaoChart'
import { resolveMesDrillTarget } from '../utils/evolucaoDrilldown'

export function useEvolucaoDrilldownState(
  mesFiltro: MesFiltroEficiencia,
  resetDeps: readonly unknown[],
  disabled = false,
) {
  const [chartGranularidade, setChartGranularidade] = useState<'mes' | 'dia'>('mes')
  const [mesClicadoGrafico, setMesClicadoGrafico] = useState<number | null>(null)

  const mesDrillTarget = resolveMesDrillTarget(mesFiltro, mesClicadoGrafico)
  const drillDisponivel =
    !disabled && !isPeriodoCurtoFiltro(mesFiltro) && mesDrillTarget != null

  useEffect(() => {
    setChartGranularidade('mes')
    setMesClicadoGrafico(null)
  }, resetDeps)

  const onPointClickMes =
    chartGranularidade === 'mes' && !disabled
      ? (_index: number, point: EvolucaoPoint) => setMesClicadoGrafico(point.mes)
      : undefined

  return {
    chartGranularidade,
    setChartGranularidade,
    mesDrillTarget,
    drillDisponivel,
    mesClicadoGrafico,
    onPointClickMes,
  }
}
