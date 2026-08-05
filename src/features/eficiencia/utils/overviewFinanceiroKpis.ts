import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import { calcularAtingimentoMetaKpi } from '@/features/receita/utils/receitaAcumuladoChart'
import { buildGestaoVistaConsolidado } from '@/features/receita/utils/receitaGestaoVista'
import { calcularPctInadimplencia } from '@/features/receita/utils/receitaInadimplenciaCalc'
import type { GestaoVistaMesRow, ReceitaMesRow } from '@/features/receita/types/receita.types'
import type { ReceitaInadimplenciaDashboard } from '@/features/receita/types/receitaInadimplencia.types'
import type { HeatCell } from '../components/OverviewKpiHeatRow'
import { MES_INICIO_RESULTADO, type MesFiltroEficiencia } from '../constants'

const PCT0 = (v: number) => `${v.toFixed(2)}%`

function mesNoEscopo(mes: number, filtro: MesFiltroEficiencia): boolean {
  if (mes < MES_INICIO_RESULTADO) return false
  if (typeof filtro === 'number') return mes === filtro
  return true
}

function filterGestaoMeses(meses: GestaoVistaMesRow[], filtro: MesFiltroEficiencia): GestaoVistaMesRow[] {
  return meses.filter((m) => mesNoEscopo(m.mes, filtro))
}

/** Receita Bruta (% recebido ÷ meta mensal); acum. Jun+ = recebido ÷ meta anual (meses com meta). */
export function buildOverviewReceitaBruta(
  gestaoMeses: GestaoVistaMesRow[],
  rows: ReceitaMesRow[],
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  ref = new Date(),
): { cells: HeatCell[]; acumulado: HeatCell } {
  const cells: HeatCell[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    if (mes < MES_INICIO_RESULTADO) return { value: null, label: '-' }
    const row = gestaoMeses.find((m) => m.mes === mes)
    if (!row || row.pctMeta == null) return { value: null, label: '-' }
    return { value: row.pctMeta, label: PCT0(row.pctMeta) }
  })

  if (typeof mesFiltro === 'number') {
    const row = gestaoMeses.find((m) => m.mes === mesFiltro)
    if (!row || row.pctMeta == null) return { cells, acumulado: { value: null, label: '-' } }
    return {
      cells,
      acumulado: { value: row.pctMeta, label: PCT0(row.pctMeta) },
    }
  }

  const mesesMetaJun = new Set(
    rows.filter((r) => r.metaBase > 0 && r.mes >= MES_INICIO_RESULTADO).map((r) => r.mes),
  )
  const atingimento = calcularAtingimentoMetaKpi(ano, rows, ref, mesesMetaJun)
  const pct = atingimento.metaAnual > 0 ? atingimento.pct : null

  return {
    cells,
    acumulado: pct == null ? { value: null, label: '-' } : { value: pct, label: PCT0(pct) },
  }
}

/** Índice de inadimplência (% saldo congelado ÷ previsto); só meses com snapshot. */
export function buildOverviewInadimplencia(
  gestaoMeses: GestaoVistaMesRow[],
  mesFiltro: MesFiltroEficiencia,
): { cells: HeatCell[]; acumulado: HeatCell } {
  const cells: HeatCell[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    if (mes < MES_INICIO_RESULTADO) return { value: null, label: '-' }
    const row = gestaoMeses.find((m) => m.mes === mes)
    if (!row || row.inadimplenciaPct == null) return { value: null, label: '-' }
    return { value: row.inadimplenciaPct, label: PCT0(row.inadimplenciaPct) }
  })

  const filtrados = filterGestaoMeses(gestaoMeses, mesFiltro).filter(
    (m) => m.inadimplencia != null && m.inadimplencia > 0,
  )
  const inadTotal = filtrados.reduce((s, m) => s + (m.inadimplencia ?? 0), 0)
  const previstoTotal = filtrados.reduce((s, m) => s + m.previsto, 0)
  const pctAcum = calcularPctInadimplencia(inadTotal, previstoTotal)

  if (typeof mesFiltro === 'number') {
    const row = gestaoMeses.find((m) => m.mes === mesFiltro)
    if (!row || row.inadimplenciaPct == null) {
      return { cells, acumulado: { value: null, label: '-' } }
    }
    return {
      cells,
      acumulado: { value: row.inadimplenciaPct, label: PCT0(row.inadimplenciaPct) },
    }
  }

  return {
    cells,
    acumulado:
      pctAcum == null ? { value: null, label: '-' } : { value: pctAcum, label: PCT0(pctAcum) },
  }
}

export function buildGestaoConsolidadoFromInadDashboard(
  rows: ReceitaMesRow[],
  inadDashboard: ReceitaInadimplenciaDashboard,
  ano: number,
) {
  const mesMax = mesMaxDisponivelInadimplencia(ano)
  const previstoPeriodo = inadDashboard.evolucao
    .filter((m) => m.mes <= mesMax)
    .reduce((s, m) => s + (m.previsto ?? 0), 0)
  return buildGestaoVistaConsolidado(
    rows,
    inadDashboard.evolucao,
    inadDashboard.valor_total_periodo,
    previstoPeriodo,
    ano,
  )
}

/** Aplica filtro Resultado (Jun+) nas células já montadas. */
export function aplicarCelulasFiltro(cells: HeatCell[], filtro: MesFiltroEficiencia): HeatCell[] {
  if (filtro !== 'resultado') return cells
  return cells.map((c, i) =>
    i + 1 < MES_INICIO_RESULTADO ? { value: null, label: '-' } : c,
  )
}
