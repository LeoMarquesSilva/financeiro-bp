import { calcularAtingimentoMetaKpi } from '@/features/receita/utils/receitaAcumuladoChart'
import { buildGestaoVistaConsolidado } from '@/features/receita/utils/receitaGestaoVista'
import { calcularPctInadimplencia } from '@/features/receita/utils/receitaInadimplenciaCalc'
import type { GestaoVistaMesRow, ReceitaMesRow } from '@/features/receita/types/receita.types'
import type { ReceitaInadimplenciaDashboard } from '@/features/receita/types/receitaInadimplencia.types'
import type { HeatCell } from '../components/OverviewKpiHeatRow'
import {
  MES_INICIO_RESULTADO,
  isMesesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'

const PCT0 = (v: number) => `${v.toFixed(2)}%`

function mesNoEscopoFinanceiro(
  mes: number,
  filtro: MesFiltroEficiencia,
  ano?: number,
): boolean {
  if (mes < MES_INICIO_RESULTADO) return false
  return mesNoFiltro(mes, filtro, ano)
}

function filterGestaoMeses(
  meses: GestaoVistaMesRow[],
  filtro: MesFiltroEficiencia,
  ano?: number,
): GestaoVistaMesRow[] {
  return meses.filter((m) => mesNoEscopoFinanceiro(m.mes, filtro, ano))
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

  if (isMesesFiltro(mesFiltro) && mesFiltro.length === 1) {
    const row = gestaoMeses.find((m) => m.mes === mesFiltro[0])
    if (!row || row.pctMeta == null) return { cells, acumulado: { value: null, label: '-' } }
    return {
      cells,
      acumulado: { value: row.pctMeta, label: PCT0(row.pctMeta) },
    }
  }

  if (
    (isMesesFiltro(mesFiltro) && mesFiltro.length > 1) ||
    mesFiltro === 'resultado'
  ) {
    const filtrados = filterGestaoMeses(gestaoMeses, mesFiltro, ano)
    const recebido = filtrados.reduce((s, m) => s + (m.recebido ?? 0), 0)
    const meta = filtrados.reduce((s, m) => s + (m.meta ?? 0), 0)
    if (meta <= 0) return { cells, acumulado: { value: null, label: '-' } }
    const pct = (recebido / meta) * 100
    return { cells, acumulado: { value: pct, label: PCT0(pct) } }
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
  ano?: number,
): { cells: HeatCell[]; acumulado: HeatCell } {
  const cells: HeatCell[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    if (mes < MES_INICIO_RESULTADO) return { value: null, label: '-' }
    const row = gestaoMeses.find((m) => m.mes === mes)
    if (!row || row.inadimplenciaPct == null) return { value: null, label: '-' }
    return { value: row.inadimplenciaPct, label: PCT0(row.inadimplenciaPct) }
  })

  const filtrados = filterGestaoMeses(gestaoMeses, mesFiltro, ano).filter(
    (m) => m.inadimplencia != null && m.inadimplencia > 0,
  )
  const inadTotal = filtrados.reduce((s, m) => s + (m.inadimplencia ?? 0), 0)
  const previstoTotal = filtrados.reduce((s, m) => s + m.previsto, 0)
  const pctAcum = calcularPctInadimplencia(inadTotal, previstoTotal)

  if (isMesesFiltro(mesFiltro) && mesFiltro.length === 1) {
    const row = gestaoMeses.find((m) => m.mes === mesFiltro[0])
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
  return buildGestaoVistaConsolidado(
    rows,
    inadDashboard.evolucao,
    inadDashboard.valor_total_periodo,
    ano,
  )
}

/** Aplica filtro Resultado (Jun+ fechados) ou meses selecionados nas células já montadas. */
export function aplicarCelulasFiltro(
  cells: HeatCell[],
  filtro: MesFiltroEficiencia,
  ano?: number,
): HeatCell[] {
  if (filtro == null) return cells
  if (filtro === 'resultado' || filtro === 'resultado_ytd') {
    return cells.map((c, i) =>
      mesNoFiltro(i + 1, filtro, ano) ? c : { value: null, label: '-' },
    )
  }
  // Multi/mês único: mantém células; o destaque visual fica no heat row.
  return cells
}
