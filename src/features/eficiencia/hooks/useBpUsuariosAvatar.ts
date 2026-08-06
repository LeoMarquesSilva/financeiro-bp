import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export type BpUsuarioAvatar = {
  nome: string
  email: string | null
  avatar_url: string | null
  nome_chave: string
}

function normalizeNomeChave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

export function useBpUsuariosAvatar() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bp_usuarios_avatar'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('bp_usuarios_avatar')
        .select('nome, email, avatar_url, nome_chave')
        .eq('ativo', true)
      if (err) throw err
      return (rows ?? []) as BpUsuarioAvatar[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const usuarios = data ?? []

  const byNomeChave = useMemo(() => {
    const map = new Map<string, BpUsuarioAvatar>()
    for (const u of usuarios) {
      if (!u.nome_chave) continue
      const prev = map.get(u.nome_chave)
      if (!prev || (!prev.avatar_url && u.avatar_url)) map.set(u.nome_chave, u)
    }
    return map
  }, [usuarios])

  return { usuarios, byNomeChave, loading: isLoading, error, normalizeNomeChave }
}

/** Resolve avatar_url a partir do nome do ranking (match exato / tokens / início). */
export function resolveAvatarFromCatalog(
  nome: string | null | undefined,
  usuarios: BpUsuarioAvatar[],
): string | null {
  const raw = typeof nome === 'string' ? nome.trim() : ''
  if (!raw || usuarios.length === 0) return null
  const chave = normalizeNomeChave(raw)

  const exact = usuarios.find((u) => u.nome_chave === chave && u.avatar_url)
  if (exact?.avatar_url) return exact.avatar_url

  const tokens = chave.split(' ').filter((t) => t.length > 2)
  if (tokens.length >= 2) {
    const fuzzy = usuarios.find((u) => {
      if (!u.avatar_url) return false
      return tokens.every((t) => u.nome_chave.includes(t))
    })
    if (fuzzy?.avatar_url) return fuzzy.avatar_url
  }

  // Ranking às vezes traz só 2 nomes; catálogo tem nome completo
  const prefix = usuarios.find(
    (u) =>
      u.avatar_url &&
      (u.nome_chave.startsWith(chave) || chave.startsWith(u.nome_chave.split(' ').slice(0, 2).join(' '))),
  )
  return prefix?.avatar_url ?? null
}
