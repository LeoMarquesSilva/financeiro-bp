import type { LucideIcon } from 'lucide-react'
import { EficienciaKpiCard } from './EficienciaKpiCard'

type Props = {
  title: string
  icon: LucideIcon
  meta?: string
  value?: string
  hint?: string
}

/** Indicadores do BI ainda sem drill-down operacional no SIOE (valores estáticos no Overview). */
export function EficienciaPlaceholderTab({ title, icon, meta, value = '—', hint }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EficienciaKpiCard
          title={title}
          value={value}
          hint={hint ?? 'Detalhamento em construção — consulte o Overview para o valor consolidado.'}
          meta={meta}
          icon={icon}
          accentClass="bg-slate-100 text-slate-600"
        />
      </div>
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
        Este indicador ainda replica apenas o cartão do Overview (mesma ordem e rótulos do BI). Quando
        houver fonte de dados dedicada, o detalhe mensal e rankings aparecerão aqui.
      </p>
    </div>
  )
}
