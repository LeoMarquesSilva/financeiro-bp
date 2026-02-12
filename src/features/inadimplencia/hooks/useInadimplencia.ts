import { useQuery } from '@tanstack/react-query'
import { inadimplenciaService } from '../services/inadimplenciaService'
import type { ListagemParams } from '../types/inadimplencia.types'

export function useInadimplencia(params: ListagemParams & { page?: number }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['inadimplencia', 'list', params],
    queryFn: async () => {
      const { data: list, error: err, total } = await inadimplenciaService.list({
        ...params,
        page: params.page ?? 1,
      })
      if (err) throw err
      return { list, total }
    },
  })

  return {
    data: data?.list ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error,
    refetch,
  }
}
