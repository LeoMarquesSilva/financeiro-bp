import { Target } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'

/** Valores estáticos espelhando o Overview do BI (100% em junho). */
export function GestaoPdiTab() {
  const chartData = [{ mes: 6, valor: 100, meta: 100 }]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EficienciaKpiCard
          title="Gestão de PDI"
          value={formatPercent(100)}
          hint="Referência jun/26 (valor estático do BI)"
          meta="Meta 100%"
          atingiuMeta
          icon={Target}
          accentClass="bg-emerald-100 text-emerald-700"
        />
      </div>
      <EficienciaEvolucaoChart
        title="Gestão de PDI"
        subtitle="Valores estáticos — apenas junho preenchido no BI"
        data={chartData}
        color="#059669"
      />
    </div>
  )
}
