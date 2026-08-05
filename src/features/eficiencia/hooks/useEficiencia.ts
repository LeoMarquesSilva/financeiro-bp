import { useQuery } from '@tanstack/react-query'
import { eficienciaService } from '../services/eficienciaService'
import type {
  AgendamentoMesRow,
  AgendamentoUsuarioRow,
  EficienciaProtocoloMesRow,
  RankingUsuarioRow,
  SlaProtocoloMesRow,
  SlaVistagemMesRow,
  TreinamentosAnualRow,
  TreinamentosPorPessoaRow,
  TurnoverAnualRow,
  TurnoverDesligamentoRow,
  TurnoverTopTempoCasaRow,
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

export function useSlaVistagemRanking(ano: number, mes: number | null, risco: boolean | null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-vistagem-ranking', ano, mes, risco],
    queryFn: () => eficienciaService.fetchSlaVistagemPorUsuario(ano, mes, risco),
  })
  const rows: RankingUsuarioRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useSlaProtocolo(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-protocolo', ano, area],
    queryFn: () => eficienciaService.fetchSlaProtocoloMensal(ano, area),
  })
  const rows: SlaProtocoloMesRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useSlaProtocoloRankingFatal(ano: number, mes: number | null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'sla-protocolo-ranking', ano, mes],
    queryFn: () => eficienciaService.fetchSlaProtocoloRankingFatal(ano, mes),
  })
  const rows: RankingUsuarioRow[] = data ?? []
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

export function useEficienciaProtocoloRanking(ano: number, mes: number | null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'protocolo-ranking', ano, mes],
    queryFn: () => eficienciaService.fetchEficienciaProtocoloRanking(ano, mes),
  })
  const rows: RankingUsuarioRow[] = data ?? []
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

export function useAgendamentoRanking(ano: number, mes: number | null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'agendamento-ranking', ano, mes],
    queryFn: () => eficienciaService.fetchAgendamentoPorUsuario(ano, mes),
  })
  const rows: AgendamentoUsuarioRow[] = data ?? []
  return { data: rows, loading: isLoading, error }
}

export function useTurnover(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'turnover', ano, area],
    queryFn: async () => {
      const [anual, desligamentos, top5] = await Promise.all([
        eficienciaService.fetchTurnoverAnual(ano, area),
        eficienciaService.fetchTurnoverDesligamentos(ano),
        eficienciaService.fetchTurnoverTop5TempoCasa(ano),
      ])
      return { anual, desligamentos, top5 }
    },
  })
  const anual: TurnoverAnualRow | null = data?.anual ?? null
  const desligamentos: TurnoverDesligamentoRow[] = data?.desligamentos ?? []
  const top5: TurnoverTopTempoCasaRow[] = data?.top5 ?? []
  return { anual, desligamentos, top5, loading: isLoading, error }
}

export function useTreinamentos(ano: number, area: string | null = null) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['eficiencia', 'treinamentos', ano, area],
    queryFn: async () => {
      const [anual, porPessoa] = await Promise.all([
        eficienciaService.fetchTreinamentosAnual(ano, area),
        eficienciaService.fetchTreinamentosPorPessoa(ano),
      ])
      return { anual, porPessoa }
    },
  })
  const anual: TreinamentosAnualRow | null = data?.anual ?? null
  const porPessoa: TreinamentosPorPessoaRow[] = data?.porPessoa ?? []
  return { anual, porPessoa, loading: isLoading, error }
}
