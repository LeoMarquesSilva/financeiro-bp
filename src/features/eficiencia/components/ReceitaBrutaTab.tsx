import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { GestaoVistaMesRow } from '@/features/receita/types/receita.types'
import {
  EFICIENCIA_META_RECEITA_BRUTA,
  MES_INICIO_RESULTADO,
  filtroEfetivoGestaoAVista,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import { buildOverviewReceitaBruta } from '../utils/overviewFinanceiroKpis'
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

export function ReceitaBrutaTab({
  ano,
  mesFiltro,
  responsavel,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { data, isLoading } = useOverviewFinanceiroKpis(ano)
  const overview = data
    ? buildOverviewReceitaBruta(data.meses, data.rows, ano, mesFiltro)
    : null
  const filtroGav = filtroEfetivoGestaoAVista(ano)
  const overviewGestaoVista = data
    ? buildOverviewReceitaBruta(data.meses, data.rows, ano, filtroGav)
    : null

  const mesesEscopo = (data?.meses ?? []).filter(
    (m: GestaoVistaMesRow) =>
      m.mes >= MES_INICIO_RESULTADO && mesNoFiltro(m.mes, mesFiltro, ano),
  )

  const chartData = mesesEscopo
    .filter((m: GestaoVistaMesRow) => m.pctMeta != null)
    .map((m: GestaoVistaMesRow) => ({
      mes: m.mes,
      valor: m.pctMeta!,
      meta: EFICIENCIA_META_RECEITA_BRUTA,
    }))

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
          title="Receita Bruta Gestão a Vista"
          value={
            overviewGestaoVista?.acumulado.value != null
              ? formatPercent(overviewGestaoVista.acumulado.value)
              : '—'
          }
          hint="Recebido ÷ meta · jun→hoje"
          icon={TrendingUp}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Receita Bruta no período selecionado"
          value={
            overview?.acumulado.value != null
              ? formatPercent(overview.acumulado.value)
              : '—'
          }
          hint="Recebido ÷ meta · meses filtrados"
          meta="Meta 100%"
          atingiuMeta={
            overview?.acumulado.value != null ? overview.acumulado.value >= 100 : null
          }
          icon={TrendingUp}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={isLoading}
        />
        <EficienciaKpiCard
          title="Recebido acumulado (período selecionado)"
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
        metaFixa={EFICIENCIA_META_RECEITA_BRUTA}
        onRacionalClick={() => setRacionalAberto(true)}
      />

      <RacionalSheet
        indicador={racionalAberto ? 'receita_bruta' : null}
        titulo="Receita Bruta"
        ano={ano}
        mes={mesFiltro}
        area={null}
        resultado={overview?.acumulado ?? null}
        metaAcumulado={EFICIENCIA_META_RECEITA_BRUTA}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
