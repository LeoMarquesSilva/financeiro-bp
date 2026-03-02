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

/** Regras de prioridade por dias em atraso: controlado <2, atenção 3-5, urgente >5 */
export const PRIORIDADE_DIAS = {
  controlado: { max: 2 },
  atencao: { min: 3, max: 5 },
  urgente: { min: 6 },
} as const
