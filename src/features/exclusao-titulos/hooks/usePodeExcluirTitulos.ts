import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthContext'
import { exclusaoTitulosService } from '../services/exclusaoTitulosService'

/**
 * Quem pode excluir títulos é definido por pessoa no banco
 * (financeiro_exclusao_autorizados), não pelo perfil. Hoje: só a Juliana Pires.
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
