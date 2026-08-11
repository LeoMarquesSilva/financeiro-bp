import { createContext, useContext, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildDefaultRoleRouteAccess,
  type RoleRouteAccessConfig,
} from '@/lib/roleAccessConfig'
import { roleAccessDefaultsService } from '@/features/usuarios/services/roleAccessDefaultsService'

type ContextValue = {
  config: RoleRouteAccessConfig
  isLoading: boolean
  save: (config: RoleRouteAccessConfig) => Promise<void>
  isSaving: boolean
  resetToDefaults: () => Promise<void>
}

const RoleAccessDefaultsContext = createContext<ContextValue | null>(null)

export function RoleAccessDefaultsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['role_route_access_defaults'],
    queryFn: () => roleAccessDefaultsService.get(),
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: (config: RoleRouteAccessConfig) => roleAccessDefaultsService.save(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role_route_access_defaults'] })
    },
  })

  const config = data ?? buildDefaultRoleRouteAccess()

  const value: ContextValue = {
    config,
    isLoading,
    save: (next) => saveMutation.mutateAsync(next),
    isSaving: saveMutation.isPending,
    resetToDefaults: () => saveMutation.mutateAsync(buildDefaultRoleRouteAccess()),
  }

  return (
    <RoleAccessDefaultsContext.Provider value={value}>{children}</RoleAccessDefaultsContext.Provider>
  )
}

export function useRoleAccessDefaults(): ContextValue {
  const ctx = useContext(RoleAccessDefaultsContext)
  if (!ctx) {
    return {
      config: buildDefaultRoleRouteAccess(),
      isLoading: false,
      save: async () => {},
      isSaving: false,
      resetToDefaults: async () => {},
    }
  }
  return ctx
}
