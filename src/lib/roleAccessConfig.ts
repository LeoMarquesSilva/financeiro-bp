import type { AppRole } from '@/lib/database.types'
import type { ModuleKey } from '@/lib/moduleAccess'
import { NAV_ACCESS_ITEMS, type NavAccessItem } from '@/lib/navAccessItems'

/** Rotas liberadas por perfil (paths do menu / ProtectedRoute). */
export type RoleRouteAccessConfig = Record<AppRole, string[]>

export const CONFIGURABLE_ROLES: AppRole[] = ['admin', 'financeiro', 'comite', 'coordenador']

export const ROLE_ACCESS_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  financeiro: 'Financeiro',
  comite: 'Comitê',
  coordenador: 'Coordenador',
}

const EMPTY_ROLE_PATHS: RoleRouteAccessConfig = {
  admin: [],
  financeiro: [],
  comite: [],
  coordenador: [],
}

/** Defaults derivados de NAV_ACCESS_ITEMS (comportamento legado em código). */
export function buildDefaultRoleRouteAccess(): RoleRouteAccessConfig {
  const result: RoleRouteAccessConfig = {
    admin: [],
    financeiro: [],
    comite: [],
    coordenador: [],
  }
  for (const item of NAV_ACCESS_ITEMS) {
    for (const role of item.roles) {
      if (!result[role].includes(item.to)) {
        result[role].push(item.to)
      }
    }
  }
  for (const role of CONFIGURABLE_ROLES) {
    result[role].sort()
  }
  return result
}

const KNOWN_ROUTE_PATHS = new Set(NAV_ACCESS_ITEMS.map((i) => i.to))

export function normalizeRoleRouteAccess(raw: unknown): RoleRouteAccessConfig {
  const defaults = buildDefaultRoleRouteAccess()
  if (!raw || typeof raw !== 'object') return defaults

  const out: RoleRouteAccessConfig = { ...EMPTY_ROLE_PATHS }
  for (const role of CONFIGURABLE_ROLES) {
    const paths = (raw as Record<string, unknown>)[role]
    if (!Array.isArray(paths)) {
      out[role] = [...defaults[role]]
      continue
    }
    out[role] = paths
      .filter((p): p is string => typeof p === 'string' && KNOWN_ROUTE_PATHS.has(p))
      .sort()
  }
  return out
}

/** Sub-rotas herdam a rota pai (ex.: detalhe do Escritório). */
export function resolveRoutePathForAccess(pathname: string): string {
  if (pathname.startsWith('/financeiro/escritorio/')) return '/financeiro/escritorio'
  return pathname
}

function roleHasRoute(
  role: AppRole,
  routePath: string,
  config: RoleRouteAccessConfig,
): boolean {
  const paths = config[role] ?? []
  return paths.includes(routePath)
}

export function canAccessRoutePath(input: {
  role: AppRole | null
  moduleAccess: ModuleKey[]
  routePath: string
  moduleKey?: ModuleKey
  roleRouteAccess?: RoleRouteAccessConfig | null
}): boolean {
  const hasModule = !!input.moduleKey && input.moduleAccess.includes(input.moduleKey)
  if (hasModule) return true

  if (!input.role) return false

  const config = input.roleRouteAccess ?? buildDefaultRoleRouteAccess()
  const path = resolveRoutePathForAccess(input.routePath)
  return roleHasRoute(input.role, path, config)
}

export function filterNavItemsForAccess<T extends NavAccessItem>(
  items: T[],
  role: AppRole | null,
  moduleAccess: ModuleKey[],
  roleRouteAccess?: RoleRouteAccessConfig | null,
): T[] {
  return items.filter((item) =>
    canAccessRoutePath({
      role,
      moduleAccess,
      routePath: item.to,
      moduleKey: item.moduleKey,
      roleRouteAccess,
    }),
  )
}

/** Retrocompat: testes que passam allowedRoles estáticos. */
export function canAccessRoute(input: {
  role: AppRole | null
  moduleAccess: ModuleKey[]
  allowedRoles: AppRole[]
  moduleKey?: ModuleKey
  routePath?: string
  roleRouteAccess?: RoleRouteAccessConfig | null
}): boolean {
  if (input.routePath) {
    return canAccessRoutePath({
      role: input.role,
      moduleAccess: input.moduleAccess,
      routePath: input.routePath,
      moduleKey: input.moduleKey,
      roleRouteAccess: input.roleRouteAccess,
    })
  }
  const hasRole = !!input.role && input.allowedRoles.includes(input.role)
  const hasModule = !!input.moduleKey && input.moduleAccess.includes(input.moduleKey)
  return hasRole || hasModule
}
