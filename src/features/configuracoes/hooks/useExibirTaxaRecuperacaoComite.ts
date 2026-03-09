import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appSettingsService } from '@/lib/appSettingsService'

const QUERY_KEY = ['app_settings', 'exibir_taxa_recuperacao_comite']

export function useExibirTaxaRecuperacaoComite() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => appSettingsService.getExibirTaxaRecuperacaoComite(),
  })
  const mutation = useMutation({
    mutationFn: (value: boolean) => appSettingsService.setExibirTaxaRecuperacaoComite(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
  return {
    exibirTaxaRecuperacaoComite: data ?? true,
    isLoading,
    setExibirTaxaRecuperacaoComite: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  }
}
