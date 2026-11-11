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
import {
  buildOverviewReceitaBruta,
  receitaBrutaMonetarioAcumulado,
} from '../utils/overviewFinanceiroKpis'
import {
  explicarReceitaBrutaPct,
  explicarReceitaBrutaRecebido,
  modoReceitaBruta,
  rotuloPeriodoEficiencia,
  TELA_EFICIENCIA_PESSOAS,
} from '../fenix/eficienciaPessoasFinanceiroFenix'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { explicarGraficoReceitaBruta } from '../fenix/eficienciaGraficosFenix'
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

  const recebidoAcumulado = mesesEscopo.reduce(
    (s: number, m: GestaoVistaMesRow) => s + (m.recebido ?? 0),
    0,
  )

  /** Fênix: mesma conta do card (recebido e meta de receitaBrutaMonetarioAcumulado). */
  const explicarPct = (escopo: 'gestao_vista' | 'periodo') => () => {
    const filtro: MesFiltroEficiencia = escopo === 'gestao_vista' ? filtroGav : mesFiltro
    const card = escopo === 'gestao_vista' ? overviewGestaoVista : overview
    const meses = data?.meses ?? []
    const rows = data?.rows ?? []
    const monetario = data ? receitaBrutaMonetarioAcumulado(meses, rows, ano, filtro) : null
    const { modo, meses: mesesConta } = modoReceitaBruta(filtro, ano, meses)
    return explicarReceitaBrutaPct({
      ano,
      escopo,
      pct: card?.acumulado.value ?? null,
      recebido: monetario?.recebido ?? null,
      meta: monetario?.meta ?? null,
      modo,
      mesesConta,
      meses,
      rows,
      periodo: rotuloPeriodoEficiencia(mesFiltro, ano),
    })
  }

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
          fenix={{ chave: 'eficiencia.receita-bruta.gestao-vista', explicar: explicarPct('gestao_vista') }}
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
          fenix={{ chave: 'eficiencia.receita-bruta.periodo', explicar: explicarPct('periodo') }}
        />
        <EficienciaKpiCard
          title="Recebido acumulado (período selecionado)"
          value={
            data
              ? new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(recebidoAcumulado)
              : '—'
          }
          icon={TrendingUp}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading}
          fenix={{
            chave: 'eficiencia.receita-bruta.recebido',
            explicar: () =>
              explicarReceitaBrutaRecebido({
                ano,
                meses: mesesEscopo,
                total: recebidoAcumulado,
                periodo: rotuloPeriodoEficiencia(mesFiltro, ano),
              }),
          }}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Receita Bruta"
        subtitle="% recebido ÷ meta mensal (a partir de junho)"
        data={chartData}
        fenix={{
          chave: 'eficiencia.receita-bruta.grafico',
          explicar: (ponto) =>
            explicarGraficoReceitaBruta(
              {
                tela: TELA_EFICIENCIA_PESSOAS.receitaBruta,
                ano,
                mesFiltro,
                data: chartData,
                meses: data?.meses ?? [],
                rows: data?.rows ?? [],
                metaFixa: EFICIENCIA_META_RECEITA_BRUTA,
              },
              ponto,
            ),
        }}
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
