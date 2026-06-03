/** Mês ainda não ocorreu no calendário (ex.: julho quando estamos em junho do mesmo ano). */
export function isMesFuturo(ano: number, mes: number, ref = new Date()): boolean {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  if (ano > y) return true
  if (ano < y) return false
  return mes > m
}

/** Recebido: null em mês futuro (ainda não houve pagamento); zero mantém zero em mês passado/atual. */
export function valorRecebidoGrafico(
  valor: number,
  ano: number,
  mes: number,
  ref = new Date(),
): number | null {
  return isMesFuturo(ano, mes, ref) ? null : valor
}
