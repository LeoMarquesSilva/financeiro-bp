import { mesAbrev, mesMaxDisponivelInadimplencia } from '../constants'
import type {
  GestaoVistaMesRow,
  GestaoVistaResumo,
  ReceitaMesRow,
  ReceitaRecebidoDepartamentoRow,
} from '../types/receita.types'
import type {
  ReceitaInadimplenciaDepartamentoMes,
  ReceitaInadimplenciaEvolucaoMes,
} from '../types/receitaInadimplencia.types'
import { calcularAtingimentoMetaKpi } from './receitaAcumuladoChart'
import { departamentoNormKey } from './receitaColunasChart'
import {
  calcularPctInadimplencia,
  valorExibicaoEvolucao,
} from './receitaInadimplenciaCalc'
import {
  inadimplenciaAreaMes,
  previstoAreaMes,
} from './receitaInadimplenciaAreaFilter'
import {
  inadimplenciaGraficoComparativo,
  isMesAtual,
  isMesFuturo,
  valorRecebidoGrafico,
  type ReceitaGraficoMesOptions,
} from './receitaMes'

/** Série mensal de uma área (meta, previsto, recebido, inad. congelada). */
export type AreaLinhaPoint = {
  mes: number
  mesLabel: string
  meta: number | null
  previsto: number
  recebido: number | null
  inadimplencia: number | null
  inadimplenciaPct: number | null
}

export type GestaoVistaSemaforoNivel = 'verde' | 'ambar' | 'vermelho' | 'neutro'

export function semaforoPctNivel(pct: number | null): GestaoVistaSemaforoNivel {
  if (pct == null) return 'neutro'
  if (pct >= 100) return 'verde'
  if (pct >= 80) return 'ambar'
  return 'vermelho'
}

function calcPctBatimento(numerador: number | null, denominador: number): number | null {
  if (numerador == null || denominador <= 0) return null
  return Math.round((numerador / denominador) * 10000) / 100
}

function periodoGestaoLabel(meses: number[], ano: number): string {
  const sorted = [...meses].sort((a, b) => a - b)
  if (sorted.length === 0) return String(ano)
  const cap = (m: number) => {
    const abrev = mesAbrev(m)
    return abrev.charAt(0).toUpperCase() + abrev.slice(1)
  }
  const ini = cap(sorted[0]!)
  const fim = cap(sorted[sorted.length - 1]!)
  if (sorted.length === 1) return `${ini}/${ano}`
  if (sorted.length === 12 && sorted[0] === 1 && sorted[11] === 12) return `Jan–Dez/${ano}`
  return `${ini}–${fim}/${ano}`
}

function mesesNoPeriodoGestao(rows: ReceitaMesRow[], ano: number, ref = new Date()): number[] {
  const mesMax = mesMaxDisponivelInadimplencia(ano, ref)
  return rows.map((r) => r.mes).filter((m) => m <= mesMax)
}

/** Todos os meses do ano com meta definida (ex.: Jun–Dez). */
function mesesMetaAnoGestao(rows: ReceitaMesRow[]): number[] {
  return rows.filter((r) => r.metaBase > 0).map((r) => r.mes)
}

function mesInicioMetaGestao(rows: ReceitaMesRow[]): number {
  const meses = mesesMetaAnoGestao(rows)
  return meses.length > 0 ? Math.min(...meses) : 1
}

export { mesInicioMetaGestao }

export function enrichGestaoVistaResumoInadVencidoAno(
  resumo: GestaoVistaResumo,
  inadVencidoAno: number,
  previstoVencidoAno: number,
): GestaoVistaResumo {
  return {
    ...resumo,
    inadimplenciaVencidoAno: inadVencidoAno,
    inadimplenciaVencidoPctAno: calcularPctInadimplencia(inadVencidoAno, previstoVencidoAno),
  }
}

