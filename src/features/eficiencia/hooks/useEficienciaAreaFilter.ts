import { useState } from 'react'
import { useEficienciaAccess } from '../hooks/useEficienciaAccess'

/**
 * Estado de filtro de área nas abas de detalhe da Eficiência.
 * Coordenador: área travada (sem “Todas” / outras áreas).
 * No Overview o slicer é tratado em EficienciaPage (Todas + área dele).
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
