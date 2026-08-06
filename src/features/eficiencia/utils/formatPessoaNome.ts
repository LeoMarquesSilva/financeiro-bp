import type { TeamMember } from '@/lib/database.types'
import { resolveTeamMember } from '@/lib/teamMembersService'
import type { BpUsuarioAvatar } from '../hooks/useBpUsuariosAvatar'

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von'])

function normalizeNomeChave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

/** Title Case pt-BR (partículas em minúsculo). */
export function formatPessoaNome(nome: string | null | undefined): string {
  const raw = typeof nome === 'string' ? nome.trim() : ''
  if (!raw) return ''
  return raw
    .split(/\s+/)
    .map((part, i) => {
      const lower = part.toLocaleLowerCase('pt-BR')
      if (i > 0 && PARTICULAS.has(lower)) return lower
      return lower
        .split('-')
        .map((p) =>
          p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1) : p,
        )
        .join('-')
    })
    .join(' ')
}

/**
 * Preferência: nome do catálogo ticket-bp → team_members → Title Case do texto bruto.
 */
export function resolvePessoaDisplayNome(
  nome: string | null | undefined,
  teamMembers: TeamMember[] = [],
  catalog: BpUsuarioAvatar[] = [],
): string {
  const raw = typeof nome === 'string' ? nome.trim() : ''
  if (!raw) return ''

  const chave = normalizeNomeChave(raw)
  const fromCatalog = catalog.find((u) => u.nome_chave === chave && u.nome?.trim())
  if (fromCatalog?.nome?.trim()) return formatPessoaNome(fromCatalog.nome)

  const tokens = chave.split(' ').filter((t) => t.length > 2)
  if (tokens.length >= 2) {
    const fuzzy = catalog.find(
      (u) => u.nome?.trim() && tokens.every((t) => u.nome_chave.includes(t)),
    )
    if (fuzzy?.nome?.trim()) return formatPessoaNome(fuzzy.nome)
  }

  const byMember = resolveTeamMember(raw, teamMembers)
  if (byMember?.full_name?.trim()) return formatPessoaNome(byMember.full_name)

  const byFull = teamMembers.find((m) => normalizeNomeChave(m.full_name) === chave)
  if (byFull?.full_name?.trim()) return formatPessoaNome(byFull.full_name)

  return formatPessoaNome(raw)
}
