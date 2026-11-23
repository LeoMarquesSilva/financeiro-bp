import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthContext'
import { exclusaoTitulosService } from '../services/exclusaoTitulosService'

/**
 * Quem pode excluir títulos é decidido no banco (current_user_pode_excluir_titulos):
 * admins ativos + quem está em financeiro_exclusao_autorizados (Juliana Pires).
 */
export function usePodeExcluirTitulos() {
  const { user } = useAuth()
  const email = user?.email ?? null
  const { data, isLoading } = useQuery({
    queryKey: ['exclusao-titulos', 'pode', email],
    queryFn: () => exclusaoTitulosService.podeExcluir(),
    enabled: !!email,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
  return { pode: data === true, isLoading: !!email && isLoading }
}
