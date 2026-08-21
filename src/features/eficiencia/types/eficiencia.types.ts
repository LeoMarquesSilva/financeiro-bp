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

export interface RankingGrupoClienteRow {
  grupo_cliente: string
  qtd_fatal?: number
  qtd_inconsistencia?: number
  qtd_desvio?: number
  pct_do_total: number
  [key: string]: string | number | undefined
}

export interface JustificativaFatalRow {
  justificativa: string
  qtd: number
  pct_do_total: number
  /** Compatível com EficienciaRankingChart (RankingChartRow). */
  [key: string]: string | number | undefined
}

export interface AreaParticipacaoRow {
  area: string
  qtd: number
  pct_do_total: number
}

export interface SlaProtocoloMesRow {
  mes: number
  qtd_d1: number
  qtd_fatal: number
  /** FATAL com flag Excludente (fora do denominador da %). */
  qtd_excludente?: number
  qtd_total: number
  pct_eficiencia: number
  meta: number | null
}

export interface SlaProtocoloDiaRow {
  dia: number
  qtd_d1: number
  qtd_fatal: number
  qtd_excludente?: number
  qtd_total: number
  pct_eficiencia: number
  meta: number | null
}

export interface EficienciaEvolucaoDiaRow {
  dia: number
  total: number
  pct: number
}

export interface EficienciaProtocoloDiaRow {
  dia: number
  total: number
  pct_eficiencia: number
}

export interface AgendamentoDiaRow {
  dia: number
  total: number
  pct_dentro_prazo: number
}