/** Meses com meta definida já decorridos (ex.: meta só a partir de jun → [6,7,8] em ago/26). */
export function mesesMetaNoPeriodoGestao(rows: ReceitaMesRow[], ano: number, ref = new Date()): number[] {
  const mesMax = mesMaxDisponivelInadimplencia(ano, ref)
  return rows
    .filter(
      (r) => r.metaBase > 0 && r.mes <= mesMax && !isMesFuturo(ano, r.mes, ref),
    )
    .map((r) => r.mes)
}

/**
 * Série mensal (ano todo) de uma única área: meta individual (meta do mês × % da área),
 * previsto e recebido por departamento, inadimplência nos meses congelados (VIOS).
 */
export function buildAreaLinhaData(
  rows: ReceitaMesRow[],
  deptRowsRecebido: ReceitaRecebidoDepartamentoRow[],
  deptRowsPrevisto: ReceitaRecebidoDepartamentoRow[],
  deptInadPorMes: Record<number, ReceitaInadimplenciaDepartamentoMes[]>,
  mesesCongelados: Set<number>,
  areaKey: string,
  areaPct: number,
  ano: number,
  graficoOpts?: ReceitaGraficoMesOptions,
): AreaLinhaPoint[] {
  const pct = areaPct

  const recebidoPorMes = new Map<number, number>()
  for (const d of deptRowsRecebido) {
    if (departamentoNormKey(d.departamento) !== areaKey) continue
    recebidoPorMes.set(d.mes, (recebidoPorMes.get(d.mes) ?? 0) + d.total)
  }

  const previstoPorMes = new Map<number, number>()
  for (const d of deptRowsPrevisto) {
    if (departamentoNormKey(d.departamento) !== areaKey) continue
    previstoPorMes.set(d.mes, (previstoPorMes.get(d.mes) ?? 0) + d.total)
  }

  return rows.map((r) => {
    const previsto = previstoPorMes.get(r.mes) ?? 0
    const inadimplenciaRaw =
      mesesCongelados.has(r.mes) &&
      !(graficoOpts?.omitMesAtual && isMesAtual(ano, r.mes))
        ? inadimplenciaAreaMes(deptInadPorMes[r.mes] ?? [], areaKey)
        : null
    const inadimplencia =
      inadimplenciaRaw != null && inadimplenciaRaw > 0 ? inadimplenciaRaw : null
    return {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta: r.meta > 0 ? (r.meta * pct) / 100 : null,
      previsto,
      recebido: valorRecebidoGrafico(
        recebidoPorMes.get(r.mes) ?? 0,
        ano,
        r.mes,
        undefined,
        graficoOpts,
      ),
      inadimplencia,
      inadimplenciaPct:
        inadimplencia != null && previsto > 0
          ? calcularPctInadimplencia(inadimplencia, previsto)
          : null,
    }
  })
}

function areaLinhaToGestaoRow(
  point: AreaLinhaPoint,
  mesesCongelados: Set<number>,
): GestaoVistaMesRow {
  return {
    mes: point.mes,
    mesLabel: point.mesLabel,
    meta: point.meta,
    previsto: point.previsto,
    recebido: point.recebido,
    pctMeta: calcPctBatimento(point.recebido, point.meta ?? 0),
    pctPrevisto: calcPctBatimento(point.recebido, point.previsto),
    inadimplencia: point.inadimplencia,
    inadimplenciaPct: point.inadimplenciaPct,
    congelado: mesesCongelados.has(point.mes),
  }
}

function buildResumoFromMeses(
  mesesPeriodo: number[],
  mesesMetaPeriodo: number[],
  mesesMetaAno: number[],
  inadPeriodo: number,
  previstoPeriodoInad: number,
  metaAcumulada: number,
  recebidoAcumulado: number,
  recebidoAtingimento: number,
  previstoAcumulado: number,
  ano: number,
): GestaoVistaResumo {
  return {
    metaAcumulada,
    previstoAcumulado,
    recebidoAcumulado,
    recebidoAtingimento,
    pctMeta: calcPctBatimento(recebidoAtingimento, metaAcumulada),
    inadimplenciaPeriodo: inadPeriodo,
    inadimplenciaPctPeriodo: calcularPctInadimplencia(inadPeriodo, previstoPeriodoInad),
    inadimplenciaVencidoAno: 0,
    inadimplenciaVencidoPctAno: null,
    periodoAnoLabel: periodoGestaoLabel(mesesMetaPeriodo, ano),
    periodoAnualLabel: periodoGestaoLabel(mesesMetaAno, ano),
    periodoLabel: periodoGestaoLabel(mesesMetaPeriodo, ano),
    periodoMetaLabel: periodoGestaoLabel(mesesMetaPeriodo, ano),
    periodoMetaAnualLabel: periodoGestaoLabel(mesesMetaAno, ano),
    mesesNoPeriodo: mesesPeriodo,
    mesesMetaNoPeriodo: mesesMetaPeriodo,
    mesesMetaAno,
  }
}

