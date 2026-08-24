export type OnboardingExclusao = {
  id: string
  grupo_cliente: string
  vigencia_inicio: string
  vigencia_fim: string
  motivo: string
  created_at: string
  updated_at: string
  created_by: string | null
  /** Chaves extras (razões sociais do grupo) — só no client, para match no racional. */
  chaves_match?: string[]
}

export type OnboardingExclusaoInsert = {
  grupo_cliente: string
  vigencia_inicio: string
  vigencia_fim: string
  motivo?: string
  created_by?: string | null
}
