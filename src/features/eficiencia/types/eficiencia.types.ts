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
  ultimaAtualizacao: UltimaAtualizacaoRow[]
}
