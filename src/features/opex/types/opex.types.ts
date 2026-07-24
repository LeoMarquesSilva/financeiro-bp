export type OpexDepartamentoRow = {
  departamento: string
  realizado: number
  previsto: number
}

export type OpexDepartamentoMesRow = {
  mes: number
  departamento: string
  realizado: number
  previsto: number
}

export type OpexDepartamentoGrupoRow = {
  grupo_conta: string
  fixo: boolean
  realizado: number
  previsto: number
}

export type OpexDepartamentoPlanoRow = {
  plano_contas: string
  realizado: number
  previsto: number
}

export type OpexKpis = {
  realizado_ytd: number
  previsto_ytd: number
  previsto_vios_ytd: number
  previsto_ano: number
  previsto_vios_ano: number
  projetado_ano: number
  media_mensal_fixas: number
  variancia_ytd_pct: number
}

export type OpexMesRow = {
  mes: number
  mesLabel: string
  previsto: number
  previsto_vios: number
  realizado: number
  projetado_fixas: number
  variacao: number
}

export type OpexGrupoRow = {
  grupo_conta: string
  fixo: boolean
  realizado_ytd: number
  previsto_ano: number
  previsto_vios: number
  previsto_restante: number
  projetado_ano: number
}

export type OpexPlanoRow = {
  plano_contas: string
  realizado_ytd: number
  previsto_ano: number
  previsto_vios: number
}

export type OpexTituloRow = {
  ci_item: number
  nro_titulo: string
  descricao: string
  fornecedor: string
  situacao_titulo: string
  departamento: string
  data_vencimento: string | null
  data_pagamento: string | null
  valor_previsto: number
  valor_realizado: number
}

export type OpexMesGrupoRow = {
  grupo_conta: string
  fixo: boolean
  previsto: number
  previsto_vios: number
  realizado: number
  variacao: number
}

export type OpexMesItemRow = {
  grupo_conta: string
  plano_contas: string
  conta_numero: string
  fixo: boolean
  ci_item: number
  ci_titulo: number
  nro_titulo: string
  descricao: string
  fornecedor: string
  departamento: string
  situacao_titulo: string
  data_vencimento: string | null
  data_pagamento: string | null
  valor_previsto: number
  valor_previsto_vios: number
  valor_orcamento: number
  valor_realizado: number
}

export type OpexOrcamentoAnoMeta = {
  ano: number
  importado: boolean
  congelado_em?: string | null
  congelado_por?: string | null
  origem?: string | null
  observacao?: string | null
  total_ano?: number
  qtd_linhas?: number
}

export type OpexOrcamentoLinha = {
  id: string
  ano: number
  mes: number
  grupo_conta: string
  plano_contas: string
  conta_numero: string
  titulo_ref: string
  descricao: string
  departamento: string
  valor: number
  fixo: boolean
  created_at?: string
  updated_at?: string
}

export type OpexOrcamentoImportLinha = {
  mes: number
  grupo_conta: string
  plano_contas: string
  conta_numero?: string
  titulo_ref?: string
  descricao?: string
  departamento?: string
  valor: number
  fixo?: boolean
}

export type OpexOrcamentoImportResult = {
  ano: number
  qtd_linhas: number
  total: number
}

export type OpexDashboard = {
  ano: number
  mes_atual: number
  meses_filtro: number[]
  orcamento_importado: boolean
  kpis: OpexKpis
  evolucao: OpexMesRow[]
  grupos: OpexGrupoRow[]
}
