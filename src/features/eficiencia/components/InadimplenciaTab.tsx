import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { GestaoVistaMesRow } from '@/features/receita/types/receita.types'
import {
  MES_INICIO_RESULTADO,
  filtroEfetivoGestaoAVista,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import { buildOverviewInadimplencia } from '../utils/overviewFinanceiroKpis'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { RacionalSheet } from './RacionalSheet'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function InadimplenciaTab({
  ano,
  mesFiltro,
  responsavel,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { data, isLoading } = useOverviewFinanceiroKpis(ano)
  const overview = data ? buildOverviewInadimplencia(data.meses, mesFiltro, ano) : null
  const filtroGav = filtroEfetivoGestaoAVista(ano)
  const overviewGestaoVista = data
    ? buildOverviewInadimplencia(data.meses, filtroGav, ano)
    : null

  const mesesEscopo = (data?.meses ?? []).filter(
    (m: GestaoVistaMesRow) =>
      m.mes >= MES_INICIO_RESULTADO && mesNoFiltro(m.mes, mesFiltro, ano),
  )

  const chartData = mesesEscopo
    .filter((m: GestaoVistaMesRow) => m.inadimplenciaPct != null)
    .map((m: GestaoVistaMesRow) => ({ mes: m.mes, valor: m.inadimplenciaPct! }))

  return (
    <div className="space-y-5">
      <EficienciaDetailFilters
        ano={ano}
        showArea={false}
        responsavel={responsavel ?? null}
        onResponsavelChange={onResponsavelChange ?? (() => undefined)}
        responsavelEnabled={responsavelEnabled ?? false}
        responsavelHintDisabled={responsavelHintDisabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Índice de Inadimplência Gestão a Vista"
          value={
            overviewGestaoVista?.acumulado.value != null
              ? formatPercent(overviewGestaoVista.acumulado.value)
              : '—'
          }
          hint="Saldo ÷ previsto · jun→hoje"
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
          hint="Saldo ÷ previsto · meses filtrados"
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
        onRacionalClick={() => setRacionalAberto(true)}
      />

      <RacionalSheet
        indicador={racionalAberto ? 'indice_inadimplencia' : null}
        titulo="Índice de Inadimplência"
        ano={ano}
        mes={mesFiltro}
        area={null}
        resultado={overview?.acumulado ?? null}
        metaAcumulado={Infinity}
        metaLabel="Meta x"
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
