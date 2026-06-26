/** Chave = departamento normalizado (ex.: insolvencia); valor = cor hex (#rrggbb). */
export type ReceitaDepartamentoCoresConfig = Record<string, string>

export type ReceitaMetasConfig = {
  ano: number
  /** Meses exibidos no gráfico (1–12). */
  meses: number[]
  meta: number
  projetado_base_abril: number
  /** Chave = número do mês (string "5" … "12"). */
  projetado_real: Record<string, number>
}

export type ReceitaMesRow = {
  mes: number
  mesLabel: string
  meta: number
  projetadoBaseAbril: number
  projetadoReal: number
  recebido: number
  previsto: number
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
  valor_pago_item: number
  plano_contas: string
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
