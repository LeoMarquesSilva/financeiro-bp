import { ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isPeriodoCurtoFiltro, MESES_EFICIENCIA, type MesFiltroEficiencia } from '../constants'

type Props = {
  granularidade: 'mes' | 'dia'
  drillDisponivel: boolean
  mesDrillTarget: number | null
  mesFiltro: MesFiltroEficiencia
  onPorDia: () => void
  onPorMes: () => void
}

export function EvolucaoDrilldownToolbar({
  granularidade,
  drillDisponivel,
  mesDrillTarget,
  mesFiltro,
  onPorDia,
  onPorMes,
}: Props) {
  if (granularidade === 'mes') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs text-slate-600"
        disabled={!drillDisponivel}
        title={
          drillDisponivel
            ? `Ver ${MESES_EFICIENCIA[(mesDrillTarget ?? 1) - 1] ?? 'mês'} por dia`
            : isPeriodoCurtoFiltro(mesFiltro)
              ? 'Indisponível em filtro por semana/dia'
              : 'Selecione um mês no filtro ou clique em um ponto do gráfico'
        }
        onClick={onPorDia}
      >
        <ZoomIn className="h-3.5 w-3.5" aria-hidden />
        Por dia
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs text-slate-600"
      onClick={onPorMes}
    >
      <ZoomOut className="h-3.5 w-3.5" aria-hidden />
      Por mês
    </Button>
  )
}
