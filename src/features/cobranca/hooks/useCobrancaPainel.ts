import { useQuery } from '@tanstack/react-query'
import { cobrancaService, type PainelFiltros } from '../services/cobrancaService'

export function useCobrancaPainel(params: PainelFiltros) {
  const { data, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cobranca', 'painel', params],
    queryFn: () => cobrancaService.listPainel(params),
  })

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    isFetching,
    error,
    refetch,
  }
}

export function useCobrancaResumo(params: PainelFiltros) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['cobranca', 'painel-resumo', params],
    queryFn: () => cobrancaService.getPainelResumo(params),
  })
  return {
    resumo: data ?? { totalValor: 0, qtd: 0, comWhatsapp: 0, comEmail: 0 },
    loading: isLoading,
    isFetching,
  }
}

export function useCobrancaArquivados(enabled: boolean) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cobranca', 'arquivados'],
    queryFn: () => cobrancaService.listArquivados(),
    enabled,
  })
  return { data: data ?? [], loading: isLoading, refetch }
}

export function usePlanoContasOpcoes() {
  const { data, isLoading } = useQuery({
    queryKey: ['cobranca', 'plano-contas-opcoes'],
    queryFn: () => cobrancaService.listPlanoContasOpcoes(),
    staleTime: 5 * 60 * 1000,
  })
  return { opcoes: data ?? [], loading: isLoading }
}
