import { MESES_ABREV } from '@/features/receita/constants'
import { supabase } from '@/lib/supabaseClient'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import {
  isMesesFiltro,
  mesesEfetivosFiltro,
  type MesFiltroEficiencia,
} from '../constants'

export type BigNumberPar = {
  atual: number
  anterior: number
}

export type BigNumberTopItem = {
  grupo: string
  valor: number
}

export type BigNumberTopPar = {
  atual: BigNumberTopItem[]
  anterior: BigNumberTopItem[]
}

export type ApresentacaoBigNumberData = {
  ano: number
  anoAnterior: number
  meses: number[]
  periodoLabel: string
  kpis: {
    timesheet: BigNumberPar
    pastas_ativas: BigNumberPar
    publicacoes: BigNumberPar
    protocolos: BigNumberPar
    providencias: BigNumberPar
    receita_bruta: BigNumberPar
  }
  top5: {
    timesheet: BigNumberTopPar
    publicacoes: BigNumberTopPar
    protocolos: BigNumberTopPar
    providencias: BigNumberTopPar
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parFrom(raw: unknown): BigNumberPar {
  const o = (raw ?? {}) as Record<string, unknown>
  return { atual: num(o.atual), anterior: num(o.anterior) }
}

function topList(raw: unknown): BigNumberTopItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const o = item as Record<string, unknown>
    return {
      grupo: String(o.grupo ?? '(sem grupo)'),
      valor: num(o.valor),
    }
  })
}

function topPar(raw: unknown): BigNumberTopPar {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    atual: topList(o.atual),
    anterior: topList(o.anterior),
  }
}

/** Intervalo contínuo De→Até (ex.: Jan–Jul → [1..7]). */
export function mesesRangeBigNumber(mesInicio: number, mesFim: number): number[] {
  const a = Math.min(Math.max(1, mesInicio), 12)
  const b = Math.min(Math.max(1, mesFim), 12)
  const de = Math.min(a, b)
  const ate = Math.max(a, b)
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i)
}

/** Fallback legado a partir do filtro global da Apresentação. */
export function mesesBigNumber(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): number[] {
  const efetivos = mesesEfetivosFiltro(mesFiltro, ano)
  if (efetivos == null) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  }
  if (efetivos.length === 0 && isMesesFiltro(mesFiltro)) {
    return [...mesFiltro].sort((a, b) => a - b)
  }
  return efetivos.length > 0 ? efetivos : [1, 2, 3, 4, 5, 6]
}

export function labelPeriodoBigNumber(
  meses: number[],
  ano: number,
  anoAnterior: number,
): string {
  if (meses.length === 0) return `${anoAnterior} × ${ano}`
  const sorted = [...meses].sort((a, b) => a - b)
  const a = MESES_ABREV[sorted[0]! - 1] ?? String(sorted[0])
  const b = MESES_ABREV[sorted[sorted.length - 1]! - 1] ?? String(sorted[sorted.length - 1])
  const yyAnt = String(anoAnterior).slice(-2)
  const yy = String(ano).slice(-2)
  if (sorted.length === 1) {
    return `${a}/${yyAnt} × ${a}/${yy}`
  }
  return `${a}-${b}/${yyAnt} × ${a}-${b}/${yy}`
}

/**
 * Timesheet da apresentação: o RPC devolve minutos inteiros (já somados linha a linha).
 * Exibição: horas = minutos DIV 60, minutos = minutos MOD 60 → "41.054:20".
 */
export function formatMinutosBigNumber(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '0:00'
  const total = Math.round(minutos)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h.toLocaleString('pt-BR')}:${String(m).padStart(2, '0')}`
}

/** KPI: 41.054:20 (horas com milhar + minutos). Entrada em minutos inteiros. */
export function formatHorasBigNumberKpi(minutos: number): string {
  return formatMinutosBigNumber(minutos)
}

export function formatHorasBigNumberTop(minutos: number): string {
  return formatMinutosBigNumber(minutos)
}

export function deltaPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) {
    if (atual === 0) return 0
    return null
  }
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

export function formatDeltaPctLabel(atual: number, anterior: number): string {
  const pct = deltaPct(atual, anterior)
  if (pct == null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${formatPercent(pct)}`
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

export function formatDeltaAbs(
  kind: 'horas' | 'count' | 'moeda',
  atual: number,
  anterior: number,
): string {
  const d = atual - anterior
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const abs = Math.abs(d)
  if (kind === 'horas') return `${sign}${formatHorasBigNumberKpi(abs)}`
  if (kind === 'moeda') return `${sign} ${formatCurrency(abs)}`
  return `${sign}${formatCount(abs)}`
}

export async function fetchApresentacaoBigNumber(
  ano: number,
  meses: number[],
): Promise<ApresentacaoBigNumberData> {
  const { data, error } = await supabase.rpc(
    'eficiencia_apresentacao_bignumbers' as never,
    { p_ano: ano, p_meses: meses } as never,
  )
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  if (raw.error) throw new Error(String(raw.error))

  const anoAnterior = num(raw.ano_anterior) || ano - 1
  const mesesOut = Array.isArray(raw.meses)
    ? (raw.meses as unknown[]).map((m) => num(m)).filter((m) => m >= 1 && m <= 12)
    : meses
  const kpisRaw = (raw.kpis ?? {}) as Record<string, unknown>
  const topRaw = (raw.top5 ?? {}) as Record<string, unknown>

  return {
    ano: num(raw.ano) || ano,
    anoAnterior,
    meses: mesesOut,
    periodoLabel: labelPeriodoBigNumber(mesesOut, ano, anoAnterior),
    kpis: {
      timesheet: parFrom(kpisRaw.timesheet),
      pastas_ativas: parFrom(kpisRaw.pastas_ativas),
      publicacoes: parFrom(kpisRaw.publicacoes),
      protocolos: parFrom(kpisRaw.protocolos),
      providencias: parFrom(kpisRaw.providencias),
      receita_bruta: parFrom(kpisRaw.receita_bruta),
    },
    top5: {
      timesheet: topPar(topRaw.timesheet),
      publicacoes: topPar(topRaw.publicacoes),
      protocolos: topPar(topRaw.protocolos),
      providencias: topPar(topRaw.providencias),
    },
  }
}
