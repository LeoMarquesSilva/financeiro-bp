import { supabase } from '@/lib/supabaseClient'
import {
  buildDefaultRoleRouteAccess,
  normalizeRoleRouteAccess,
  type RoleRouteAccessConfig,
} from '@/lib/roleAccessConfig'

const KEY_ROLE_ROUTE_ACCESS = 'role_route_access_defaults'

export const roleAccessDefaultsService = {
  async get(): Promise<RoleRouteAccessConfig> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', KEY_ROLE_ROUTE_ACCESS)
      .maybeSingle()
    if (error) throw error
    if (!data) return buildDefaultRoleRouteAccess()
    return normalizeRoleRouteAccess((data as { value: unknown }).value)
  },

  async save(config: RoleRouteAccessConfig): Promise<void> {
    const normalized = normalizeRoleRouteAccess(config)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY_ROLE_ROUTE_ACCESS, value: normalized } as never, { onConflict: 'key' })
    if (error) throw error
  },
}
