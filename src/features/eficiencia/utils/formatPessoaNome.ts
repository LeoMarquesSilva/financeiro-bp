import type { TeamMember } from '@/lib/database.types'
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
 * Preferência: match exato no catálogo ticket-bp → match exato em team_members → Title Case do bruto.
 * Não usa match só pelo primeiro nome (evita trocar Gustavo Ribeiro por Gustavo Bismarchi).
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
  const primeiro = tokens[0]
  if (tokens.length >= 2 && primeiro) {
    const fuzzy = catalog.find((u) => {
      if (!u.nome?.trim()) return false
      const catTokens = u.nome_chave.split(' ').filter((t) => t.length > 2)
      if (catTokens[0] !== primeiro) return false
      // Exige overlap forte nos dois sentidos (evita homônimos parciais).
      const rawInCat = tokens.every((t) => u.nome_chave.includes(t))
      const catInRaw = catTokens.every((t) => chave.includes(t))
      return rawInCat || catInRaw
    })
    if (fuzzy?.nome?.trim()) return formatPessoaNome(fuzzy.nome)
  }

  const byFull = teamMembers.find((m) => normalizeNomeChave(m.full_name) === chave)
  if (byFull?.full_name?.trim()) return formatPessoaNome(byFull.full_name)

  return formatPessoaNome(raw)
}
