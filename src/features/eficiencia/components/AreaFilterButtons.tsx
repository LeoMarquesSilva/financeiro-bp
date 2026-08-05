import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AREAS_EFICIENCIA } from '../constants'

type Props = {
  value: string | null
  onChange: (area: string | null) => void
}

export function AreaFilterButtons({ value, onChange }: Props) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
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
      {AREAS_EFICIENCIA.map((area) => (
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
