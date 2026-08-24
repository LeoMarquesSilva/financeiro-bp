import {
  EFICIENCIA_TZ,
  isPeriodoCurtoFiltro,
  linhaNoPeriodoCurtoFiltro,
  mesNoFiltro,
  mesesEfetivosFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import type { RacionalIndicador } from '../types/eficiencia.types'
import type { EvolucaoPoint } from '../components/EficienciaEvolucaoChart'
import { isVistadoD1Sim } from './racionalFormat'
import { RACIONAL_COLUNA_RESPONSAVEL } from './responsavelMatch'

type Bucket = {
  ok: number
  total: number
  /** SLA Protocolo: DISTINCT CI */
  cisOk: Set<string>
  cisTotal: Set<string>
}

function emptyBucket(): Bucket {
  return { ok: 0, total: 0, cisOk: new Set(), cisTotal: new Set() }
}

function parseDataLinhaRacional(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12) {
    return null
  }

  const raw = String(value)
  const d = /^\d{4}-\d{2}-\d{2}/.test(raw)
    ? new Date(/T/.test(raw) ? raw : `${raw.slice(0, 10)}T12:00:00`)
    : new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function partesDataLinhaRacional(d: Date): { y: number; m: number; day: number } | null {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EFICIENCIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  if (!y || !m || !day) return null
  return { y, m, day }
}

/** Extrai mês (1–12) no fuso do BI; null se inválido ou fora do ano. */
export function mesDaLinhaRacional(
  value: unknown,
  ano: number,
): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12) {
    return value
  }

  const d = parseDataLinhaRacional(value)
  if (!d) return null
  const parts = partesDataLinhaRacional(d)
  if (!parts || parts.y !== ano) return null
  return parts.m
}

/** Extrai dia (1–31) no fuso do BI; null se inválido ou fora do mês/ano. */
export function diaDaLinhaRacional(
  value: unknown,
  ano: number,
  mes: number,
): number | null {
  const d = parseDataLinhaRacional(value)
  if (!d) return null
  const parts = partesDataLinhaRacional(d)
  if (!parts || parts.y !== ano || parts.m !== mes) return null
  return parts.day
}

function dataColunaIndicador(indicador: RacionalIndicador): string | null {
  switch (indicador) {
    case 'sla_protocolo':
      return 'conclusao_completa'
    case 'eficiencia_protocolo':
      return 'data_criada'
    case 'sla_ciencia_agendamentos':
      return 'data_conclusao'
    case 'sla_vistagem_risco':
    case 'sla_vistagem_normal':
      return 'disponibilizado_vistagem'
    case 'gestao_pdi':
      return 'mes'
    default:
      return null
  }
}

function linhaEntraNoMesFiltro(
  row: Record<string, unknown>,
  indicador: RacionalIndicador,
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): boolean {
  const dataCol = dataColunaIndicador(indicador)
  if (!dataCol) return false

  if (isPeriodoCurtoFiltro(mesFiltro)) {
    if (indicador === 'gestao_pdi') {
      const mes = Number(row.mes)
      return Number.isFinite(mes) && mesNoFiltro(mes, mesFiltro, ano)
    }
    return linhaNoPeriodoCurtoFiltro(row[dataCol], ano, mesFiltro)
  }

  const mes = mesDaLinhaRacional(row[dataCol], ano)
  if (mes == null) return false
  const meses = mesesEfetivosFiltro(mesFiltro, ano)
  if (meses && !meses.includes(mes)) return false
  return true
}

function toPoints(buckets: Map<number, Bucket>, useCi: boolean): EvolucaoPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([mes, b]) => {
      const ok = useCi ? b.cisOk.size : b.ok
      const total = useCi ? b.cisTotal.size : b.total
      return {
        mes,
        valor: total > 0 ? Math.round((ok / total) * 10000) / 100 : 0,
      }
    })
    .filter((p) => {
      const b = buckets.get(p.mes)!
      const total = useCi ? b.cisTotal.size : b.total
      return total > 0
    })
}

/**
 * Monta pontos do gráfico de linha a partir das linhas do racional
 * (já filtradas pelo responsável).
 */
export function agregarEvolucaoPorResponsavel(
  indicador: RacionalIndicador,
  linhas: Array<Record<string, unknown>>,
  ano: number,
  mesFiltro: MesFiltroEficiencia = null,
): EvolucaoPoint[] {
  if (!RACIONAL_COLUNA_RESPONSAVEL[indicador] && indicador !== 'gestao_pdi') {
    return []
  }

  const dataCol = dataColunaIndicador(indicador)
  if (!dataCol) return []

  const buckets = new Map<number, Bucket>()
  const ensure = (mes: number) => {
    let b = buckets.get(mes)
    if (!b) {
      b = emptyBucket()
      buckets.set(mes, b)
    }
    return b
  }

  for (const row of linhas) {
    if (!linhaEntraNoMesFiltro(row, indicador, ano, mesFiltro)) continue
    const mes = mesDaLinhaRacional(row[dataCol], ano) ?? 1
    const b = ensure(mes)

    switch (indicador) {
      case 'sla_protocolo': {
        if (row.excludente === 'Excludente') continue
        const ci = String(row.ci ?? '').trim()
        if (!ci) continue
        b.cisTotal.add(ci)
        if (row.fatal_apos18 === 'D-1') b.cisOk.add(ci)
        break
      }
      case 'eficiencia_protocolo': {
        if (row.excludente === 'Excludente') continue
        b.total += 1
        if (String(row.status_inconsistencia ?? '').toUpperCase() === 'EFICIÊNCIA') {
          b.ok += 1
        }
        break
      }
      case 'sla_ciencia_agendamentos': {
        if (row.excludente === 'Excludente') continue
        b.total += 1
        if (!String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')) {
          b.ok += 1
        }
        break
      }
      case 'sla_vistagem_risco':
      case 'sla_vistagem_normal': {
        if (row.excludente === 'Excludente') continue
        b.total += 1
        if (isVistadoD1Sim(row.vistado_d1)) b.ok += 1
        break
      }
      case 'gestao_pdi': {
        b.total += 1
        if (row.apta === true || String(row.status ?? '') === 'Apta') {
          b.ok += 1
        }
        break
      }
      default:
        break
    }
  }

  const useCi = indicador === 'sla_protocolo'
  const points = toPoints(buckets, useCi)

  // PDI junho baseline 100% se houver linha no mês
  if (indicador === 'gestao_pdi') {
    return points.map((p) => (p.mes === 6 ? { ...p, valor: 100 } : p))
  }
  return points
}

