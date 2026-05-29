import { Link } from 'react-router-dom'
import { Scale, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { InadimplenciaGrupoRef } from '../services/inadimplenciaGruposIndex'
import { cn } from '@/lib/utils'

const CLASSE_BADGE: Record<string, 'classeA' | 'classeB' | 'classeC'> = {
  A: 'classeA',
  B: 'classeB',
  C: 'classeC',
}

interface InadimplenciaGrupoBadgesProps {
  ativa?: InadimplenciaGrupoRef | null
  resolvida?: InadimplenciaGrupoRef | null
  /** Nome do grupo para link de busca na inadimplência */
  grupoNome: string
  size?: 'sm' | 'md'
  className?: string
}

export function InadimplenciaGrupoBadges({
  ativa,
  resolvida,
  grupoNome,
  size = 'sm',
  className,
}: InadimplenciaGrupoBadgesProps) {
  if (!ativa && !resolvida) return null

  const textClass = size === 'md' ? 'text-xs' : 'text-[11px]'
  const iconClass = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {ativa && (
        <Link
          to={`/financeiro/inadimplencia?busca=${encodeURIComponent(grupoNome)}`}
          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 rounded-full"
          title="Ver no módulo de inadimplência"
        >
          <Badge
            variant={CLASSE_BADGE[ativa.status_classe] ?? 'destructive'}
            className={cn('gap-1 rounded-full px-2.5 py-0.5 font-semibold hover:opacity-90', textClass)}
          >
            <Scale className={iconClass} />
            Inadimplência · Classe {ativa.status_classe}
          </Badge>
        </Link>
      )}
      {resolvida && !ativa && (
        <Link
          to={`/financeiro/inadimplencia?busca=${encodeURIComponent(grupoNome)}&resolvidos=1`}
          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1 rounded-full"
          title="Ver histórico na inadimplência"
        >
          <Badge
            variant="outline"
            className={cn(
              'gap-1 rounded-full border-slate-300 bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600 hover:bg-slate-200/80',
              textClass
            )}
          >
            <CheckCircle2 className={iconClass} />
            Resolvido
          </Badge>
        </Link>
      )}
    </div>
  )
}
