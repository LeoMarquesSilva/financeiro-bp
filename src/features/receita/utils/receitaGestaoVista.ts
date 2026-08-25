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

/** Série mensal de uma área (meta, previsto, recebido, inad. congelada ou parcial). */
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

/** Previsto no acumulado: mês corrente usa só vencido até o corte, se informado. */
export function previstoAcumuloComCorte(
  mes: number,
  previstoCheio: number,
  cortePorMes?: ReadonlyMap<number, number>,
): number {
  const cortado = cortePorMes?.get(mes)
  return cortado != null ? cortado : previstoCheio
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
 * Fatia da área sobre a meta **base** do mês (teto anual). Sem catch-up.
 */
export function metaAreaSobreBase(metaBase: number, areaPct: number): number | null {
  if (metaBase <= 0 || areaPct <= 0) return null
  return (metaBase * areaPct) / 100
}

/**
 * Meta do mês na visão por área = meta **já rebalanceada do escritório** × % da área.
 * É a meta nova que se forma com o gap do escritório (não o catch-up isolado da área).
 */
export function metaAreaDoMes(metaEscritorio: number, areaPct: number): number | null {
  if (metaEscritorio <= 0 || areaPct <= 0) return null
  return (metaEscritorio * areaPct) / 100
}

/**
 * Série mensal de uma área: meta = fatia da meta rebalanceada do escritório,
 * previsto/recebido por departamento, inadimplência nos meses congelados (VIOS).
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
  ref = new Date(),
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
    const omitAtual = Boolean(graficoOpts?.omitMesAtual && isMesAtual(ano, r.mes, ref))
    const podeInad =
      !isMesFuturo(ano, r.mes, ref) &&
      !omitAtual &&
      (mesesCongelados.has(r.mes) || Boolean(graficoOpts?.incluirInadParcial))
    const inadimplenciaRaw = podeInad
      ? inadimplenciaAreaMes(deptInadPorMes[r.mes] ?? [], areaKey)
      : null
    const inadimplencia =
      inadimplenciaRaw == null
        ? null
        : inadimplenciaRaw > 0 || graficoOpts?.incluirInadParcial
          ? inadimplenciaRaw
          : null
    const metaEscritorio = r.meta > 0 ? r.meta : r.metaBase
    return {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta: metaAreaDoMes(metaEscritorio, pct),
      previsto,
      recebido: valorRecebidoGrafico(
        recebidoPorMes.get(r.mes) ?? 0,
        ano,
        r.mes,
        ref,
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
  previstoCortePorMes?: ReadonlyMap<number, number>,
): { meses: GestaoVistaMesRow[]; resumo: GestaoVistaResumo } {
  const mesesPeriodo = mesesNoPeriodoGestao(rows, ano, ref)
  const mesesMetaPeriodo = mesesMetaNoPeriodoGestao(rows, ano, ref)
  const mesesMetaPeriodoSet = new Set(mesesMetaPeriodo)
  const mesesMetaAno = mesesMetaAnoGestao(rows)

  const inadPorMes = new Map<number, { valor: number; pct: number; congelado: boolean }>()
  for (const m of inadEvolucao) {
    const { valor, pct } = valorExibicaoEvolucao(m)
    inadPorMes.set(m.mes, { valor, pct, congelado: m.congelado })
  }

  const meses: GestaoVistaMesRow[] = rows.map((r) => {
    const recebido = valorRecebidoGrafico(r.recebido, ano, r.mes, ref)
    const meta = r.meta > 0 ? r.meta : null
    const inad = inadPorMes.get(r.mes)
    const futuro = isMesFuturo(ano, r.mes, ref)
    const inadValor = futuro
      ? null
      : inad != null
        ? inad.valor
        : inadimplenciaGraficoComparativo(undefined, ano, r.mes, ref)
    const inadPct = futuro || inad == null ? null : inad.pct
    return {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta,
      previsto: r.previsto,
      recebido,
      pctMeta: calcPctBatimento(recebido, meta ?? 0),
      pctPrevisto: calcPctBatimento(recebido, r.previsto),
      inadimplencia: inadValor,
      inadimplenciaPct: inadPct,
      congelado: inad?.congelado ?? false,
    }
  })

  const atingimento = calcularAtingimentoMetaKpi(ano, rows, ref)
  const previstoAcumulado = rows
    .filter((r) => mesesMetaPeriodoSet.has(r.mes))
    .reduce((s, r) => s + previstoAcumuloComCorte(r.mes, r.previsto, previstoCortePorMes), 0)
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
  previstoCortePorMes?: ReadonlyMap<number, number>,
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
    { incluirInadParcial: true },
    ref,
  )

  const meses = areaLinha.map((p) => areaLinhaToGestaoRow(p, mesesCongelados))

  const metaAcumulada = rows
    .filter((r) => r.metaBase > 0)
    .reduce((s, r) => s + (metaAreaSobreBase(r.metaBase, areaPct) ?? 0), 0)

  const recebidoAcumulado = meses
    .filter((m) => mesesMetaSet.has(m.mes) && m.recebido != null)
    .reduce((s, m) => s + (m.recebido ?? 0), 0)

  const recebidoAtingimento = recebidoAcumulado

  const previstoAcumulado = meses
    .filter((m) => mesesMetaSet.has(m.mes))
    .reduce((s, m) => s + previstoAcumuloComCorte(m.mes, m.previsto, previstoCortePorMes), 0)

  const previstoPeriodoInad = mesesMetaPeriodo.reduce(
    (s, mes) =>
      s +
      previstoAcumuloComCorte(
        mes,
        previstoAreaMes(deptRowsPrevisto, mes, areaKey),
        previstoCortePorMes,
      ),
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

/** Primeiro mês com meta na série (ex.: jun). Linhas anteriores são só informativas. */
export function mesInicioMetaNaSerie(meses: GestaoVistaMesRow[]): number | null {
  const row = meses.find((m) => m.meta != null && m.meta > 0)
  return row?.mes ?? null
}

/** Total da tabela: previsto/recebido/inad. só nos meses com meta (Jun+); meta = teto anual. */
export function buildGestaoVistaTotalYtd(
  meses: GestaoVistaMesRow[],
  mesesPeriodo: number[],
  mesesMetaPeriodo: number[] = [],
  metaAnualKpi?: number,
  recebidoAtingimentoKpi?: number,
  previstoCortePorMes?: ReadonlyMap<number, number>,
): GestaoVistaMesRow {
  const metaSet = new Set(mesesMetaPeriodo)
  const somaSet = metaSet.size > 0 ? metaSet : new Set(mesesPeriodo)
  const noPeriodo = meses.filter((m) => somaSet.has(m.mes))

  const metaYtd = noPeriodo.reduce((s, m) => s + (m.meta ?? 0), 0)
  const meta =
    metaAnualKpi != null && metaAnualKpi > 0 ? metaAnualKpi : metaYtd
  const previsto = noPeriodo.reduce(
    (s, m) => s + previstoAcumuloComCorte(m.mes, m.previsto, previstoCortePorMes),
    0,
  )
  const recebidoVals = noPeriodo.map((m) => m.recebido).filter((v): v is number => v != null)
  const recebido = recebidoVals.length > 0 ? recebidoVals.reduce((s, v) => s + v, 0) : null

  const recebidoMeta =
    recebidoVals.length > 0 ? recebidoVals.reduce((s, v) => s + v, 0) : null

  const mesesComInad = noPeriodo.filter((m) => m.inadimplencia != null && m.inadimplencia > 0)
  const inadVals = mesesComInad.map((m) => m.inadimplencia as number)
  const inad = inadVals.length > 0 ? inadVals.reduce((s, v) => s + v, 0) : null
  const previstoInad = mesesComInad.reduce(
    (s, m) => s + previstoAcumuloComCorte(m.mes, m.previsto, previstoCortePorMes),
    0,
  )

  return {
    mes: 0,
    mesLabel: 'Total',
    meta: meta > 0 ? meta : null,
    previsto,
    recebido,
    pctMeta: calcPctBatimento(
      recebidoAtingimentoKpi ?? recebidoMeta ?? recebido,
      meta,
    ),
    pctPrevisto: calcPctBatimento(recebido, previsto),
    inadimplencia: inad,
    inadimplenciaPct:
      inad != null && previstoInad > 0 ? calcularPctInadimplencia(inad, previstoInad) : null,
    congelado: false,
  }
}
