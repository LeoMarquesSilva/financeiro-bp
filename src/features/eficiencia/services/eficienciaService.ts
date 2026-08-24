import { supabase } from '@/lib/supabaseClient'
import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import { receitaInadimplenciaService } from '@/features/receita/services/receitaInadimplenciaService'
import { receitaMetasService } from '@/features/receita/services/receitaMetasService'
import { receitaService } from '@/features/receita/services/receitaService'
import { computePostEngagementRate } from '@/features/operacoes-legais/marketing/instagramAnalytics'
import { instagramService } from '@/features/operacoes-legais/marketing/instagramService'
import { cobrancaService } from '@/features/cobranca/services/cobrancaService'
import {
  EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL,
  MES_INICIO_RESULTADO,
  OPS_LEGAIS_CADASTRO_CONTROLADORIA,
  OPS_LEGAIS_CADASTRO_TIPOS_ABERTURA,
  areaFiltroParaIndicador,
  isAgendamentoVistagemIndisponivelPorArea,
  mesNoFiltro,
  mesesEfetivosFiltro,
  rangePeriodoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { buildGestaoConsolidadoFromInadDashboard } from '../utils/overviewFinanceiroKpis'
import type {
  AgendamentoDiaRow,
  AgendamentoMesRow,
  AgendamentoUsuarioRow,
  BeneficioEconomicoRow,
  EficienciaOverview,
  EficienciaProtocoloDiaRow,
  EficienciaProtocoloMesRow,
  OpsLegaisProtocoloMesRow,
  OpsLegaisProtocoloRankingRow,
  OpsLegaisAntecipacaoMesRow,
  OpsLegaisPublicacoesEficMesRow,
  OpsLegaisPublicacoesMesRow,
  OpsLegaisPublicacoesTipoRow,
  OpsLegaisIniciativasDashboard,
  OpsLegaisResponsumDashboard,
  OpsLegaisTarefasRankingRow,
  RacionalEscopo,
  RacionalIndicador,
  RacionalResultado,
  AreaParticipacaoRow,
  JustificativaFatalRow,
  RankingUsuarioRow,
  RankingGrupoClienteRow,
  SlaProtocoloMesRow,
  SlaProtocoloDiaRow,
  SlaVistagemDiaRow,
  SlaVistagemMesRow,
  GestaoPdiDesvioPlanilhaRow,
  GestaoPdiDetalheRow,
  GestaoPdiElegivelRow,
  GestaoPdiMesRow,
  TreinamentoItemRow,
  TreinamentoSessaoFuturaRow,
  TreinamentosAnualRow,
  TreinamentosMesRow,
  TreinamentosPorPessoaRow,
  VistagemDesvioRankingRow,
  TurnoverAnualRow,
  TurnoverDesligamentoRow,
  TurnoverTopTempoCasaRow,
  TurnoverAtivoAreaRow,
  ColaboradorFeriasRow,
  UltimaAtualizacaoRow,
} from '../types/eficiencia.types'
import type { IndicadoresResultadoMes } from '../types/indicadoresResultado.types'
import {
  buildResumoAmostra,
  mapSlaRowToFatalExcludente,
  selecionarAmostraExcludentes,
  type AbrirChamadosResultado,
  type AmostraChamadoItem,
  type EvidenciaFatalDecisao,
} from '../utils/amostraChamados'
import { parseEdgeFunctionError } from '@/features/cobranca/utils/phone'
import { agregarGestaoPdiMensal, avaliarGestaoPdi } from '../utils/gestaoPdiCalc'
import { nomesResponsavelMatch, RACIONAL_COLUNA_RESPONSAVEL } from '../utils/responsavelMatch'
import { marcarTreinamentosDuplicados } from '../utils/treinamentosDedupe'
import { filtrarPainelEfetividade } from '../utils/opsEfetividadeCobranca'

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never)
  if (error) throw error
  return (data ?? []) as T
}

import {
  aplicarOnboardingNoRacional,
  buildRacionalBaseQuery,
  buildRacionalSelect,
  fetchDesenvolvimentoRacional,
  fetchEficienciaProtocoloRacionalResumo,
  fetchOpsLegaisCadastroRacionalResumo,
  fetchOpsLegaisEficienciaProtocoloRacionalResumo,
  fetchOpsLegaisPublicacoesRacionalResumo,
  fetchOpsLegaisSlaProtocoloRacionalResumo,
  fetchRacionalLinhasCompletas,
  filterRetencaoRacionalLinhasPorAno,
  sortRetencaoRacionalLinhas,
  fetchSlaCienciaAgendamentosRacionalResumo,
  fetchSlaProtocoloRacionalResumo,
  fetchSlaVistagemRacionalResumo,
  RACIONAL_LIMITE,
  type RacionalConfig,
} from '../utils/racionalQuery'

const TAREFAS_PROTOCOLO_EXCLUIDAS = [
  'MATERIAL MARKETING - REELS/POST/ARTIGO',
  'PROTOCOLO DUE DILIGENCE PROSPECT',
  'PROTOCOLO DUE DILLIGENCE PROSPECT',
] as const

async function fetchRacionalResumo(
  indicador: RacionalIndicador,
  cfg: RacionalConfig,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
  escopo: RacionalEscopo = 'default',
  responsavel: string | null = null,
): Promise<RacionalResultado['resumo']> {
  if (indicador === 'sla_protocolo') {
    return fetchSlaProtocoloRacionalResumo(cfg, ano, area, mes, escopo, responsavel)
  }
  if (indicador === 'eficiencia_protocolo') {
    return fetchEficienciaProtocoloRacionalResumo(cfg, ano, area, mes, responsavel)
  }
  if (indicador === 'sla_ciencia_agendamentos') {
    return fetchSlaCienciaAgendamentosRacionalResumo(cfg, ano, area, mes, responsavel)
  }
  if (indicador === 'ops_legais_sla_protocolo') {
    return fetchOpsLegaisSlaProtocoloRacionalResumo(cfg, ano, area, mes)
  }
  if (indicador === 'ops_legais_eficiencia_protocolo') {
    return fetchOpsLegaisEficienciaProtocoloRacionalResumo(cfg, ano, area, mes)
  }
  if (indicador === 'ops_legais_pub_analise' || indicador === 'ops_legais_pub_agendamento') {
    return fetchOpsLegaisPublicacoesRacionalResumo(cfg, indicador, ano, area, mes)
  }
  if (indicador === 'ops_legais_cadastro') {
    return fetchOpsLegaisCadastroRacionalResumo(cfg, ano, area, mes)
  }
  if (indicador === 'sla_vistagem_risco' || indicador === 'sla_vistagem_normal') {
    return fetchSlaVistagemRacionalResumo(
      cfg,
      indicador,
      ano,
      areaFiltroParaIndicador(indicador, area),
      mes,
      responsavel,
    )
  }
  return undefined
}

