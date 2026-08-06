import { TrendingUp } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { GestaoVistaMesRow } from '@/features/receita/types/receita.types'
import { MES_INICIO_RESULTADO } from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import { buildOverviewReceitaBruta } from '../utils/overviewFinanceiroKpis'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'

export function ReceitaBrutaTab({ ano }: { ano: number }) {
  const { data, isLoading } = useOverviewFinanceiroKpis(ano)
  const overview = data
    ? buildOverviewReceitaBruta(data.meses, data.rows, ano, null)
    : null

  const chartData =
    data?.meses
      .filter((m: GestaoVistaMesRow) => m.mes >= MES_INICIO_RESULTADO && m.pctMeta != null)
      .map((m: GestaoVistaMesRow) => ({ mes: m.mes, valor: m.pctMeta!, meta: 100 })) ?? []

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = data?.meses.find((m: GestaoVistaMesRow) => m.mes === mesAtual)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Receita Bruta no ano"
          value={
            overview?.acumulado.value != null
              ? formatPercent(overview.acumulado.value)
              : '—'
          }
          hint="Recebido ÷ meta (Jun+)"
          meta="Meta 100%"
          atingiuMeta={
            overview?.acumulado.value != null ? overview.acumulado.value >= 100 : null
          }
          icon={TrendingUp}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Receita Bruta no mês atual"
          value={
            rowMesAtual?.pctMeta != null && rowMesAtual.mes >= MES_INICIO_RESULTADO
              ? formatPercent(rowMesAtual.pctMeta)
              : '—'
          }
          icon={TrendingUp}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Recebido acumulado (Jun+)"
          value={
            data
              ? new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(
                  data.meses
                    .filter((m: GestaoVistaMesRow) => m.mes >= MES_INICIO_RESULTADO)
                    .reduce((s: number, m: GestaoVistaMesRow) => s + (m.recebido ?? 0), 0),
                )
              : '—'
          }
          icon={TrendingUp}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Receita Bruta"
        subtitle="% recebido ÷ meta mensal (a partir de junho)"
        data={chartData}
        color="#059669"
      />
    </div>
  )
}
