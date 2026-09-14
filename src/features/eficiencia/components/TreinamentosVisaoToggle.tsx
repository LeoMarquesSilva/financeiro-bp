import { AlertTriangle, CalendarClock, GraduationCap, UserCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TreinamentosVisao =
  | 'equipe'
  | 'pessoas'
  | 'treinamentos'
  | 'futuros'
  | 'duplicados'

type Props = {
  value: TreinamentosVisao
  onChange: (value: TreinamentosVisao) => void
  className?: string
  /** Exibe aba Pessoas (% concluíram meta individual) — Ops Legais. */
  showPessoasVisao?: boolean
  /** Aba à parte para duplicidades de qualquer área. */
  showDuplicadosVisao?: boolean
  qtdDuplicados?: number
  /** Áreas com lançamento duplicado (rótulo do botão). */
  areasDuplicados?: string[]
}

export function TreinamentosVisaoToggle({
  value,
  onChange,
  className,
  showPessoasVisao = false,
  showDuplicadosVisao = false,
  qtdDuplicados = 0,
  areasDuplicados = [],
}: Props) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        className="inline-flex flex-wrap items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
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
        {showPessoasVisao ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={value === 'pessoas'}
            onClick={() => onChange('pessoas')}
            className={cn(
              'h-8 gap-1.5 px-3 text-xs',
              value === 'pessoas'
                ? 'bg-white text-slate-900 shadow-sm hover:bg-white'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden />
            Pessoas
          </Button>
        ) : null}
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
      {showDuplicadosVisao && qtdDuplicados > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={value === 'duplicados'}
          title={
            areasDuplicados.length > 0
              ? `Duplicidades · ${areasDuplicados.join(', ')}`
              : 'Duplicidades'
          }
          onClick={() => onChange('duplicados')}
          className={cn(
            'h-8 gap-1.5 border px-3 text-xs',
            value === 'duplicados'
              ? 'border-red-300 bg-red-50 text-red-800 shadow-sm hover:bg-red-50'
              : 'border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          <span className="max-w-[220px] truncate">
            Duplicidades
            {areasDuplicados.length > 0 ? ` · ${areasDuplicados.join(', ')}` : ''}
          </span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums',
              value === 'duplicados' ? 'bg-red-200 text-red-900' : 'bg-red-100 text-red-800',
            )}
          >
            {qtdDuplicados}
          </span>
        </Button>
      ) : null}
    </div>
  )
}