const RACIONAL_CONFIG: Record<RacionalIndicador, RacionalConfig> = {
  sla_protocolo: {
    tabela: 'sp_tarefas_historico',
    dataColuna: 'conclusao_completa',
    areaColuna: 'area_conclusao',
    // Excludente entra no racional (visível), mas fica fora do KPI/% via RPC e resumo.
    filtros: [
      { tipo: 'eq', coluna: 'status', valor: 'Concluída' },
      { tipo: 'eq', coluna: 'etiqueta_tarefa', valor: 'PROTOCOLO' },
      {
        tipo: 'excludeInAllowNull',
        coluna: 'area_conclusao',
        valores: ['Operações Legais', 'Tributário'],
      },
      { tipo: 'notIn', coluna: 'tarefa', valores: [...TAREFAS_PROTOCOLO_EXCLUIDAS] },
      { tipo: 'notIn', coluna: 'tarefa_pai', valores: ['MATERIAL MARKETING - REELS/POST/ARTIGO'] },
      { tipo: 'orEq', coluna: 'fatal_apos18', valores: ['D-1', 'FATAL'] },
    ],
    colunas: [
      { key: 'ci', label: 'CI' },
      { key: 'nro_cnj', label: 'Nro CNJ' },
      { key: 'area_conclusao', label: 'Área (na conclusão)' },
      { key: 'grupo_cliente', label: 'Grupo Cliente' },
      { key: 'tarefa', label: 'Tarefa' },
      { key: 'tarefa_pai', label: 'Tarefa Pai' },
      { key: 'usuario_conclusao', label: 'Usuário que concluiu a tarefa' },
      { key: 'data_para_conclusao', label: 'Data para conclusão' },
      { key: 'conclusao_completa', label: 'Conclusão Completa' },
      { key: 'fatal_apos18', label: 'Fatal apos 18' },
      { key: 'justificativa_fatal', label: 'Justificativa de Fatal' },
      { key: 'excludente', label: 'Excludente' },
    ],
  },
  eficiencia_protocolo: {
    tabela: 'sp_protocolos',
    dataColuna: 'data_criada',
    areaColuna: 'area',
    filtros: [
      { tipo: 'excludeInAllowNull', coluna: 'area', valores: ['Operações Legais', 'Tributário'] },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'protocolo_nos_autos', label: 'Nº do Processo' },
      { key: 'area', label: 'Área' },
      { key: 'criado_por', label: 'Criado por' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'tipo_protocolo', label: 'Tipo de Protocolo' },
      // data_criada = base do KPI/RPC mensal (obrigatória também p/ série por responsável)
      { key: 'data_criada', label: 'Data criada' },
      { key: 'protocolado_em', label: 'Protocolado em' },
      { key: 'status_inconsistencia', label: 'Status' },
      { key: 'inconsistencia_juridico', label: 'Inconsistência - Jurídico' },
      { key: 'inconsistencia_juridico_motivo', label: 'Motivo Inconsistência' },
      { key: 'excludente', label: 'Excludente', virtual: true },
    ],
  },
  /**
   * BI SLA PROTOCOLOS — HTML_Historico_D1 / KPI_HTML_D1_FATAL.
   * EFICIÊNCIA OPERACIONAL = SIM e EFICIÊNCIA ∈ {D1, PROTOCOLADO NO FATAL}.
   */
  ops_legais_sla_protocolo: {
    tabela: 'sp_protocolos',
    dataColuna: 'protocolado_em',
    areaColuna: null,
    filtros: [
      { tipo: 'notNull', coluna: 'protocolado_em' },
      { tipo: 'distinctFrom', coluna: 'status', valor: 'Cancelado' },
      { tipo: 'eq', coluna: 'eficiencia_operacional', valor: 'SIM' },
      { tipo: 'orEq', coluna: 'eficiencia_sla', valores: ['D1', 'PROTOCOLADO NO FATAL'] },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'protocolo_nos_autos', label: 'Nº do Processo' },
      { key: 'eficiencia_sla', label: 'EFICIÊNCIA' },
      { key: 'protocolado_em', label: 'PROTOCOLADO EM' },
      { key: 'protocolado_por', label: 'PROTOCOLADO POR' },
      { key: 'data_do_fatal', label: 'Data do Fatal' },
      { key: 'data_criada', label: 'Criado' },
      { key: 'eficiencia_operacional', label: 'EFICIÊNCIA OPERACIONAL' },
      { key: 'area', label: 'Área' },
      { key: 'status', label: 'STATUS' },
    ],
  },
  /** BI SLA PROTOCOLOS — Eficiência Protocolo (INCONSISTÊNCIA - CONTROLADORIA vazia). */
  ops_legais_eficiencia_protocolo: {
    tabela: 'sp_protocolos',
    dataColuna: 'protocolado_em',
    areaColuna: null,
    filtros: [
      { tipo: 'notNull', coluna: 'protocolado_em' },
      { tipo: 'distinctFrom', coluna: 'status', valor: 'Cancelado' },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'protocolo_nos_autos', label: 'Nº do Processo' },
      { key: 'protocolado_em', label: 'PROTOCOLADO EM' },
      { key: 'protocolado_por', label: 'PROTOCOLADO POR' },
      { key: 'inconsistencia_controladoria', label: 'INCONSISTÊNCIA - CONTROLADORIA' },
      { key: 'inconsistencia_controladoria_motivo', label: 'INCONSISTÊNCIA - CONTROLADORIA - MOTIVO' },
      { key: 'area', label: 'Área' },
      { key: 'status', label: 'STATUS' },
      { key: 'eficiencia_operacional', label: 'EFICIÊNCIA OPERACIONAL' },
    ],
  },
  /** BI SLA PUBLICAÇÕES — Análise (INCONSISTÊNCIAS - TIPO em branco ou ANÁLISE). */
  ops_legais_pub_analise: {
    tabela: 'sp_publicacoes',
    dataColuna: 'data_recebimento_kurier',
    areaColuna: null,
    filtros: [
      { tipo: 'notNull', coluna: 'data_recebimento_kurier' },
      { tipo: 'nullOrIn', coluna: 'inconsistencias_tipo', valores: ['ANÁLISE', 'ANALISE'] },
      // Só Análise: fora Trabalhista com Demanda de Risco = Sim
      {
        tipo: 'notAllEq',
        pares: [
          { coluna: 'area', valor: 'Trabalhista' },
          { coluna: 'demanda_risco', valor: 'Sim' },
        ],
      },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'numero_processo', label: 'Nº do Processo' },
      { key: 'eficiencia', label: 'EFICIÊNCIA' },
      { key: 'data_recebimento_kurier', label: 'DATA RECEBIMENTO KURIER' },
      { key: 'inconsistencias_tipo', label: 'INCONSISTÊNCIAS - TIPO' },
      { key: 'inconsistencia_subtipo', label: 'INCONSISTÊNCIA - SUBTIPO' },
      { key: 'agendado_por', label: 'AGENDADO POR' },
      { key: 'area', label: 'Área' },
      { key: 'tipo_agendamento', label: 'TIPO DO AGENDAMENTO' },
      { key: 'check_pub', label: 'CHECK' },
    ],
  },
  /** BI SLA PUBLICAÇÕES — Agendamento (INCONSISTÊNCIAS - TIPO em branco ou AGENDAMENTO). */
  ops_legais_pub_agendamento: {
    tabela: 'sp_publicacoes',
    dataColuna: 'data_recebimento_kurier',
    areaColuna: null,
    filtros: [
      { tipo: 'notNull', coluna: 'data_recebimento_kurier' },
      { tipo: 'nullOrIn', coluna: 'inconsistencias_tipo', valores: ['AGENDAMENTO'] },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'numero_processo', label: 'Nº do Processo' },
      { key: 'eficiencia', label: 'EFICIÊNCIA' },
      { key: 'data_recebimento_kurier', label: 'DATA RECEBIMENTO KURIER' },
      { key: 'inconsistencias_tipo', label: 'INCONSISTÊNCIAS - TIPO' },
      { key: 'inconsistencia_subtipo', label: 'INCONSISTÊNCIA - SUBTIPO' },
      { key: 'agendado_por', label: 'AGENDADO POR' },
      { key: 'area', label: 'Área' },
      { key: 'tipo_agendamento', label: 'TIPO DO AGENDAMENTO' },
      { key: 'check_pub', label: 'CHECK' },
    ],
  },
  /**
   * BI CADASTRO — % Eficiência Cadastro Processos (Agendamento / DePara).
   * População: controladoria ativa (Isadora, Maria Júlia, Marina, Natália).
   */
  ops_legais_cadastro: {
    tabela: 'sp_agendamento',
    dataColuna: 'solicitado_em',
    areaColuna: null,
    filtros: [
      { tipo: 'notNull', coluna: 'solicitado_em' },
      { tipo: 'notNull', coluna: 'agendado_por' },
      {
        tipo: 'orIlikeStarts',
        coluna: 'agendado_por',
        valores: [...OPS_LEGAIS_CADASTRO_CONTROLADORIA],
      },
      {
        tipo: 'orEq',
        coluna: 'tipo_abertura_encerramento',
        valores: [...OPS_LEGAIS_CADASTRO_TIPOS_ABERTURA],
      },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'solicitado_em', label: 'Solicitado em' },
      { key: 'agendado_por', label: 'Agendado por' },
      { key: 'de_para', label: 'DePara' },
      { key: 'adesao_indicador', label: 'Adesão ao Indicador' },
      { key: 'revisao_observacao', label: 'REVISÃO - OBSERVAÇÃO' },
      { key: 'inconsistencia_juridico', label: 'Inconsistência jurídico' },
      { key: 'tipo_agendamento', label: 'Tipo agendamento' },
      { key: 'tipo_abertura_encerramento', label: 'Abertura/Encerramento' },
      { key: 'area_equipe', label: 'Área / Equipe' },
      { key: 'status', label: 'Status' },
    ],
  },
  sla_ciencia_agendamentos: {
    tabela: 'sp_tarefas',
    dataColuna: 'data_conclusao',
    areaColuna: 'area_conclusao',
    filtros: [
      { tipo: 'distinctFrom', coluna: 'area_conclusao', valor: 'Tributário' },
      { tipo: 'eq', coluna: 'tarefa', valor: '1. CIÊNCIA DOS AGENDAMENTOS' },
    ],
    colunas: [
      { key: 'ci', label: 'CI' },
      { key: 'nro_cnj', label: 'Nro CNJ' },
      { key: 'area_conclusao', label: 'Área (na conclusão)' },
      { key: 'grupo_cliente', label: 'Grupo Cliente' },
      { key: 'tarefa', label: 'Tarefa' },
      { key: 'usuario_conclusao', label: 'Usuário que concluiu a tarefa' },
      { key: 'data_para_conclusao', label: 'Data para conclusão' },
      { key: 'data_conclusao', label: 'Data da Conclusão' },
      { key: 'fatal_sem18_d1', label: 'Adesão' },
      { key: 'excludente', label: 'Excludente', virtual: true },
    ],
  },
  sla_vistagem_risco: {
    tabela: 'sp_publicacoes',
    dataColuna: 'disponibilizado_vistagem',
    areaColuna: 'area',
    filtros: [
      { tipo: 'notNull', coluna: 'vistado_por' },
      { tipo: 'distinctFrom', coluna: 'demanda_risco', valor: 'Não' },
      { tipo: 'excludeInAllowNull', coluna: 'area', valores: ['Operações Legais'] },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'numero_processo', label: 'Nº do Processo' },
      { key: 'area', label: 'Área' },
      { key: 'grupo', label: 'Grupo Cliente' },
      { key: 'cliente_principal', label: 'Cliente' },
      { key: 'tipo_agendamento', label: 'Tipo de Agendamento' },
      { key: 'vistado_por', label: 'Vistado por' },
      { key: 'disponibilizado_vistagem', label: 'Disponibilizado para Vistagem' },
      { key: 'vistado_em', label: 'Vistado em' },
      { key: 'vistado_d1', label: 'Vistado D+1' },
      { key: 'excludente', label: 'Excludente', virtual: true },
    ],
  },
  sla_vistagem_normal: {
    tabela: 'sp_publicacoes',
    dataColuna: 'disponibilizado_vistagem',
    areaColuna: 'area',
    filtros: [
      { tipo: 'notNull', coluna: 'vistado_por' },
      { tipo: 'orEq', coluna: 'demanda_risco', valores: ['Não', 'NAO'] },
      {
        tipo: 'excludeInAllowNull',
        coluna: 'area',
        valores: ['Distressd Deals', 'Operações Legais', 'Tributário', 'Trabalhista'],
      },
    ],
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'numero_processo', label: 'Nº do Processo' },
      { key: 'area', label: 'Área' },
      { key: 'grupo', label: 'Grupo Cliente' },
      { key: 'cliente_principal', label: 'Cliente' },
      { key: 'tipo_agendamento', label: 'Tipo de Agendamento' },
      { key: 'vistado_por', label: 'Vistado por' },
      { key: 'disponibilizado_vistagem', label: 'Disponibilizado para Vistagem' },
      { key: 'vistado_em', label: 'Vistado em' },
      { key: 'vistado_d1', label: 'Vistado D+1' },
      { key: 'excludente', label: 'Excludente', virtual: true },
    ],
  },
  desenvolvimento_equipe: {
    tabela: 'sp_treinamentos_presenca',
    dataColuna: 'data',
    areaColuna: null,
    colunas: [
      { key: 'sp_id', label: 'ID' },
      { key: 'colaborador', label: 'Colaborador' },
      { key: 'treinamento', label: 'Treinamento' },
      { key: 'status', label: 'Status' },
      { key: 'data', label: 'Data' },
      { key: 'duracao_minutos', label: 'Duração (min)' },
    ],
  },
  retencao_talentos: {
    tabela: 'sp_turnover',
    dataColuna: 'admissao',
    areaColuna: 'area',
    colunas: [
      { key: 'nome', label: 'Nome' },
      { key: 'area', label: 'Área' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'admissao', label: 'Admissão' },
      { key: 'desligamento', label: 'Desligamento' },
      { key: 'tipo_desligamento', label: 'Tipo de Desligamento' },
    ],
  },
  /** Base via fetchGestaoPdiDetalhe — não usa query genérica da tabela. */
  gestao_pdi: {
    tabela: 'sp_gestao_pdi_elegiveis',
    dataColuna: 'mes',
    areaColuna: 'area',
    colunas: [
      { key: 'mes', label: 'Mês' },
      { key: 'colaborador', label: 'Colaborador' },
      { key: 'area', label: 'Área' },
      { key: 'estrutura', label: 'Estrutura' },
      { key: 'progresso', label: 'Progresso' },
      { key: 'progresso_anterior', label: 'Progresso anterior' },
      { key: 'evidencias_execucao', label: 'Evidências' },
      { key: 'one_a_one', label: '1:1' },
      { key: 'mudou_progresso', label: 'Mudou progresso' },
      { key: 'tem_evidencia', label: 'Tem evidência' },
      { key: 'tem_1a1', label: 'Tem 1:1' },
      { key: 'status', label: 'Status' },
      { key: 'desvio_criterio_apuracao', label: 'Critério apuração' },
    ],
  },
  receita_bruta: {
    tabela: 'receita_overview',
    dataColuna: 'mes',
    areaColuna: null,
    colunas: [
      { key: 'mes', label: 'Mês' },
      { key: 'meta', label: 'Meta R$' },
      { key: 'previsto', label: 'Previsto R$' },
      { key: 'recebido', label: 'Recebido R$' },
      { key: 'pct_meta', label: '% Meta' },
      { key: 'pct_previsto', label: '% Previsto' },
    ],
  },
  indice_inadimplencia: {
    tabela: 'receita_overview',
    dataColuna: 'mes',
    areaColuna: null,
    colunas: [
      { key: 'mes', label: 'Mês' },
      { key: 'previsto', label: 'Previsto R$' },
      { key: 'inadimplencia', label: 'Inadimplência R$' },
      { key: 'inadimplencia_pct', label: 'Índice %' },
      { key: 'congelado', label: 'Snapshot congelado' },
    ],
  },
  ops_legais_antecipacao_faturamento: {
    tabela: 'sp_tarefas',
    dataColuna: 'data_conclusao',
    areaColuna: null,
    filtros: [
      { tipo: 'eq', coluna: 'tarefa', valor: 'REALIZAR FATURAMENTO' },
      { tipo: 'notNull', coluna: 'data_conclusao' },
      { tipo: 'notNull', coluna: 'data_para_conclusao' },
    ],
    colunas: [
      { key: 'ci', label: 'CI' },
      { key: 'nro_cnj', label: 'Nº do Processo' },
      { key: 'grupo_cliente', label: 'Grupo Cliente' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'usuario_conclusao', label: 'Concluído por' },
      { key: 'data_para_conclusao', label: 'Data para conclusão' },
      { key: 'data_limite', label: 'Data limite' },
      { key: 'data_conclusao', label: 'Data conclusão' },
      { key: 'status_prazo', label: 'Resultado' },
    ],
  },
  ops_legais_efetividade_cobranca: {
    tabela: 'cobranca_painel',
    dataColuna: 'data_vencimento',
    areaColuna: null,
    colunas: [
      { key: 'nro_titulo', label: 'Título' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'grupo_cliente', label: 'Grupo Cliente' },
      { key: 'plano_contas', label: 'Plano de Contas' },
      { key: 'data_vencimento', label: 'Vencimento' },
      { key: 'data_prazo_d1', label: 'Prazo D+1' },
      { key: 'valor', label: 'Valor' },
      { key: 'status_cobranca', label: 'Resultado' },
      { key: 'ultima_cobranca_at', label: 'Última cobrança' },
      { key: 'ultima_cobranca_canal', label: 'Canal' },
    ],
  },
  ops_legais_iniciativas: {
    tabela: 'ops_legais_iniciativas',
    dataColuna: 'data',
    areaColuna: null,
    colunas: [
      { key: 'status', label: 'Status' },
      { key: 'nome', label: 'Projeto' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'extensao', label: 'Extensão' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'data', label: 'Data' },
      { key: 'sub_concluidas', label: 'Sub concluídas' },
      { key: 'total_sub', label: 'Total sub' },
      { key: 'url', label: 'URL' },
    ],
  },
  ops_legais_marketing: {
    tabela: 'instagram_posts',
    dataColuna: 'published_at',
    areaColuna: null,
    colunas: [
      { key: 'published_at', label: 'Publicado em' },
      { key: 'caption', label: 'Legenda' },
      { key: 'media_product_type', label: 'Formato' },
      { key: 'areas', label: 'Áreas' },
      { key: 'reach', label: 'Alcance' },
      { key: 'likes', label: 'Likes' },
      { key: 'comments', label: 'Comentários' },
      { key: 'saves', label: 'Saves' },
      { key: 'shares', label: 'Shares' },
      { key: 'engajamento_pct', label: 'Engajamento %' },
      { key: 'permalink', label: 'Link' },
    ],
  },
}

