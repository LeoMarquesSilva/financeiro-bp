import { AlertTriangle } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { GestaoVistaMesRow } from '@/features/receita/types/receita.types'
import {
  MES_INICIO_RESULTADO,
  isMesesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import { buildOverviewInadimplencia } from '../utils/overviewFinanceiroKpis'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

export function InadimplenciaTab({ ano, mesFiltro }: Props) {
  const { data, isLoading } = useOverviewFinanceiroKpis(ano)
  const overview = data ? buildOverviewInadimplencia(data.meses, mesFiltro, ano) : null

  const mesesEscopo = (data?.meses ?? []).filter(
    (m: GestaoVistaMesRow) =>
      m.mes >= MES_INICIO_RESULTADO && mesNoFiltro(m.mes, mesFiltro, ano),
  )

  const chartData = mesesEscopo
    .filter((m: GestaoVistaMesRow) => m.inadimplenciaPct != null)
    .map((m: GestaoVistaMesRow) => ({ mes: m.mes, valor: m.inadimplenciaPct! }))

  const mesDestaque =
    isMesesFiltro(mesFiltro) && mesFiltro.length === 1
      ? mesFiltro[0]
      : new Date().getMonth() + 1
  const rowMesDestaque = data?.meses.find((m: GestaoVistaMesRow) => m.mes === mesDestaque)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Índice de Inadimplência Gestão a Vista"
          value={
            rowMesDestaque?.inadimplenciaPct != null &&
            rowMesDestaque.mes >= MES_INICIO_RESULTADO &&
            mesNoFiltro(rowMesDestaque.mes, mesFiltro, ano)
              ? formatPercent(rowMesDestaque.inadimplenciaPct)
              : '—'
          }
          icon={AlertTriangle}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Índice de Inadimplência no período selecionado"
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
          title="Saldo inadimplência (período selecionado)"
          value={
            data
              ? new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(
                  mesesEscopo.reduce(
                    (s: number, m: GestaoVistaMesRow) => s + (m.inadimplencia ?? 0),
                    0,
                  ),
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
