export type OpexPlanoFiltroState = {
  gruposExcluidos: string[]
  planosExcluidos: string[]
}

export type OpexPlanoCatalogoRow = {
  grupo_conta: string
  plano_contas: string
  fixo: boolean
}

export const OPEX_PLANO_FILTRO_VAZIO: OpexPlanoFiltroState = {
  gruposExcluidos: [],
  planosExcluidos: [],
}

export function planoFiltroChave(grupo: string, plano: string): string {
  return `${grupo}|${plano}`
}

export function parsePlanoFiltroChave(chave: string): { grupo: string; plano: string } {
  const sep = chave.indexOf('|')
  if (sep < 0) return { grupo: chave, plano: '' }
  return { grupo: chave.slice(0, sep), plano: chave.slice(sep + 1) }
}

export function opexPlanoFiltroStorageKey(ano: number): string {
  return `opex-plano-filtro-${ano}`
}

export function loadOpexPlanoFiltro(ano: number): OpexPlanoFiltroState {
  try {
    const raw = localStorage.getItem(opexPlanoFiltroStorageKey(ano))
    if (!raw) return OPEX_PLANO_FILTRO_VAZIO
    const parsed = JSON.parse(raw) as Partial<OpexPlanoFiltroState>
    return {
      gruposExcluidos: Array.isArray(parsed.gruposExcluidos)
        ? parsed.gruposExcluidos.filter((g): g is string => typeof g === 'string')
        : [],
      planosExcluidos: Array.isArray(parsed.planosExcluidos)
        ? parsed.planosExcluidos.filter((p): p is string => typeof p === 'string')
        : [],
    }
  } catch {
    return OPEX_PLANO_FILTRO_VAZIO
  }
}

export function saveOpexPlanoFiltro(ano: number, filtro: OpexPlanoFiltroState): void {
  localStorage.setItem(opexPlanoFiltroStorageKey(ano), JSON.stringify(filtro))
}

export function temPlanoFiltroAtivo(filtro: OpexPlanoFiltroState): boolean {
  return filtro.gruposExcluidos.length > 0 || filtro.planosExcluidos.length > 0
}

export function grupoTotalmenteExcluido(grupo: string, filtro: OpexPlanoFiltroState): boolean {
  return filtro.gruposExcluidos.includes(grupo)
}

export function planoExcluido(grupo: string, plano: string, filtro: OpexPlanoFiltroState): boolean {
  if (grupoTotalmenteExcluido(grupo, filtro)) return true
  return filtro.planosExcluidos.includes(planoFiltroChave(grupo, plano))
}

export function grupoParcialmenteExcluido(
  grupo: string,
  planosDoGrupo: string[],
  filtro: OpexPlanoFiltroState,
): boolean {
  if (grupoTotalmenteExcluido(grupo, filtro)) return false
  return planosDoGrupo.some((plano) => planoExcluido(grupo, plano, filtro))
}

export function contagemPlanoFiltro(
  catalogo: OpexPlanoCatalogoRow[],
  filtro: OpexPlanoFiltroState,
): { total: number; visiveis: number; ocultos: number } {
  const total = catalogo.length
  const visiveis = catalogo.filter((row) => !planoExcluido(row.grupo_conta, row.plano_contas, filtro)).length
  return { total, visiveis, ocultos: total - visiveis }
}

export function agruparCatalogoPlano(catalogo: OpexPlanoCatalogoRow[]): Map<string, OpexPlanoCatalogoRow[]> {
  const map = new Map<string, OpexPlanoCatalogoRow[]>()
  for (const row of catalogo) {
    const list = map.get(row.grupo_conta) ?? []
    list.push(row)
    map.set(row.grupo_conta, list)
  }
  for (const [grupo, rows] of map) {
    map.set(
      grupo,
      [...rows].sort((a, b) => a.plano_contas.localeCompare(b.plano_contas, 'pt-BR')),
    )
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')))
}

export function rpcPlanoFiltroArrays(filtro: OpexPlanoFiltroState): {
  p_grupos_excluidos: string[] | null
  p_planos_excluidos: string[] | null
} {
  return {
    p_grupos_excluidos: filtro.gruposExcluidos.length ? filtro.gruposExcluidos : null,
    p_planos_excluidos: filtro.planosExcluidos.length ? filtro.planosExcluidos : null,
  }
}
