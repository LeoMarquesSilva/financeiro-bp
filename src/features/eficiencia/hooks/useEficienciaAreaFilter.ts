import { useState } from 'react'
import { useEficienciaAccess } from '../hooks/useEficienciaAccess'

/**
 * Estado de filtro de área nas abas de Eficiência.
 * Coordenador: área travada (sem “Todas” / outras áreas).
 */
export function useEficienciaAreaFilter(initial: string | null = null) {
  const access = useEficienciaAccess()
  const [areaLivre, setAreaLivre] = useState<string | null>(initial)

  const locked = !access.canFilterAreas
  const area = locked ? access.lockedArea : areaLivre

  return {
    area,
    setArea: locked ? () => undefined : setAreaLivre,
    allowedAreas: locked ? (access.lockedArea ? [access.lockedArea] : []) : null,
    allowTodas: access.canFilterAreas,
    locked,
  }
}
