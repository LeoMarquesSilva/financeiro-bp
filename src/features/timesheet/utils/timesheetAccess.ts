import type { AppRole } from '@/lib/database.types'
import type { ColaboradorNivelHierarquico } from '@/features/colaboradores/types'
import { normalizeAreaEficiencia } from '@/features/eficiencia/utils/eficienciaAccess'
import { timesheetAreasDaPessoa } from '../constants'

export type TimesheetAccess = {
  /** Pode escolher Todas e qualquer área do VIOS. */
  canFilterAreas: boolean
  /** `null` = todas. Lista vazia = sem área vinculada. */
  lockedAreas: string[] | null
  /** Rótulo da área do usuário, quando o recorte está travado. */
  areaLabel: string | null
}

type ResolveInput = {
  role: AppRole | null
  teamMemberArea: string | null | undefined
  nivelHierarquico: ColaboradorNivelHierarquico | null | undefined
  colaboradorArea: string | null | undefined
}

export function resolveTimesheetAccess(input: ResolveInput): TimesheetAccess {
  if (input.role === 'admin') {
    return { canFilterAreas: true, lockedAreas: null, areaLabel: null }
  }

  const bruta = (input.colaboradorArea || input.teamMemberArea || '').trim()
  const canonica = normalizeAreaEficiencia(bruta) ?? bruta

  if (input.nivelHierarquico === 'socio' && (bruta === 'Sócio' || canonica === 'Sócio')) {
    return { canFilterAreas: true, lockedAreas: null, areaLabel: null }
  }

  const areas = timesheetAreasDaPessoa(canonica || bruta)
  if (areas == null) {
    return { canFilterAreas: false, lockedAreas: [], areaLabel: null }
  }

  const label =
    canonica === 'Reestruturação' || bruta === 'Insolvência'
      ? 'Reestruturação'
      : canonica || bruta

  return { canFilterAreas: false, lockedAreas: areas, areaLabel: label }
}
