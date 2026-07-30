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

/** Linha mensal da seção Gestão à vista. */
export type GestaoVistaMesRow = {
  mes: number
  mesLabel: string
  meta: number | null
  previsto: number
  recebido: number | null
  pctMeta: number | null
  pctPrevisto: number | null
  inadimplencia: number | null
  inadimplenciaPct: number | null
  /** Mês com snapshot de inadimplência congelado. */
  congelado: boolean
}

/** KPIs acumulados do período Jan–mês atual na Gestão à vista. */
export type GestaoVistaResumo = {
  metaAcumulada: number
  previstoAcumulado: number
  /** Caixa acumulado no período Jan–mês atual. */
  recebidoAcumulado: number
  /** Caixa só nos meses com meta (ex.: Jul–Dez) — base do atingimento. */
  recebidoAtingimento: number
  pctMeta: number | null
  inadimplenciaPeriodo: number
  inadimplenciaPctPeriodo: number | null
  periodoLabel: string
  /** Período dos meses com meta já decorridos (ex.: Jul/2026). */
  periodoMetaLabel: string
  /** Vigência da meta no ano (ex.: Jul–Dez/2026). */
  periodoMetaAnualLabel: string
  mesesNoPeriodo: number[]
  mesesMetaNoPeriodo: number[]
  mesesMetaAno: number[]
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
  departamento?: string | null
}

export type ReceitaRecebidoCategoriaKey = 'inadimplencia' | 'novos_contratos' | 'receita_mes'

export type ReceitaRecebidoClassificacaoItemRow = ReceitaRecebidoItemRow & {
  data_vencimento: string | null
  categoria: ReceitaRecebidoCategoriaKey
}

/** Decomposição previsto × caixa (RPC receita_previsto_fechamento_mes). */
export type ReceitaPrevistoFechamentoMes = {
  previsto: number
  /** Vencimento neste mês, quitado neste mês (valor_item — inclui novos contratos). */
  quitado_no_mes: number
  /** Vencimento neste mês, baixa antes do mês (valor_item). */
  quitado_antecipado: number
  /** Vencimento neste mês, baixa após o mês — vira inad. recuperada no caixa da baixa. */
  quitado_pago_depois: number
  /** quitado_antecipado + quitado_pago_depois (retrocompat.). */
  quitado_outro_mes: number
  /** Vencimento neste mês, ainda não pago (valor_item). */
  em_aberto: number
  /** KPI inadimplência (grupos / congelado) — pode diferir de em_aberto. */
  inadimplencia_kpi: number
  receita_mes_caixa: number
  inad_recebida: number
  novos_total: number
  /** Novos contratos com vencimento neste mês (caixa líquido). */
  novos_vencimento_mes: number
  /** Novos contratos com vencimento em mês anterior (caixa líquido). */
  novos_vencimento_anterior: number
  /** receita_mes_caixa + novos_vencimento_mes — parcela do recebido ligada ao previsto. */
  recebido_previsto_caixa: number
  recebido_classificado: number
}

export type ReceitaPrevistoFechamentoBucket =
  | 'em_aberto'
  | 'quitado_no_mes'
  | 'quitado_antecipado'
  | 'quitado_pago_depois'

export type ReceitaPrevistoFechamentoItemRow = ReceitaPrevistoItemRow & {
  data_pagamento: string | null
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
