export type ColaboradorNivelHierarquico = 'socio' | 'gerente' | 'coordenador' | 'colaborador'

export interface Colaborador {
  id: string
  orqestrai_employee_id: string | null
  full_name: string
  email: string | null
  area: string
  area_orqestrai: string | null
  cargo: string | null
  nivel_hierarquico: ColaboradorNivelHierarquico
  is_active: boolean
  admission_date: string | null
  termination_date: string | null
  vios_ci: string | null
  responsum_user_id: string | null
  responsum_email: string | null
  /** URL pública da foto no RESPONSUM (`app_c009c0e4f1_users.avatar_url`). */
  avatar_url: string | null
  synced_at: string
  created_at: string
  updated_at: string
}

export type ColaboradorDivergenciaTipo =
  | 'sem_conta_responsum'
  | 'sem_registro_orqestrai'
  | 'area_diferente'
  | 'status_diferente'

export interface ColaboradorDivergencia {
  id: string
  tipo: ColaboradorDivergenciaTipo
  full_name: string
  email: string | null
  detalhe: string | null
  detectado_em: string
  resolvido: boolean
  resolvido_em: string | null
}
