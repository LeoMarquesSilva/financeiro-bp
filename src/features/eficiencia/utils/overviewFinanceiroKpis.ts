import { calcularAtingimentoMetaKpi } from '@/features/receita/utils/receitaAcumuladoChart'
import { buildGestaoVistaConsolidado } from '@/features/receita/utils/receitaGestaoVista'
import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import {
  calcularPctInadimplencia,
  previstoMesEvolucao,
} from '@/features/receita/utils/receitaInadimplenciaCalc'
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

export type InadimplenciaAoVivo = { valor: number; previsto: number; pct: number }

/** Meses do Acum. de inadimplência: Jun+ no filtro, até o mês corrente. */
export function mesesInadimplenciaAoVivo(
  filtro: MesFiltroEficiencia,
  ano: number,
  ref = new Date(),
): number[] {
  const mesMax = mesMaxDisponivelInadimplencia(ano, ref)
  return Array.from({ length: mesMax }, (_, i) => i + 1).filter((mes) =>
    mesNoEscopoFinanceiro(mes, filtro, ano),
  )
}

/** Quebra meses em intervalos contíguos — o saldo ao vivo é calculado por intervalo. */
export function intervalosContiguos(meses: number[]): Array<[number, number]> {
  const intervalos: Array<[number, number]> = []
  for (const mes of [...meses].sort((a, b) => a - b)) {
    const ultimo = intervalos[intervalos.length - 1]
    if (ultimo && mes === ultimo[1] + 1) ultimo[1] = mes
    else intervalos.push([mes, mes])
  }
  return intervalos
}

/**
 * Saldo ao vivo (`grupos_periodo`) ÷ previsto do período — mesma base do card
 * Resultado % da Receita. Nunca soma os snapshots congelados da evolução.
 */
export function consolidarInadimplenciaAoVivo(
  dashboards: ReceitaInadimplenciaDashboard[],
): InadimplenciaAoVivo | null {
  const valor = dashboards.reduce((s, d) => s + d.valor_total_periodo, 0)
  const previsto = dashboards.reduce(
    (s, d) => s + d.evolucao.reduce((acc, m) => acc + previstoMesEvolucao(m), 0),
    0,
  )
  if (previsto <= 0) return null
  return { valor, previsto, pct: calcularPctInadimplencia(valor, previsto) }
}

/**
 * Índice de inadimplência: mês = % do snapshot congelado (mês corrente ainda parcial);
 * Acum. = saldo ao vivo do período ÷ previsto (card Resultado % da Receita).
 */
export function buildOverviewInadimplencia(
  gestaoMeses: GestaoVistaMesRow[],
  aoVivo: InadimplenciaAoVivo | null | undefined,
): { cells: HeatCell[]; acumulado: HeatCell } {
  const cells: HeatCell[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    if (mes < MES_INICIO_RESULTADO) return { value: null, label: '-' }
    const row = gestaoMeses.find((m) => m.mes === mes)
    if (!row || row.inadimplenciaPct == null) return { value: null, label: '-' }
    return { value: row.inadimplenciaPct, label: PCT0(row.inadimplenciaPct) }
  })

  return {
    cells,
    acumulado:
      aoVivo == null ? { value: null, label: '-' } : { value: aoVivo.pct, label: PCT0(aoVivo.pct) },
  }
}

/** Valores R$ acumulados — recebido e meta (mesma base do % de receita bruta). */
export function receitaBrutaMonetarioAcumulado(
  gestaoMeses: GestaoVistaMesRow[],
  rows: ReceitaMesRow[],
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  ref = new Date(),
): { recebido: number; meta: number } | null {
  if (isMesesFiltro(mesFiltro) && mesFiltro.length === 1) {
    const row = gestaoMeses.find((m) => m.mes === mesFiltro[0])
    if (!row || row.pctMeta == null) return null
    const meta = row.meta ?? 0
    const recebido = row.recebido ?? 0
    if (meta <= 0 && recebido <= 0) return null
    return { recebido, meta }
  }

  if (
    (isMesesFiltro(mesFiltro) && mesFiltro.length > 1) ||
    mesFiltro === 'resultado'
  ) {
    const filtrados = filterGestaoMeses(gestaoMeses, mesFiltro, ano)
    const recebido = filtrados.reduce((s, m) => s + (m.recebido ?? 0), 0)
    const meta = filtrados.reduce((s, m) => s + (m.meta ?? 0), 0)
    if (meta <= 0 && recebido <= 0) return null
    return { recebido, meta }
  }

  const mesesMetaJun = new Set(
    rows.filter((r) => r.metaBase > 0 && r.mes >= MES_INICIO_RESULTADO).map((r) => r.mes),
  )
  const atingimento = calcularAtingimentoMetaKpi(ano, rows, ref, mesesMetaJun)
  if (atingimento.metaAnual <= 0 && atingimento.recebidoAcumulado <= 0) return null
  return {
    recebido: atingimento.recebidoAcumulado,
    meta: atingimento.metaAnual,
  }
}

/** Valor R$ da evolução (snapshot do mês) — mesma base do gráfico Evolução da Inadimplência. */
export function inadimplenciaValorEvolucaoExibicao(
  gestaoMeses: GestaoVistaMesRow[],
  mesFiltro: MesFiltroEficiencia,
  ano?: number,
): number | null {
  if (isMesesFiltro(mesFiltro) && mesFiltro.length === 1) {
    const row = gestaoMeses.find((m) => m.mes === mesFiltro[0])
    if (!row || row.inadimplenciaPct == null) return null
    return row.inadimplencia ?? 0
  }

  const noEscopo = filterGestaoMeses(gestaoMeses, mesFiltro, ano)
  const comSnapshot = noEscopo.filter(
    (m) => m.congelado && m.inadimplencia != null && m.inadimplenciaPct != null,
  )
  const candidatos =
    comSnapshot.length > 0
      ? comSnapshot
      : noEscopo.filter((m) => m.inadimplencia != null && m.inadimplenciaPct != null)
  if (candidatos.length === 0) return null

  const last = candidatos.reduce((best, m) => (m.mes > best.mes ? m : best))
  return last.inadimplencia ?? 0
}

/** @deprecated Use inadimplenciaValorEvolucaoExibicao — evita somar snapshots mensais. */
export function inadimplenciaMonetarioAcumulado(
  gestaoMeses: GestaoVistaMesRow[],
  mesFiltro: MesFiltroEficiencia,
  ano?: number,
): { inadimplencia: number; previsto: number } | null {
  const valor = inadimplenciaValorEvolucaoExibicao(gestaoMeses, mesFiltro, ano)
  if (valor == null) return null
  return { inadimplencia: valor, previsto: 0 }
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
