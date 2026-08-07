import { useMemo } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { resolveEficienciaAccess, type EficienciaAccess } from '../utils/eficienciaAccess'

/** Resolve o perfil de visão do dashboard Eficiência a partir da sessão. */
export function useEficienciaAccess(): EficienciaAccess {
  const { role, user, area, nivelHierarquico, colaboradorArea } = useAuth()

  return useMemo(
    () =>
      resolveEficienciaAccess({
        role,
        email: user?.email,
        teamMemberArea: area,
        nivelHierarquico,
        colaboradorArea,
      }),
    [role, user?.email, area, nivelHierarquico, colaboradorArea],
  )
}
