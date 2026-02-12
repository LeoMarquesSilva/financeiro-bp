import { cn } from '@/shared/utils/cn'
import type { InadimplenciaClasse } from '@/lib/database.types'

const CLASS_STYLES: Record<InadimplenciaClasse, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-200',
  B: 'bg-amber-100 text-amber-800 border-amber-200',
  C: 'bg-red-100 text-red-800 border-red-200',
}

interface ClasseBadgeProps {
  classe: InadimplenciaClasse
  className?: string
}

export function ClasseBadge({ classe, className }: ClasseBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded border px-2 py-0.5 text-xs font-medium',
        CLASS_STYLES[classe],
        className
      )}
    >
      Classe {classe}
    </span>
  )
}
