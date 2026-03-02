import type { PrioridadeTipo } from '../types/inadimplencia.types'

/**
 * Prioridade baseada apenas em dias em atraso:
 * - Controlado: < 2 dias
 * - Atenção: 3 a 5 dias
 * - Urgente: > 5 dias
 */
export function getPrioridade(diasEmAberto: number, _valorEmAberto?: number): PrioridadeTipo {
  if (diasEmAberto > 5) return 'urgente'
  if (diasEmAberto >= 3) return 'atencao'
  return 'controlado'
}
