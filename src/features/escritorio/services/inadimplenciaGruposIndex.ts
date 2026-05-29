import { supabase } from '@/lib/supabaseClient'
import type { InadimplenciaClasse } from '@/lib/database.types'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import type { GrupoEscritorio } from './escritorioService'
import { GRUPO_SEM_NOME, normalizarNomeGrupo } from './escritorioService'
import type { GrupoResumoRow } from './escritorioService'

export type FiltroInadimplencia = 'todos' | 'inadimplentes' | 'resolvidos'

export interface InadimplenciaGrupoRef {
  id: string
  status_classe: InadimplenciaClasse
  resolvido_at: string | null
}

export interface InadimplenciaGruposIndex {
  byPessoaId: Map<string, InadimplenciaGrupoRef>
  byGrupoNorm: Map<string, InadimplenciaGrupoRef>
  /** Nomes de grupo normalizados com inadimplência ativa */
  gruposAtivosNorm: Set<string>
  /** Nomes de grupo normalizados só com histórico resolvido */
  gruposResolvidosNorm: Set<string>
}

export interface InadimplenciaGrupoStatus {
  ativa: InadimplenciaGrupoRef | null
  resolvida: InadimplenciaGrupoRef | null
}

const PAGE_SIZE = 1000

function preferRef(
  current: InadimplenciaGrupoRef | undefined,
  next: InadimplenciaGrupoRef
): InadimplenciaGrupoRef {
  if (!current) return next
  if (current.resolvido_at && !next.resolvido_at) return next
  if (!current.resolvido_at && next.resolvido_at) return current
  return next
}

async function fetchGruposByPessoaIds(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) return map

  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const { data, error } = await supabase
      .from('pessoas')
      .select('id, grupo_cliente')
      .in('id', chunk)

    if (error) throw error

    for (const row of (data ?? []) as { id: string; grupo_cliente: string | null }[]) {
      if (row.grupo_cliente?.trim()) {
        map.set(row.id, row.grupo_cliente.trim())
      }
    }
  }

  return map
}

function buildGrupoNormSets(
  byPessoaId: Map<string, InadimplenciaGrupoRef>,
  byGrupoNorm: Map<string, InadimplenciaGrupoRef>,
  pessoaGrupos: Map<string, string>
): { gruposAtivosNorm: Set<string>; gruposResolvidosNorm: Set<string> } {
  const gruposAtivosNorm = new Set<string>()
  const gruposResolvidosNorm = new Set<string>()

  for (const [norm, ref] of byGrupoNorm) {
    if (ref.resolvido_at) gruposResolvidosNorm.add(norm)
    else gruposAtivosNorm.add(norm)
  }

  for (const [pessoaId, ref] of byPessoaId) {
    const grupoNome = pessoaGrupos.get(pessoaId)
    if (!grupoNome) continue
    const norm = normalizarNomeGrupo(grupoNome)
    if (!norm) continue
    if (ref.resolvido_at) {
      if (!gruposAtivosNorm.has(norm)) gruposResolvidosNorm.add(norm)
    } else {
      gruposAtivosNorm.add(norm)
      gruposResolvidosNorm.delete(norm)
    }
  }

  return { gruposAtivosNorm, gruposResolvidosNorm }
}

/** Índice leve de clientes inadimplentes para cruzar com grupos do escritório. */
export async function fetchInadimplenciaGruposIndex(): Promise<InadimplenciaGruposIndex> {
  const byPessoaId = new Map<string, InadimplenciaGrupoRef>()
  const byGrupoNorm = new Map<string, InadimplenciaGrupoRef>()

  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('clients_inadimplencia')
      .select('id, razao_social, pessoa_id, resolvido_at, status_classe')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const chunk = (data ?? []) as {
      id: string
      razao_social: string
      pessoa_id: string | null
      resolvido_at: string | null
      status_classe: InadimplenciaClasse
    }[]

    for (const row of chunk) {
      const ref: InadimplenciaGrupoRef = {
        id: row.id,
        status_classe: row.status_classe,
        resolvido_at: row.resolvido_at,
      }

      if (row.pessoa_id) {
        byPessoaId.set(row.pessoa_id, preferRef(byPessoaId.get(row.pessoa_id), ref))
      }

      const norm = normalizarNomeGrupo(row.razao_social)
      if (norm) {
        byGrupoNorm.set(norm, preferRef(byGrupoNorm.get(norm), ref))
      }
    }

    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  const pessoaGrupos = await fetchGruposByPessoaIds([...byPessoaId.keys()])
  const { gruposAtivosNorm, gruposResolvidosNorm } = buildGrupoNormSets(byPessoaId, byGrupoNorm, pessoaGrupos)

  return { byPessoaId, byGrupoNorm, gruposAtivosNorm, gruposResolvidosNorm }
}

