export const RECEITA_SECTION_IDS = {
  resumo: 'receita-resumo',
  gestaoAVista: 'receita-gestao-a-vista',
  inadimplencia: 'receita-inadimplencia',
  comparativo: 'receita-comparativo-mensal',
  detalhamento: 'receita-detalhamento-por-mes',
  acumulado: 'receita-valores-acumulados',
} as const

export type ReceitaSectionId = (typeof RECEITA_SECTION_IDS)[keyof typeof RECEITA_SECTION_IDS]

export function scrollToReceitaSection(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}
