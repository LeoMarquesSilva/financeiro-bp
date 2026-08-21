import { AREAS_EFICIENCIA_JURIDICO } from '@/features/eficiencia/constants'

/** Áreas do slicer — mesmo conjunto do painel Eficiência Jurídico. */
export const LEVANTAMENTO_AREA_OPCOES = [...AREAS_EFICIENCIA_JURIDICO] as const

const REESTRUTURACAO_RAW_KEYS = new Set([
  'reestruturação',
  'reestruturacao',
  'insolvência',
  'insolvencia',
  'cível | insolvência',
  'civel | insolvencia',
])

function areaKey(raw: string): string {
  return raw.trim().toLocaleLowerCase('pt-BR')
}

/** Match de área bruta (coluna VIOS/timesheet) contra filtro canônico do levantamento. */
export function matchesLevantamentoAreaFiltro(
  rawArea: string | null | undefined,
  filtro: string | null | undefined,
): boolean {
  if (!filtro?.trim()) return true
  const raw = (rawArea ?? '').trim()
  if (!raw) return false
  const key = areaKey(raw)
  const filtroKey = areaKey(filtro)
  if (filtroKey === 'reestruturação' || filtroKey === 'reestruturacao') {
    return REESTRUTURACAO_RAW_KEYS.has(key)
  }
  return key === filtroKey
}
