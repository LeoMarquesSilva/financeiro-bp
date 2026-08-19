import type { EvolucaoPoint } from '../components/EficienciaEvolucaoChart'
import type { MesFiltroEficiencia } from '../constants'
import { MESES_EFICIENCIA } from '../constants'

export type EvolucaoDiarioRow = {
  dia: number
  total: number
  pct: number
}

/** Mês alvo do drill-down: clique no gráfico ou filtro com um único mês. */
export function resolveMesDrillTarget(
  mesFiltro: MesFiltroEficiencia,
  mesClicado: number | null,
): number | null {
  if (mesClicado != null) return mesClicado
  if (Array.isArray(mesFiltro) && mesFiltro.length === 1) return mesFiltro[0]!
  return null
}

/** Série diária: somente dias com volume (sem fins de semana vazios). */
export function buildEvolucaoDiarioChart(
  rows: EvolucaoDiarioRow[],
  meta: number | null,
): EvolucaoPoint[] {
  return rows
    .filter((row) => row.total > 0)
    .sort((a, b) => a.dia - b.dia)
    .map((row) => ({
      mes: row.dia,
      label: String(row.dia).padStart(2, '0'),
      valor: Number(row.pct),
      meta,
    }))
}

export function evolucaoDrilldownSubtitle(
  granularidade: 'mes' | 'dia',
  mesDrillTarget: number | null,
  ano: number,
  subtitleMes: string,
  subtitleMesResponsavel?: string | null,
  responsavel?: string | null,
): string {
  if (granularidade === 'dia' && mesDrillTarget != null) {
    return `% diário · ${MESES_EFICIENCIA[mesDrillTarget - 1] ?? mesDrillTarget}/${ano}`
  }
  if (responsavel && subtitleMesResponsavel) return subtitleMesResponsavel
  return subtitleMes
}

export function resolveEvolucaoDrilldownChart(params: {
  granularidade: 'mes' | 'dia'
  mesDrillTarget: number | null
  responsavel: string | null
  chartDataMes: EvolucaoPoint[]
  chartDataDiarioResp: EvolucaoPoint[]
  chartDataDiarioRpc: EvolucaoPoint[]
}): EvolucaoPoint[] {
  if (params.granularidade === 'dia' && params.mesDrillTarget != null) {
    return params.responsavel ? params.chartDataDiarioResp : params.chartDataDiarioRpc
  }
  return params.chartDataMes
}
