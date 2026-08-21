import { CalendarClock, GraduationCap, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TreinamentosVisao = 'equipe' | 'treinamentos' | 'futuros'

type Props = {
  value: TreinamentosVisao
  onChange: (value: TreinamentosVisao) => void
  className?: string
}

export function TreinamentosVisaoToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1',
        className,
      )}
      role="group"
      aria-label="Visualização dos treinamentos"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === 'equipe'}
        onClick={() => onChange('equipe')}
        className={cn(
          'h-8 gap-1.5 px-3 text-xs',
          value === 'equipe'
            ? 'bg-white text-slate-900 shadow-sm hover:bg-white'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        <Users className="h-3.5 w-3.5" aria-hidden />
        Visão Equipe
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === 'treinamentos'}
        onClick={() => onChange('treinamentos')}
        className={cn(
          'h-8 gap-1.5 px-3 text-xs',
          value === 'treinamentos'
            ? 'bg-white text-slate-900 shadow-sm hover:bg-white'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        <GraduationCap className="h-3.5 w-3.5" aria-hidden />
        Visão Treinamentos
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === 'futuros'}
        onClick={() => onChange('futuros')}
        className={cn(
          'h-8 gap-1.5 px-3 text-xs',
          value === 'futuros'
            ? 'bg-white text-slate-900 shadow-sm hover:bg-white'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        Treinamentos Futuros
      </Button>
    </div>
  )
}
