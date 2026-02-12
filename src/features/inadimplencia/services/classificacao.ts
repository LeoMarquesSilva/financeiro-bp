import type { InadimplenciaClasse } from '@/lib/database.types'

/**
 * Sugestão de classificação por dias (apenas fallback no cadastro).
 * A definição oficial é feita na reunião, caso a caso, pelo histórico do cliente.
 * A: 1-30 dias, B: 31-60 dias, C: 61+ dias
 */
export function calcularClasse(diasEmAberto: number): InadimplenciaClasse {
  if (diasEmAberto <= 30) return 'A'
  if (diasEmAberto <= 60) return 'B'
  return 'C'
}

/**
 * Calcula dias em aberto a partir da data de vencimento (até hoje).
 */
export function calcularDiasEmAberto(dataVencimento: string | null | undefined): number {
  if (!dataVencimento) return 0
  const venci = new Date(dataVencimento)
  const hoje = new Date()
  venci.setHours(0, 0, 0, 0)
  hoje.setHours(0, 0, 0, 0)
  const diff = Math.floor((hoje.getTime() - venci.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}
