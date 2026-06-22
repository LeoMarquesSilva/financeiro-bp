export type ReceitaInadimplenciaTopCliente = {
  cliente: string
  valor: number
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
}
