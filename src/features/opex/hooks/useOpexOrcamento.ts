import { useQuery, useQueryClient } from '@tanstack/react-query'
import { opexOrcamentoService } from '../services/opexOrcamentoService'

export function useOpexOrcamento(ano: number) {
  const queryClient = useQueryClient()

  const metaQuery = useQuery({
    queryKey: ['opex', 'orcamento', 'meta', ano],
    queryFn: () => opexOrcamentoService.fetchAnoMeta(ano),
    staleTime: 30_000,
  })

  const linhasQuery = useQuery({
    queryKey: ['opex', 'orcamento', 'linhas', ano],
    queryFn: () => opexOrcamentoService.listLinhas(ano),
    staleTime: 30_000,
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['opex', 'orcamento', 'meta', ano] }),
      queryClient.invalidateQueries({ queryKey: ['opex', 'orcamento', 'linhas', ano] }),
      queryClient.invalidateQueries({ queryKey: ['opex', 'dashboard', ano] }),
    ])
  }

  return {
    meta: metaQuery.data,
    linhas: linhasQuery.data ?? [],
    isLoading: metaQuery.isLoading || linhasQuery.isLoading,
    error: metaQuery.error ?? linhasQuery.error,
    refetch: async () => {
      await Promise.all([metaQuery.refetch(), linhasQuery.refetch()])
    },
    invalidate,
  }
}
