/** Societário e Contratos tem SLA Vistagem Risco mesmo antes do primeiro caso. */
export const SLA_VISTAGEM_RISCO_CONTRATOS_SEM_CASOS_PCT = 100

export function isSlaVistagemRiscoContratosSemCasos(
  area: string | null,
  risco: boolean,
  total: number,
): boolean {
  return risco && area === 'Contratos' && total <= 0
}

/**
 * Regra geral: sem casos no período retorna `null`.
 * A exceção Contratos + Risco é resolvida explicitamente por
 * `isSlaVistagemRiscoContratosSemCasos`, pois o indicador vale e deve exibir 100,00%.
 * Indisponibilidade real (ex.: Trabalhista + Normal) continua exibindo `-`.
 */
export function pctSlaVistagemAcumulado(vistadoD1: number, total: number): number | null {
  if (total <= 0) return null
  return (vistadoD1 / total) * 100
}

export function totalPublicacoesVistagem<T extends { total: number }>(rows: T[]): number {
  return rows.reduce((s, r) => s + r.total, 0)
}
