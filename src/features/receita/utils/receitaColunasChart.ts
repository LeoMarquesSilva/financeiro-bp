import {
  RECEITA_AREA_FALLBACK_PALETTE,
  RECEITA_DEPARTAMENTO_CORES,
  RECEITA_PLANO_PALETTE,
} from '../constants'
import { isMesFuturo, valorRecebidoGrafico } from './receitaMes'
import { labelPlanoContas } from './planoContasLabel'
import { formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import type {
  ReceitaAreaChartSlice,
  ReceitaColunasChartPoint,
  ReceitaMesRow,
  ReceitaRecebidoDepartamentoRow,
  ReceitaRecebidoItemRow,
  ReceitaRecebidoPlanoMensalRow,
} from '../types/receita.types'
import {
  agruparRecebidoPorGrupo,
  valorRecebidoItem,
} from './recebidoGrupos'

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
  return formatPercent(value)
}

export function formatPercentMeta(value: number): string {
  if (!value) return formatPercent(0)
  return formatPercent(value)
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

export type ColunasBarLabelMode = 'currency' | 'percentMeta' | 'planoShare'

/** Valores absolutos em reais (ex.: 1.207.251) não devem receber sufixo %. */
export function isLikelyAbsoluteCurrency(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) >= 1000
}

export function resolveColunasBarLabelMode(
  percentMetaMode: boolean,
  planoShareLabels: boolean,
): ColunasBarLabelMode {
  if (percentMetaMode) return 'percentMeta'
  if (planoShareLabels) return 'planoShare'
  return 'currency'
}

export function formatColunasBarValueLabel(
  value: number,
  mode: ColunasBarLabelMode,
  options?: { stackTotal?: number },
): string {
  if (!value || !Number.isFinite(value)) return ''
  if (mode === 'planoShare') {
    const total = options?.stackTotal ?? 0
    if (!total) return ''
    return formatPercentLabel((value / total) * 100)
  }
  if (mode === 'percentMeta') {
    if (isLikelyAbsoluteCurrency(value)) return formatCurrencyCompact(value)
    return formatPercentLabel(value)
  }
  return formatCurrencyCompact(value)
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Cor de texto legível sobre o preenchimento do segmento empilhado. */
export function segmentLabelTextColor(segmentColor: string): string {
  const rgb = parseHexColor(segmentColor)
  if (!rgb) return '#0f172a'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.62 ? '#0f172a' : '#ffffff'
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

/** Converte valores mensais em % da meta do mês (meta = 100%, não exibida). */
export function toColunasPercentData(
  data: ReceitaColunasChartPoint[],
  stackSlices: ReceitaAreaChartSlice[],
): ReceitaColunasChartPoint[] {
  return data.map((p) => {
    const meta = Number(p.meta) || 0
    if (meta <= 0) return { ...p }

    const point: ReceitaColunasChartPoint = {
      ...p,
      meta: 100,
      projetadoBaseAbril: (p.projetadoBaseAbril / meta) * 100,
      projetadoReal: (p.projetadoReal / meta) * 100,
      previsto: (p.previsto / meta) * 100,
      recebidoTotal:
        p.recebidoTotal != null ? (p.recebidoTotal / meta) * 100 : null,
    }

    for (const slice of stackSlices) {
      const v = p[slice.dataKey]
      point[slice.dataKey] =
        typeof v === 'number' ? (v / meta) * 100 : v
    }

    return point
  })
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

/** Meta rateada e previsto por departamento quando uma área está selecionada. */
export function applyAreaScopeToColunasData(
  points: ReceitaColunasChartPoint[],
  rows: ReceitaMesRow[],
  areaKey: string,
  areaMetaPct: number,
  previstoDeptRows: ReceitaRecebidoDepartamentoRow[],
): ReceitaColunasChartPoint[] {
  const previstoPorMes = new Map<number, number>()
  for (const d of previstoDeptRows) {
    if (departamentoNormKey(d.departamento) !== areaKey) continue
    previstoPorMes.set(d.mes, (previstoPorMes.get(d.mes) ?? 0) + d.total)
  }

  const rowByMes = new Map(rows.map((r) => [r.mes, r]))

  return points.map((p) => {
    const row = rowByMes.get(p.mes)
    const metaArea = row && row.meta > 0 ? (row.meta * areaMetaPct) / 100 : p.meta
    return {
      ...p,
      meta: metaArea,
      previsto: previstoPorMes.get(p.mes) ?? 0,
    }
  })
}

export function grupoDataKey(grupo: string): string {
  return `grp_${departamentoNormKey(grupo)}`
}

export function buildGrupoSlicesFromItens(
  itens: ReceitaRecebidoItemRow[],
  clienteGrupoMap: Map<string, string>,
): ReceitaAreaChartSlice[] {
  const grupos = agruparRecebidoPorGrupo(itens, clienteGrupoMap)
  return grupos.map((g, i) => ({
    departamento: g.grupo,
    dataKey: grupoDataKey(g.grupo),
    color: RECEITA_AREA_FALLBACK_PALETTE[i % RECEITA_AREA_FALLBACK_PALETTE.length],
  }))
}

export function buildPlanoSlicesFromItens(itens: ReceitaRecebidoItemRow[]): ReceitaAreaChartSlice[] {
  const totals = new Map<string, number>()
  for (const item of itens) {
    const plano = item.plano_contas?.trim() || 'Sem plano'
    totals.set(plano, (totals.get(plano) ?? 0) + valorRecebidoItem(item))
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

export function buildColunasChartDataFromAreaItens(
  ano: number,
  rows: ReceitaMesRow[],
  itensByMes: Map<number, ReceitaRecebidoItemRow[]>,
  slices: ReceitaAreaChartSlice[],
  breakdown: 'grupo' | 'plano',
  clienteGrupoMap: Map<string, string>,
): ReceitaColunasChartPoint[] {
  return rows.map((r) => {
    const futuro = isMesFuturo(ano, r.mes)
    const itens = itensByMes.get(r.mes) ?? []
    const point: ReceitaColunasChartPoint = {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta: r.meta,
      projetadoBaseAbril: r.projetadoBaseAbril,
      projetadoReal: r.projetadoReal,
      previsto: r.previsto,
      recebidoTotal: null,
    }

    for (const slice of slices) {
      point[slice.dataKey] = futuro ? null : 0
    }

    if (!futuro && itens.length > 0) {
      if (breakdown === 'grupo') {
        for (const g of agruparRecebidoPorGrupo(itens, clienteGrupoMap)) {
          point[grupoDataKey(g.grupo)] = g.total
        }
      } else {
        const byPlano = new Map<string, number>()
        for (const item of itens) {
          const plano = item.plano_contas?.trim() || 'Sem plano'
          byPlano.set(plano, (byPlano.get(plano) ?? 0) + valorRecebidoItem(item))
        }
        for (const [plano, total] of byPlano) {
          point[planoDataKey(plano)] = total
        }
      }
    }

    const recebidoTotal = slices.reduce(
      (sum, slice) => sum + (Number(point[slice.dataKey]) || 0),
      0,
    )
    point.recebidoTotal = recebidoTotal > 0 ? recebidoTotal : null

    return point
  })
}
