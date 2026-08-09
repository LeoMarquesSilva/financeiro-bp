import type { AppRole } from '@/lib/database.types'
import type { ModuleKey } from '@/lib/moduleAccess'

/** Home padrão por perfil (quando o usuário tem role). */
const HOME_BY_ROLE: Partial<Record<AppRole, string>> = {
  admin: '/financeiro/inadimplencia',
  financeiro: '/financeiro/inadimplencia',
  comite: '/financeiro/inadimplencia',
  coordenador: '/financeiro/eficiencia',
}

/** Rota de entrada de cada módulo liberado individualmente. */
export const MODULE_HOME_PATH: Record<ModuleKey, string> = {
  eficiencia: '/financeiro/eficiencia',
  'operacoes-legais': '/financeiro/operacoes-legais',
  inadimplencia: '/financeiro/inadimplencia',
  receita: '/financeiro/receita',
  escritorio: '/financeiro/escritorio',
  cobranca: '/financeiro/cobranca',
  opex: '/financeiro/opex',
  gestores: '/financeiro/usuarios',
  configuracoes: '/financeiro/configuracoes',
}

/** Ordem de preferência quando o usuário só tem módulos (sem role de home fixa). */
const MODULE_HOME_PRIORITY: ModuleKey[] = [
  'eficiencia',
  'operacoes-legais',
  'receita',
  'inadimplencia',
  'escritorio',
  'cobranca',
  'opex',
  'gestores',
  'configuracoes',
]

/**
 * Primeira tela após login / rota inválida.
 * Coordenador → Eficiência; admin/financeiro/comite → Inadimplência;
 * só módulos → primeiro módulo liberado na ordem de prioridade.
 */
export function resolveHomePath(
  role: AppRole | null,
  moduleAccess: ModuleKey[],
): string {
  if (role && HOME_BY_ROLE[role]) return HOME_BY_ROLE[role]!
  for (const key of MODULE_HOME_PRIORITY) {
    if (moduleAccess.includes(key)) return MODULE_HOME_PATH[key]
  }
  return '/financeiro/perfil'
}
