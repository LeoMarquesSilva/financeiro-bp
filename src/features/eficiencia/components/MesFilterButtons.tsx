import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MESES_EFICIENCIA,
  isMesesFiltro,
  isSemanaFiltro,
  rangeSemanaFiltro,
  toggleMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { toPriMaiuscula } from '../utils/textFormat'

type Props = {
  value: MesFiltroEficiencia
  onChange: (mes: MesFiltroEficiencia) => void
  /** Filtros de semana (Ops Legais). Default true. */
  showSemanas?: boolean
}

const BTN =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'

export function MesFilterButtons({ value, onChange, showSemanas = true }: Props) {
  const valueEfetivo =
    !showSemanas && isSemanaFiltro(value) ? null : value

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(BTN, valueEfetivo === null ? BTN_ON : BTN_OFF)}
        aria-pressed={valueEfetivo === null}
      >
        {toPriMaiuscula('Todos os meses')}
      </button>
      <button
        type="button"
        onClick={() => onChange('resultado')}
        className={cn(BTN, valueEfetivo === 'resultado' ? BTN_ON : BTN_OFF)}
        aria-pressed={valueEfetivo === 'resultado'}
        title="Junho até o último mês fechado — exclui o mês corrente"
      >
        {toPriMaiuscula('Resultado')}
      </button>
      {showSemanas ? (
        <>
          <button
            type="button"
            onClick={() => onChange('semana_passada')}
            className={cn(BTN, valueEfetivo === 'semana_passada' ? BTN_ON : BTN_OFF)}
            aria-pressed={valueEfetivo === 'semana_passada'}
            title={rangeSemanaFiltro('semana_passada').label}
          >
            {toPriMaiuscula('Semana passada')}
          </button>
          <button
            type="button"
            onClick={() => onChange('semana_retrasada')}
            className={cn(BTN, valueEfetivo === 'semana_retrasada' ? BTN_ON : BTN_OFF)}
            aria-pressed={valueEfetivo === 'semana_retrasada'}
            title={rangeSemanaFiltro('semana_retrasada').label}
          >
            {toPriMaiuscula('Semana retrasada')}
          </button>
        </>
      ) : null}
      {MESES_EFICIENCIA.map((label, idx) => {
        const mes = idx + 1
        const ativo = isMesesFiltro(valueEfetivo) && valueEfetivo.includes(mes)
        return (
          <button
            key={mes}
            type="button"
            onClick={() => onChange(toggleMesFiltro(valueEfetivo, mes))}
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
