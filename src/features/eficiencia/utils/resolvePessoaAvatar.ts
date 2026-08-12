import type { TeamMember } from '@/lib/database.types'
import { getTeamMember } from '@/lib/teamAvatars'
import { getLocalAvatarPath } from '@/lib/teamMembersService'
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

function avatarFromMember(m: TeamMember): string | null {
  return (
    getTeamMember(m.email)?.avatar ??
    m.avatar_url ??
    getLocalAvatarPath(m.email)
  )
}

/**
 * Resolve miniatura: 1) catálogo Colaboradores/ORQUESTRAI + ticket-bp
 * (`useBpUsuariosAvatar`), 2) team_members por nome completo (sem match só
 * pelo 1º nome), 3) /team/{slug}.jpg.
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

  const alvo = normalizeNome(raw)
  const byFullName = teamMembers.find((m) => normalizeNome(m.full_name) === alvo)
  if (byFullName) return avatarFromMember(byFullName)

  const tokens = alvo.split(/\s+/).filter((t) => t.length > 2)
  const primeiro = tokens[0]
  if (tokens.length >= 2 && primeiro) {
    const fuzzy = teamMembers.find((m) => {
      const n = normalizeNome(m.full_name)
      const catTokens = n.split(/\s+/).filter((t) => t.length > 2)
      if (catTokens[0] !== primeiro) return false
      const rawInCat = tokens.every((t) => n.includes(t))
      const catInRaw = catTokens.every((t) => alvo.includes(t))
      return rawInCat || catInRaw
    })
    if (fuzzy) return avatarFromMember(fuzzy)
  }

  return null
}
