/** Planos de contas que entram na cota de receita (Recebido/Previsto). Demais planos são ignorados. */
export const PLANOS_CONTAS_INCLUIDOS_COTA = [
  'HONORÁRIOS MENSAIS',
  'HONORÁRIOS SPOT',
  'HONORÁRIOS DE SUCUMBÊNCIA',
  'HONORÁRIOS DE ÊXITO',
  'HONORÁRIOS DE MANUTENÇÃO',
  'HONORÁRIOS POR HORA TRABALHADA',
  'HONORÁRIOS ADVOCATÍCIOS',
] as const

export const MESES_ABREV = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

export function mesAbrev(mes: number): string {
  return MESES_ABREV[mes - 1] ?? String(mes)
}