type OpsFinanceiroRacionalIndicador =
  | 'ops_legais_antecipacao_faturamento'
  | 'ops_legais_efetividade_cobranca'

function mesDeDataIso(value: unknown): number {
  const mes = Number(String(value ?? '').slice(5, 7))
  return Number.isFinite(mes) ? mes : 0
}

async function fetchOpsLegaisFinanceiroRacional(
  indicador: OpsFinanceiroRacionalIndicador,
  ano: number,
  mes: MesFiltroEficiencia,
  limite: number | null,
): Promise<RacionalResultado> {
  const cfg = RACIONAL_CONFIG[indicador]
  let linhas: Array<Record<string, unknown>>

  if (indicador === 'ops_legais_antecipacao_faturamento') {
    const select = cfg.colunas
      .filter((coluna) => coluna.key !== 'status_prazo')
      .map((coluna) => coluna.key)
      .join(',')
    const baseAno = await fetchRacionalLinhasCompletas(
      cfg,
      indicador,
      ano,
      null,
      null,
      select,
    )
    linhas = baseAno
      .filter((row) => mesNoFiltro(mesDeDataIso(row.data_conclusao), mes, ano))
      .map((row): Record<string, unknown> => {
        const conclusao = String(row.data_conclusao ?? '')
        const dataLimite = String(row.data_limite ?? '')
        const dentroPrazo = Boolean(dataLimite) && conclusao <= dataLimite
        return {
          ...row,
          status_prazo: dentroPrazo ? 'Dentro do prazo' : 'Fora do prazo',
        }
      })
      .sort((a, b) => {
        const aDentro = a['status_prazo'] === 'Dentro do prazo' ? 1 : 0
        const bDentro = b['status_prazo'] === 'Dentro do prazo' ? 1 : 0
        return (
          aDentro - bDentro ||
          String(b['data_conclusao']).localeCompare(String(a['data_conclusao']))
        )
      })
  } else {
    const base = await cobrancaService.listPainelKpi()
    linhas = filtrarPainelEfetividade(base, ano, mes)
      .map((row) => ({
        nro_titulo: row.nro_titulo,
        cliente: row.cliente,
        grupo_cliente: row.grupo_cliente,
        plano_contas: row.plano_contas,
        data_vencimento: row.data_vencimento,
        data_prazo_d1: row.data_prazo_d1,
        valor: row.valor,
        status_cobranca: row.tem_whatsapp_d1 ? 'Cobrado no D+1' : 'Fora / sem cobrança',
        ultima_cobranca_at: row.ultima_cobranca_at,
        ultima_cobranca_canal: row.ultima_cobranca_canal,
      }))
      .sort((a, b) => {
        const aDentro = a.status_cobranca === 'Cobrado no D+1' ? 1 : 0
        const bDentro = b.status_cobranca === 'Cobrado no D+1' ? 1 : 0
        return aDentro - bDentro || String(b.data_vencimento).localeCompare(String(a.data_vencimento))
      })
  }

  const statusKey =
    indicador === 'ops_legais_antecipacao_faturamento' ? 'status_prazo' : 'status_cobranca'
  const statusOk =
    indicador === 'ops_legais_antecipacao_faturamento' ? 'Dentro do prazo' : 'Cobrado no D+1'
  const qtdOk = linhas.filter((row) => row[statusKey] === statusOk).length
  const qtdFora = linhas.length - qtdOk
  const truncado = limite != null && linhas.length > limite

  return {
    colunas: cfg.colunas,
    linhas: limite == null ? linhas : linhas.slice(0, limite),
    truncado,
    resumo: {
      qtd_eficiencia: qtdOk,
      qtd_inconsistencia: qtdFora,
      qtd_total: linhas.length,
    },
  }
}

