import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services/dashboardService'

export function useDashboard() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['inadimplencia', 'dashboard'],
    queryFn: () => dashboardService.getDashboard(),
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error,
    refetch,
  }
}
