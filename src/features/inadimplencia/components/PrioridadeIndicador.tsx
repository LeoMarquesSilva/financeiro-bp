import { cn } from '@/shared/utils/cn'
import type { PrioridadeTipo } from '../types/inadimplencia.types'

const STYLES: Record<PrioridadeTipo, { label: string; className: string }> = {
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-800 border-red-200' },
  atencao: { label: 'Atenção', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  controlado: { label: 'Controlado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

interface PrioridadeIndicadorProps {
  prioridade: PrioridadeTipo
  className?: string
}

export function PrioridadeIndicador({ prioridade, className }: PrioridadeIndicadorProps) {
  const { label, className: style } = STYLES[prioridade]
  const icon = prioridade === 'urgente' ? '🔥' : prioridade === 'atencao' ? '⚠️' : '✅'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
        style,
        className
      )}
      title={label}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  )
}
