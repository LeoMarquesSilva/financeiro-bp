import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  cobrancaTemplatesService,
  DEFAULT_TEMPLATES,
  type CobrancaTemplates,
} from '../services/cobrancaTemplatesService'

const QUERY_KEY = ['cobranca', 'templates']

export function useCobrancaTemplates() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => cobrancaTemplatesService.get(),
  })
  const mutation = useMutation({
    mutationFn: (templates: CobrancaTemplates) => cobrancaTemplatesService.save(templates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
  return {
    templates: data ?? DEFAULT_TEMPLATES,
    isLoading,
    saveTemplates: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}
