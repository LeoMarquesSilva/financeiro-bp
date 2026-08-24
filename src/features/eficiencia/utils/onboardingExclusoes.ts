import type { RacionalIndicador } from '../types/eficiencia.types'
import type { OnboardingExclusao } from '../types/onboardingExclusoes.types'

/** Indicadores que desconsideram o grupo no período de onboarding. */
export const INDICADORES_ONBOARDING = [
  'sla_protocolo',
  'sla_ciencia_agendamentos',
] as const satisfies readonly RacionalIndicador[]

export type IndicadorOnboarding = (typeof INDICADORES_ONBOARDING)[number]

const GRUPO_DATA_POR_INDICADOR: Record<
  IndicadorOnboarding,
  { grupoKey: string; dataKey: string }
> = {
  sla_protocolo: { grupoKey: 'grupo_cliente', dataKey: 'conclusao_completa' },
  sla_ciencia_agendamentos: { grupoKey: 'grupo_cliente', dataKey: 'data_conclusao' },
}

/** Chave de grupo para match de onboarding (sem prefixo "Grupo ", sem acento). */
export function onboardingGrupoChave(grupo: string | null | undefined): string {
  return String(grupo ?? '')
    .replace(/^Grupo\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
}

export function isoDateFromValue(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null
}

export function ultimoDiaDoMes(ano: number, mes: number): string {
  const dt = new Date(Date.UTC(ano, mes, 0))
  return dt.toISOString().slice(0, 10)
}

export function primeiroDiaDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

export function exclusaoCobreAno(exclusao: OnboardingExclusao, ano: number): boolean {
  return exclusao.vigencia_inicio.slice(0, 4) <= String(ano) && exclusao.vigencia_fim.slice(0, 4) >= String(ano)
}

export function linhaExcluidaPorOnboarding(
  row: Record<string, unknown>,
  indicador: RacionalIndicador,
  exclusoes: OnboardingExclusao[],
): boolean {
  if (exclusoes.length === 0) return false
  if (!INDICADORES_ONBOARDING.includes(indicador as IndicadorOnboarding)) return false
  const keys = GRUPO_DATA_POR_INDICADOR[indicador as IndicadorOnboarding]
  const chave = onboardingGrupoChave(String(row[keys.grupoKey] ?? ''))
  if (!chave) return false
  const iso = isoDateFromValue(row[keys.dataKey])
  if (!iso) return false
  return exclusoes.some(
    (e) =>
      onboardingGrupoChave(e.grupo_cliente) === chave &&
      iso >= e.vigencia_inicio &&
      iso <= e.vigencia_fim,
  )
}

export const JUSTIFICATIVA_ONBOARDING = 'ONBOARDING / TRANSIÇÃO DE CARTEIRA'

/** Mantém a linha no racional e marca como Excludente (fora da % do KPI). */
export function marcarLinhasOnboardingExcludente<T extends Record<string, unknown>>(
  linhas: T[],
  indicador: RacionalIndicador,
  exclusoes: OnboardingExclusao[],
): T[] {
  if (exclusoes.length === 0) return linhas
  if (!INDICADORES_ONBOARDING.includes(indicador as IndicadorOnboarding)) return linhas
  return linhas.map((row) => {
    if (!linhaExcluidaPorOnboarding(row, indicador, exclusoes)) return row
    const next: T = { ...row, excludente: 'Excludente' }
    if (indicador === 'sla_protocolo') {
      // Sempre o tipo onboarding — senão o Excel de resultado espalha
      // as linhas em outras justificativas (ex.: ALTO FLUXO) e não soma todas.
      next.justificativa_fatal = JUSTIFICATIVA_ONBOARDING
    }
    return next
  })
}

export function formatPeriodoOnboarding(inicio: string, fim: string): string {
  const fmt = (iso: string) => {
    const [y, m] = iso.split('-')
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${meses[Number(m) - 1]}/${y.slice(2)}`
  }
  const a = fmt(inicio)
  const b = fmt(fim)
  return a === b ? a : `${a} – ${b}`
}
