import type { PrioridadeTipo } from '../types/inadimplencia.types'
import { PESO_DIAS, PESO_VALOR, LIMIAR_URGENTE, LIMIAR_ATENCAO } from '@/shared/constants/inadimplencia'

/**
 * Score de risco: (dias * peso) + (valor normalizado * peso)
 * Quanto maior, mais urgente.
 */
export function calcularScore(diasEmAberto: number, valorEmAberto: number): number {
  return Math.round(diasEmAberto * PESO_DIAS + (valorEmAberto / 1000) * PESO_VALOR)
}

export function getPrioridade(diasEmAberto: number, valorEmAberto: number): PrioridadeTipo {
  const score = calcularScore(diasEmAberto, valorEmAberto)
  if (score >= LIMIAR_URGENTE) return 'urgente'
  if (score >= LIMIAR_ATENCAO) return 'atencao'
  return 'controlado'
}
