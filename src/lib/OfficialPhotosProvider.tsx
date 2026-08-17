import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import {
  officialPhotosService,
  replaceOfficialPhotoCache,
  getOfficialPhotoCacheVersion,
} from '@/lib/officialPhotos'

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
  const emails = [
    ...colaboradores.map((row) => row.email),
    ...teamMembers.map((row) => row.email),
  ].filter((email): email is string => !!email)

  const result = await officialPhotosService.lookup({
    externalUserIds: [...new Set(ids)],
    emails: [...new Set(emails)],
  })
  replaceOfficialPhotoCache(result.data)
  return result
}

export function OfficialPhotosProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const query = useQuery({
    queryKey: ['official-photos', 'catalog'],
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 10,
    queryFn: loadOfficialPhotoCatalog,
  })

  const value = useMemo<OfficialPhotosContextValue>(
    () => ({
      version: query.data ? getOfficialPhotoCacheVersion() : 0,
      loading: query.isLoading,
      unavailable: query.data?.unavailable === true,
    }),
    [query.data, query.isLoading],
  )

  return <OfficialPhotosContext.Provider value={value}>{children}</OfficialPhotosContext.Provider>
}
