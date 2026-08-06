import { supabase } from '@/lib/supabaseClient'
import {
  EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO,
  EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL,
  areaFiltroParaIndicador,
  isAgendamentoVistagemIndisponivelPorArea,
  type MesFiltroEficiencia,
} from '../constants'
import type {
  AgendamentoMesRow,
  AgendamentoUsuarioRow,
  BeneficioEconomicoRow,
  EficienciaOverview,
  EficienciaProtocoloMesRow,
  RacionalIndicador,
  RacionalResultado,
  RankingUsuarioRow,
  SlaProtocoloMesRow,
  SlaVistagemMesRow,
  TreinamentosAnualRow,
  TreinamentosMesRow,
  TreinamentosPorPessoaRow,
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
} from '../utils/amostraChamados'

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
): Promise<RacionalResultado['resumo']> {
  if (indicador === 'sla_protocolo') {
    return fetchSlaProtocoloRacionalResumo(cfg, ano, area, mes)
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
    mes: number | null,
    risco: boolean | null,
  ): Promise<RankingUsuarioRow[]> {
    return rpc('eficiencia_sla_vistagem_por_usuario', { p_ano: ano, p_mes: mes, p_risco: risco })
  },

  async fetchSlaProtocoloMensal(ano: number, area: string | null = null): Promise<SlaProtocoloMesRow[]> {
    return rpc('eficiencia_sla_protocolo_mensal', { p_ano: ano, p_area: area })
  },

  async fetchSlaProtocoloRankingFatal(
    ano: number,
    mes: number | null,
  ): Promise<RankingUsuarioRow[]> {
    return rpc('eficiencia_sla_protocolo_ranking_fatal', { p_ano: ano, p_mes: mes })
  },

  async fetchEficienciaProtocoloMensal(
    ano: number,
    area: string | null = null,
  ): Promise<EficienciaProtocoloMesRow[]> {
    return rpc('eficiencia_protocolo_mensal', { p_ano: ano, p_area: area })
  },

  async fetchEficienciaProtocoloRanking(
    ano: number,
    mes: number | null,
  ): Promise<RankingUsuarioRow[]> {
    return rpc('eficiencia_protocolo_ranking_inconsistencia', { p_ano: ano, p_mes: mes })
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
    mes: number | null,
  ): Promise<AgendamentoUsuarioRow[]> {
    return rpc('eficiencia_agendamento_por_usuario', { p_ano: ano, p_mes: mes })
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

  async fetchTreinamentosPorPessoa(ano: number): Promise<TreinamentosPorPessoaRow[]> {
    return rpc('eficiencia_treinamentos_por_pessoa', { p_ano: ano })
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
      ultimaAtualizacao,
    }
  },

  /** Linhas brutas que compõem o cálculo de um indicador (drill-down "Racional"). */
  async fetchRacional(
    indicador: RacionalIndicador,
    ano: number,
    area: string | null = null,
    mes: MesFiltroEficiencia = null,
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
    ).limit(RACIONAL_LIMITE + 1)

    const { data, error } = await query
    if (error) throw error
    const linhas = (data ?? []) as unknown as Array<Record<string, unknown>>

    const resumo = await fetchRacionalResumo(indicador, cfg, ano, areaEfetiva, mes)

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
    const linhas = await fetchRacionalLinhasCompletas(cfg, indicador, ano, areaEfetiva, mes, select)

    const resumo = await fetchRacionalResumo(indicador, cfg, ano, areaEfetiva, mes)

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
    ] = await Promise.all([
      this.fetchRacionalParaExport('sla_protocolo', ano, null, mesFiltro),
      this.fetchRacionalParaExport('eficiencia_protocolo', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_ciencia_agendamentos', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_vistagem_risco', ano, null, mesFiltro),
      this.fetchRacionalParaExport('sla_vistagem_normal', ano, null, mesFiltro),
      this.fetchRacionalParaExport('desenvolvimento_equipe', ano, null, mesFiltro),
    ])

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
      detalhesExcludentes,
      amostraChamados,
      resumoAmostra,
    }
  },
}
