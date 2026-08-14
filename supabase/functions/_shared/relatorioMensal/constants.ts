export const META_AREAS: { key: string; pct: number; label: string }[] = [
  { key: 'insolvencia', pct: 46.85, label: 'Insolvência' },
  { key: 'trabalhista', pct: 15.33, label: 'Trabalhista' },
  { key: 'civel', pct: 15.33, label: 'Cível' },
  { key: 'contratos', pct: 12.53, label: 'Contratos' },
  { key: 'recuperacao_de_credito', pct: 9.96, label: 'Recuperação de Crédito' },
]

export const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

export type RelatorioSecoes = {
  indicadores_operacionais: boolean
  receita_visao_mes: boolean
  receita_composicao: boolean
  receita_inad_grupos: boolean
  receita_grafico_resumo: boolean
  eficiencia_overview: boolean
}

export type RelatorioSecaoKey = keyof RelatorioSecoes

export const SECOES_ORDEM_DEFAULT: RelatorioSecaoKey[] = [
  'indicadores_operacionais',
  'receita_visao_mes',
  'receita_composicao',
  'receita_inad_grupos',
  'receita_grafico_resumo',
  'eficiencia_overview',
]

export type RelatorioSecoesConfig = {
  secoes: RelatorioSecoes
  ordem: RelatorioSecaoKey[]
  /** Destinatário com área meta: indicadores vão na seção da área, não no consolidado. */
  focusAreaKey?: string | null
}

export const SECOES_DEFAULT: RelatorioSecoes = {
  indicadores_operacionais: true,
  receita_visao_mes: true,
  receita_composicao: true,
  receita_inad_grupos: true,
  receita_grafico_resumo: false,
  eficiencia_overview: true,
}

export function parseSecoesConfig(raw: Record<string, unknown> | null | undefined): RelatorioSecoesConfig {
  const r = raw ?? {}
  const secoes = { ...SECOES_DEFAULT }
  for (const key of SECOES_ORDEM_DEFAULT) {
    if (typeof r[key] === 'boolean') secoes[key] = r[key]
  }

  let ordem: RelatorioSecaoKey[] = Array.isArray(r.ordem)
    ? r.ordem.filter(
      (k): k is RelatorioSecaoKey =>
        typeof k === 'string' && SECOES_ORDEM_DEFAULT.includes(k as RelatorioSecaoKey),
    )
    : [...SECOES_ORDEM_DEFAULT]

  for (const key of SECOES_ORDEM_DEFAULT) {
    if (!ordem.includes(key)) ordem.push(key)
  }

  return { secoes, ordem }
}

export function areaLabel(areaKey: string | null | undefined): string {
  if (!areaKey) return 'Consolidado (escritório)'
  return META_AREAS.find((a) => a.key === areaKey)?.label ?? areaKey
}

/** Chaves Receita (meta) → nomes canônicos das RPCs de Eficiência (sp_usuarios_area). */
const RECEITA_KEY_TO_EFICIENCIA_AREA: Record<string, string> = {
  insolvencia: 'Reestruturação',
  trabalhista: 'Trabalhista',
  civel: 'Cível',
  contratos: 'Contratos',
  recuperacao_de_credito: 'Recuperação de Crédito',
}

export function areaEficienciaParam(areaKey: string | null | undefined): string | null {
  if (!areaKey) return null
  return RECEITA_KEY_TO_EFICIENCIA_AREA[areaKey] ?? areaLabel(areaKey)
}

export function departamentoNormKey(departamento: string): string {
  return departamento
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function departamentoMatchesAreaKey(departamento: string, areaKey: string): boolean {
  const key = departamentoNormKey(departamento)
  if (key === areaKey) return true
  const label = META_AREAS.find((a) => a.key === areaKey)?.label
  if (!label) return false
  return key === departamentoNormKey(label)
}
