/** Normaliza CNJ para comparação (somente dígitos). */
export function normalizarCnj(cnj: string | null | undefined): string {
  return String(cnj ?? '').replace(/\D/g, '')
}

/** CNJ válido para importação (mínimo 15 dígitos no padrão nacional). */
export function cnjValidoParaImportacao(cnj: string | null | undefined): boolean {
  const digits = normalizarCnj(cnj)
  return digits.length >= 15
}

export function formatarCnjExibicao(cnj: string | null | undefined): string {
  const d = normalizarCnj(cnj)
  if (d.length !== 20) return String(cnj ?? '').trim()
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`
}
