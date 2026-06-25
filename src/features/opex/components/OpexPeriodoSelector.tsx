import { cn } from '@/lib/utils'
import { MESES_CURTOS } from '../constants'
import { mesesYtd, temFiltroMeses, toggleMesFiltro } from '../utils/opexPeriodo'

type Props = {
  mesesFiltro: number[]
  mesAtual: number
  onChange: (meses: number[]) => void
}

export function OpexPeriodoSelector({ mesesFiltro, mesAtual, onChange }: Props) {
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const ytdAtivo =
    filtroAtivo &&
    mesAtual > 0 &&
    mesesFiltro.length === mesAtual &&
    mesesFiltro.every((m, i) => m === i + 1)

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[280px]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Meses</span>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
            !filtroAtivo
              ? 'border-rose-300 bg-rose-50 text-rose-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200',
          )}
        >
          Ano inteiro
        </button>
        {mesAtual > 0 && (
          <button
            type="button"
            onClick={() => onChange(mesesYtd(mesAtual))}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
              ytdAtivo
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200',
            )}
          >
            YTD
          </button>
        )}
        {MESES_CURTOS.map((label, idx) => {
          const mes = idx + 1
          const selected = mesesFiltro.includes(mes)
          return (
            <button
              key={mes}
              type="button"
              onClick={() => onChange(toggleMesFiltro(mesesFiltro, mes))}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-medium capitalize transition-colors',
                selected
                  ? 'border-rose-400 bg-rose-100 text-rose-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50/50',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      {filtroAtivo && (
        <p className="text-[10px] text-slate-500">
          {mesesFiltro.length} mês{mesesFiltro.length > 1 ? 'es' : ''} selecionado
          {mesesFiltro.length > 1 ? 's' : ''} — clique para alternar
        </p>
      )}
    </div>
  )
}
