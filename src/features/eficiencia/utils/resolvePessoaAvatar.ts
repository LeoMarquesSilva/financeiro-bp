import type { TeamMember } from '@/lib/database.types'
import { getTeamMember } from '@/lib/teamAvatars'
import { getLocalAvatarPath, resolveTeamMember } from '@/lib/teamMembersService'
import {
  resolveAvatarFromCatalog,
  type BpUsuarioAvatar,
} from '../hooks/useBpUsuariosAvatar'

function normalizeNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

/**
 * Resolve miniatura: 1) catálogo ticket-bp (bp_usuarios_avatar),
 * 2) team_members + TEAM_BY_EMAIL, 3) /team/{slug}.jpg.
 */
export function resolvePessoaAvatarUrl(
  nome: string | null | undefined,
  teamMembers: TeamMember[],
  catalog: BpUsuarioAvatar[] = [],
): string | null {
  const fromCatalog = resolveAvatarFromCatalog(nome, catalog)
  if (fromCatalog) return fromCatalog

  const raw = typeof nome === 'string' ? nome.trim() : ''
  if (!raw) return null

  const byMember = resolveTeamMember(raw, teamMembers)
  if (byMember) {
    const fromMap = getTeamMember(byMember.email)?.avatar
    if (fromMap) return fromMap
    if (byMember.avatar_url) return byMember.avatar_url
    return getLocalAvatarPath(byMember.email)
  }

  const alvo = normalizeNome(raw)
  const byFullName = teamMembers.find((m) => normalizeNome(m.full_name) === alvo)
  if (byFullName) {
    return (
      getTeamMember(byFullName.email)?.avatar ??
      byFullName.avatar_url ??
      getLocalAvatarPath(byFullName.email)
    )
  }

  const tokens = alvo.split(/\s+/).filter((t) => t.length > 2)
  if (tokens.length >= 2) {
    const fuzzy = teamMembers.find((m) => {
      const n = normalizeNome(m.full_name)
      return tokens.every((t) => n.includes(t))
    })
    if (fuzzy) {
      return (
        getTeamMember(fuzzy.email)?.avatar ??
        fuzzy.avatar_url ??
        getLocalAvatarPath(fuzzy.email)
      )
    }
  }

  return null
}
