/** Saldo remanescente de pagamento parcial no VIOS, ex.: 12385-1(12448/1). */
export function isTituloSaldoParcial(nroTitulo: string | null | undefined): boolean {
  if (!nroTitulo) return false
  return /\([0-9]+\/[0-9]+\)/.test(nroTitulo)
}
