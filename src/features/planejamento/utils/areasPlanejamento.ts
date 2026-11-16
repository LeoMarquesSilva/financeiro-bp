/**
 * Áreas do Planejamento 2027: as 7 áreas do DL (`dl_areas`), com a ponte para as chaves da
 * Receita/ME (`recuperacao_de_credito`, `outras`) e para as áreas da Eficiência Operacional.
 * Sem imports com alias: roda nos testes com `node --test`.
 */

export type AreaKey = 'insolvencia' | 'trabalhista' | 'civel' | 'contratos' | 'rec_credito' | 'add' | 'tributario'

export type AreaPlanejamento = {
  key: AreaKey
  nome: string
  /** Chave da área na Receita/Melhor Estimativa (`outras` = demais departamentos). */
  receitaKey: string
  /** Área no painel de Eficiência Operacional (null = sem indicadores por área). */
  eficienciaArea: string | null
  /** Departamento no VIOS (dl_areas.departamento). */
  departamento: string
  cor: string
  /** Área que deixou de existir: aparece no histórico (2025/2026), sem projeção nem meta em 2027. */
  encerrada?: boolean
}

export const AREAS_PLANEJAMENTO: readonly AreaPlanejamento[] = [
  { key: 'insolvencia', departamento: 'Insolvência', nome: 'Insolvência', receitaKey: 'insolvencia', eficienciaArea: 'Reestruturação', cor: '#7f1d1d' },
  { key: 'trabalhista', departamento: 'Trabalhista', nome: 'Trabalhista', receitaKey: 'trabalhista', eficienciaArea: 'Trabalhista', cor: '#0b5ee5' },
  { key: 'civel', departamento: 'Cível', nome: 'Cível', receitaKey: 'civel', eficienciaArea: 'Cível', cor: '#2c99dd' },
  { key: 'contratos', departamento: 'Contratos', nome: 'Contratos', receitaKey: 'contratos', eficienciaArea: 'Contratos', cor: '#de7412' },
  {
    key: 'rec_credito', departamento: 'Recuperação de Crédito',
    nome: 'Recuperação de Crédito',
    receitaKey: 'recuperacao_de_credito',
    eficienciaArea: 'Recuperação de Crédito',
    cor: '#0f766e',
  },
  {
    key: 'add',
    departamento: 'Distressed Deals',
    nome: 'Distressed Deals (encerrada)',
    receitaKey: 'outras',
    eficienciaArea: null,
    cor: '#ea580c',
    encerrada: true,
  },
  { key: 'tributario', departamento: 'Tributário', nome: 'Tributário', receitaKey: 'outras', eficienciaArea: null, cor: '#a16207' },
]

export const AREA_KEYS: readonly AreaKey[] = AREAS_PLANEJAMENTO.map((a) => a.key)

/** Áreas com projeção e meta em 2027 (sem as encerradas). */
export const AREAS_2027: readonly AreaPlanejamento[] = AREAS_PLANEJAMENTO.filter((a) => !a.encerrada)
export const AREA_KEYS_2027: readonly AreaKey[] = AREAS_2027.map((a) => a.key)

export function areaEncerrada(key: string): boolean {
  return Boolean(AREAS_PLANEJAMENTO.find((a) => a.key === key)?.encerrada)
}

export const SEM_AREA_KEY = 'sem_area'

export function areaNome(key: string): string {
  if (key === SEM_AREA_KEY) return 'Sem área'
  if (key === 'operacoes_legais') return 'Operações Legais'
  if (key === 'estrutura') return 'Estrutura'
  return AREAS_PLANEJAMENTO.find((a) => a.key === key)?.nome ?? key
}

export function areaPorKey(key: string): AreaPlanejamento | undefined {
  return AREAS_PLANEJAMENTO.find((a) => a.key === key)
}

export const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

export function mesRotulo(ano: number, mes: number): string {
  return `${MESES_ABREV[mes - 1] ?? mes}/${String(ano).slice(-2)}`
}

export function zeros12(): number[] {
  return Array.from({ length: 12 }, () => 0)
}

export function soma(valores: readonly number[]): number {
  return valores.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
}

/** Variação % (null quando a base é zero). */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

export function arred2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}
