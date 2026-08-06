import { AlertTriangle } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { GestaoVistaMesRow } from '@/features/receita/types/receita.types'
import { MES_INICIO_RESULTADO } from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import { buildOverviewInadimplencia } from '../utils/overviewFinanceiroKpis'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'

export function InadimplenciaTab({ ano }: { ano: number }) {
  const { data, isLoading } = useOverviewFinanceiroKpis(ano)
  const overview = data ? buildOverviewInadimplencia(data.meses, null, ano) : null

  const chartData =
    data?.meses
      .filter((m: GestaoVistaMesRow) => m.mes >= MES_INICIO_RESULTADO && m.inadimplenciaPct != null)
      .map((m: GestaoVistaMesRow) => ({ mes: m.mes, valor: m.inadimplenciaPct! })) ?? []

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = data?.meses.find((m: GestaoVistaMesRow) => m.mes === mesAtual)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Índice de Inadimplência"
          value={
            overview?.acumulado.value != null
              ? formatPercent(overview.acumulado.value)
              : '—'
          }
          hint="Saldo congelado ÷ previsto (Jun+)"
          icon={AlertTriangle}
          accentClass="bg-amber-100 text-amber-800"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Índice no mês atual"
          value={
            rowMesAtual?.inadimplenciaPct != null && rowMesAtual.mes >= MES_INICIO_RESULTADO
              ? formatPercent(rowMesAtual.inadimplenciaPct)
              : '—'
          }
          icon={AlertTriangle}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Saldo inadimplência (Jun+)"
          value={
            data
              ? new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(
                  data.meses
                    .filter((m: GestaoVistaMesRow) => m.mes >= MES_INICIO_RESULTADO)
                    .reduce((s: number, m: GestaoVistaMesRow) => s + (m.inadimplencia ?? 0), 0),
                )
              : '—'
          }
          icon={AlertTriangle}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Índice de Inadimplência"
        subtitle="% saldo congelado ÷ previsto (a partir de junho)"
        data={chartData}
        color="#d97706"
      />
    </div>
  )
}
