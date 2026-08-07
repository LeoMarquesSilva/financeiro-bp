import { supabase } from '@/lib/supabaseClient'
import {
  EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO,
  EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL,
  areaFiltroParaIndicador,
  isAgendamentoVistagemIndisponivelPorArea,
  mesesEfetivosFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import type {
  AgendamentoMesRow,
  AgendamentoUsuarioRow,
  BeneficioEconomicoRow,
  EficienciaOverview,
  EficienciaProtocoloMesRow,
  RacionalEscopo,
  RacionalIndicador,
  RacionalResultado,
  JustificativaFatalRow,
  RankingUsuarioRow,
  SlaProtocoloMesRow,
  SlaVistagemMesRow,
  GestaoPdiDesvioPlanilhaRow,
  GestaoPdiDetalheRow,
  GestaoPdiElegivelRow,
  GestaoPdiMesRow,
  TreinamentoItemRow,
  TreinamentosAnualRow,
  TreinamentosMesRow,
  TreinamentosPorPessoaRow,
  VistagemDesvioRankingRow,
  TurnoverAnualRow,
  TurnoverDesligamentoRow,
  TurnoverTopTempoCasaRow,
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

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never)
  if (error) throw error
  return (data ?? []) as T
}

import {
  buildRacionalBaseQuery,
  fetchDesenvolvimentoRacional,
  fetchEficienciaProtocoloRacionalResumo,
  fetchRacionalLinhasCompletas,
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
): Promise<RacionalResultado['resumo']> {
  if (indicador === 'sla_protocolo') {
    return fetchSlaProtocoloRacionalResumo(cfg, ano, area, mes, escopo)
  }
  if (indicador === 'eficiencia_protocolo') {
    return fetchEficienciaProtocoloRacionalResumo(cfg, ano, area, mes)
  }
  if (indicador === 'sla_vistagem_risco' || indicador === 'sla_vistagem_normal') {
    return fetchSlaVistagemRacionalResumo(cfg, indicador, ano, areaFiltroParaIndicador(indicador, area), mes)
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
      { key: 'area_conclusao', label: 'Área (na conclusão)' },
      { key: 'grupo_cliente', label: 'Grupo Cliente' },
      { key: 'tarefa', label: 'Tarefa' },
      { key: 'tarefa_pai', label: 'Tarefa Pai' },
      { key: 'nro_cnj', label: 'Nro CNJ' },
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
      { key: 'area', label: 'Área' },
      { key: 'criado_por', label: 'Criado por' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'tipo_protocolo', label: 'Tipo de Protocolo' },
      { key: 'protocolado_em', label: 'Protocolado em' },
      { key: 'status_inconsistencia', label: 'Status' },
      { key: 'inconsistencia_juridico_motivo', label: 'Motivo Inconsistência' },
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
      { key: 'area_conclusao', label: 'Área (na conclusão)' },
      { key: 'grupo_cliente', label: 'Grupo Cliente' },
      { key: 'tarefa', label: 'Tarefa' },
      { key: 'nro_cnj', label: 'Nro CNJ' },
      { key: 'usuario_conclusao', label: 'Usuário que concluiu a tarefa' },
      { key: 'data_para_conclusao', label: 'Data para conclusão' },
      { key: 'data_conclusao', label: 'Data da Conclusão' },
      { key: 'fatal_sem18_d1', label: 'Adesão' },
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
      { key: 'area', label: 'Área' },
      { key: 'cliente_principal', label: 'Cliente' },
      { key: 'numero_processo', label: 'Número do Processo' },
      { key: 'tipo_agendamento', label: 'Tipo de Agendamento' },
      { key: 'vistado_por', label: 'Vistado por' },
      { key: 'disponibilizado_vistagem', label: 'Disponibilizado para Vistagem' },
      { key: 'vistado_em', label: 'Vistado em' },
      { key: 'vistado_d1', label: 'Vistado D+1' },
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
      { key: 'area', label: 'Área' },
      { key: 'cliente_principal', label: 'Cliente' },
      { key: 'numero_processo', label: 'Número do Processo' },
      { key: 'tipo_agendamento', label: 'Tipo de Agendamento' },
      { key: 'vistado_por', label: 'Vistado por' },
      { key: 'disponibilizado_vistagem', label: 'Disponibilizado para Vistagem' },
      { key: 'vistado_em', label: 'Vistado em' },
      { key: 'vistado_d1', label: 'Vistado D+1' },
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
    filtros: [
      {
        tipo: 'excludeInAllowNull',
        coluna: 'area',
        valores: [...EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO],
      },
    ],
    colunas: [
      { key: 'nome', label: 'Nome' },
      { key: 'area', label: 'Área' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'admissao', label: 'Admissão' },
      { key: 'desligamento', label: 'Desligamento' },
      { key: 'tipo_desligamento', label: 'Tipo de Desligamento' },
    ],
  },
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
      .select('colaborador, treinamento, data, duracao_minutos')
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)
      .order('data', { ascending: false })
      .limit(5000)
    if (error) throw error
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      colaborador: String(r.colaborador ?? ''),
      treinamento: r.treinamento == null ? null : String(r.treinamento),
      data: r.data == null ? null : String(r.data),
      duracao_minutos: Number(r.duracao_minutos ?? 0),
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

  /** Linhas brutas que compõem o cálculo de um indicador (drill-down "Racional"). */
  async fetchRacional(
    indicador: RacionalIndicador,
    ano: number,
    area: string | null = null,
    mes: MesFiltroEficiencia = null,
    escopo: RacionalEscopo = 'default',
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
      return fetchDesenvolvimentoRacional(cfg, ano, area, mes)
    }

    const areaEfetiva = areaFiltroParaIndicador(indicador, area)

    const query = buildRacionalBaseQuery(
      cfg,
      indicador,
      ano,
      areaEfetiva,
      mes,
      cfg.colunas.map((c) => c.key).join(','),
      escopo,
    ).limit(RACIONAL_LIMITE + 1)

    const { data, error } = await query
    if (error) throw error
    const linhas = (data ?? []) as unknown as Array<Record<string, unknown>>

    const resumo = await fetchRacionalResumo(indicador, cfg, ano, areaEfetiva, mes, escopo)

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
      return fetchDesenvolvimentoRacional(cfg, ano, area, mes)
    }

    const areaEfetiva = areaFiltroParaIndicador(indicador, area)

    const select = cfg.colunas.map((c) => c.key).join(',')
    const linhas = await fetchRacionalLinhasCompletas(
      cfg,
      indicador,
      ano,
      areaEfetiva,
      mes,
      select,
      escopo,
    )

    const resumo = await fetchRacionalResumo(indicador, cfg, ano, areaEfetiva, mes, escopo)

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
    ] = await Promise.all([
      this.fetchRacionalParaExport('sla_protocolo', ano, null, mesFiltro),
      this.fetchRacionalParaExport('eficiencia_protocolo', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_ciencia_agendamentos', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_vistagem_risco', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_vistagem_normal', ano, null, mesFiltro),
      this.fetchRacionalParaExport('desenvolvimento_equipe', ano, null, mesFiltro),
      this.fetchGestaoPdiMensal(ano, null),
      this.fetchGestaoPdiDetalhe(ano, mesFiltro, null),
      this.fetchTurnoverAnual(ano, null),
      this.fetchRacionalParaExport('retencao_talentos', ano, null, null),
      this.fetchTurnoverDesligamentos(ano),
    ])
    const gestaoPdiMensal = gestaoPdiMensalRows.find((r) => r.mes === mes) ?? null

    const fatalExcludentes = slaProtocolo.linhas
      .map((row) => mapSlaRowToFatalExcludente(row))
      .filter((row): row is NonNullable<typeof row> => row != null)

    const detalhesExcludentes = selecionarAmostraExcludentes(fatalExcludentes)
    const amostraChamados = detalhesExcludentes.filter((r) => r.naAmostra)
    const resumoAmostra = buildResumoAmostra(detalhesExcludentes)

    return {
      ano,
      mes,
      slaProtocolo,
      eficienciaProtocolo,
      agendamento,
      vistagemRisco,
      vistagemNormal,
      desenvolvimento,
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
   * tiver coordenador/gerente/sócio mapeado com conta RESPONSUM (ver módulo Colaboradores).
   */
  async abrirChamadosEvidenciaResponsum(
    itens: AmostraChamadoItem[],
    createdByEmail: string | null,
  ): Promise<AbrirChamadosResultado> {
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
