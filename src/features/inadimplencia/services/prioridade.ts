import type { PrioridadeTipo } from '../types/inadimplencia.types'

/** Configuração dos limites de dias para cada nível de prioridade (usado na tela de configurações). */
export interface PrioridadeConfig {
  controlado_max: number
  atencao_min: number
  atencao_max: number
  urgente_min: number
}

/** Valores padrão: Controlado 0–2, Atenção 3–5, Urgente 6+ */
export const DEFAULT_PRIORIDADE_CONFIG: PrioridadeConfig = {
  controlado_max: 2,
  atencao_min: 3,
  atencao_max: 5,
  urgente_min: 6,
}

/**
 * Calcula a prioridade com base em dias em atraso e opcionalmente em uma config.
 * Se config não for passada, usa DEFAULT_PRIORIDADE_CONFIG.
 */
export function getPrioridade(
  diasEmAberto: number,
  _valorEmAberto?: number,
  config: PrioridadeConfig = DEFAULT_PRIORIDADE_CONFIG
): PrioridadeTipo {
  if (diasEmAberto >= config.urgente_min) return 'urgente'
  if (diasEmAberto >= config.atencao_min) return 'atencao'
  return 'controlado'
}