export const eficienciaService = {
  async fetchSlaVistagemMensal(
    ano: number,
    risco: boolean | null,
    area: string | null = null,
  ): Promise<SlaVistagemMesRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    if (risco === false && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL) return []
    return rpc('eficiencia_sla_vistagem_mensal', {
      p_ano: ano,
      p_risco: risco,
      p_area: area,
    })
  },

  async fetchSlaVistagemPorUsuario(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    risco: boolean | null = null,
    area: string | null = null,
  ): Promise<RankingUsuarioRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    if (risco === false && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL) return []
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_sla_vistagem_por_usuario', {
      p_ano: ano,
      p_meses: meses,
      p_risco: risco,
      p_area: area,
    })
  },

  async fetchSlaVistagemDesvioPorUsuario(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    risco: boolean | null = null,
    area: string | null = null,
  ): Promise<VistagemDesvioRankingRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    if (risco === false && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL) return []
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_sla_vistagem_desvio_por_usuario', {
      p_ano: ano,
      p_meses: meses,
      p_risco: risco,
      p_area: area,
    })
  },

  async fetchSlaVistagemDesvioPorTipo(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    risco: boolean | null = null,
    area: string | null = null,
  ): Promise<VistagemDesvioRankingRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    if (risco === false && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL) return []
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_sla_vistagem_desvio_por_tipo', {
      p_ano: ano,
      p_meses: meses,
      p_risco: risco,
      p_area: area,
    })
  },

  async fetchSlaVistagemDesvioPorGrupo(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    risco: boolean | null = null,
    area: string | null = null,
  ): Promise<VistagemDesvioRankingRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    if (risco === false && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL) return []
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_sla_vistagem_desvio_por_grupo', {
      p_ano: ano,
      p_meses: meses,
      p_risco: risco,
      p_area: area,
    })
  },

  async fetchSlaProtocoloMensal(ano: number, area: string | null = null): Promise<SlaProtocoloMesRow[]> {
    return rpc('eficiencia_sla_protocolo_mensal', { p_ano: ano, p_area: area })
  },

  async fetchSlaProtocoloDiario(
    ano: number,
    mes: number,
    area: string | null = null,
  ): Promise<SlaProtocoloDiaRow[]> {
    return rpc('eficiencia_sla_protocolo_diario', {
      p_ano: ano,
      p_mes: mes,
      p_area: area,
    })
  },

  async fetchEficienciaProtocoloDiario(
    ano: number,
    mes: number,
    area: string | null = null,
  ): Promise<EficienciaProtocoloDiaRow[]> {
    return rpc('eficiencia_protocolo_diario', {
      p_ano: ano,
      p_mes: mes,
      p_area: area,
    })
  },

  async fetchAgendamentoDiario(
    ano: number,
    mes: number,
    area: string | null = null,
  ): Promise<AgendamentoDiaRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    return rpc('eficiencia_agendamento_diario', {
      p_ano: ano,
      p_mes: mes,
      p_area: area,
    })
  },

  async fetchSlaVistagemDiario(
    ano: number,
    mes: number,
    risco: boolean | null,
    area: string | null = null,
  ): Promise<SlaVistagemDiaRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    if (risco === false && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL) return []
    return rpc('eficiencia_sla_vistagem_diario', {
      p_ano: ano,
      p_mes: mes,
      p_risco: risco,
      p_area: area,
    })
  },

  async fetchSlaProtocoloRankingFatal(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<RankingUsuarioRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_sla_protocolo_ranking_fatal', {
      p_ano: ano,
      p_meses: meses,
      p_area: area,
    })
  },

  async fetchSlaProtocoloRankingFatalGrupo(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<RankingGrupoClienteRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_sla_protocolo_ranking_fatal_grupo', {
      p_ano: ano,
      p_meses: meses,
      p_area: area,
    })
  },

  async fetchSlaProtocoloJustificativaFatal(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<JustificativaFatalRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_sla_protocolo_justificativa_fatal', {
      p_ano: ano,
      p_meses: meses,
      p_area: area,
    })
  },

  async fetchAreaParticipacao(
    ano: number,
    meses: number[] | null = null,
  ): Promise<AreaParticipacaoRow[]> {
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_area_participacao', {
      p_ano: ano,
      p_meses: meses,
    })
  },

  async fetchEficienciaProtocoloMensal(
    ano: number,
    area: string | null = null,
  ): Promise<EficienciaProtocoloMesRow[]> {
    return rpc('eficiencia_protocolo_mensal', { p_ano: ano, p_area: area })
  },

  async fetchEficienciaProtocoloRanking(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<RankingUsuarioRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_protocolo_ranking_inconsistencia', {
      p_ano: ano,
      p_meses: meses,
      p_area: area,
    })
  },

  async fetchEficienciaProtocoloRankingGrupo(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<RankingGrupoClienteRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_protocolo_ranking_inconsistencia_grupo', {
      p_ano: ano,
      p_meses: meses,
      p_area: area,
    })
  },

  async fetchAgendamentoMensal(ano: number, area: string | null = null): Promise<AgendamentoMesRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    return rpc('eficiencia_agendamento_mensal', {
      p_ano: ano,
      p_area: area,
    })
  },

  async fetchAgendamentoPorUsuario(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<AgendamentoUsuarioRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_agendamento_por_usuario', {
      p_ano: ano,
      p_meses: meses,
      p_area: area,
    })
  },

  async fetchAgendamentoPorGrupo(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<RankingGrupoClienteRow[]> {
    if (isAgendamentoVistagemIndisponivelPorArea(area)) return []
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_agendamento_por_grupo', {
      p_ano: ano,
      p_meses: meses,
      p_area: area,
    })
  },

  // --- Operações Legais (RG) — RPCs isoladas do consolidado ---

  async fetchOpsLegaisProtocoloMensal(ano: number): Promise<OpsLegaisProtocoloMesRow[]> {
    return rpc('eficiencia_ops_legais_protocolo_mensal', { p_ano: ano })
  },

  async fetchOpsLegaisProtocoloRanking(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
  ): Promise<OpsLegaisProtocoloRankingRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_ops_legais_protocolo_ranking', { p_ano: ano, p_meses: meses })
  },

  async fetchOpsLegaisAgendamentoMensal(ano: number): Promise<AgendamentoMesRow[]> {
    return rpc('eficiencia_ops_legais_agendamento_mensal', { p_ano: ano })
  },

  async fetchOpsLegaisAgendamentoPorUsuario(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
  ): Promise<AgendamentoUsuarioRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_ops_legais_agendamento_por_usuario', {
      p_ano: ano,
      p_meses: meses,
    })
  },

  async fetchOpsLegaisCadastroMensal(ano: number): Promise<AgendamentoMesRow[]> {
    return rpc('eficiencia_ops_legais_cadastro_mensal', { p_ano: ano })
  },

  async fetchOpsLegaisCadastroPorUsuario(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
  ): Promise<AgendamentoUsuarioRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_ops_legais_cadastro_por_usuario', {
      p_ano: ano,
      p_meses: meses,
    })
  },

  async fetchOpsLegaisTarefasRanking(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
  ): Promise<OpsLegaisTarefasRankingRow[]> {
    const { inicio, fimExclusivo } = rangePeriodoFiltro(ano, mesFiltro)
    return rpc('eficiencia_ops_legais_tarefas_ranking', {
      p_inicio: inicio,
      p_fim: fimExclusivo,
    })
  },

  async fetchOpsLegaisResponsum(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
  ): Promise<OpsLegaisResponsumDashboard> {
    const { inicio, fimExclusivo } = rangePeriodoFiltro(ano, mesFiltro)
    const { data, error } = await supabase.functions.invoke('ops-legais-responsum', {
      body: { inicio, fim: fimExclusivo },
    })
    if (error) throw error
    if (data?.error) throw new Error(String(data.error))
    return data as OpsLegaisResponsumDashboard
  },

  async fetchOpsLegaisIniciativas(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
  ): Promise<OpsLegaisIniciativasDashboard> {
    const { inicio, fimExclusivo } = rangePeriodoFiltro(ano, mesFiltro)
    const { data, error } = await supabase.functions.invoke('ops-legais-iniciativas', {
      body: { inicio, fim: fimExclusivo },
    })
    if (error) throw error
    if (data?.error) throw new Error(String(data.error))
    return data as OpsLegaisIniciativasDashboard
  },

  async fetchOpsLegaisAntecipacaoMensal(ano: number): Promise<OpsLegaisAntecipacaoMesRow[]> {
    return rpc('eficiencia_ops_legais_antecipacao_mensal', { p_ano: ano })
  },

  async fetchOpsLegaisPublicacoesMensal(ano: number): Promise<OpsLegaisPublicacoesMesRow[]> {
    return rpc('eficiencia_ops_legais_publicacoes_mensal', { p_ano: ano })
  },

  async fetchOpsLegaisPublicacoesEficMensal(
    ano: number,
    escopo: 'analise' | 'agendamento',
  ): Promise<OpsLegaisPublicacoesEficMesRow[]> {
    return rpc('eficiencia_ops_legais_publicacoes_efic_mensal', {
      p_ano: ano,
      p_escopo: escopo,
    })
  },

  async fetchOpsLegaisPublicacoesPorTipo(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
  ): Promise<OpsLegaisPublicacoesTipoRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []
    return rpc('eficiencia_ops_legais_publicacoes_por_tipo', {
      p_ano: ano,
      p_meses: meses,
    })
  },

  async fetchTurnoverAnual(ano: number, area: string | null = null): Promise<TurnoverAnualRow | null> {
    const rows = await rpc<TurnoverAnualRow[]>('eficiencia_turnover_anual', {
      p_ano: ano,
      p_area: area,
    })
    return rows[0] ?? null
  },

  async fetchTurnoverDesligamentos(ano: number): Promise<TurnoverDesligamentoRow[]> {
    return rpc('eficiencia_turnover_desligamentos', { p_ano: ano })
  },

  async fetchTurnoverTop5TempoCasa(ano: number): Promise<TurnoverTopTempoCasaRow[]> {
    return rpc('eficiencia_turnover_top5_tempo_casa', { p_ano: ano })
  },

  async fetchColaboradoresFerias(): Promise<ColaboradorFeriasRow[]> {
    const { data, error } = await supabase
      .from('colaboradores_ferias')
      .select(
        'orqestrai_employee_id, full_name, nome_chave, vacation_exempt, saldo_dias, gozados_ano, em_ferias, ferias_inicio, ferias_fim, proximo_inicio, proximo_fim',
      )
      .limit(2000)
    if (error) throw error
    return (data ?? []) as ColaboradorFeriasRow[]
  },

  /** Headcount ativo no ano (com admissão). Sem `area` = todas as áreas. */
  async fetchTurnoverAtivosAreaDetalhe(
    ano: number,
    area: string | null = null,
  ): Promise<TurnoverAtivoAreaRow[]> {
    let query = supabase
      .from('sp_turnover')
      .select('nome, cargo, admissao, desligamento, area')
      .limit(5000)
    if (area) query = query.eq('area', area)
    const { data, error } = await query
    if (error) throw error

    type Row = {
      nome: string | null
      cargo: string | null
      admissao: string | null
      desligamento: string | null
      area: string | null
    }
    const rows = (data ?? []) as Row[]

    const byKey = new Map<
      string,
      { nome: string; cargo: string | null; admissao: string | null; area: string | null }
    >()
    for (const row of rows) {
      const nome = String(row.nome ?? '').trim()
      if (!nome) continue
      const admYear = row.admissao ? Number(String(row.admissao).slice(0, 4)) : null
      const deslYear = row.desligamento ? Number(String(row.desligamento).slice(0, 4)) : null
      if (admYear != null && admYear > ano) continue
      if (deslYear != null && deslYear <= ano) continue
      const key = nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleUpperCase('pt-BR')
        .replace(/\s+/g, ' ')
      const prev = byKey.get(key)
      const adm = row.admissao == null ? null : String(row.admissao)
      if (!prev || (adm && (!prev.admissao || adm > prev.admissao))) {
        byKey.set(key, {
          nome,
          cargo: row.cargo == null ? null : String(row.cargo),
          admissao: adm,
          area: row.area == null ? null : String(row.area),
        })
      }
    }
    return [...byKey.values()]
  },

  /** Headcount ativo no ano por área (para categorias de treinamento Ops Legais). */
  async fetchTurnoverAtivosArea(
    ano: number,
    area: string,
  ): Promise<Array<{ nome: string; cargo: string | null; admissao: string | null }>> {
    return this.fetchTurnoverAtivosAreaDetalhe(ano, area)
  },

  async fetchTreinamentosAnual(
    ano: number,
    area: string | null = null,
  ): Promise<TreinamentosAnualRow | null> {
    const rows = await rpc<TreinamentosAnualRow[]>('eficiencia_treinamentos_anual', {
      p_ano: ano,
      p_area: area,
    })
    return rows[0] ?? null
  },

  async fetchTreinamentosMensal(
    ano: number,
    area: string | null = null,
  ): Promise<TreinamentosMesRow[]> {
    return rpc('eficiencia_treinamentos_mensal', { p_ano: ano, p_area: area })
  },

  async fetchTreinamentosPorPessoa(
    ano: number,
    area: string | null = null,
  ): Promise<TreinamentosPorPessoaRow[]> {
    return rpc('eficiencia_treinamentos_por_pessoa', { p_ano: ano, p_area: area })
  },

  /** Itens de presença no ano (para cards por colaborador). */
  async fetchTreinamentosItens(ano: number): Promise<TreinamentoItemRow[]> {
    const { data, error } = await supabase
      .from('sp_treinamentos_presenca')
      .select('colaborador, treinamento, data, duracao_minutos, ministrado_por')
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)
      .order('data', { ascending: false })
      .limit(5000)
    if (error) throw error
    return marcarTreinamentosDuplicados(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        colaborador: String(r.colaborador ?? ''),
        treinamento: r.treinamento == null ? null : String(r.treinamento),
        data: r.data == null ? null : String(r.data),
        duracao_minutos: Number(r.duracao_minutos ?? 0),
        ministrado_por:
          r.ministrado_por == null || String(r.ministrado_por).trim() === ''
            ? null
            : String(r.ministrado_por),
      })),
    )
  },

  /** Sessões com data futura (lista mestre SharePoint). */
  async fetchTreinamentosSessoesFuturas(ano: number): Promise<TreinamentoSessaoFuturaRow[]> {
    const hoje = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('sp_treinamentos_sessoes')
      .select('sp_id, nome, data, duracao_minutos, ministrado_por')
      .gt('data', hoje)
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)
      .order('data', { ascending: true })
      .limit(500)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      sp_id: Number(r.sp_id),
      nome: String(r.nome ?? ''),
      data: String(r.data ?? ''),
      duracao_minutos:
        r.duracao_minutos == null || r.duracao_minutos === ''
          ? null
          : Number(r.duracao_minutos),
      ministrado_por:
        r.ministrado_por == null || String(r.ministrado_por).trim() === ''
          ? null
          : String(r.ministrado_por),
    }))
  },

  async fetchGestaoPdiElegiveis(ano: number): Promise<GestaoPdiElegivelRow[]> {
    const { data, error } = await supabase
      .from('sp_gestao_pdi_elegiveis')
      .select('ano, mes, area, colaborador, estrutura, progresso, evidencias_execucao, one_a_one')
      .eq('ano', ano)
      .order('mes')
      .order('colaborador')
    if (error) throw error
    return (data ?? []) as GestaoPdiElegivelRow[]
  },

  async fetchGestaoPdiMensal(ano: number, area: string | null = null): Promise<GestaoPdiMesRow[]> {
    // Preferir RPC quando disponível; fallback calcula no client a partir da tabela espelho.
    const { data, error } = await supabase.rpc('eficiencia_gestao_pdi_mensal' as never, {
      p_ano: ano,
      p_area: area,
    } as never)
    if (!error && data) {
      return (data as GestaoPdiMesRow[]).map((r) => ({
        ...r,
        pct_aptas: r.pct_aptas == null ? null : Number(r.pct_aptas),
      }))
    }
    const elegiveis = await this.fetchGestaoPdiElegiveis(ano)
    return agregarGestaoPdiMensal(avaliarGestaoPdi(elegiveis, area))
  },

  async fetchGestaoPdiDesviosPlanilha(ano: number): Promise<GestaoPdiDesvioPlanilhaRow[]> {
    const { data, error } = await supabase
      .from('sp_gestao_pdi_desvios')
      .select('ano, mes, colaborador, desvio_criterio_apuracao')
      .eq('ano', ano)
    if (error) throw error
    return (data ?? []) as GestaoPdiDesvioPlanilhaRow[]
  },

  async fetchGestaoPdiDetalhe(
    ano: number,
    mesFiltro: MesFiltroEficiencia = null,
    area: string | null = null,
  ): Promise<GestaoPdiDetalheRow[]> {
    const meses = mesesEfetivosFiltro(mesFiltro, ano)
    if (meses && meses.length === 0) return []

    const [elegiveis, desviosPlanilha, rpcDetalhe] = await Promise.all([
      this.fetchGestaoPdiElegiveis(ano),
      this.fetchGestaoPdiDesviosPlanilha(ano).catch(() => [] as GestaoPdiDesvioPlanilhaRow[]),
      supabase
        .rpc('eficiencia_gestao_pdi_detalhe' as never, {
          p_ano: ano,
          p_meses: meses,
          p_area: area,
        } as never)
        .then(({ data, error }) => ({ data, error })),
    ])

    let detalhe: GestaoPdiDetalheRow[] =
      !rpcDetalhe.error && rpcDetalhe.data
        ? (rpcDetalhe.data as GestaoPdiDetalheRow[])
        : (() => {
            let rows = avaliarGestaoPdi(elegiveis, area)
            if (meses) rows = rows.filter((r) => meses.includes(r.mes))
            return rows
          })()

    const criterioPorChave = new Map(
      desviosPlanilha.map((d) => [
        `${d.mes}|${d.colaborador.trim().toLocaleLowerCase('pt-BR')}`,
        d.desvio_criterio_apuracao,
      ]),
    )
    return detalhe.map((d) => ({
      ...d,
      desvio_criterio_apuracao:
        criterioPorChave.get(`${d.mes}|${d.colaborador.trim().toLocaleLowerCase('pt-BR')}`) ??
        d.desvio_criterio_apuracao ??
        null,
    }))
  },

  async fetchGestaoPdiRacional(
    ano: number,
    area: string | null = null,
    mes: MesFiltroEficiencia = null,
    responsavel: string | null = null,
  ): Promise<RacionalResultado> {
    const cfg = RACIONAL_CONFIG.gestao_pdi
    let detalhe = await this.fetchGestaoPdiDetalhe(ano, mes, area)
    if (responsavel?.trim()) {
      detalhe = detalhe.filter((d) => nomesResponsavelMatch(d.colaborador, responsavel))
    }
    const linhas: Array<Record<string, unknown>> = detalhe.map((d) => ({
      mes: d.mes,
      colaborador: d.colaborador,
      area: d.area,
      estrutura: d.estrutura,
      progresso: d.progresso,
      progresso_anterior: d.progresso_anterior,
      evidencias_execucao: d.evidencias_execucao,
      one_a_one: d.one_a_one,
      mudou_progresso: d.mudou_progresso ? 'Sim' : 'Não',
      tem_evidencia: d.tem_evidencia ? 'Sim' : 'Não',
      tem_1a1: d.tem_1a1 ? 'Sim' : 'Não',
      status: d.status,
      desvio_criterio_apuracao: d.desvio_criterio_apuracao ?? null,
    }))
    const aptas = detalhe.filter((d) => d.apta).length
    const desvios = detalhe.length - aptas
    return {
      colunas: cfg.colunas,
      linhas,
      truncado: false,
      resumo: {
        qtd_pdi_apta: aptas,
        qtd_pdi_desvio: desvios,
        qtd_total: detalhe.length,
      },
    }
  },

  async fetchOverviewFinanceiroRacional(
    indicador: 'receita_bruta' | 'indice_inadimplencia',
    ano: number,
    mes: MesFiltroEficiencia = null,
  ): Promise<RacionalResultado> {
    const cfg = RACIONAL_CONFIG[indicador]
    const metas = await receitaMetasService.getMetas()
    const { rows } = await receitaService.buildDashboard(metas)
    const mesMax = mesMaxDisponivelInadimplencia(ano)
    const inadDashboard = await receitaInadimplenciaService.fetchDashboard({
      ano,
      mesInicio: 1,
      mesFim: mesMax > 0 ? mesMax : 12,
    })
    const { meses } = buildGestaoConsolidadoFromInadDashboard(rows, inadDashboard, ano)
    const mesesFiltro = mesesEfetivosFiltro(mes, ano)
    const filtrados = meses.filter((m) => {
      if (m.mes < MES_INICIO_RESULTADO) return false
      if (mesesFiltro && !mesesFiltro.includes(m.mes)) return false
      return true
    })
    const linhas: Array<Record<string, unknown>> = filtrados.map((m) => ({
      mes: m.mesLabel,
      meta: m.meta,
      previsto: m.previsto,
      recebido: m.recebido,
      pct_meta: m.pctMeta,
      pct_previsto: m.pctPrevisto,
      inadimplencia: m.inadimplencia,
      inadimplencia_pct: m.inadimplenciaPct,
      congelado: m.congelado ? 'Sim' : 'Não',
    }))
    return { colunas: cfg.colunas, linhas, truncado: false }
  },

  async fetchOpsLegaisIniciativasRacional(
    ano: number,
    mes: MesFiltroEficiencia = null,
  ): Promise<RacionalResultado> {
    const cfg = RACIONAL_CONFIG.ops_legais_iniciativas
    const dash = await this.fetchOpsLegaisIniciativas(ano, mes)
    const concluidos = (dash.painel?.concluidos ?? []).map((p) => ({
      status: 'Concluído',
      nome: p.nome,
      tipo: p.tipo,
      extensao: p.extensao,
      responsavel: p.responsavel,
      data: p.data,
      sub_concluidas: p.sub_concluidas,
      total_sub: p.total_sub,
      url: p.url,
    }))
    const andamento = (dash.painel?.andamento ?? []).map((p) => ({
      status: 'Andamento',
      nome: p.nome,
      tipo: p.tipo,
      extensao: p.extensao,
      responsavel: p.responsavel,
      data: p.data,
      sub_concluidas: p.sub_concluidas,
      total_sub: p.total_sub,
      url: p.url,
    }))
    const fallback =
      concluidos.length === 0 && andamento.length === 0
        ? (dash.itens ?? []).map((p) => ({
            status: 'Item',
            nome: p.nome,
            tipo: (p.tags ?? []).join(', '),
            extensao: '',
            responsavel: '',
            data: p.data,
            sub_concluidas: null,
            total_sub: null,
            url: p.url,
          }))
        : []
    const linhas = [...concluidos, ...andamento, ...fallback]
    return { colunas: cfg.colunas, linhas, truncado: false }
  },

  async fetchOpsLegaisMarketingRacional(
    ano: number,
    mes: MesFiltroEficiencia = null,
  ): Promise<RacionalResultado> {
    const cfg = RACIONAL_CONFIG.ops_legais_marketing
    const dash = await instagramService.getDashboard()
    const { inicio, fimExclusivo } = rangePeriodoFiltro(ano, mes)
    const inicioMs = new Date(`${inicio}T00:00:00`).getTime()
    const fimMs = new Date(`${fimExclusivo}T00:00:00`).getTime()
    const linhas = dash.posts
      .filter((p) => {
        if (!p.published_at) return false
        const t = new Date(p.published_at).getTime()
        return Number.isFinite(t) && t >= inicioMs && t < fimMs
      })
      .map((p) => ({
        published_at: p.published_at,
        caption: (p.caption ?? '').slice(0, 200),
        media_product_type: p.media_product_type ?? p.media_type,
        areas: (p.areas?.length ? p.areas : p.area ? [p.area] : []).join(', '),
        reach: p.reach,
        likes: p.likes,
        comments: p.comments,
        saves: p.saves,
        shares: p.shares,
        engajamento_pct: Number(computePostEngagementRate(p).toFixed(2)),
        permalink: p.permalink,
      }))
    return { colunas: cfg.colunas, linhas, truncado: false }
  },

  async fetchBeneficioEconomicoAnual(ano: number): Promise<BeneficioEconomicoRow | null> {
    const rows = await rpc<BeneficioEconomicoRow[]>('eficiencia_beneficio_economico_anual', {
      p_ano: ano,
    })
    return rows[0] ?? null
  },

  async fetchUltimaAtualizacao(): Promise<UltimaAtualizacaoRow[]> {
    return rpc('eficiencia_ultima_atualizacao', {})
  },

  async getOverview(ano: number, area: string | null = null): Promise<EficienciaOverview> {
    const [
      slaVistagemRisco,
      slaVistagemComum,
      slaProtocolo,
      eficienciaProtocolo,
      agendamento,
      turnover,
      treinamentos,
      treinamentosMensal,
      gestaoPdiMensal,
      ultimaAtualizacao,
    ] = await Promise.all([
      this.fetchSlaVistagemMensal(ano, true, area),
      this.fetchSlaVistagemMensal(ano, false, area),
      this.fetchSlaProtocoloMensal(ano, area),
      this.fetchEficienciaProtocoloMensal(ano, area),
      this.fetchAgendamentoMensal(ano, area),
      this.fetchTurnoverAnual(ano, area),
      this.fetchTreinamentosAnual(ano, area),
      this.fetchTreinamentosMensal(ano, area),
      this.fetchGestaoPdiMensal(ano, area),
      this.fetchUltimaAtualizacao(),
    ])
    return {
      slaVistagemRisco,
      slaVistagemComum,
      slaProtocolo,
      eficienciaProtocolo,
      agendamento,
      turnover,
      treinamentos,
      treinamentosMensal,
      gestaoPdiMensal,
      ultimaAtualizacao,
    }
  },

  /** Só o resumo numérico (cards Eficiência × Desvio / semana). */
  async fetchRacionalResumoOnly(
    indicador: RacionalIndicador,
    ano: number,
    area: string | null = null,
    mes: MesFiltroEficiencia = null,
    escopo: RacionalEscopo = 'default',
    responsavel: string | null = null,
  ): Promise<RacionalResultado['resumo']> {
    const cfg = RACIONAL_CONFIG[indicador]
    const areaEfetiva = areaFiltroParaIndicador(indicador, area)
    return fetchRacionalResumo(indicador, cfg, ano, areaEfetiva, mes, escopo, responsavel)
  },

  /** Linhas brutas que compõem o cálculo de um indicador (drill-down "Racional"). */
  async fetchRacional(
    indicador: RacionalIndicador,
    ano: number,
    area: string | null = null,
    mes: MesFiltroEficiencia = null,
    escopo: RacionalEscopo = 'default',
    opts?: { somenteDesvios?: boolean; responsavel?: string | null },
  ): Promise<RacionalResultado> {
    const responsavel = opts?.responsavel ?? null
    if (
      indicador === 'sla_vistagem_normal' &&
      area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL
    ) {
      return {
        colunas: RACIONAL_CONFIG.sla_vistagem_normal.colunas,
        linhas: [],
        truncado: false,
      }
    }
    if (
      isAgendamentoVistagemIndisponivelPorArea(area) &&
      (indicador === 'sla_ciencia_agendamentos' ||
        indicador === 'sla_vistagem_risco' ||
        indicador === 'sla_vistagem_normal')
    ) {
      const cfgVazio = RACIONAL_CONFIG[indicador]
      return { colunas: cfgVazio.colunas, linhas: [], truncado: false }
    }
    const cfg = RACIONAL_CONFIG[indicador]

    if (indicador === 'desenvolvimento_equipe') {
      return fetchDesenvolvimentoRacional(
        cfg,
        ano,
        area,
        mes,
        responsavel,
        escopo,
        RACIONAL_LIMITE,
      )
    }

    if (indicador === 'gestao_pdi') {
      return this.fetchGestaoPdiRacional(ano, area, mes, responsavel)
    }

    if (indicador === 'receita_bruta' || indicador === 'indice_inadimplencia') {
      return this.fetchOverviewFinanceiroRacional(indicador, ano, mes)
    }

    if (indicador === 'ops_legais_iniciativas') {
      return this.fetchOpsLegaisIniciativasRacional(ano, mes)
    }

    if (indicador === 'ops_legais_marketing') {
      return this.fetchOpsLegaisMarketingRacional(ano, mes)
    }

    if (
      indicador === 'ops_legais_antecipacao_faturamento' ||
      indicador === 'ops_legais_efetividade_cobranca'
    ) {
      return fetchOpsLegaisFinanceiroRacional(indicador, ano, mes, RACIONAL_LIMITE)
    }

    const areaEfetiva = areaFiltroParaIndicador(indicador, area)

    let query = buildRacionalBaseQuery(
      cfg,
      indicador,
      ano,
      areaEfetiva,
      mes,
      buildRacionalSelect(cfg),
      escopo,
      responsavel,
    )

    if (opts?.somenteDesvios) {
      if (indicador === 'ops_legais_eficiencia_protocolo') {
        query = query.not('inconsistencia_controladoria', 'is', null)
      } else if (indicador === 'ops_legais_sla_protocolo') {
        query = query.eq('eficiencia_sla', 'PROTOCOLADO NO FATAL')
      } else if (indicador === 'ops_legais_pub_analise' || indicador === 'ops_legais_pub_agendamento') {
        query = query.eq('eficiencia', 'DESVIO')
      } else if (indicador === 'ops_legais_cadastro') {
        query = query
          .not('adesao_indicador', 'is', null)
          .neq('adesao_indicador', 'SEM ADESÃO')
      }
    }

    const { data, error } = await query.limit(RACIONAL_LIMITE + 1)
    if (error) throw error
    let linhas = (data ?? []) as unknown as Array<Record<string, unknown>>

    if (indicador === 'retencao_talentos' && responsavel?.trim()) {
      linhas = linhas.filter((row) => nomesResponsavelMatch(String(row.nome ?? ''), responsavel))
    }

    if (indicador === 'retencao_talentos') {
      linhas = sortRetencaoRacionalLinhas(filterRetencaoRacionalLinhasPorAno(linhas, ano))
    }

    linhas = await aplicarOnboardingNoRacional(linhas, indicador, escopo)

    const resumo = opts?.somenteDesvios
      ? undefined
      : await fetchRacionalResumo(indicador, cfg, ano, areaEfetiva, mes, escopo, responsavel)

    return {
      colunas: cfg.colunas,
      linhas: linhas.slice(0, RACIONAL_LIMITE),
      truncado: linhas.length > RACIONAL_LIMITE,
      resumo,
    }
  },

  /** Base completa para exportação Excel (sem limite de linhas na UI). */
  async fetchRacionalParaExport(
    indicador: RacionalIndicador,
    ano: number,
    area: string | null = null,
    mes: MesFiltroEficiencia = null,
    escopo: RacionalEscopo = 'default',
    responsavel: string | null = null,
  ): Promise<RacionalResultado> {
    if (
      indicador === 'sla_vistagem_normal' &&
      area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL
    ) {
      return {
        colunas: RACIONAL_CONFIG.sla_vistagem_normal.colunas,
        linhas: [],
        truncado: false,
      }
    }
    if (
      isAgendamentoVistagemIndisponivelPorArea(area) &&
      (indicador === 'sla_ciencia_agendamentos' ||
        indicador === 'sla_vistagem_risco' ||
        indicador === 'sla_vistagem_normal')
    ) {
      const cfgVazio = RACIONAL_CONFIG[indicador]
      return { colunas: cfgVazio.colunas, linhas: [], truncado: false }
    }

    const cfg = RACIONAL_CONFIG[indicador]

    if (indicador === 'desenvolvimento_equipe') {
      return fetchDesenvolvimentoRacional(cfg, ano, area, mes, responsavel, escopo, null)
    }

    if (indicador === 'gestao_pdi') {
      return this.fetchGestaoPdiRacional(ano, area, mes, responsavel)
    }

    if (indicador === 'receita_bruta' || indicador === 'indice_inadimplencia') {
      return this.fetchOverviewFinanceiroRacional(indicador, ano, mes)
    }

    if (indicador === 'ops_legais_iniciativas') {
      return this.fetchOpsLegaisIniciativasRacional(ano, mes)
    }

    if (indicador === 'ops_legais_marketing') {
      return this.fetchOpsLegaisMarketingRacional(ano, mes)
    }

    if (
      indicador === 'ops_legais_antecipacao_faturamento' ||
      indicador === 'ops_legais_efetividade_cobranca'
    ) {
      return fetchOpsLegaisFinanceiroRacional(indicador, ano, mes, null)
    }

    const areaEfetiva = areaFiltroParaIndicador(indicador, area)

    let linhas = await fetchRacionalLinhasCompletas(
      cfg,
      indicador,
      ano,
      areaEfetiva,
      mes,
      buildRacionalSelect(cfg),
      escopo,
      responsavel,
    )

    if (responsavel?.trim()) {
      const col = RACIONAL_COLUNA_RESPONSAVEL[indicador]
      if (col) {
        linhas = linhas.filter((row) =>
          nomesResponsavelMatch(String(row[col] ?? ''), responsavel),
        )
      }
    }

    const resumo = await fetchRacionalResumo(
      indicador,
      cfg,
      ano,
      areaEfetiva,
      mes,
      escopo,
      responsavel,
    )

    return {
      colunas: cfg.colunas,
      linhas,
      truncado: false,
      resumo,
    }
  },

  /**
   * Compila racionais do mês + amostra de evidências (excludentes FATAL)
   * para o Excel gerencial Indicadores Resultado.
   */
  async fetchIndicadoresResultadoMes(ano: number, mes: number): Promise<IndicadoresResultadoMes> {
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new Error('Mês inválido para Indicadores Resultado')
    }
    const mesFiltro: MesFiltroEficiencia = [mes]

    const [
      slaProtocolo,
      eficienciaProtocolo,
      agendamento,
      vistagemRisco,
      vistagemNormal,
      desenvolvimento,
      gestaoPdiMensalRows,
      gestaoPdiDetalhe,
      retencaoAnual,
      retencaoTalentos,
      retencaoDesligamentos,
      desenvolvimentoAnual,
    ] = await Promise.all([
      this.fetchRacionalParaExport('sla_protocolo', ano, null, mesFiltro),
      this.fetchRacionalParaExport('eficiencia_protocolo', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_ciencia_agendamentos', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_vistagem_risco', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_vistagem_normal', ano, null, mesFiltro),
      this.fetchRacionalParaExport('desenvolvimento_equipe', ano, null, null),
      this.fetchGestaoPdiMensal(ano, null),
      this.fetchGestaoPdiDetalhe(ano, mesFiltro, null),
      this.fetchTurnoverAnual(ano, null),
      this.fetchRacionalParaExport('retencao_talentos', ano, null, null),
      this.fetchTurnoverDesligamentos(ano),
      this.fetchTreinamentosAnual(ano, null),
    ])
    const gestaoPdiMensal = gestaoPdiMensalRows.find((r) => r.mes === mes) ?? null

    const metas = await receitaMetasService.getMetas()
    const { rows: receitaRows } = await receitaService.buildDashboard(metas)
    const mesMax = mesMaxDisponivelInadimplencia(ano)
    const inadDashboard = await receitaInadimplenciaService.fetchDashboard({
      ano,
      mesInicio: 1,
      mesFim: mesMax > 0 ? mesMax : 12,
    })
    const { meses: gestaoMeses } = buildGestaoConsolidadoFromInadDashboard(
      receitaRows,
      inadDashboard,
      ano,
    )
    const mesGestao = gestaoMeses.find((m) => m.mes === mes)
    const financeiro = mesGestao
      ? {
          receitaBrutaPct: mesGestao.pctMeta,
          recebido: mesGestao.recebido,
          meta: mesGestao.meta,
          inadimplenciaPct: mesGestao.inadimplenciaPct,
          inadimplencia: mesGestao.inadimplencia,
          previsto: mesGestao.previsto,
        }
      : null

    const fatalExcludentes = slaProtocolo.linhas
      .map((row) => mapSlaRowToFatalExcludente(row))
      .filter((row): row is NonNullable<typeof row> => row != null)

    const detalhesExcludentes = selecionarAmostraExcludentes(fatalExcludentes)
    const amostraChamados = detalhesExcludentes.filter((r) => r.naAmostra)
    const resumoAmostra = buildResumoAmostra(detalhesExcludentes)

    return {
      ano,
      mes,
      financeiro,
      slaProtocolo,
      eficienciaProtocolo,
      agendamento,
      vistagemRisco,
      vistagemNormal,
      desenvolvimento,
      desenvolvimentoAnual,
      gestaoPdiMensal,
      gestaoPdiDetalhe,
      retencaoAnual,
      retencaoTalentos,
      retencaoDesligamentos,
      detalhesExcludentes,
      amostraChamados,
      resumoAmostra,
    }
  },

  /**
   * Abre chamados de evidência FATAL Excludente na RESPONSUM via Edge Function
   * `abrir-chamados-evidencia` (SIOE). created_by_email é o fallback quando a área não
   * tiver coordenador/gerente/sócio mapeado com conta RESPONSUM (ver módulo Usuários).
   */
  async abrirChamadosEvidenciaResponsum(
    itens: AmostraChamadoItem[],
    createdByEmail: string | null,
    titularPorArea: Record<
      string,
      { responsum_user_id: string; full_name: string; area: string }
    > = {},
  ): Promise<AbrirChamadosResultado> {
    const overrides =
      Object.keys(titularPorArea).length > 0 ? titularPorArea : undefined
    const { data, error } = await supabase.functions.invoke('abrir-chamados-evidencia', {
      body: {
        itens: itens.map((i) => ({
          ci: i.ci,
          area: i.area,
          responsavel: i.responsavel,
          nroCnj: i.nroCnj,
          grupoCliente: i.grupoCliente,
          textoChamado: i.textoChamado,
        })),
        created_by_email: createdByEmail,
        titular_por_area: overrides,
      },
    })
    if (error) throw new Error(await parseEdgeFunctionError(error))
    return data as AbrirChamadosResultado
  },

  /**
   * Decisões de auditoria (RESPONSUM → SIOE) por CI.
   * Se houver várias linhas para o mesmo CI, mantém a mais recente (`decidido_em`).
   */
  async fetchEvidenciaFatalDecisoesPorCi(cis: string[]): Promise<Map<string, EvidenciaFatalDecisao>> {
    const unique = [...new Set(cis.map((c) => c.trim()).filter(Boolean))]
    const map = new Map<string, EvidenciaFatalDecisao>()
    if (unique.length === 0) return map

    const { data, error } = await supabase
      .from('eficiencia_evidencia_fatal_decisoes' as never)
      .select(
        'id, ci, ticket_id, evidencia_enviada, decisao, ano, mes, decidido_em, decidido_por_id, decidido_por_nome, category, subcategory',
      )
      .in('ci', unique)
      .order('decidido_em', { ascending: false })
    if (error) throw error

    for (const row of (data ?? []) as unknown as EvidenciaFatalDecisao[]) {
      if (!map.has(row.ci)) map.set(row.ci, row)
    }
    return map
  },
}
