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
  | 'operacoes-legais'
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
  { value: 'gestores', label: 'Usuários' },
  { value: 'configuracoes', label: 'Configurações' },
]

export function moduleKeyLabel(key: ModuleKey): string {
  return MODULE_KEY_OPTIONS.find((m) => m.value === key)?.label ?? key
}
