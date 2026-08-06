export type MesRow = { mes: number; [key: string]: number }

export interface SlaVistagemMesRow {
  mes: number
  total: number
  vistado_d1: number
  pct_d1: number
}

export interface RankingUsuarioRow {
  usuario: string
  total?: number
  vistado_d1?: number
  qtd_fatal?: number
  qtd_inconsistencia?: number
  dentro_prazo?: number
  fora_prazo?: number
  pct_d1?: number
  pct_do_total: number
  /** Permite uso direto em EficienciaRankingTable (linhas genéricas). */
  [key: string]: string | number | undefined
}

export interface JustificativaFatalRow {
  justificativa: string
  qtd: number
  pct_do_total: number
  /** Compatível com EficienciaRankingChart (RankingChartRow). */
  [key: string]: string | number | undefined
}

export interface SlaProtocoloMesRow {
  mes: number
  qtd_d1: number
  qtd_fatal: number
  qtd_total: number
  pct_eficiencia: number
  meta: number | null
}

export interface EficienciaProtocoloMesRow {
  mes: number
  total: number
  sem_inconsistencia: number
  pct_eficiencia: number
}

export interface AgendamentoMesRow {
  mes: number
  dentro_prazo: number
  fora_prazo: number
  pct_dentro_prazo: number
}

export interface AgendamentoUsuarioRow {
  usuario: string
  dentro_prazo: number
  fora_prazo: number
  pct_do_total: number
  /** Permite uso direto em EficienciaRankingTable (linhas genéricas). */
  [key: string]: string | number
}

export interface TurnoverAnualRow {
  funcionarios_ativos: number
  saidas_voluntarias: number
  pct_retencao: number
  meta_pct_retencao_minima: number
}

export interface TurnoverDesligamentoRow {
  nome: string
  area: string | null
  cargo: string | null
  admissao: string | null
  desligamento: string | null
  tipo_desligamento: string | null
  meses_casa: number | null
}

export interface TurnoverTopTempoCasaRow {
  nome: string
  area: string | null
  cargo: string | null
  admissao: string | null
  meses_casa: number
}

export interface TreinamentosAnualRow {
  minutos_lancados: number
  pessoas_ativas: number
  meta_minutos: number
  pct_atingimento: number
}

export interface TreinamentosMesRow {
  mes: number
  minutos_lancados: number
  meta_minutos: number
  pct_atingimento: number
}

export interface TreinamentosPorPessoaRow {
  colaborador: string
  minutos_lancados: number
  horas_formatadas: string
}

export interface TreinamentoItemRow {
  colaborador: string
  treinamento: string | null
  data: string | null
  duracao_minutos: number
}

export interface VistagemDesvioRankingRow {
  usuario?: string
  tipo_publicacao?: string
  grupo_cliente?: string
  qtd_desvio: number
  pct_do_total: number
  [key: string]: string | number | undefined
}

/** Linha bruta de sp_gestao_pdi_elegiveis. */
export interface GestaoPdiElegivelRow {
  ano: number
  mes: number
  area: string | null
  colaborador: string
  estrutura: string | null
  progresso: number | null
  evidencias_execucao: string | null
  one_a_one: number | null
}

export interface GestaoPdiMesRow {
  mes: number
  elegiveis: number
  aptas: number
  desvios: number
  pct_aptas: number | null
}

export interface GestaoPdiDetalheRow {
  mes: number
  area: string | null
  colaborador: string
  estrutura: string | null
  progresso: number | null
  progresso_anterior: number | null
  evidencias_execucao: string | null
  one_a_one: number | null
  mudou_progresso: boolean
  tem_evidencia: boolean
  tem_1a1: boolean
  apta: boolean
  status: 'Apta' | 'Desvio'
  /** Texto da planilha (aba Desvio / Análise Desvios). */
  desvio_criterio_apuracao?: string | null
}

/** Linha de sp_gestao_pdi_desvios (critério de apuração da planilha). */
export interface GestaoPdiDesvioPlanilhaRow {
  ano: number
  mes: number
  colaborador: string
  desvio_criterio_apuracao: string | null
}

export interface BeneficioEconomicoRow {
  qtd_decisoes: number
  valor_acao: number
  valor_condenacao: number
  beneficio_economico: number
  pct_beneficio: number
}

export interface UltimaAtualizacaoRow {
  fonte: string
  executado_em: string
  upserted: number
  deleted: number
  errors: number
}

export type RacionalIndicador =
  | 'sla_protocolo'
  | 'eficiencia_protocolo'
  | 'sla_ciencia_agendamentos'
  | 'sla_vistagem_risco'
  | 'sla_vistagem_normal'
  | 'desenvolvimento_equipe'
  | 'retencao_talentos'

/**
 * Escopo opcional do Racional.
 * `sla_protocolo_fatal` = só FATAL não-excludente (mesma base dos gráficos
 * Justificativa / % / Qtd Fatal Responsáveis).
 */
export type RacionalEscopo = 'default' | 'sla_protocolo_fatal'

export interface RacionalColuna {
  key: string
  label: string
}

export interface RacionalResumo {
  /** SLA Protocolo — DISTINCT ci (na métrica; Excludente fora) */
  qtd_d1?: number
  qtd_fatal?: number
  /** SLA Protocolo — DISTINCT ci com Excludente (listados, fora da %) */
  qtd_excludente?: number
  /** Eficiência Protocolo — COUNT(*) */
  qtd_eficiencia?: number
  qtd_inconsistencia?: number
  /** SLA Vistagem — COUNT(*) por vistado_d1 */
  qtd_vistado_sim?: number
  qtd_vistado_nao?: number
  qtd_total?: number
}

/** @deprecated Use RacionalResumo */
export type RacionalSlaProtocoloResumo = Pick<RacionalResumo, 'qtd_d1' | 'qtd_fatal'> & {
  qtd_d1: number
  qtd_fatal: number
}

export interface RacionalResultado {
  colunas: RacionalColuna[]
  linhas: Array<Record<string, unknown>>
  /** true quando a consulta bateu no limite de linhas e foi cortada (tabela maior que o limite). */
  truncado: boolean
  /** Totais da base filtrada (mesma lógica do KPI). */
  resumo?: RacionalResumo
}

export interface EficienciaOverview {
  slaVistagemRisco: SlaVistagemMesRow[]
  slaVistagemComum: SlaVistagemMesRow[]
  slaProtocolo: SlaProtocoloMesRow[]
  eficienciaProtocolo: EficienciaProtocoloMesRow[]
  agendamento: AgendamentoMesRow[]
  turnover: TurnoverAnualRow | null
  treinamentos: TreinamentosAnualRow | null
  treinamentosMensal: TreinamentosMesRow[]
  gestaoPdiMensal: GestaoPdiMesRow[]
  ultimaAtualizacao: UltimaAtualizacaoRow[]
}
