/** Linhas das RPCs `planejamento_*` (supabase/migrations/20261111190000_planejamento_2027.sql). */

export type PlanAreaRow = { area_key: string; nome: string; departamento: string; ordem: number }

export type PlanReceitaRow = {
  mes: number
  area_key: string
  origem: 'departamento' | 'rateio_titulo' | 'classificado' | 'sem_area'
  recebido: number
}

export type PlanReceitaSemAreaRow = {
  cliente: string
  departamentos_vios: string
  total: number
  titulos: number
  sugestao_area_key: string | null
  area_key: string | null
  classificado_por_email: string | null
  classificado_em: string | null
  /** Ainda sem área (sem rateio do título e sem classificação do cliente). */
  pendente: number
  /** Valor dos títulos rateados por % entre áreas. */
  rateado: number
  titulos_rateados: number
}

/** % de uma área num título de receita sem área (planejamento_receita_rateio_titulo). */
export type PlanRateioTituloRow = {
  ci_titulo: number
  area_key: string
  pct: number
  classificado_por_email: string | null
  classificado_em: string | null
}

/** Ajuste provisório da receita (controle financeiro − VIOS) por mês e área. */
export type PlanReceitaAjusteRow = {
  mes: number
  area_key: string
  valor: number
  fonte: string
}

export type PlanMargemRow = {
  area_key: string
  mes: number
  receita_bruta: number
  base_nf: number
  aliquota: number
  aliquota_herdada: boolean
  impostos: number
  desp_pessoas: number
  desp_demais: number
  desp_operacionais: number
  pct_controladoria: number
  origem_controladoria: string
  desp_controladoria: number
  pessoas_reclassificadas: number
}

export type PlanOpexBlocosRow = {
  mes: number
  areas: number
  controladoria: number
  estrutura: number
  outros: number
  total: number
  pessoas_reclassificadas: number
  pessoas_sem_match: number
}

export type PlanPessoasRow = { area_key: string; mes: number; folha: number; demais_pessoas: number; headcount: number | null }

export type PlanTimesheetRow = { area_key: string; mes: number; horas: number }

export type PlanCenarioRow = {
  id: string
  ano_alvo: number
  nome: string
  descricao: string | null
  premissas: unknown
  oficial: boolean
  oficializado_em: string | null
  oficializado_por_email: string | null
  created_by_email: string | null
  created_at: string
  updated_by_email: string | null
  updated_at: string
}

export type PlanInadimplenciaRow = { mes: number; area_key: string; inadimplencia: number; previsto_mes: number; congelado: boolean }

export type PlanInadimplenciaPeriodoRow = { area_key: string; inadimplencia: number; previsto: number; mes_fim: number }

export type PlanTituloSemAreaRow = {
  ci_titulo: number | null
  nro_titulo: string | null
  ci_item: number | null
  mes: number
  data_vencimento: string | null
  data_pagamento: string | null
  competencia: string | null
  valor: number
  plano_contas: string | null
  descricao: string | null
  departamento: string | null
  contrato: string | null
  etiquetas: string | null
  nfse: string | null
}

export type PlanClienteHistoricoRow = { area_key: string; ano: number; titulos: number; total: number }