export interface SlaVistagemDiaRow {
  dia: number
  total: number
  pct_d1: number
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

/** Série mensal do BI Ops Legais (RG) — protocolos. */
export interface OpsLegaisProtocoloMesRow {
  mes: number
  /** População SLA PROTOCOLO: operacional=SIM e EFICIÊNCIA ∈ {D1, PROTOCOLADO NO FATAL}. */
  total: number
  qtd_d1: number
  /** SLA PROTOCOLO % = D1 / (D1 + PROTOCOLADO NO FATAL). */
  pct_d1: number
  qtd_protocolado_fatal?: number
  /** Base completa (controladoria) — distinta da população SLA. */
  total_eficiencia?: number
  sem_inconsistencia: number
  pct_sem_inconsistencia: number
  eficiencia_ok: number
  eficiencia_nok: number
  pct_eficiencia_operacional: number
}

export interface OpsLegaisProtocoloRankingRow {
  usuario: string
  qtd_inconsistencia: number
  qtd_eficiencia_nok: number
  pct_do_total: number
  [key: string]: string | number
}

export interface OpsLegaisPublicacoesMesRow {
  mes: number
  total: number
  com_vistador: number
  vistado_d1: number
  pct_d1: number
}

/** SLA Publicações — % Eficiência (Análise ou Agendamento). */
export interface OpsLegaisPublicacoesEficMesRow {
  mes: number
  total: number
  qtd_eficiencia: number
  qtd_desvio: number
  pct_eficiencia: number
}

/** Financeiro — Antecipação de Faturamento de Honorários (BI AntecipacaoHonorarios). */
export interface OpsLegaisAntecipacaoMesRow {
  mes: number
  total_faturavel: number
  qtd_dentro_prazo: number
  qtd_fora_prazo: number
  pct_antecipacao: number
}

export interface OpsLegaisPublicacoesTipoRow {
  tipo_agendamento: string
  qtd: number
  pct_do_total: number
  [key: string]: string | number
}

/** Ranking flip cards — Tarefas Ops Legais. */
export interface OpsLegaisTarefasRankingRow {
  pessoa: string
  total_atividades: number
  central_pub: number
  central_agend: number
  desvio_pub: number
  desvio_agend: number
  total_erros: number
  pct_erros: number
  rank_atividades: number
  rank_excelencia: number
}

export interface OpsLegaisResponsumTicketsKpi {
  total: number
  em_atendimento: number
  resolvidos: number
  taxa_resolucao: number
}

/** KPIs Iniciativas Estratégicas (ClickUp / BI KPI_HTML_PROJETOS_PARTE1). */
export interface OpsLegaisIniciativasItem {
  id: string
  nome: string
  url: string | null
  tags: string[]
  horas: number
  data: string | null
}

export interface OpsLegaisIniciativasSubtarefa {
  id: string
  nome: string
  responsavel: string
  data: string | null
  status: string
}

export interface OpsLegaisIniciativasProjeto {
  id: string
  nome: string
  url: string | null
  tipo: string
  extensao: string
  responsavel: string
  data: string | null
  subtarefas: OpsLegaisIniciativasSubtarefa[]
  total_sub: number
  sub_concluidas: number
}

export interface OpsLegaisIniciativasItemSemana {
  id: string
  nome: string
  url: string | null
  tipo: 'Projeto' | 'Subtarefa'
  pai_titulo: string
  responsavel: string
  data: string | null
}

/** Painel Projetos Realizados (BI KPI_HTML_PROJETOS_PARTE2). */
export interface OpsLegaisIniciativasPainel {
  projetos_em_andamento: number
  tarefas_sob_em_andamento: number
  subtarefas_concluidas_periodo: number
  semana_inicio: string
  semana_fim: string
  concluidos: OpsLegaisIniciativasProjeto[]
  semana: OpsLegaisIniciativasItemSemana[]
  /** Semana passada agregada por tarefa (mesma forma de `concluidos`). */
  semana_por_tarefa?: OpsLegaisIniciativasProjeto[]
  andamento: OpsLegaisIniciativasProjeto[]
}

export interface OpsLegaisIniciativasDashboard {
  meta_anual: number
  projetos_concluidos: number
  projetos_finalizados: number
  melhorias_finalizadas: number
  pct_progresso: number
  pct_contribuicao_projetos: number
  pct_contribuicao_melhorias: number
  horas_ganhas: number
  horas_formatadas: string
  dias_uteis: number
  dias_uteis_mensal: number
  cor_progresso: string
  inicio: string
  fim: string
  itens: OpsLegaisIniciativasItem[]
  painel?: OpsLegaisIniciativasPainel
}

export interface OpsLegaisResponsumNps {
  nps: number
  zona: string
  promotores: number
  neutros: number
  detratores: number
  total_avaliacoes: number
  media_score: number
  excelente: number
  bom: number
  regular: number
  ruim: number
}

export interface OpsLegaisResponsumTicketItem {
  title: string
  status: string
  created_at: string | null
}

export interface OpsLegaisResponsumConcluido {
  nome: string
  qtd: number
  is_sla_fatal: boolean
}

export interface OpsLegaisResponsumPendente {
  nome: string
  qtd_aberto: number
  qtd_andamento: number
  is_sla_fatal: boolean
  tickets: OpsLegaisResponsumTicketItem[]
  pessoas_sla?: Array<{
    nome: string
    qtd: number
    tickets: OpsLegaisResponsumTicketItem[]
  }>
}

export interface OpsLegaisResponsumDashboard {
  periodo: { inicio: string; fim: string }
  tickets: OpsLegaisResponsumTicketsKpi
  nps: OpsLegaisResponsumNps
  concluidos: OpsLegaisResponsumConcluido[]
  pendentes: OpsLegaisResponsumPendente[]
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

export interface TurnoverAtivoAreaRow {
  nome: string
  cargo: string | null
  admissao: string | null
  area: string | null
}

export interface ColaboradorFeriasRow {
  orqestrai_employee_id: string
  full_name: string
  nome_chave: string
  vacation_exempt: boolean
  saldo_dias: number
  gozados_ano: number
  em_ferias: boolean
  ferias_inicio: string | null
  ferias_fim: string | null
  proximo_inicio: string | null
  proximo_fim: string | null
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
  admissao?: string | null
  meses_elegiveis?: number | null
  meta_minutos?: number | null
}

export interface TreinamentoItemRow {
  colaborador: string
  treinamento: string | null
  data: string | null
  duracao_minutos: number
  ministrado_por?: string | null
  /** Mesma pessoa + treinamento + data em mais de um ID (espelho/SharePoint). */
  duplicado?: boolean
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
  | 'ops_legais_sla_protocolo'
  | 'ops_legais_eficiencia_protocolo'
  | 'ops_legais_pub_analise'
  | 'ops_legais_pub_agendamento'
  | 'ops_legais_cadastro'
  | 'ops_legais_iniciativas'
  | 'ops_legais_marketing'
  | 'ops_legais_antecipacao_faturamento'
  | 'ops_legais_efetividade_cobranca'
  | 'sla_ciencia_agendamentos'
  | 'sla_vistagem_risco'
  | 'sla_vistagem_normal'
  | 'desenvolvimento_equipe'
  | 'retencao_talentos'
  | 'gestao_pdi'
  | 'receita_bruta'
  | 'indice_inadimplencia'

/**
 * Escopo opcional do Racional.
 * `sla_protocolo_fatal` = só FATAL não-excludente (mesma base dos gráficos
 * Justificativa / % / Qtd Fatal Responsáveis).
 */
export type RacionalEscopo =
  | 'default'
  | 'sla_protocolo_fatal'
  | 'desenvolvimento_equipe'
  | 'desenvolvimento_treinamentos'

export interface RacionalColuna {
  key: string
  label: string
  format?: 'percentual' | 'duracao_minutos'
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
  /** Gestão de PDI — avaliações conforme e fora dos critérios. */
  qtd_pdi_apta?: number
  qtd_pdi_desvio?: number
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