/**
 * Série diária de um mês a partir das linhas do racional (responsável filtrado).
 */
export function agregarEvolucaoDiariaPorResponsavel(
  indicador: RacionalIndicador,
  linhas: Array<Record<string, unknown>>,
  ano: number,
  mes: number,
): EvolucaoPoint[] {
  if (indicador === 'gestao_pdi') return []

  const dataCol = dataColunaIndicador(indicador)
  if (!dataCol || !RACIONAL_COLUNA_RESPONSAVEL[indicador]) return []

  const buckets = new Map<number, Bucket>()
  const ensure = (dia: number) => {
    let b = buckets.get(dia)
    if (!b) {
      b = emptyBucket()
      buckets.set(dia, b)
    }
    return b
  }

  for (const row of linhas) {
    const dia = diaDaLinhaRacional(row[dataCol], ano, mes)
    if (dia == null) continue
    const b = ensure(dia)

    switch (indicador) {
      case 'sla_protocolo': {
        if (row.excludente === 'Excludente') continue
        const ci = String(row.ci ?? '').trim()
        if (!ci) continue
        b.cisTotal.add(ci)
        if (row.fatal_apos18 === 'D-1') b.cisOk.add(ci)
        break
      }
      case 'eficiencia_protocolo': {
        if (row.excludente === 'Excludente') continue
        b.total += 1
        if (String(row.status_inconsistencia ?? '').toUpperCase() === 'EFICIÊNCIA') {
          b.ok += 1
        }
        break
      }
      case 'sla_ciencia_agendamentos': {
        if (row.excludente === 'Excludente') continue
        b.total += 1
        if (!String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')) {
          b.ok += 1
        }
        break
      }
      case 'sla_vistagem_risco':
      case 'sla_vistagem_normal': {
        if (row.excludente === 'Excludente') continue
        if (!String(row.vistado_por ?? '').trim()) continue
        b.total += 1
        if (isVistadoD1Sim(row.vistado_d1)) b.ok += 1
        break
      }
      default:
        break
    }
  }

  const useCi = indicador === 'sla_protocolo'
  return toPoints(buckets, useCi).map((p) => ({
    ...p,
    label: String(p.mes).padStart(2, '0'),
  }))
}

/** Soma numerador/denominador da série (para KPI do período). */
export function acumularEvolucaoPorResponsavel(
  linhas: Array<Record<string, unknown>>,
  indicador: RacionalIndicador,
  ano: number,
  mesFiltro: MesFiltroEficiencia = null,
): { pct: number | null; ok: number; total: number } {
  const dataCol = dataColunaIndicador(indicador)
  if (!dataCol) return { pct: null, ok: 0, total: 0 }

  let ok = 0
  let total = 0
  const cisOk = new Set<string>()
  const cisTotal = new Set<string>()

  for (const row of linhas) {
    if (!linhaEntraNoMesFiltro(row, indicador, ano, mesFiltro)) continue

    switch (indicador) {
      case 'sla_protocolo': {
        if (row.excludente === 'Excludente') continue
        const ci = String(row.ci ?? '').trim()
        if (!ci) continue
        cisTotal.add(ci)
        if (row.fatal_apos18 === 'D-1') cisOk.add(ci)
        break
      }
      case 'eficiencia_protocolo': {
        if (row.excludente === 'Excludente') continue
        total += 1
        if (String(row.status_inconsistencia ?? '').toUpperCase() === 'EFICIÊNCIA') ok += 1
        break
      }
      case 'sla_ciencia_agendamentos': {
        if (row.excludente === 'Excludente') continue
        total += 1
        if (!String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')) ok += 1
        break
      }
      case 'sla_vistagem_risco':
      case 'sla_vistagem_normal': {
        if (row.excludente === 'Excludente') continue
        total += 1
        if (isVistadoD1Sim(row.vistado_d1)) ok += 1
        break
      }
      case 'gestao_pdi': {
        total += 1
        if (row.apta === true || String(row.status ?? '') === 'Apta') ok += 1
        break
      }
      default:
        break
    }
  }

  if (indicador === 'sla_protocolo') {
    const t = cisTotal.size
    const o = cisOk.size
    return { pct: t > 0 ? (o / t) * 100 : null, ok: o, total: t }
  }

  return { pct: total > 0 ? (ok / total) * 100 : null, ok, total }
}
