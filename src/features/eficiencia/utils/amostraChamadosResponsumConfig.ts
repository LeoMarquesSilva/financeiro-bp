import type { Colaborador, ColaboradorNivelHierarquico } from '@/features/colaboradores/types'

const STORAGE_KEY = 'sioe.amostra-chamados.responsum-por-area'

const NIVEL_PRIORIDADE: Record<ColaboradorNivelHierarquico, number> = {
  coordenador: 0,
  gerente: 1,
  socio: 2,
  colaborador: 99,
}

const TITULARES: ColaboradorNivelHierarquico[] = ['coordenador', 'gerente', 'socio']

export type ResponsumTitularRef = {
  responsum_user_id: string
  full_name: string
  area: string
}

export type AmostraChamadosResponsumConfig = Record<string, ResponsumTitularRef>

export function loadAmostraChamadosResponsumConfig(): AmostraChamadosResponsumConfig {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: AmostraChamadosResponsumConfig = {}
    for (const [area, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const v = value as Record<string, unknown>
      const responsum_user_id = String(v.responsum_user_id ?? '').trim()
      const full_name = String(v.full_name ?? '').trim()
      const areaRef = String(v.area ?? area).trim()
      if (responsum_user_id && full_name) {
        out[area] = { responsum_user_id, full_name, area: areaRef }
      }
    }
    return out
  } catch {
    return {}
  }
}

export function saveAmostraChamadosResponsumConfig(config: AmostraChamadosResponsumConfig): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/** Titular automático (coordenador > gerente > sócio) — mesma regra da Edge Function. */
export function titularPadraoPorArea(
  colaboradores: Colaborador[],
  areas: string[],
): Map<string, Colaborador> {
  const map = new Map<string, Colaborador>()
  for (const area of areas) {
    const candidatos = colaboradores.filter(
      (c) =>
        c.area === area &&
        c.is_active &&
        c.responsum_user_id &&
        TITULARES.includes(c.nivel_hierarquico),
    )
    candidatos.sort(
      (a, b) =>
        (NIVEL_PRIORIDADE[a.nivel_hierarquico] ?? 99) -
        (NIVEL_PRIORIDADE[b.nivel_hierarquico] ?? 99),
    )
    const top = candidatos[0]
    if (top) map.set(area, top)
  }
  return map
}

export function resolveTitularResponsumPorArea(
  area: string,
  colaboradores: Colaborador[],
  overrides: AmostraChamadosResponsumConfig,
): ResponsumTitularRef | null {
  const override = overrides[area]
  if (override?.responsum_user_id) return override
  const padrao = titularPadraoPorArea(colaboradores, [area]).get(area)
  if (!padrao?.responsum_user_id) return null
  return {
    responsum_user_id: padrao.responsum_user_id,
    full_name: padrao.full_name,
    area: padrao.area,
  }
}

export function colaboradoresComResponsum(colaboradores: Colaborador[]): Colaborador[] {
  return colaboradores.filter((c) => c.is_active && c.responsum_user_id)
}

export function areasParaConfiguracaoResponsum(
  colaboradores: Colaborador[],
  areasAmostra: string[],
): string[] {
  const set = new Set<string>()
  for (const c of colaboradores) {
    if (c.area?.trim()) set.add(c.area.trim())
  }
  for (const a of areasAmostra) {
    if (a?.trim()) set.add(a.trim())
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
