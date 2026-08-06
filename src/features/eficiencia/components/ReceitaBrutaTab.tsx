import { TrendingUp } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { GestaoVistaMesRow } from '@/features/receita/types/receita.types'
import {
  MES_INICIO_RESULTADO,
  isMesesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import { buildOverviewReceitaBruta } from '../utils/overviewFinanceiroKpis'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

export function ReceitaBrutaTab({ ano, mesFiltro }: Props) {
  const { data, isLoading } = useOverviewFinanceiroKpis(ano)
  const overview = data
    ? buildOverviewReceitaBruta(data.meses, data.rows, ano, mesFiltro)
    : null

  const mesesEscopo = (data?.meses ?? []).filter(
    (m: GestaoVistaMesRow) =>
      m.mes >= MES_INICIO_RESULTADO && mesNoFiltro(m.mes, mesFiltro, ano),
  )

  const chartData = mesesEscopo
    .filter((m: GestaoVistaMesRow) => m.pctMeta != null)
    .map((m: GestaoVistaMesRow) => ({ mes: m.mes, valor: m.pctMeta!, meta: 100 }))

  const mesDestaque =
    isMesesFiltro(mesFiltro) && mesFiltro.length === 1
      ? mesFiltro[0]
      : new Date().getMonth() + 1
  const rowMesDestaque = data?.meses.find((m: GestaoVistaMesRow) => m.mes === mesDestaque)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Receita Bruta no período"
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
          title={
            isMesesFiltro(mesFiltro) && mesFiltro.length === 1
              ? 'Receita Bruta no mês'
              : 'Receita Bruta no mês atual'
          }
          value={
            rowMesDestaque?.pctMeta != null &&
            rowMesDestaque.mes >= MES_INICIO_RESULTADO &&
            mesNoFiltro(rowMesDestaque.mes, mesFiltro, ano)
              ? formatPercent(rowMesDestaque.pctMeta)
              : '—'
          }
          icon={TrendingUp}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Recebido acumulado (período)"
          value={
            data
              ? new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(
                  mesesEscopo.reduce(
                    (s: number, m: GestaoVistaMesRow) => s + (m.recebido ?? 0),
                    0,
                  ),
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
