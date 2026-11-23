export type DlArea = {
  area_key: string
  nome: string
  departamento: string
  referencia_mercado: number | null
  ordem: number
  /** 'mensal' zera o mês negativo; 'acumulado' compensa no ano. */
  regra_negativo: DlRegraNegativo
}

export type DlRegraNegativo = 'mensal' | 'acumulado'

/** De onde veio o parâmetro do mês: valor digitado, cadastro de RH ou Fechamento Legal Ops. */
export type DlOrigemParametro = 'manual' | 'cadastro_rh' | 'legal_ops' | 'legal_ops_herdado' | 'sem_dado'

/** Linha de `dl_resultado_mensal` (base caixa, direto do SIOE). */
export type DlMesRow = {
  area_key: string
  mes: number
  receita_bruta: number
  impostos: number
  desp_operacionais: number
  desp_controladoria: number
  desp_indiretas: number
  profissionais: number
  pct_controladoria: number
  /** % da Controladoria veio de um Fechamento Legal Ops anterior (o do mês ainda não foi gravado). */
  parametro_herdado: boolean
  /** Pró-labore dos sócios no mês (parcela fixa somada às indiretas), lançado no VIOS. */
  socios_prolabore: number
  /** Honorários recebidos em nome do Banco do Brasil (já incluídos na receita bruta). */
  liberacao_recursos: number
  /** Alíquota do imposto aplicada no mês (%). */
  aliquota: number
  /** Mês sem alíquota cadastrada: usou a do último mês cadastrado. */
  aliquota_herdada: boolean
  origem_profissionais: DlOrigemParametro
  origem_controladoria: DlOrigemParametro
  /** Mês fechado: valores da foto do fechamento. */
  fechado: boolean
}

export type DlParametroMensal = {
  ano: number
  mes: number
  area_key: string
  /** Nulo = automático (cadastro de RH). */
  profissionais: number | null
  /** Nulo = automático (Fechamento Legal Ops). */
  pct_controladoria: number | null
}

export type DlAliquota = { ano: number; mes: number; aliquota: number }

export type DlFechamento = { ano: number; mes: number; fechado_em: string; fechado_por: string | null }

export type DlGestor = {
  id: string
  ano: number
  area_key: string
  nome: string
  pct: number
  mes_inicio: number
  mes_fim: number
}

/** Linha de `dl_gestor_mensal`: DL do gestor sobre o resultado da carteira dele. */
export type DlGestorMes = {
  gestor_id: string
  mes: number
  clientes: number
  liquido_clientes: number
  resultado_clientes: number
  /** DL a pagar no mês = calculado + ajuste. */
  dl: number
  dl_calculado: number
  /** Diferença de meses já fechados (VIOS mudou depois do fechamento). */
  ajuste: number
  fechado: boolean
}

/** DL do gestor já ligado à área (para somar no demonstrativo). */
export type DlGestorAreaMes = { area_key: string; mes: number; dl: number }

/** Cliente sem linha entra no DL do gestor; `incluido = false` exclui. */
export type DlGestorCliente = { gestor_id: string; cliente: string; incluido: boolean }

/** Cliente com honorários recebidos na área no ano (`dl_clientes_area`). */
export type DlClienteArea = { area_key: string; cliente: string; liquido: number }

export type DlLinhaKey =
  | 'receita_bruta'
  | 'liberacao_recursos'
  | 'impostos'
  | 'receita_liquida'
  | 'desp_operacionais'
  | 'desp_controladoria'
  | 'margem'
  | 'margem_pct'
  | 'desp_indiretas'
  | 'resultado'
  | 'dl_gestor'
  | 'profissionais'
  | 'custo_hora'

/** Valores de um mês já com as linhas derivadas. */
export type DlMesCalculado = Record<DlLinhaKey, number> & {
  mes: number
  /** % da Controladoria herdado de um Fechamento Legal Ops anterior. */
  herdado: boolean
  aliquota_herdada: boolean
  fechado: boolean
}

/** DL de um gestor num mês, para a tabela de pagamento. */
export type DlGestorLinha = {
  gestor: DlGestor
  meses: Array<{ mes: number; dl: number; dl_calculado: number; ajuste: number; fechado: boolean } | null>
  total: number
}
