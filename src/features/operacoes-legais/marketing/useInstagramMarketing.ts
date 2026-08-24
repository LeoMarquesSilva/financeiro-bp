import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { instagramService } from './instagramService'
import type { MarketingPerson } from './instagramService'
import type { InstagramDashboardData, InstagramSolicitante, MarketingTaskRow } from './types'

const DASHBOARD_KEY = ['operacoes-legais', 'marketing', 'instagram'] as const

interface MarketingDashboardQuery {
  data: InstagramDashboardData | undefined
  isLoading: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

interface MarketingPeopleQuery {
  data: MarketingPerson[] | undefined
  isLoading: boolean
  error: unknown
}

interface MarketingPautasQuery {
  data: MarketingTaskRow[] | undefined
  isLoading: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

export function useInstagramMarketing(): MarketingDashboardQuery {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => instagramService.getDashboard(),
    staleTime: 5 * 60 * 1000,
  }) as MarketingDashboardQuery
}

export function useInstagramPeople(): MarketingPeopleQuery {
  return useQuery({
    queryKey: ['operacoes-legais', 'marketing', 'people'],
    queryFn: () => instagramService.listPeople(),
    staleTime: 15 * 60 * 1000,
  }) as MarketingPeopleQuery
}

export function useMarketingPautas(): MarketingPautasQuery {
  return useQuery({
    queryKey: ['operacoes-legais', 'marketing', 'pautas'],
    queryFn: () => instagramService.listMarketingTasks(),
    staleTime: 5 * 60 * 1000,
  }) as MarketingPautasQuery
}

export function useSyncInstagram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => instagramService.sync(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useUpdateInstagramPostLinks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      postId: string
      areas: string[]
      solicitantes: InstagramSolicitante[]
      skipParticipants: boolean
    }) => instagramService.updatePostLinks(
      input.postId,
      input.areas,
      input.solicitantes,
      input.skipParticipants,
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}
