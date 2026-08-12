import type { MesFiltroEficiencia } from '../constants'
import { AreaFilterButtons } from './AreaFilterButtons'
import { ResponsavelFilter } from './ResponsavelFilter'

type Props = {
  ano: number
  mesFiltro?: MesFiltroEficiencia
  /** Filtro de área — omitir em abas sem slicer (ex.: Receita). */
  area?: string | null
  onAreaChange?: (area: string | null) => void
  allowedAreas?: readonly string[] | null
  allowTodas?: boolean
  showArea?: boolean
  responsavel: string | null
  onResponsavelChange: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

/**
 * Slicers das abas de detalhe: área (chips) + responsável (gestão individual),
 * no mesmo alinhamento visual.
 */
export function EficienciaDetailFilters({
  ano,
  mesFiltro,
  area = null,
  onAreaChange,
  allowedAreas,
  allowTodas = true,
  showArea = true,
  responsavel,
  onResponsavelChange,
  responsavelEnabled = true,
  responsavelHintDisabled,
}: Props) {
  return (
    <div className="space-y-2">
      {showArea && onAreaChange ? (
        <AreaFilterButtons
          value={area}
          onChange={onAreaChange}
          allowedAreas={allowedAreas}
          allowTodas={allowTodas}
          ano={ano}
          mesFiltro={mesFiltro}
        />
      ) : null}
      <ResponsavelFilter
        ano={ano}
        area={showArea ? area : null}
        value={responsavel}
        onChange={onResponsavelChange}
        enabled={responsavelEnabled}
        hintDisabled={responsavelHintDisabled}
      />
    </div>
  )
}
