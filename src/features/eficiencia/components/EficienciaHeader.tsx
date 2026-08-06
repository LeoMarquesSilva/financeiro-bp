import { Gauge, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/shared/utils/format'
import type { UltimaAtualizacaoRow } from '../types/eficiencia.types'

type Props = {
  ano: number
  anos: number[]
  onAnoChange: (ano: number) => void
  ultimaAtualizacao?: UltimaAtualizacaoRow[]
}

const BTN =
  'inline-flex h-8 min-w-[4.5rem] items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

export function EficienciaHeader({ ano, anos, onAnoChange, ultimaAtualizacao }: Props) {
  const maisRecente = ultimaAtualizacao?.length
    ? ultimaAtualizacao.reduce((a, b) => (a.executado_em > b.executado_em ? a : b))
    : null

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Gauge className="h-6 w-6 text-slate-600" />
          Resultado Metas Bismarchi Pires | Consolidado
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Indicadores operacionais do jurídico — SLA, protocolo, agendamento, turnover e treinamentos
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {maisRecente && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400" title={`Fonte: ${maisRecente.fonte}`}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Atualizado em {formatDateTime(maisRecente.executado_em)}
          </span>
        )}
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label="Ano de referência"
          title="Use 2025 apenas para comparativo anual"
        >
          {anos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onAnoChange(a)}
              className={cn(BTN, ano === a ? BTN_ON : BTN_OFF)}
              aria-pressed={ano === a}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
