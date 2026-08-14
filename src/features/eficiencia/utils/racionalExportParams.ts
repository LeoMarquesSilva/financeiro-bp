import type { RacionalIndicador } from '../types/eficiencia.types'
import { INDICADOR_OPERACIONAL_RACIONAL } from './racionalExportUrl'

export const RACIONAL_EXPORT_SESSION_KEY = 'sioe_racional_export_pending'

const EMAIL_RACIONAL_SLUGS = new Set(
  Object.values(INDICADOR_OPERACIONAL_RACIONAL),
) as Set<RacionalIndicador>

export type RacionalExportParams = {
  indicador: RacionalIndicador
  ano: number
  mes: number
  areaKey: string | null
}

export function isEmailRacionalSlug(value: string): value is RacionalIndicador {
  return EMAIL_RACIONAL_SLUGS.has(value as RacionalIndicador)
}

/** Persiste intenção de export (login ou redirect podem limpar a query string). */
export function persistRacionalExportSearch(search: string): void {
  const raw = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  if (!params.get('racionalExport') || !isEmailRacionalSlug(params.get('racionalExport')!)) {
    return
  }
  sessionStorage.setItem(RACIONAL_EXPORT_SESSION_KEY, raw)
}

export function clearPersistedRacionalExport(): void {
  sessionStorage.removeItem(RACIONAL_EXPORT_SESSION_KEY)
}

export function readRacionalExportParams(): RacionalExportParams | null {
  const fromUrl = new URLSearchParams(window.location.search)
  const stored = sessionStorage.getItem(RACIONAL_EXPORT_SESSION_KEY)
  const params = fromUrl.get('racionalExport')
    ? fromUrl
    : stored
      ? new URLSearchParams(stored)
      : null

  if (!params) return null

  const slug = params.get('racionalExport')
  if (!slug || !isEmailRacionalSlug(slug)) return null

  const mes = Number(params.get('mes'))
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return null

  const ano = Number(params.get('ano'))
  if (!Number.isFinite(ano) || ano < 2000) return null

  return {
    indicador: slug,
    ano,
    mes,
    areaKey: params.get('areaKey'),
  }
}
