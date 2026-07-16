export type OpexDepartamentoRow = {
  departamento: string
  realizado: number
  previsto: number
}

export type OpexKpis = {
  realizado_ytd: number
  previsto_ytd: number
  previsto_ano: number
  projetado_ano: number
  media_mensal_fixas: number
  variancia_ytd_pct: number
}

export type OpexMesRow = {
  mes: number
  mesLabel: string
  previsto: number
  realizado: number
  projetado_fixas: number
  variacao: number
}

export type OpexGrupoRow = {
  grupo_conta: string
  fixo: boolean
  realizado_ytd: number
  previsto_ano: number
  previsto_restante: number
  projetado_ano: number
}

export type OpexPlanoRow = {
  plano_contas: string
  realizado_ytd: number
  previsto_ano: number
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
  realizado: number
  variacao: number
}

export type OpexDashboard = {
  ano: number
  mes_atual: number
  meses_filtro: number[]
  kpis: OpexKpis
  evolucao: OpexMesRow[]
  grupos: OpexGrupoRow[]
}
