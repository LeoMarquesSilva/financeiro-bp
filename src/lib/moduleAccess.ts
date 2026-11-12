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
  /** Recorte de Eficiência: visão completa, travada na área da pessoa. */
  | 'eficiencia-area'
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

/** Não entram na grade principal: são subcategorias de Resultado Metas. */
export const EFICIENCIA_AREA_MODULE = 'eficiencia-area' as const
export const EFICIENCIA_PROTOCOLOS_MODULE = 'eficiencia-protocolos' as const

/**
 * Recorte de Resultado Metas liberado para a pessoa:
 * - completa: escritório inteiro (`eficiencia`)
 * - area: visão completa, só da área da pessoa (`eficiencia-area`)
 * - protocolos: só indicadores de protocolo, na área da pessoa (`eficiencia-protocolos`)
 */
export type EficienciaEscopo = 'completa' | 'area' | 'protocolos'

/** Chaves que liberam Resultado Metas (uma por recorte). */
export const EFICIENCIA_ESCOPO_MODULE: Record<EficienciaEscopo, ModuleKey> = {
  completa: 'eficiencia',
  area: EFICIENCIA_AREA_MODULE,
  protocolos: EFICIENCIA_PROTOCOLOS_MODULE,
}

const EFICIENCIA_MODULE_KEYS: readonly ModuleKey[] = Object.values(EFICIENCIA_ESCOPO_MODULE)

export function moduleKeyLabel(key: ModuleKey): string {
  if (key === EFICIENCIA_AREA_MODULE) return 'Visão completa (somente área)'
  if (key === EFICIENCIA_PROTOCOLOS_MODULE) return 'Somente protocolos'
  return MODULE_KEY_OPTIONS.find((m) => m.value === key)?.label ?? key
}

/** Recorte pelas chaves gravadas. Se houver mais de uma, vale a mais ampla. */
export function eficienciaEscopoFromModules(
  moduleAccess: Iterable<string>,
): EficienciaEscopo | null {
  const keys = new Set(moduleAccess)
  if (keys.has('eficiencia')) return 'completa'
  if (keys.has(EFICIENCIA_AREA_MODULE)) return 'area'
  if (keys.has(EFICIENCIA_PROTOCOLOS_MODULE)) return 'protocolos'
  return null
}

/** Troca o recorte de Resultado Metas, mantendo só uma chave (ou nenhuma). */
export function withEficienciaEscopo<K extends string>(
  modules: Iterable<K>,
  escopo: EficienciaEscopo | null,
): Set<K> {
  const next = new Set(modules)
  for (const key of EFICIENCIA_MODULE_KEYS) next.delete(key as K)
  if (escopo) next.add(EFICIENCIA_ESCOPO_MODULE[escopo] as K)
  return next
}

/** Qualquer recorte de Resultado Metas libera a rota do módulo. */
export function hasEficienciaModule(moduleAccess: readonly string[]): boolean {
  return eficienciaEscopoFromModules(moduleAccess) != null
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
  return eficienciaEscopoFromModules(moduleAccess) === 'protocolos'
}

/** Visão completa de Resultado Metas, travada na área da pessoa (sem “Todas as áreas”). */
export function isEficienciaSomenteArea(
  role: string | null | undefined,
  moduleAccess: readonly string[],
): boolean {
  if (role === 'admin') return false
  return eficienciaEscopoFromModules(moduleAccess) === 'area'
}
