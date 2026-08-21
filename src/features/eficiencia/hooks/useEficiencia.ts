import { useQuery } from '@tanstack/react-query'
import type { MesFiltroEficiencia } from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type {
  AgendamentoMesRow,
  AgendamentoUsuarioRow,
  EficienciaProtocoloMesRow,
  GestaoPdiDetalheRow,
  GestaoPdiMesRow,
  JustificativaFatalRow,
  OpsLegaisProtocoloMesRow,
  OpsLegaisPublicacoesEficMesRow,
  OpsLegaisResponsumDashboard,
  OpsLegaisTarefasRankingRow,
  RankingUsuarioRow,
  RankingGrupoClienteRow,
  SlaProtocoloMesRow,
  SlaProtocoloDiaRow,
  SlaVistagemMesRow,
  TreinamentoItemRow,
  TreinamentoSessaoFuturaRow,
  TreinamentosAnualRow,
  TreinamentosPorPessoaRow,
  TurnoverAnualRow,
  TurnoverDesligamentoRow,
  VistagemDesvioRankingRow,
} from '../types/eficiencia.types'

export function useEficienciaOverview(ano: number, area: string | null = null) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['eficiencia', 'overview', ano, area],
    queryFn: () => eficienciaService.getOverview(ano, area),
  })
  return { data: data ?? null, loading: isLoading, error, refetch }
}

export function useSlaVistagem(ano: number, risco: boolean | null, area: string | null = null) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['eficiencia', 'sla-vistagem', ano, risco, area],
    queryFn: () => eficienciaService.fetchSlaVistagemMensal(ano, risco, area),
  })
  const rows: SlaVistagemMesRow[] = data ?? []
  return { data: rows, loading: isLoading, error, refetch }
}

export function useSlaVistagemRanking(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  risco: boolean | null,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-vistagem-ranking', ano, mesFiltro, risco, area],
    queryFn: () => eficienciaService.fetchSlaVistagemPorUsuario(ano, mesFiltro, risco, area),
  })
  const rows: RankingUsuarioRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useSlaVistagemDesvioRankings(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  risco: boolean | null,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-vistagem-desvio', ano, mesFiltro, risco, area],
    queryFn: async () => {
      const [porUsuario, porTipo, porGrupo] = await Promise.all([
        eficienciaService.fetchSlaVistagemDesvioPorUsuario(ano, mesFiltro, risco, area),
        eficienciaService.fetchSlaVistagemDesvioPorTipo(ano, mesFiltro, risco, area),
        eficienciaService.fetchSlaVistagemDesvioPorGrupo(ano, mesFiltro, risco, area),
      ])
      return { porUsuario, porTipo, porGrupo }
    },
  })
  const porUsuario: VistagemDesvioRankingRow[] = data?.porUsuario ?? []
  const porTipo: VistagemDesvioRankingRow[] = data?.porTipo ?? []
  const porGrupo: VistagemDesvioRankingRow[] = data?.porGrupo ?? []
  return { porUsuario, porTipo, porGrupo, loading: isLoading, error }
}

export function useSlaProtocolo(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-protocolo', ano, area],
    queryFn: () => eficienciaService.fetchSlaProtocoloMensal(ano, area),
  })
  const rows: SlaProtocoloMesRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useSlaProtocoloDiario(
  ano: number,
  mes: number | null,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-protocolo-diario', ano, mes, area],
    queryFn: () => eficienciaService.fetchSlaProtocoloDiario(ano, mes!, area),
    enabled: mes != null && mes >= 1 && mes <= 12,
  })
  const rows: SlaProtocoloDiaRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useEficienciaProtocoloDiario(
  ano: number,
  mes: number | null,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'eficiencia-protocolo-diario', ano, mes, area],
    queryFn: () => eficienciaService.fetchEficienciaProtocoloDiario(ano, mes!, area),
    enabled: mes != null && mes >= 1 && mes <= 12,
  })
  return { data: data ?? [], loading: isLoading, error }
}

export function useAgendamentoDiario(
  ano: number,
  mes: number | null,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'agendamento-diario', ano, mes, area],
    queryFn: () => eficienciaService.fetchAgendamentoDiario(ano, mes!, area),
    enabled: mes != null && mes >= 1 && mes <= 12,
  })
  return { data: data ?? [], loading: isLoading, error }
}

export function useSlaVistagemDiario(
  ano: number,
  mes: number | null,
  risco: boolean | null,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-vistagem-diario', ano, mes, risco, area],
    queryFn: () => eficienciaService.fetchSlaVistagemDiario(ano, mes!, risco, area),
    enabled: mes != null && mes >= 1 && mes <= 12,
  })
  return { data: data ?? [], loading: isLoading, error }
}

