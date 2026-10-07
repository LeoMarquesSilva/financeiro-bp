/** União das 5 áreas jurídicas no VIOS. Reestruturação = Insolvência + Cível | Insolvência. */
export const TIMESHEET_AREAS_JURIDICO_VIOS = [
  'Cível',
  'Contratos',
  'Insolvência',
  'Cível | Insolvência',
  'Recuperação de Crédito',
  'Trabalhista',
] as const

/**
 * Áreas do timesheet (coluna `area`) que a pessoa pode ver.
 * `null` = todas (sócio do escritório, sem área de prática).
 */
export function timesheetAreasDaPessoa(area: string | null | undefined): string[] | null {
  const nome = (area ?? '').trim()
  if (!nome) return null
  if (nome === 'Reestruturação' || nome === 'Insolvência') {
    return ['Insolvência', 'Cível | Insolvência']
  }
  if (nome === 'Cível') return ['Cível']
  if (nome === 'Contratos' || nome === 'Societário e Contratos') return ['Contratos']
  if (nome === 'Operações Legais') return ['Operações Legais']
  if (nome === 'Recuperação de Crédito') return ['Recuperação de Crédito']
  if (nome === 'Trabalhista') return ['Trabalhista']
  if (nome === 'Tributário') return ['Tributário']
  if (nome === 'Distressed Deals' || nome === 'Special Situations') return ['Special Situations']
  if (nome === 'Sócio') return null
  return [nome]
}
