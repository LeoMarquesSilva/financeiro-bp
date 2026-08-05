import { Gauge, RefreshCcw } from 'lucide-react'
import { formatDateTime } from '@/shared/utils/format'
import type { UltimaAtualizacaoRow } from '../types/eficiencia.types'

const SELECT_CLASS =
  'flex h-8 min-w-[90px] rounded-lg border border-slate-200 bg-white px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

type Props = {
  ano: number
  anos: number[]
  onAnoChange: (ano: number) => void
  ultimaAtualizacao?: UltimaAtualizacaoRow[]
}

export function EficienciaHeader({ ano, anos, onAnoChange, ultimaAtualizacao }: Props) {
  const maisRecente = ultimaAtualizacao?.length
    ? ultimaAtualizacao.reduce((a, b) => (a.executado_em > b.executado_em ? a : b))
    : null

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Gauge className="h-6 w-6 text-slate-600" />
          Eficiência Operacional
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Indicadores operacionais do jurídico — SLA, protocolo, agendamento, turnover e treinamentos
        </p>
      </div>

      <div className="flex items-center gap-3">
        {maisRecente && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400" title={`Fonte: ${maisRecente.fonte}`}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Atualizado em {formatDateTime(maisRecente.executado_em)}
          </span>
        )}
        <select
          value={ano}
          onChange={(e) => onAnoChange(Number(e.target.value))}
          className={SELECT_CLASS}
          title="Ano de referência"
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </header>
  )
}