/** Visão consolidada (escritório inteiro). */
export function buildGestaoVistaConsolidado(
  rows: ReceitaMesRow[],
  inadEvolucao: ReceitaInadimplenciaEvolucaoMes[],
  inadValorPeriodo: number,
  ano: number,
  ref = new Date(),
): { meses: GestaoVistaMesRow[]; resumo: GestaoVistaResumo } {
  const mesesPeriodo = mesesNoPeriodoGestao(rows, ano, ref)
  const mesesMetaPeriodo = mesesMetaNoPeriodoGestao(rows, ano, ref)
  const mesesMetaPeriodoSet = new Set(mesesMetaPeriodo)
  const mesesMetaAno = mesesMetaAnoGestao(rows)

  const inadPorMes = new Map<number, { valor: number; pct: number; congelado: boolean }>()
  for (const m of inadEvolucao) {
    if (!m.congelado) continue
    const { valor, pct } = valorExibicaoEvolucao(m)
    if (valor > 0) inadPorMes.set(m.mes, { valor, pct, congelado: true })
  }

  const meses: GestaoVistaMesRow[] = rows.map((r) => {
    const recebido = valorRecebidoGrafico(r.recebido, ano, r.mes, ref)
    const meta = r.meta > 0 ? r.meta : null
    const inad = inadPorMes.get(r.mes)
    const inadValor = inadimplenciaGraficoComparativo(inad?.valor, ano, r.mes, ref)
    return {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta,
      previsto: r.previsto,
      recebido,
      pctMeta: calcPctBatimento(recebido, meta ?? 0),
      pctPrevisto: calcPctBatimento(recebido, r.previsto),
      inadimplencia: inadValor,
      inadimplenciaPct: inad?.pct ?? null,
      congelado: inad != null,
    }
  })

  const atingimento = calcularAtingimentoMetaKpi(ano, rows, ref)
  const previstoAcumulado = rows
    .filter((r) => mesesMetaPeriodoSet.has(r.mes))
    .reduce((s, r) => s + r.previsto, 0)
  const recebidoAcumulado = rows
    .filter((r) => mesesMetaPeriodoSet.has(r.mes) && !isMesFuturo(ano, r.mes, ref))
    .reduce((s, r) => s + r.recebido, 0)

  const inadPrevistoMeta = inadEvolucao
    .filter((m) => mesesMetaPeriodoSet.has(m.mes))
    .reduce((s, m) => s + (m.previsto ?? 0), 0)

  const resumo = buildResumoFromMeses(
    mesesPeriodo,
    mesesMetaPeriodo,
    mesesMetaAno,
    inadValorPeriodo,
    inadPrevistoMeta,
    atingimento.metaAnual,
    recebidoAcumulado,
    atingimento.recebidoAcumulado,
    previstoAcumulado,
    ano,
  )

  return { meses, resumo }
}

