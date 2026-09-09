import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { opexDeParaService } from '../services/opexDeParaService'

export function useOpexGrupoDePara(anoOrigem: number, anoDestino: number) {
  const queryClient = useQueryClient()
  const enabled = anoOrigem > 2000 && anoDestino > anoOrigem

  const query = useQuery({
    queryKey: ['opex', 'grupo-de-para', anoOrigem, anoDestino],
    queryFn: () => opexDeParaService.list(anoOrigem, anoDestino),
    enabled,
    staleTime: 60_000,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['opex', 'grupo-de-para'] })

  const upsert = useMutation({
    mutationFn: opexDeParaService.upsert,
    onSuccess: () => void invalidate(),
  })

  const remove = useMutation({
    mutationFn: opexDeParaService.remove,
    onSuccess: () => void invalidate(),
  })

  return { ...query, upsert, remove }
}
