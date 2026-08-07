import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AREAS_EFICIENCIA } from '../constants'

type Props = {
  value: string | null
  onChange: (area: string | null) => void
  /** Se informado, só exibe essas áreas (ex.: área do coordenador). */
  allowedAreas?: readonly string[] | null
  /** Exibir “Todas as áreas”. Default true. */
  allowTodas?: boolean
}

export function AreaFilterButtons({
  value,
  onChange,
  allowedAreas,
  allowTodas = true,
}: Props) {
  const areas =
    allowedAreas == null
      ? [...AREAS_EFICIENCIA]
      : AREAS_EFICIENCIA.filter((a) => allowedAreas.includes(a))

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      {allowTodas ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
            value === null
              ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
          )}
          aria-pressed={value === null}
        >
          Todas as áreas
        </button>
      ) : null}
      {areas.map((area) => (
        <button
          key={area}
          type="button"
          onClick={() => onChange(area)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
            value === area
              ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
          )}
          aria-pressed={value === area}
        >
          {area}
        </button>
      ))}
    </div>
  )
}
