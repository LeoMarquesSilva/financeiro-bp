/** Mesma regra de `opex_extrapolacao_fixas_grupo`: média YTD × meses restantes. */
export function projetadoRestanteFixas(realizadoYtd: number, fixo: boolean, mesAtual: number): number {
  if (!fixo || mesAtual <= 0 || mesAtual >= 12 || realizadoYtd <= 0) return 0
  return Math.round((realizadoYtd / mesAtual) * (12 - mesAtual) * 100) / 100
}

export function realizadoComProjecaoAno(
  realizadoYtd: number,
  fixo: boolean,
  mesAtual: number,
  visaoAno: boolean,
): number {
  if (!visaoAno) return realizadoYtd
  return realizadoYtd + projetadoRestanteFixas(realizadoYtd, fixo, mesAtual)
}
