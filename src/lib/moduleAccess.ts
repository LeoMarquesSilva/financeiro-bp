/**
 * Módulos do financeiro-bp que podem ser liberados individualmente para um team_member,
 * além dos 3 roles existentes (admin/financeiro/comite). Alinhado às rotas de
 * src/app/App.tsx e à constraint CHECK de team_member_module_access.module_key
 * (supabase/migrations/20260806260000_team_members_colaborador_e_acesso_modulo.sql).
 */
export type ModuleKey =
  | 'inadimplencia'
  | 'escritorio'
  | 'cobranca'
  | 'receita'
  | 'opex'
  | 'eficiencia'
  /** Recorte de Eficiência: só SLA Protocolo, Eficiência Protocolo e SLA Ciência de Agendamentos. */
  | 'eficiencia-protocolos'
  | 'operacoes-legais'
  | 'timesheet'
  | 'gestores'
  | 'configuracoes'

export const MODULE_KEY_OPTIONS: { value: ModuleKey; label: string }[] = [
  { value: 'inadimplencia', label: 'Inadimplência' },
  { value: 'escritorio', label: 'Escritório' },
  { value: 'cobranca', label: 'Cobrança' },
  { value: 'receita', label: 'Receita' },
  { value: 'opex', label: 'Opex' },
  { value: 'eficiencia', label: 'Resultado Metas Bismarchi Pires' },
  /** Sidebar/rota `/financeiro/operacoes-legais` (não filtra mais o Overview de Eficiência). */
  { value: 'operacoes-legais', label: 'Operações Legais' },
  { value: 'timesheet', label: 'Timesheet' },
  { value: 'gestores', label: 'Usuários' },
  { value: 'configuracoes', label: 'Configurações' },
]

/** Não entra na grade principal: é subcategoria de Resultado Metas. */
export const EFICIENCIA_PROTOCOLOS_MODULE = 'eficiencia-protocolos' as const

export function moduleKeyLabel(key: ModuleKey): string {
  if (key === EFICIENCIA_PROTOCOLOS_MODULE) return 'Somente protocolos'
  return MODULE_KEY_OPTIONS.find((m) => m.value === key)?.label ?? key
}

/**
 * Visão restrita de Resultado Metas.
 * Admin continua vendo o módulo inteiro. Os demais, só quando têm a subcategoria
 * e não têm o módulo completo.
 */
export function isEficienciaSomenteProtocolos(
  role: string | null | undefined,
  moduleAccess: readonly string[],
): boolean {
  if (role === 'admin') return false
  return (
    moduleAccess.includes(EFICIENCIA_PROTOCOLOS_MODULE) &&
    !moduleAccess.includes('eficiencia')
  )
}
