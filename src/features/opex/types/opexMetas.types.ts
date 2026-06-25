export type OpexIniciativaTipo = 'substituicao_ferramenta' | 'desenvolvimento_interno'

export type OpexIniciativaStatus = 'planejada' | 'em_andamento' | 'concluida' | 'validada'

export type OpexIniciativa = {
  id: string
  ano: number
  tipo: OpexIniciativaTipo
  titulo: string
  descricao?: string
  /** Ferramenta substituída ou necessidade operacional suprida */
  contexto: string
  /** CI Item(s) do VIOS que comprovam economia ou custo evitado */
  ci_itens: number[]
  valor_anual: number
  status: OpexIniciativaStatus
  data_inicio?: string | null
  data_conclusao?: string | null
  validado_em?: string | null
  validado_por?: string | null
  observacoes?: string | null
}

export type OpexTituloVinculado = {
  ci_item: number
  ci_titulo: number
  nro_titulo: string
  descricao: string
  fornecedor: string
  grupo_conta: string
  plano_contas: string
  valor_previsto: number
  valor_realizado: number
  data_vencimento: string | null
  data_pagamento: string | null
  situacao_titulo: string
}

export type OpexMetasEstrategicasConfig = {
  meta_min_iniciativas: number
  meta_min_valor_anual: number
  iniciativas: OpexIniciativa[]
}

export type OpexMetaTipoResumo = {
  tipo: OpexIniciativaTipo
  total: number
  validadas: number
  valor_validado: number
  meta_iniciativas_ok: boolean
  meta_valor_ok: boolean
  meta_atingida: boolean
}
