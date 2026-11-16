export type DlArea = {
  area_key: string
  nome: string
  departamento: string
  referencia_mercado: number | null
  ordem: number
}

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
  /** Parâmetros do mês vieram do último mês cadastrado. */
  parametro_herdado: boolean
  /** Pró-labore dos sócios no mês (parcela fixa somada às indiretas), lançado no VIOS. */
  socios_prolabore: number
}

export type DlParametroMensal = {
  ano: number
  mes: number
  area_key: string
  profissionais: number
  pct_controladoria: number
}

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
  dl: number
}

/** DL do gestor já ligado à área (para somar no demonstrativo). */
export type DlGestorAreaMes = { area_key: string; mes: number; dl: number }

export type DlGestorCliente = { gestor_id: string; cliente: string }

/** Cliente com honorários recebidos na área no ano (`dl_clientes_area`). */
export type DlClienteArea = { area_key: string; cliente: string; liquido: number }

export type DlLinhaKey =
  | 'receita_bruta'
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
export type DlMesCalculado = Record<DlLinhaKey, number> & { mes: number; herdado: boolean }
