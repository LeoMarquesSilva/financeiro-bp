import { useQuery } from '@tanstack/react-query'
import { opexService } from '../services/opexService'
import { opexDeParaService } from '../services/opexDeParaService'
import { opexDeParaKeys } from '../utils/opexDePara'

/** Níveis 1 e 2 do plano de contas do VIOS — muda raramente. */
export function useOpexPlanoContasNiveis() {
  return useQuery({
    queryKey: ['opex', 'plano-contas-niveis'],
    queryFn: () => opexService.fetchPlanoContasNiveis(),
    staleTime: 60 * 60_000,
  })
}

/** De × Para que partem do ano exibido (para achar o nível 1 de grupos do plano antigo). */
export function useOpexDeParaPorOrigem(anoOrigem: number) {
  return useQuery({
    queryKey: [...opexDeParaKeys.all, 'origem', anoOrigem],
    queryFn: () => opexDeParaService.listPorOrigem(anoOrigem),
    staleTime: 60_000,
  })
}
