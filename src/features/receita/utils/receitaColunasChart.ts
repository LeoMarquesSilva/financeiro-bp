import {
  RECEITA_AREA_FALLBACK_PALETTE,
  RECEITA_DEPARTAMENTO_CORES,
  RECEITA_PLANO_PALETTE,
} from '../constants'
import { isMesFuturo, valorRecebidoGrafico } from './receitaMes'
import { labelPlanoContas } from './planoContasLabel'
import type {
  ReceitaAreaChartSlice,
  ReceitaColunasChartPoint,
  ReceitaMesRow,
  ReceitaRecebidoDepartamentoRow,
  ReceitaRecebidoPlanoMensalRow,
} from '../types/receita.types'

export function departamentoNormKey(departamento: string): string {
  return (
    departamento
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase() || 'sem_departamento'
  )
}

export function departamentoDataKey(departamento: string): string {
  return `rec_${departamentoNormKey(departamento)}`
}

/** Cor única por departamento; fallbacks só para nomes fora do mapa. */
export function departamentoAreaColor(
  departamento: string,
  usedColors: Set<string>,
  coresConfig: Record<string, string> = RECEITA_DEPARTAMENTO_CORES,
): string {
  const key = departamentoNormKey(departamento)
  const fixed = coresConfig[key] ?? RECEITA_DEPARTAMENTO_CORES[key]
  if (fixed) {
    usedColors.add(fixed)
    return fixed
  }

  for (const color of RECEITA_AREA_FALLBACK_PALETTE) {
    if (!usedColors.has(color)) {
      usedColors.add(color)
      return color
    }
  }

  const overflow =
    RECEITA_AREA_FALLBACK_PALETTE[usedColors.size % RECEITA_AREA_FALLBACK_PALETTE.length]
  usedColors.add(overflow)
  return overflow
}

export function planoNormKey(plano: string): string {
  return (
    plano
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase() || 'sem_plano'
  )
}

export function planoDataKey(plano: string): string {
  return `plc_${planoNormKey(plano)}`
}

function planoColor(plano: string, usedColors: Set<string>): string {
  const key = planoNormKey(plano)
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  const preferred = RECEITA_PLANO_PALETTE[h % RECEITA_PLANO_PALETTE.length]
  if (!usedColors.has(preferred)) {
    usedColors.add(preferred)
    return preferred
  }
  for (const color of RECEITA_PLANO_PALETTE) {
    if (!usedColors.has(color)) {
      usedColors.add(color)
      return color
    }
  }
  return preferred
}

export function formatPercentLabel(value: number): string {
  if (!value) return ''
  if (value < 10) {
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  }
  return `${Math.round(value)}%`
}

export function formatColunaLabel(value: number): string {
  if (!value) return ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export function buildAreaSlices(
  deptRows: ReceitaRecebidoDepartamentoRow[],
  meses: number[],
  coresConfig: Record<string, string> = RECEITA_DEPARTAMENTO_CORES,
): ReceitaAreaChartSlice[] {
  const totals = new Map<string, number>()
  for (const row of deptRows) {
    if (!meses.includes(row.mes)) continue
    totals.set(row.departamento, (totals.get(row.departamento) ?? 0) + row.total)
  }

  const usedColors = new Set<string>()

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([departamento]) => ({
      departamento,
      dataKey: departamentoDataKey(departamento),
      color: departamentoAreaColor(departamento, usedColors, coresConfig),
    }))
}

export function buildColunasChartData(
  ano: number,
  rows: ReceitaMesRow[],
  deptRows: ReceitaRecebidoDepartamentoRow[],
  areaSlices: ReceitaAreaChartSlice[],
): ReceitaColunasChartPoint[] {
  const meses = rows.map((r) => r.mes)
  const deptByMes = new Map<number, ReceitaRecebidoDepartamentoRow[]>()
  for (const d of deptRows) {
    if (!meses.includes(d.mes)) continue
    const list = deptByMes.get(d.mes) ?? []
    list.push(d)
    deptByMes.set(d.mes, list)
  }

  return rows.map((r) => {
    const futuro = isMesFuturo(ano, r.mes)
    const point: ReceitaColunasChartPoint = {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta: r.meta,
      projetadoBaseAbril: r.projetadoBaseAbril,
      projetadoReal: r.projetadoReal,
      previsto: r.previsto,
      recebidoTotal: valorRecebidoGrafico(r.recebido, ano, r.mes),
    }

    for (const slice of areaSlices) {
      point[slice.dataKey] = futuro ? null : 0
    }

    if (!futuro) {
      for (const d of deptByMes.get(r.mes) ?? []) {
        const key = departamentoDataKey(d.departamento)
        point[key] = d.total
      }
    }

    return point
  })
}

export function buildPlanoSlices(
  planoRows: ReceitaRecebidoPlanoMensalRow[],
  meses: number[],
): ReceitaAreaChartSlice[] {
  const totals = new Map<string, number>()
  for (const row of planoRows) {
    if (!meses.includes(row.mes)) continue
    totals.set(row.plano_contas, (totals.get(row.plano_contas) ?? 0) + row.total)
  }

  const usedColors = new Set<string>()

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([plano]) => ({
      departamento: labelPlanoContas(plano),
      dataKey: planoDataKey(plano),
      color: planoColor(plano, usedColors),
    }))
}

export function buildColunasChartDataPorPlano(
  ano: number,
  rows: ReceitaMesRow[],
  planoRows: ReceitaRecebidoPlanoMensalRow[],
  planoSlices: ReceitaAreaChartSlice[],
): ReceitaColunasChartPoint[] {
  const meses = rows.map((r) => r.mes)
  const planoByMes = new Map<number, ReceitaRecebidoPlanoMensalRow[]>()
  for (const p of planoRows) {
    if (!meses.includes(p.mes)) continue
    const list = planoByMes.get(p.mes) ?? []
    list.push(p)
    planoByMes.set(p.mes, list)
  }

  return rows.map((r) => {
    const futuro = isMesFuturo(ano, r.mes)
    const point: ReceitaColunasChartPoint = {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta: r.meta,
      projetadoBaseAbril: r.projetadoBaseAbril,
      projetadoReal: r.projetadoReal,
      previsto: r.previsto,
      recebidoTotal: valorRecebidoGrafico(r.recebido, ano, r.mes),
    }

    for (const slice of planoSlices) {
      point[slice.dataKey] = futuro ? null : 0
    }

    if (!futuro) {
      for (const p of planoByMes.get(r.mes) ?? []) {
        const key = planoDataKey(p.plano_contas)
        point[key] = p.total
      }
    }

    return point
  })
}
