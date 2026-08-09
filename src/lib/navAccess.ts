import type { AppRole } from '@/lib/database.types'
import type { ModuleKey } from '@/lib/moduleAccess'

export type NavAccessItem = {
  to: string
  label: string
  roles: AppRole[]
  moduleKey?: ModuleKey
  end?: boolean
}

/** Mesma regra da sidebar: role OU módulo liberado. */
export function filterNavItemsForAccess<T extends NavAccessItem>(
  items: T[],
  role: AppRole | null,
  moduleAccess: ModuleKey[],
): T[] {
  return items.filter(
    (item) =>
      (role != null && item.roles.includes(role)) ||
      (item.moduleKey != null && moduleAccess.includes(item.moduleKey)),
  )
}

/** Rotas do menu (labels estáveis para auditoria). */
export const NAV_ACCESS_ITEMS: NavAccessItem[] = [
  {
    to: '/financeiro/inadimplencia/dashboard',
    label: 'Dashboard',
    roles: ['admin', 'financeiro', 'comite'],
    moduleKey: 'inadimplencia',
  },
  {
    to: '/financeiro/inadimplencia',
    label: 'Inadimplência',
    roles: ['admin', 'financeiro', 'comite'],
    moduleKey: 'inadimplencia',
    end: true,
  },
  {
    to: '/financeiro/cobranca/seguimento',
    label: 'Inadimplência Pontual',
    roles: ['admin', 'financeiro', 'comite'],
    moduleKey: 'cobranca',
  },
  {
    to: '/financeiro/inadimplencia/judicializada',
    label: 'Inad. Judicializada',
    roles: ['admin', 'financeiro', 'comite'],
  },
  {
    to: '/financeiro/escritorio',
    label: 'Escritório',
    roles: ['admin', 'financeiro'],
    moduleKey: 'escritorio',
  },
  {
    to: '/financeiro/cobranca',
    label: 'Cobrança',
    roles: ['admin', 'financeiro'],
    moduleKey: 'cobranca',
  },
  {
    to: '/financeiro/receita',
    label: 'Receita',
    roles: ['admin', 'financeiro', 'comite'],
    moduleKey: 'receita',
  },
  {
    to: '/financeiro/opex',
    label: 'OPEX',
    roles: ['admin', 'financeiro'],
    moduleKey: 'opex',
  },
  {
    to: '/financeiro/eficiencia',
    label: 'Eficiência Operacional',
    roles: ['admin', 'coordenador'],
    moduleKey: 'eficiencia',
  },
  {
    to: '/financeiro/operacoes-legais',
    label: 'Operações Legais',
    roles: ['admin', 'coordenador'],
    moduleKey: 'operacoes-legais',
  },
  {
    to: '/financeiro/usuarios',
    label: 'Usuários',
    roles: ['admin'],
    moduleKey: 'gestores',
  },
  {
    to: '/financeiro/configuracoes',
    label: 'Configurações',
    roles: ['admin'],
    moduleKey: 'configuracoes',
  },
]

export function canAccessRoute(input: {
  role: AppRole | null
  moduleAccess: ModuleKey[]
  allowedRoles: AppRole[]
  moduleKey?: ModuleKey
}): boolean {
  const hasRole = !!input.role && input.allowedRoles.includes(input.role)
  const hasModule = !!input.moduleKey && input.moduleAccess.includes(input.moduleKey)
  return hasRole || hasModule
}
