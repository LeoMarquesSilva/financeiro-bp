import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  invalidateOnboardingExclusoesCache,
  onboardingExclusoesService,
} from '../services/onboardingExclusoesService'
import type { OnboardingExclusaoInsert } from '../types/onboardingExclusoes.types'

export const ONBOARDING_EXCLUSOES_QUERY_KEY = ['eficiencia', 'onboarding-exclusoes'] as const

export function useOnboardingExclusoes(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ONBOARDING_EXCLUSOES_QUERY_KEY,
    queryFn: () => onboardingExclusoesService.list(),
    staleTime: 30_000,
    enabled,
  })

  const invalidate = async () => {
    invalidateOnboardingExclusoesCache()
    await queryClient.invalidateQueries({ queryKey: ['eficiencia'] })
  }

  const create = useMutation({
    mutationFn: (input: OnboardingExclusaoInsert) => onboardingExclusoesService.create(input),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => onboardingExclusoesService.remove(id),
    onSuccess: invalidate,
  })

  return {
    exclusoes: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    create,
    remove,
  }
}
