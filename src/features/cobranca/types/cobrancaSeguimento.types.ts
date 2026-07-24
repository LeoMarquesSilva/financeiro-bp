export type CobrancaSeguimentoAcaoTipo =
  | 'ligacao'
  | 'email'
  | 'whatsapp'
  | 'reuniao'
  | 'acordo'
  | 'promessa_pagamento'
  | 'outro'

export type CobrancaSeguimentoKpis = {
  valor_total: number
  qtd_titulos: number
  qtd_grupos: number
  valor_faixa_1_30: number
  valor_faixa_31_60: number
  media_dias_atraso: number
}

export type CobrancaSeguimentoTopDevedor = {
  grupo_chave: string
  valor_total: number
  qtd_titulos: number
  max_dias_atraso: number
}

export type CobrancaSeguimentoGrupo = {
  grupo_chave: string
  qtd_titulos: number
  valor_total: number
  max_dias_atraso: number
  media_dias_atraso: number
  qtd_razoes: number
  cobranca_d1_realizada: boolean
  ultima_cobranca_d1_at: string | null
  ultima_cobranca_d1_canal: string | null
  ultima_acao_seguimento_at: string | null
  ultima_acao_seguimento_tipo: CobrancaSeguimentoAcaoTipo | null
  proximo_follow_up: string | null
  departamentos: CobrancaSeguimentoDepartamento[]
}

export type CobrancaSeguimentoDepartamento = {
  departamento: string
  valor: number
  pct: number
}

export type CobrancaSeguimentoDashboard = {
  kpis: CobrancaSeguimentoKpis
  top_devedores: CobrancaSeguimentoTopDevedor[]
  grupos: CobrancaSeguimentoGrupo[]
}

export type CobrancaSeguimentoGrupoAcima60 = {
  grupo_chave: string
  qtd_titulos: number
  valor_total: number
  max_dias_atraso: number
  qtd_razoes: number
  pessoa_id_principal: string | null
  titulos: CobrancaSeguimentoTituloAcima60[]
}

export type CobrancaSeguimentoTituloAcima60 = {
  parcela_id: string
  cliente: string | null
  pessoa_nome: string | null
  nro_titulo: string | null
  parcela: string | null
  data_vencimento: string
  valor: number
  dias_atraso: number
}

export type CobrancaSeguimentoGruposAcima60 = {
  kpis: {
    qtd_grupos: number
    qtd_titulos: number
    valor_total: number
  }
  grupos: CobrancaSeguimentoGrupoAcima60[]
}

export type CobrancaSeguimentoTitulo = {
  parcela_id: string
  pessoa_id: string | null
  cliente: string | null
  pessoa_nome: string | null
  grupo_chave: string
  nro_titulo: string | null
  parcela: string | null
  parcelas: string | null
  descricao: string | null
  plano_contas: string | null
  data_vencimento: string
  valor: number
  dias_atraso: number
}

export type CobrancaSeguimentoHistoricoD1 = {
  id: string
  parcela_id: string
  nro_titulo: string | null
  cliente: string | null
  canal: string
  status: string
  created_at: string
  mensagem_resumo: string | null
  created_by: string | null
}

export type CobrancaSeguimentoAcao = {
  id: string
  tipo: CobrancaSeguimentoAcaoTipo
  descricao: string
  data_acao: string
  data_follow_up: string | null
  created_by: string | null
  created_at: string
}

export type CobrancaSeguimentoGrupoDetalhe = {
  grupo_chave: string
  titulos: CobrancaSeguimentoTitulo[]
  historico_d1: CobrancaSeguimentoHistoricoD1[]
  acoes_seguimento: CobrancaSeguimentoAcao[]
}

export type CobrancaSeguimentoNovaAcaoInput = {
  grupo_chave: string
  tipo: CobrancaSeguimentoAcaoTipo
  descricao: string
  data_acao: string
  data_follow_up?: string | null
  created_by?: string | null
}

export type FaixaAtrasoSeguimentoFiltro = 'todos' | '1-30' | '31-60'
export type StatusD1SeguimentoFiltro = 'todos' | 'com_d1' | 'sem_d1'
