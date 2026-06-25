import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'

export function useOpexMesGrupos(ano: number, mes: number | null) {
  return useQuery({
    queryKey: ['opex', 'mes-grupos', ano, mes],
    queryFn: () => opexService.fetchMesGrupos(ano, mes!),
    enabled: mes != null && mes >= 1 && mes <= 12,
    staleTime: 60_000,
  })
}
