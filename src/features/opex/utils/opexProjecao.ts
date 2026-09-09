/** Mesma regra de `opex_extrapolacao_fixas_grupo`: média YTD × meses restantes. */
export function projetadoRestanteFixas(realizadoYtd: number, fixo: boolean, mesAtual: number): number {
  if (!fixo || mesAtual <= 0 || mesAtual >= 12 || realizadoYtd <= 0) return 0
  return Math.round((realizadoYtd / mesAtual) * (12 - mesAtual) * 100) / 100
}
