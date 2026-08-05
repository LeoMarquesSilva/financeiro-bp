import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MESES_EFICIENCIA,
  isMesesFiltro,
  toggleMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'

type Props = {
  value: MesFiltroEficiencia
  onChange: (mes: MesFiltroEficiencia) => void
}

const BTN =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

export function MesFilterButtons({ value, onChange }: Props) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(BTN, value === null ? BTN_ON : BTN_OFF)}
        aria-pressed={value === null}
      >
        Todos os meses
      </button>
      <button
        type="button"
        onClick={() => onChange('resultado')}
        className={cn(BTN, value === 'resultado' ? BTN_ON : BTN_OFF)}
        aria-pressed={value === 'resultado'}
        title="Junho até o último mês fechado — exclui o mês corrente"
      >
        Resultado
      </button>
      {MESES_EFICIENCIA.map((label, idx) => {
        const mes = idx + 1
        const ativo = isMesesFiltro(value) && value.includes(mes)
        return (
          <button
            key={mes}
            type="button"
            onClick={() => onChange(toggleMesFiltro(value, mes))}
            className={cn(BTN, ativo ? BTN_ON : BTN_OFF)}
            aria-pressed={ativo}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
