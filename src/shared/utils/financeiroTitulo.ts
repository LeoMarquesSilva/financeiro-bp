/** Títulos a receber (legado sem tipo conta como RECEBER). */
export function financeiroTituloEhReceber(tipo: string | null | undefined): boolean {
  if (!tipo?.trim()) return true
  return tipo.trim().toUpperCase() === 'RECEBER'
}

/** Filtro PostgREST para queries em financeiro_parcelas (módulos atuais). */
export const FINANCEIRO_PARCELAS_SO_RECEBER_OR = 'tipo.is.null,tipo.eq.RECEBER'
