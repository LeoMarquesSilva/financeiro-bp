import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import {
  officialPhotosService,
  applyOfficialPhotoCatalog,
  peekPersistedOfficialPhotoCatalog,
  prefetchOfficialPhotoImages,
  getOfficialPhotoCacheVersion,
} from '@/lib/officialPhotos'
import type { OfficialPhotoEmailAlias } from '@/lib/officialPhotosCore'

type OfficialPhotosContextValue = {
  version: number
  loading: boolean
  unavailable: boolean
}

export const OfficialPhotosContext = createContext<OfficialPhotosContextValue>({
  version: 0,
  loading: false,
  unavailable: false,
})

export function useOfficialPhotos() {
  return useContext(OfficialPhotosContext)
}

const persistedCatalog = peekPersistedOfficialPhotoCatalog()

function buildSioeEmailAliases(
  colaboradores: Array<{ id: string; email: string | null }>,
  teamMembers: Array<{ email: string | null; colaborador_id: string | null }>,
): OfficialPhotoEmailAlias[] {
  const aliases: OfficialPhotoEmailAlias[] = []
  for (const row of colaboradores) {
    if (row.email) aliases.push({ externalUserId: row.id, email: row.email })
  }
  for (const row of teamMembers) {
    if (row.colaborador_id && row.email) {
      aliases.push({ externalUserId: row.colaborador_id, email: row.email })
    }
  }
  return aliases
}

async function loadOfficialPhotoCatalog() {
  const [colabRes, teamRes] = await Promise.all([
    supabase.from('colaboradores' as never).select('id, email'),
    supabase.from('team_members').select('id, email, colaborador_id'),
  ])
  if (colabRes.error) throw colabRes.error
  if (teamRes.error) throw teamRes.error

  const colaboradores = (colabRes.data ?? []) as Array<{ id: string; email: string | null }>
  const teamMembers = (teamRes.data ?? []) as Array<{
    id: string
    email: string | null
    colaborador_id: string | null
  }>

  const ids = [
    ...colaboradores.map((row) => row.id),
    ...teamMembers.map((row) => row.colaborador_id).filter((id): id is string => !!id),
  ]
  const linkedIds = new Set(ids.filter(Boolean))
  const emails = teamMembers
    .filter((row) => !row.colaborador_id || !linkedIds.has(row.colaborador_id))
    .map((row) => row.email)
    .filter((email): email is string => !!email)

  const result = await officialPhotosService.lookup({
    externalUserIds: [...new Set(ids)],
    emails: [...new Set(emails)],
  })

  if (result.unavailable) {
    const cached = peekPersistedOfficialPhotoCatalog()
    if (cached?.photos.length) {
      return { data: cached.photos, notFound: result.notFound, unavailable: true }
    }
    return result
  }

  const aliases = buildSioeEmailAliases(colaboradores, teamMembers)
  applyOfficialPhotoCatalog(result.data, aliases)
  prefetchOfficialPhotoImages(result.data)
  return result
}

export function OfficialPhotosProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const query = useQuery({
    queryKey: ['official-photos', 'catalog'],
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: true,
    retry: false,
    initialData: persistedCatalog?.photos.length
      ? { data: persistedCatalog.photos, notFound: [] as string[] }
      : undefined,
    initialDataUpdatedAt: persistedCatalog?.savedAt,
    queryFn: loadOfficialPhotoCatalog,
  })

  const value = useMemo<OfficialPhotosContextValue>(
    () => ({
      version: getOfficialPhotoCacheVersion(),
      loading: query.isLoading && getOfficialPhotoCacheVersion() === 0,
      unavailable: query.data?.unavailable === true && getOfficialPhotoCacheVersion() === 0,
    }),
    [query.data, query.dataUpdatedAt, query.isLoading],
  )

  return <OfficialPhotosContext.Provider value={value}>{children}</OfficialPhotosContext.Provider>
}
