/** Áreas do escritório (mesmo De-Para usado no sync SharePoint, scripts/sharepoint/transforms.mjs). */
export const AREAS_EFICIENCIA = [
  'Cível',
  'Contratos',
  'Operações Legais',
  'Recuperação de Crédito',
  'Reestruturação',
  'Trabalhista',
] as const

/** Trabalhista não possui SLA Vistagem Normal (somente demanda de risco). */
export const EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL = 'Trabalhista' as const

/** Cargos excluídos do KPI Desenvolvimento Equipe (Overview BI). */
export const EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO = [
  'Coordenador Ops. Legais',
  'Gerente',
  'Sócio de Área',
  'Supervisor Ops. Legais',
] as const

/** Áreas excluídas da população base de Retenção no Overview (slicer BI). */
export const EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO = ['Distressd Deals', 'Tributário'] as const

/** Rótulos curtos dos meses (1 = Jan … 12 = Dez). */
export const MESES_EFICIENCIA = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

/**
 * Filtro de mês do Overview.
 * - `null` — ano inteiro
 * - `1..12` — mês único
 * - `'resultado'` — jun–dez (período de resultado; jan–mai ficam em branco)
 */
export type MesFiltroEficiencia = number | null | 'resultado'

/** Primeiro mês do período "Resultado" (junho). */
export const MES_INICIO_RESULTADO = 6
