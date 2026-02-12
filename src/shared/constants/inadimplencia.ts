import type { InadimplenciaClasse, InadimplenciaTipoAcao } from '@/lib/database.types'

/** Áreas e gestores vêm do Supabase (team_members). */

/** Classificação é definida na reunião, caso a caso (histórico do cliente). Não há regra automática por dias. */
export const CLASSES: InadimplenciaClasse[] = ['A', 'B', 'C']

export const CLASS_LABELS: Record<InadimplenciaClasse, string> = {
  A: 'Grau A – Bom pagador',
  B: 'Grau B – Atrasos recorrentes',
  C: 'Grau C – Inadimplente crônico',
}

export const TIPOS_ACAO: { value: InadimplenciaTipoAcao; label: string }[] = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'acordo', label: 'Acordo' },
  { value: 'outro', label: 'Outro' },
]

export const FORMAS_PAGAMENTO = [
  'PIX',
  'Transferência',
  'Boleto',
  'Dinheiro',
  'Cartão',
  'Outro',
] as const

export const PESO_DIAS = 2
export const PESO_VALOR = 1 // score += (valor_em_aberto / 1000) * PESO_VALOR
export const LIMIAR_URGENTE = 100 // score >= 100 => Urgente
export const LIMIAR_ATENCAO = 50  // score >= 50 => Atenção; < 50 => Controlado
