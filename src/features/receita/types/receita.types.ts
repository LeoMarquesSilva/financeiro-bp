/** Chave = departamento normalizado (ex.: insolvencia); valor = cor hex (#rrggbb). */
export type ReceitaDepartamentoCoresConfig = Record<string, string>

export type ReceitaMetasConfig = {
  ano: number
  /** Meses exibidos no gráfico (1–12). */
  meses: number[]
  /**
   * Meses que possuem meta definida. Quando ausente, todos os `meses` têm meta
   * (compatibilidade com as configurações anteriores).
   */
  meses_meta?: number[]
  meta: number
  projetado_base_abril: number
  /** Chave = número do mês (string "5" … "12"). */
  projetado_real: Record<string, number>
}

export type ReceitaMesRow = {
  mes: number
  mesLabel: string
  /** Meta mensal ajustada (com rateio de gap dos meses fechados). */
  meta: number
  /** Meta mensal original (ex.: R$ 10 mi ÷ 7). Soma = teto anual fixo em KPIs. */
  metaBase: number
  projetadoBaseAbril: number
  projetadoReal: number
  recebido: number
  previsto: number
  encargos: number
}

export type ReceitaDashboardData = {
  ano: number
  rows: ReceitaMesRow[]
}

export type ReceitaAcumuladoChartPoint = {
  mes: number
  mesLabel: string
  /** null em mês futuro (sem recebido real lançado). */
  recebidoAcumulado: number | null
  previstoAcumulado: number
  metaAcumulada: number
  /** % da meta acumulada por área (modo apresentação por área). */
  [areaDataKey: string]: number | string | null
}

export type ReceitaRecebidoPlanoRow = {
  plano_contas: string
  quantidade: number
  total: number
}

export type ReceitaRecebidoDepartamentoRow = {
  mes: number
  departamento: string
  total: number
}

export type ReceitaRecebidoPlanoMensalRow = {
  mes: number
  plano_contas: string
  total: number
}

export type ReceitaAreaChartSlice = {
  departamento: string
  dataKey: string
  color: string
}

export type ReceitaColunasChartPoint = {
  mes: number
  mesLabel: string
  meta: number
  projetadoBaseAbril: number
  projetadoReal: number
  previsto: number
  recebidoTotal: number | null
  /** Chaves dinâmicas por departamento (dataKey Recharts). */
  [areaDataKey: string]: number | string | null
}

export type ReceitaRecebidoItemRow = {
  ci_item: number
  ci_titulo: number
  cliente: string | null
  descricao: string | null
  nro_titulo: string | null
  data_pagamento: string | null
  /** Honorários líquidos (sem encargos de boleto/juros). */
  valor_recebido: number
  valor_encargos: number
  valor_pago_item: number
  valor_fluxo_item: number | null
  plano_contas: string
  situacao_titulo: string | null
}

export type ReceitaEncargosItemRow = {
  ci_item: number
  ci_titulo: number
  cliente: string | null
  descricao: string | null
  nro_titulo: string | null
  data_pagamento: string | null
  valor_encargos: number
  valor_pago_item: number
  valor_fluxo_item: number | null
  plano_contas: string
  situacao_titulo: string | null
}

/** Título recebido cujo departamento não é uma das áreas do rateio (fica "sem área"). */
export type ReceitaRecebidoSemAreaItemRow = {
  ci_item: number
  ci_titulo: number
  cliente: string | null
  descricao: string | null
  nro_titulo: string | null
  data_pagamento: string | null
  valor_recebido: number
  valor_pago_item: number
  plano_contas: string
  departamento: string
  situacao_titulo: string | null
}

export type ReceitaPrevistoItemRow = {
  ci_item: number
  ci_titulo: number
  cliente: string | null
  descricao: string | null
  nro_titulo: string | null
  data_vencimento: string | null
  valor_item: number
  plano_contas: string
  situacao_titulo: string | null
}
