export type OnboardingExclusao = {
  id: string
  grupo_cliente: string
  vigencia_inicio: string
  vigencia_fim: string
  motivo: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export type OnboardingExclusaoInsert = {
  grupo_cliente: string
  vigencia_inicio: string
  vigencia_fim: string
  motivo?: string
  created_by?: string | null
}
