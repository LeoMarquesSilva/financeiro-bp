import type { AppRole } from '@/lib/database.types'
import type { ModuleKey } from '@/lib/moduleAccess'

export type NavAccessItem = {
  to: string
  label: string
  roles: AppRole[]
  moduleKey?: ModuleKey
  end?: boolean
}

/** Rotas do menu (labels estáveis). `roles` = default legado em código. */
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
    // Resultado Metas (jurídico). Coordenador precisa do checkbox — não herda via role.
    roles: ['admin'],
    moduleKey: 'eficiencia',
  },
  {
    to: '/financeiro/operacoes-legais',
    label: 'Operações Legais',
    // Módulo próprio. Só admin ou checkbox "Operações Legais".
    roles: ['admin'],
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
