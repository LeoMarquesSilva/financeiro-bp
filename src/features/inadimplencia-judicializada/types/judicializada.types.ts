export type ProcessoViosRow = {
  id: string
  ci: string | null
  grupo_cliente: string | null
  departamento: string | null
  area: string | null
  advogado_responsavel: string | null
  cliente: string | null
  acao: string | null
  nro_cnj: string | null
  situacao_processo: string | null
  fase_processual: string | null
  pessoa_id: string | null
}

export type InadimplenciaJudicializadaAndamentoRow = {
  id: string
  judicializada_id: string
  processo_id: string
  data_andamento: string | null
  descricao: string
  fonte: 'planilha' | 'vios' | 'manual'
  vios_evento_id: string | null
  vios_sync_em: string | null
  created_at: string
  updated_at: string
}

export type InadimplenciaJudicializadaRow = {
  id: string
  grupo_cliente: string
  grupo_chave: string
  processo_id: string
  valor_em_aberto_auto: number
  valor_em_aberto_ajuste: number | null
  /** Valor base (ajuste ou automático), sem correção. */
  valor_em_aberto_nominal: number
  /** Valor com INPC + juros TJSP desde data_judicializacao. */
  valor_em_aberto: number
  valor_correcao_inpc: number
  valor_juros_mora: number
  meses_atualizacao: number
  data_judicializacao: string | null
  observacoes: string | null
  encerrado_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  nro_cnj: string | null
  acao: string | null
  area: string | null
  departamento: string | null
  situacao_processo: string | null
  fase_processual: string | null
  advogado_responsavel: string | null
  processo_cliente: string | null
  processo_grupo_vios: string | null
  processo_ci: string | null
  processo_pessoa_id: string | null
  parte_passiva: string | null
  valor_causa: number | null
  status_planilha: string | null
  andamentos_resumo: string | null
  providencias_planilha: string | null
  citacao: string | null
  tribunal: string | null
  tipo_acao_planilha: string | null
  importado_em: string | null
  importado_de: string | null
  andamentos_sync_em: string | null
  andamentos_fonte: string | null
}

export type CreateJudicializadaInput = {
  grupo_cliente: string
  processo_id: string
  data_judicializacao?: string | null
  observacoes?: string | null
  valor_em_aberto_ajuste?: number | null
  created_by?: string | null
  nro_cnj?: string | null
  parte_passiva?: string | null
  valor_causa?: number | null
  status_planilha?: string | null
  andamentos_resumo?: string | null
  providencias_planilha?: string | null
  citacao?: string | null
  tribunal?: string | null
  tipo_acao_planilha?: string | null
  importado_de?: string | null
}

export type UpdateJudicializadaInput = {
  grupo_cliente?: string
  processo_id?: string
  data_judicializacao?: string | null
  observacoes?: string | null
  valor_em_aberto_ajuste?: number | null
}

export type JudicializadaKpis = {
  totalEmAberto: number
  totalValorCausa: number
  totalLancamentoVios: number
  qtdGrupos: number
  qtdProcessos: number
  porArea: { area: string; valor: number; qtd: number }[]
}

export type { PlanilhaAjuizadoRow, ImportPreviewRow, ImportPlanilhaResult } from '../utils/judicializadaImport'
