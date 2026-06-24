export type ReceitaInadimplenciaTopCliente = {
  cliente: string
  valor: number
}

export type ReceitaInadimplenciaClientePeriodo = {
  cliente: string
  grupo_cliente: string
  valor: number
  qtd_meses: number
}

export type ReceitaInadimplenciaGrupoPeriodo = {
  grupo_cliente: string
  valor: number
  qtd_meses: number
  qtd_clientes: number
}

export type ReceitaInadimplenciaClienteTituloPeriodo = {
  mes: number
  ci_titulo: number
  nro_titulo: string
  descricao: string | null
  plano_contas: string | null
  situacao_titulo: string | null
  data_vencimento: string | null
  data_pagamento: string | null
  valor_item: number
  valor_pago_item: number
  inadimplencia: number
  qtd_itens: number
}

export type ReceitaInadimplenciaDepartamentoMes = {
  departamento: string
  inadimplencia: number
}

export type ReceitaInadimplenciaFechamentoMes = {
  congelado: boolean
  valor_total?: number
  pct?: number
  congelado_em?: string
}

export type ReceitaInadimplenciaGrupoMes = {
  grupo_cliente: string
  faturado: number
  recebido: number
  inadimplencia: number
  qtd_clientes: number
  qtd_clientes_inad: number
}

export type ReceitaInadimplenciaEvolucaoMes = {
  mes: number
  mes_label: string
  /** Valor exibido na evolução (congelado ou calculado). */
  valor: number
  /** Valor calculado ao vivo — usado no acumulado do período. */
  valor_calculado?: number
  /** Previsto mensal (denominador do % — alinhado ao gráfico comparativo de receita). */
  previsto?: number
  pct: number
  congelado: boolean
  /** Data/hora em que o mês foi congelado (ISO). */
  congelado_em?: string
  /** Valor recalculado após seleção manual de grupos na UI. */
  ajustado?: boolean
}

export type ReceitaInadimplenciaDashboard = {
  ano: number
  mes_inicio: number
  mes_fim: number
  mes_max_disponivel: number
  periodo_label: string
  valor_total_periodo: number
  pct_periodo: number
  top5: ReceitaInadimplenciaTopCliente[]
  top5_total: number
  top5_pct: number
  evolucao: ReceitaInadimplenciaEvolucaoMes[]
  destaque_reducao_pct: number | null
  /** Acumulado recalculado após exclusão manual de clientes no período. */
  clientes_ajustado?: boolean
}