/** Visão por área meta (previsto/recebido/inad. por departamento). */
export function buildGestaoVistaArea(
  rows: ReceitaMesRow[],
  deptRowsRecebido: ReceitaRecebidoDepartamentoRow[],
  deptRowsPrevisto: ReceitaRecebidoDepartamentoRow[],
  deptInadPorMes: Record<number, ReceitaInadimplenciaDepartamentoMes[]>,
  mesesCongelados: Set<number>,
  areaKey: string,
  areaPct: number,
  inadValorPeriodo: number,
  ano: number,
  ref = new Date(),
): { meses: GestaoVistaMesRow[]; resumo: GestaoVistaResumo } {
  const mesesPeriodo = mesesNoPeriodoGestao(rows, ano, ref)
  const mesesMetaPeriodo = mesesMetaNoPeriodoGestao(rows, ano, ref)
  const mesesMetaSet = new Set(mesesMetaPeriodo)
  const mesesMetaAno = mesesMetaAnoGestao(rows)

  const areaLinha = buildAreaLinhaData(
    rows,
    deptRowsRecebido,
    deptRowsPrevisto,
    deptInadPorMes,
    mesesCongelados,
    areaKey,
    areaPct,
    ano,
  )

  const meses = areaLinha.map((p) => areaLinhaToGestaoRow(p, mesesCongelados))

  const metaAcumulada = rows
    .filter((r) => r.metaBase > 0)
    .reduce((s, r) => s + (r.metaBase * areaPct) / 100, 0)

  const recebidoAcumulado = meses
    .filter((m) => mesesMetaSet.has(m.mes) && m.recebido != null)
    .reduce((s, m) => s + (m.recebido ?? 0), 0)

  const recebidoAtingimento = recebidoAcumulado

  const previstoAcumulado = meses
    .filter((m) => mesesMetaSet.has(m.mes))
    .reduce((s, m) => s + m.previsto, 0)

  const previstoPeriodoInad = mesesMetaPeriodo.reduce(
    (s, mes) => s + previstoAreaMes(deptRowsPrevisto, mes, areaKey),
    0,
  )

  const resumo = buildResumoFromMeses(
    mesesPeriodo,
    mesesMetaPeriodo,
    mesesMetaAno,
    inadValorPeriodo,
    previstoPeriodoInad,
    metaAcumulada,
    recebidoAcumulado,
    recebidoAtingimento,
    previstoAcumulado,
    ano,
  )

  return { meses, resumo }
}

/** Total YTD da tabela (soma linhas no período Jan–mês atual). */
export function buildGestaoVistaTotalYtd(
  meses: GestaoVistaMesRow[],
  mesesPeriodo: number[],
  mesesMetaPeriodo: number[] = [],
  metaAnualKpi?: number,
  recebidoAtingimentoKpi?: number,
): GestaoVistaMesRow {
  const set = new Set(mesesPeriodo)
  const metaSet = new Set(mesesMetaPeriodo)
  const noPeriodo = meses.filter((m) => set.has(m.mes))

  const meta = noPeriodo.reduce((s, m) => s + (m.meta ?? 0), 0)
  const previsto = noPeriodo.reduce((s, m) => s + m.previsto, 0)
  const recebidoVals = noPeriodo.map((m) => m.recebido).filter((v): v is number => v != null)
  const recebido = recebidoVals.length > 0 ? recebidoVals.reduce((s, v) => s + v, 0) : null

  const recebidoMetaVals = noPeriodo
    .filter((m) => metaSet.has(m.mes))
    .map((m) => m.recebido)
    .filter((v): v is number => v != null)
  const recebidoMeta =
    recebidoMetaVals.length > 0 ? recebidoMetaVals.reduce((s, v) => s + v, 0) : null

  const inadVals = noPeriodo
    .map((m) => m.inadimplencia)
    .filter((v): v is number => v != null && v > 0)
  const inad = inadVals.length > 0 ? inadVals.reduce((s, v) => s + v, 0) : null

  return {
    mes: 0,
    mesLabel: 'Total',
    meta: meta > 0 ? meta : null,
    previsto,
    recebido,
    pctMeta: calcPctBatimento(
      recebidoAtingimentoKpi ?? recebidoMeta ?? recebido,
      metaAnualKpi ?? meta,
    ),
    pctPrevisto: calcPctBatimento(recebido, previsto),
    inadimplencia: inad,
    inadimplenciaPct: inad != null && previsto > 0 ? calcularPctInadimplencia(inad, previsto) : null,
    congelado: false,
  }
}
