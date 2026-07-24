import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cobrancaSeguimentoService } from '../services/cobrancaSeguimentoService'
import type { CobrancaSeguimentoNovaAcaoInput } from '../types/cobrancaSeguimento.types'

const QUERY_OPTS = {
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
}

export function useCobrancaSeguimentoDashboard() {
  const { data, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cobranca', 'seguimento', 'dashboard'],
    queryFn: () => cobrancaSeguimentoService.fetchDashboard(),
    ...QUERY_OPTS,
  })

  return {
    dashboard: data ?? {
      kpis: {
        valor_total: 0,
        qtd_titulos: 0,
        qtd_grupos: 0,
        valor_faixa_1_30: 0,
        valor_faixa_31_60: 0,
        media_dias_atraso: 0,
      },
      top_devedores: [],
      grupos: [],
    },
    loading: isLoading,
    isFetching,
    error,
    refetch,
  }
}

export function useCobrancaSeguimentoGruposAcima60() {
  const { data, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cobranca', 'seguimento', 'grupos-acima-60'],
    queryFn: () => cobrancaSeguimentoService.fetchGruposAcima60(),
    ...QUERY_OPTS,
  })

  return {
    data: data ?? { kpis: { qtd_grupos: 0, qtd_titulos: 0, valor_total: 0 }, grupos: [] },
    loading: isLoading,
    isFetching,
    error,
    refetch,
  }
}

export function useCobrancaSeguimentoGrupoDetalhe(grupoChave: string | null) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['cobranca', 'seguimento', 'grupo', grupoChave],
    queryFn: () => cobrancaSeguimentoService.fetchGrupoDetalhe(grupoChave!),
    enabled: !!grupoChave,
    ...QUERY_OPTS,
  })

  return {
    detalhe: data ?? null,
    loading: isLoading,
    error,
    refetch,
  }
}

export function useCobrancaSeguimentoCreateAcao() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CobrancaSeguimentoNovaAcaoInput) => cobrancaSeguimentoService.createAcao(input),
    onSuccess: (_data: void, variables: CobrancaSeguimentoNovaAcaoInput) => {
      queryClient.invalidateQueries({ queryKey: ['cobranca', 'seguimento', 'dashboard'] })
      queryClient.invalidateQueries({
        queryKey: ['cobranca', 'seguimento', 'grupo', variables.grupo_chave],
      })
    },
  })
}