export function grupoDisplayNorm(grupoCliente: string): string {
  const display = grupoCliente === '' ? GRUPO_SEM_NOME : grupoCliente
  return normalizarNomeGrupo(display)
}

export function resumoMatchesInadimplencia(
  r: GrupoResumoRow,
  index: InadimplenciaGruposIndex,
  filtro: FiltroInadimplencia
): boolean {
  if (filtro === 'todos') return true
  const norm = grupoDisplayNorm(r.grupo_cliente)
  const isAtivo = index.gruposAtivosNorm.has(norm)
  const isResolvido = index.gruposResolvidosNorm.has(norm) && !isAtivo
  if (filtro === 'inadimplentes') return isAtivo
  if (filtro === 'resolvidos') return isResolvido
  return true
}

export function countInadimplenciaFromResumo(
  resumo: GrupoResumoRow[],
  index: InadimplenciaGruposIndex
): { inadimplentes: number; resolvidos: number } {
  let inadimplentes = 0
  let resolvidos = 0
  for (const r of resumo) {
    const norm = grupoDisplayNorm(r.grupo_cliente)
    const isAtivo = index.gruposAtivosNorm.has(norm)
    const isResolvido = index.gruposResolvidosNorm.has(norm) && !isAtivo
    if (isAtivo) inadimplentes++
    else if (isResolvido) resolvidos++
  }
  return { inadimplentes, resolvidos }
}

export function matchGrupoInadimplencia(
  grupo: GrupoEscritorio,
  index: InadimplenciaGruposIndex
): InadimplenciaGrupoRef | null {
  for (const empresa of grupo.empresas) {
    const byId = index.byPessoaId.get(empresa.id)
    if (byId) return byId
  }

  const norm = normalizarNomeGrupo(grupo.grupo_cliente)
  return index.byGrupoNorm.get(norm) ?? null
}

export function getInadimplenciaStatusForGrupo(
  grupo: GrupoEscritorio,
  index: InadimplenciaGruposIndex
): InadimplenciaGrupoStatus {
  const ref = matchGrupoInadimplencia(grupo, index)
  if (!ref) return { ativa: null, resolvida: null }
  if (ref.resolvido_at) return { ativa: null, resolvida: ref }
  return { ativa: ref, resolvida: null }
}

export function matchClienteInadimplencia(
  cliente: ClienteEscritorioRow,
  index: InadimplenciaGruposIndex
): InadimplenciaGrupoStatus {
  const byId = index.byPessoaId.get(cliente.id)
  if (byId) {
    return byId.resolvido_at
      ? { ativa: null, resolvida: byId }
      : { ativa: byId, resolvida: null }
  }

  const grupo = cliente.grupo_cliente?.trim() || GRUPO_SEM_NOME
  const ref = index.byGrupoNorm.get(normalizarNomeGrupo(grupo))
  if (!ref) return { ativa: null, resolvida: null }
  return ref.resolvido_at
    ? { ativa: null, resolvida: ref }
    : { ativa: ref, resolvida: null }
}

/** @deprecated Use getInadimplenciaStatusForGrupo */
export function getInadimplenciaAtivaForGrupo(
  grupo: GrupoEscritorio,
  index: InadimplenciaGruposIndex
): InadimplenciaGrupoRef | null {
  return getInadimplenciaStatusForGrupo(grupo, index).ativa
}