export function useSlaProtocoloRankingFatal(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-protocolo-ranking', ano, mesFiltro, area],
    queryFn: () => eficienciaService.fetchSlaProtocoloRankingFatal(ano, mesFiltro, area),
  })
  const rows: RankingUsuarioRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useSlaProtocoloRankingFatalGrupo(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-protocolo-ranking-grupo', ano, mesFiltro, area],
    queryFn: () => eficienciaService.fetchSlaProtocoloRankingFatalGrupo(ano, mesFiltro, area),
  })
  const rows: RankingGrupoClienteRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useSlaProtocoloJustificativaFatal(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-protocolo-justificativa', ano, mesFiltro, area],
    queryFn: () => eficienciaService.fetchSlaProtocoloJustificativaFatal(ano, mesFiltro, area),
  })
  const rows: JustificativaFatalRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useEficienciaProtocolo(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'protocolo', ano, area],
    queryFn: () => eficienciaService.fetchEficienciaProtocoloMensal(ano, area),
  })
  const rows: EficienciaProtocoloMesRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useEficienciaProtocoloRanking(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'protocolo-ranking', ano, mesFiltro, area],
    queryFn: () => eficienciaService.fetchEficienciaProtocoloRanking(ano, mesFiltro, area),
  })
  const rows: RankingUsuarioRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useEficienciaProtocoloRankingGrupo(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'protocolo-ranking-grupo', ano, mesFiltro, area],
    queryFn: () => eficienciaService.fetchEficienciaProtocoloRankingGrupo(ano, mesFiltro, area),
  })
  const rows: RankingGrupoClienteRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useAgendamento(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'agendamento', ano, area],
    queryFn: () => eficienciaService.fetchAgendamentoMensal(ano, area),
  })
  const rows: AgendamentoMesRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useAgendamentoRanking(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'agendamento-ranking', ano, mesFiltro, area],
    queryFn: () => eficienciaService.fetchAgendamentoPorUsuario(ano, mesFiltro, area),
  })
  const rows: AgendamentoUsuarioRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useAgendamentoRankingGrupo(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  area: string | null = null,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'agendamento-ranking-grupo', ano, mesFiltro, area],
    queryFn: () => eficienciaService.fetchAgendamentoPorGrupo(ano, mesFiltro, area),
  })
  const rows: RankingGrupoClienteRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useTurnover(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'turnover', ano, area],
    queryFn: async () => {
      const [anual, desligamentos] = await Promise.all([
        eficienciaService.fetchTurnoverAnual(ano, area),
        eficienciaService.fetchTurnoverDesligamentos(ano),
      ])
      return { anual, desligamentos }
    },
  })
  const anual: TurnoverAnualRow | null = data?.anual ?? null
  const desligamentos: TurnoverDesligamentoRow[] = data?.desligamentos ?? []
  return { anual, desligamentos, loading: isLoading, error }
}

export function useTreinamentos(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'treinamentos', ano, area],
    queryFn: async () => {
      const [anual, porPessoa, itens, sessoesFuturas] = await Promise.all([
        eficienciaService.fetchTreinamentosAnual(ano, area),
        eficienciaService.fetchTreinamentosPorPessoa(ano, area),
        eficienciaService.fetchTreinamentosItens(ano),
        eficienciaService.fetchTreinamentosSessoesFuturas(ano),
      ])
      return { anual, porPessoa, itens, sessoesFuturas }
    },
  })
  const anual: TreinamentosAnualRow | null = data?.anual ?? null
  const porPessoa: TreinamentosPorPessoaRow[] = data?.porPessoa ?? []
  const itens: TreinamentoItemRow[] = data?.itens ?? []
  const sessoesFuturas: TreinamentoSessaoFuturaRow[] = data?.sessoesFuturas ?? []
  return { anual, porPessoa, itens, sessoesFuturas, loading: isLoading, error }
}

export function useOpsLegaisRg(ano: number, mesFiltro: MesFiltroEficiencia) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-rg', ano, mesFiltro],
    queryFn: async () => {
      const [
        protocoloMensal,
        cadastroMensal,
        cadastroRanking,
        publicacoesAnalise,
        publicacoesAgendamento,
      ] = await Promise.all([
        eficienciaService.fetchOpsLegaisProtocoloMensal(ano),
        eficienciaService.fetchOpsLegaisCadastroMensal(ano),
        eficienciaService.fetchOpsLegaisCadastroPorUsuario(ano, mesFiltro),
        eficienciaService.fetchOpsLegaisPublicacoesEficMensal(ano, 'analise'),
        eficienciaService.fetchOpsLegaisPublicacoesEficMensal(ano, 'agendamento'),
      ])
      return {
        protocoloMensal,
        cadastroMensal,
        cadastroRanking,
        publicacoesAnalise,
        publicacoesAgendamento,
      }
    },
  })
  return {
    protocoloMensal: (data?.protocoloMensal ?? []) as OpsLegaisProtocoloMesRow[],
    cadastroMensal: (data?.cadastroMensal ?? []) as AgendamentoMesRow[],
    cadastroRanking: (data?.cadastroRanking ?? []) as AgendamentoUsuarioRow[],
    publicacoesAnalise: (data?.publicacoesAnalise ?? []) as OpsLegaisPublicacoesEficMesRow[],
    publicacoesAgendamento: (data?.publicacoesAgendamento ??
      []) as OpsLegaisPublicacoesEficMesRow[],
    loading: isLoading,
    error,
  }
}

export function useOpsLegaisTarefas(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  enabled = true,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-tarefas', ano, mesFiltro],
    enabled,
    queryFn: async () => {
      const [ranking, responsum] = await Promise.all([
        eficienciaService.fetchOpsLegaisTarefasRanking(ano, mesFiltro),
        eficienciaService.fetchOpsLegaisResponsum(ano, mesFiltro),
      ])
      return { ranking, responsum }
    },
  })
  return {
    ranking: (data?.ranking ?? []) as OpsLegaisTarefasRankingRow[],
    responsum: (data?.responsum ?? null) as OpsLegaisResponsumDashboard | null,
    loading: isLoading,
    error: error as Error | null,
  }
}

export function useGestaoPdi(ano: number, mesFiltro: MesFiltroEficiencia, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'gestao-pdi', ano, mesFiltro, area],
    queryFn: async () => {
      const [mensal, detalhe] = await Promise.all([
        eficienciaService.fetchGestaoPdiMensal(ano, area),
        eficienciaService.fetchGestaoPdiDetalhe(ano, mesFiltro, area),
      ])
      return { mensal, detalhe }
    },
  })
  const mensal: GestaoPdiMesRow[] = data?.mensal ?? []
  const detalhe: GestaoPdiDetalheRow[] = data?.detalhe ?? []
  return { mensal, detalhe, loading: isLoading, error }
}
