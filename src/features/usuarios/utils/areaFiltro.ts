/**
 * Filtro de áreas em Usuários.
 *
 * Operações Legais inclui o time jurídico da área e os braços administrativos
 * que operam sob ela: Marketing, Facilities, Financeiro, R.H. e Limpeza.
 * "Comercial" não existe — legado do ORQESTRAI; trata-se como Marketing.
 */

export const AREA_OPERACOES_LEGAIS = 'Operações Legais' as const

/** Subáreas administrativas que entram no filtro Operações Legais. */
export const AREAS_DENTRO_OPERACOES_LEGAIS = [
  'Marketing',
  'Facilities',
  'Financeiro',
  'R.H.',
  'RH',
  'Limpeza',
  /** Legado ORQESTRAI — não exibir como área própria. */
  'Comercial',
] as const

const SUB_OPS = new Set<string>(AREAS_DENTRO_OPERACOES_LEGAIS)

/** Áreas que aparecem no select de filtro (ordem de exibição). */
export const USUARIOS_AREA_FILTRO_OPCOES = [
  'Cível',
  'Contratos',
  'Distressed Deals',
  'Operações Legais',
  'Recuperação de Crédito',
  'Reestruturação',
  'Sócio',
  'Trabalhista',
  'Tributário',
] as const

/** Comercial → Marketing; cargos/legado SIOE → área real. */
export function normalizeAreaUsuarios(area: string | null | undefined): string {
  const trimmed = (area ?? '').trim()
  if (!trimmed || trimmed === '—') return trimmed || '—'
  if (trimmed === 'Comercial') return 'Marketing'
  if (trimmed === 'RH') return 'R.H.'
  if (trimmed === 'Societário e Contratos') return 'Contratos'

  // Cargo no campo área (legado Gestores) — não é departamento.
  const lower = trimmed.toLocaleLowerCase('pt-BR')
  if (
    lower.includes('financeiro') ||
    lower.includes('financeira')
  ) {
    // Ex.: "Coordenadora Financeiro", "Assistente Financeira"
    if (
      lower.includes('coordenador') ||
      lower.includes('assistente') ||
      lower === 'financeiro' ||
      lower === 'financeira'
    ) {
      return 'Financeiro'
    }
  }
  return trimmed
}

/** Bucket do filtro: subáreas admin caem em Operações Legais. */
export function areaFiltroBucket(area: string | null | undefined): string {
  const normalized = normalizeAreaUsuarios(area)
  if (!normalized || normalized === '—') return normalized
  if (normalized === AREA_OPERACOES_LEGAIS || SUB_OPS.has(normalized) || SUB_OPS.has(area ?? '')) {
    return AREA_OPERACOES_LEGAIS
  }
  return normalized
}

export function matchesAreaFiltro(
  area: string | null | undefined,
  filtro: string,
): boolean {
  if (filtro === 'all') return true
  return areaFiltroBucket(area) === filtro
}

/**
 * Rótulo na lista: subárea admin mostra "Operações Legais · Marketing".
 * Área pura de Ops Legais permanece só "Operações Legais".
 */
export function formatAreaUsuariosLabel(area: string | null | undefined): string {
  const normalized = normalizeAreaUsuarios(area)
  if (!normalized || normalized === '—') return '—'
  if (normalized === AREA_OPERACOES_LEGAIS) return AREA_OPERACOES_LEGAIS
  if (SUB_OPS.has(normalized) || (area && SUB_OPS.has(area))) {
    return `${AREA_OPERACOES_LEGAIS} · ${normalized === 'Comercial' ? 'Marketing' : normalized}`
  }
  return normalized
}

/** Opções do select a partir das áreas presentes na lista (já normalizadas/agrupadas). */
export function buildAreaFiltroOptions(areasPresentes: string[]): string[] {
  const buckets = new Set(areasPresentes.map((a) => areaFiltroBucket(a)).filter((a) => a && a !== '—'))
  const ordered = USUARIOS_AREA_FILTRO_OPCOES.filter((a) => buckets.has(a))
  const extras = [...buckets]
    .filter((a) => !USUARIOS_AREA_FILTRO_OPCOES.includes(a as (typeof USUARIOS_AREA_FILTRO_OPCOES)[number]))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return [...ordered, ...extras]
}
