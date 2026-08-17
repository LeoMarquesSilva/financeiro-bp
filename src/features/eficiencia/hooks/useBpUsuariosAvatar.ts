import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { getOfficialPhotoUrlByEmail } from '@/lib/officialPhotos'
import { useOfficialPhotos } from '@/lib/OfficialPhotosProvider'

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

type ColaboradorAvatarRow = {
  full_name: string
  email: string | null
  avatar_url: string | null
}

type BpAvatarRow = {
  nome: string
  email: string | null
  avatar_url: string | null
  nome_chave: string
}

function toCatalogEntry(
  nome: string,
  email: string | null | undefined,
  avatar_url: string | null | undefined,
): BpUsuarioAvatar | null {
  const n = String(nome ?? '').trim()
  if (!n) return null
  const url = typeof avatar_url === 'string' && avatar_url.trim() ? avatar_url.trim() : null
  return {
    nome: n,
    email: email ? String(email).trim().toLowerCase() : null,
    avatar_url: url,
    nome_chave: normalizeNomeChave(n),
  }
}

/**
 * Mescla catálogos priorizando foto do módulo Colaboradores (ORQUESTRAI).
 * Inclui inativos: rankings de eficiência ainda listam desligados com desvio histórico.
 */
function mergeAvatarCatalog(
  colaboradores: ColaboradorAvatarRow[],
  ticketRows: BpAvatarRow[],
): BpUsuarioAvatar[] {
  const byKey = new Map<string, BpUsuarioAvatar>()

  const upsert = (entry: BpUsuarioAvatar | null, preferPhoto: boolean) => {
    if (!entry?.nome_chave) return
    const prev = byKey.get(entry.nome_chave)
    if (!prev) {
      byKey.set(entry.nome_chave, entry)
      return
    }
    if (preferPhoto && !prev.avatar_url && entry.avatar_url) {
      byKey.set(entry.nome_chave, { ...prev, ...entry, avatar_url: entry.avatar_url })
      return
    }
    if (!preferPhoto && !prev.avatar_url && entry.avatar_url) {
      byKey.set(entry.nome_chave, { ...prev, avatar_url: entry.avatar_url })
    }
  }

  // 1) Fonte principal: colaboradores (espelho ORQUESTRAI)
  for (const c of colaboradores) {
    upsert(toCatalogEntry(c.full_name, c.email, c.avatar_url), true)
  }

  // 2) Fallback ticket-bp / RESPONSUM (bp_usuarios_avatar), inclusive inativos com foto
  for (const u of ticketRows) {
    upsert(
      toCatalogEntry(u.nome, u.email, u.avatar_url ?? null),
      false,
    )
  }

  return [...byKey.values()]
}

export function useBpUsuariosAvatar() {
  const { version: officialVersion } = useOfficialPhotos()
  const { data, isLoading, error } = useQuery({
    queryKey: ['bp_usuarios_avatar', 'colaboradores'],
    queryFn: async () => {
      const [colabRes, ticketRes] = await Promise.all([
        supabase
          .from('colaboradores' as never)
          .select('full_name, email, avatar_url'),
        supabase
          .from('bp_usuarios_avatar')
          .select('nome, email, avatar_url, nome_chave'),
      ])
      if (colabRes.error) throw colabRes.error
      if (ticketRes.error) throw ticketRes.error

      return mergeAvatarCatalog(
        (colabRes.data ?? []) as ColaboradorAvatarRow[],
        (ticketRes.data ?? []) as BpAvatarRow[],
      )
    },
    staleTime: 1000 * 60 * 30,
  })

  const usuarios = useMemo(
    () =>
      (data ?? []).map((u) => ({
        ...u,
        avatar_url: getOfficialPhotoUrlByEmail(u.email) ?? u.avatar_url,
      })),
    [data, officialVersion],
  )

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
      (u.nome_chave.startsWith(chave) ||
        chave.startsWith(u.nome_chave.split(' ').slice(0, 2).join(' '))),
  )
  return prefix?.avatar_url ?? null
}
