import { useMemo, useState } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_AGENDAMENTO,
  filtrarMensalGestaoAVista,
  filtrarMensalPorMesFiltro,
  isAgendamentoVistagemIndisponivelPorArea,
  type MesFiltroEficiencia,
} from '../constants'
import { useAgendamento, useAgendamentoDiario, useAgendamentoRanking } from '../hooks/useEficiencia'
import { useEvolucaoPorResponsavel } from '../hooks/useEvolucaoPorResponsavel'
import { useEvolucaoDrilldownState } from '../hooks/useEvolucaoDrilldownState'
import { usePeriodoCurtoResumo } from '../hooks/usePeriodoCurtoResumo'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { totaisAgendamentoFromResumo } from '../utils/periodoCurtoIndicadorTotais'
import {
  buildEvolucaoDiarioChart,
  evolucaoDrilldownSubtitle,
  resolveEvolucaoDrilldownChart,
} from '../utils/evolucaoDrilldown'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EvolucaoDrilldownToolbar } from './EvolucaoDrilldownToolbar'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { RacionalSheet } from './RacionalSheet'
import type { AgendamentoDiaRow } from '../types/eficiencia.types'
import type { HeatCell } from './OverviewKpiHeatRow'
import {
  emptyLabelDesvioResponsavel,
  rankingDesvioFiltrado,
} from '../utils/responsavelMatch'

const BI_BAR = '#94a3b8'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function AgendamentoTab({
  ano,
  mesFiltro,
  responsavel = null,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const indisponivel = isAgendamentoVistagemIndisponivelPorArea(area)
  const drill = useEvolucaoDrilldownState(
    mesFiltro,
    [mesFiltro, ano, area, responsavel],
    indisponivel,
  )
  const mesDrillTarget = drill.mesDrillTarget

  const { data: mensal, loading } = useAgendamento(ano, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const { data: ranking, loading: loadingRanking } = useAgendamentoRanking(ano, mesFiltro, area)
  const {
    chartData: evolucaoResp,
    chartDataDiario: evolucaoDiarioResp,
    acumulado: acumResp,
    loading: loadingEvol,
  } = useEvolucaoPorResponsavel(
    'sla_ciencia_agendamentos',
    ano,
    area,
    responsavel,
    mesFiltro,
    drill.chartGranularidade === 'dia' ? mesDrillTarget : null,
  )

  const { data: diario, loading: loadingDiario } = useAgendamentoDiario(
    ano,
    drill.chartGranularidade === 'dia' && !responsavel ? mesDrillTarget : null,
    area,
  )

  const mensalGestaoVista = filtrarMensalGestaoAVista(mensal, ano)

  const periodoCurto = usePeriodoCurtoResumo(
    'sla_ciencia_agendamentos',
    ano,
    mesFiltro,
    area,
    responsavel,
  )

  const periodoTotais = useMemo(() => {
    if (periodoCurto.periodoCurtoAtivo && periodoCurto.resumo) {
      return totaisAgendamentoFromResumo(periodoCurto.resumo)
    }
    const dentroPrazo = mensalFiltrado.reduce((s, m) => s + m.dentro_prazo, 0)
    const foraPrazo = mensalFiltrado.reduce((s, m) => s + m.fora_prazo, 0)
    const total = dentroPrazo + foraPrazo
    return {
      dentroPrazo,
      foraPrazo,
      total,
      pctGeral: total > 0 ? (dentroPrazo / total) * 100 : null,
    }
  }, [periodoCurto.periodoCurtoAtivo, periodoCurto.resumo, mensalFiltrado])

  const dentroPrazo = indisponivel
    ? 0
    : responsavel && !periodoCurto.periodoCurtoAtivo
      ? acumResp.ok
      : periodoTotais.dentroPrazo
  const foraPrazo = indisponivel
    ? 0
    : responsavel && !periodoCurto.periodoCurtoAtivo
      ? Math.max(0, acumResp.total - acumResp.ok)
      : periodoTotais.foraPrazo
  const total = dentroPrazo + foraPrazo
  const pctGeral =
    !indisponivel && responsavel && !periodoCurto.periodoCurtoAtivo
      ? total > 0
        ? (dentroPrazo / total) * 100
        : null
      : indisponivel
        ? null
        : periodoTotais.pctGeral

  const dentroPrazoGav = indisponivel
    ? 0
    : mensalGestaoVista.reduce((s, m) => s + m.dentro_prazo, 0)
  const foraPrazoGav = indisponivel
    ? 0
    : mensalGestaoVista.reduce((s, m) => s + m.fora_prazo, 0)
  const totalGav = dentroPrazoGav + foraPrazoGav
  const pctGestaoVista =
    !indisponivel && totalGav > 0 ? (dentroPrazoGav / totalGav) * 100 : null
  const areaHint = area ? `Área ${area}` : undefined
  const loadingPeriodo =
    loading ||
    periodoCurto.loading ||
    Boolean(responsavel && !periodoCurto.periodoCurtoAtivo && loadingEvol)

  const chartDataMes = responsavel
    ? evolucaoResp.map((p) => ({ mes: p.mes, valor: p.valor, meta: EFICIENCIA_META_AGENDAMENTO }))
    : mensalFiltrado.map((m) => ({
        mes: m.mes,
        valor: m.pct_dentro_prazo,
        meta: EFICIENCIA_META_AGENDAMENTO,
      }))

  const chartDataDiarioRpc = useMemo(
    () =>
      buildEvolucaoDiarioChart(
        diario.map((row: AgendamentoDiaRow) => ({
          dia: row.dia,
          total: row.total,
          pct: row.pct_dentro_prazo,
        })),
        EFICIENCIA_META_AGENDAMENTO,
      ),
    [diario],
  )

  const chartDataDiarioResp = useMemo(
    () =>
      evolucaoDiarioResp.map((p) => ({
        mes: p.mes,
        label: p.label,
        valor: p.valor,
        meta: EFICIENCIA_META_AGENDAMENTO,
      })),
    [evolucaoDiarioResp],
  )

  const chartData = resolveEvolucaoDrilldownChart({
    granularidade: drill.chartGranularidade,
    mesDrillTarget,
    responsavel,
    chartDataMes,
    chartDataDiarioResp,
    chartDataDiarioRpc,
  })

  const selectedChartIndex =
    drill.chartGranularidade === 'mes' && drill.mesClicadoGrafico != null
      ? chartDataMes.findIndex((point) => point.mes === drill.mesClicadoGrafico)
      : null

  const chartSubtitle = evolucaoDrilldownSubtitle(
    drill.chartGranularidade,
    mesDrillTarget,
    ano,
    '% de tarefas concluídas dentro do prazo D+1',
    `% no prazo · ${responsavel ?? ''}`,
    responsavel,
  )

  const loadingChart =
    loading ||
    Boolean(responsavel && loadingEvol) ||
    (drill.chartGranularidade === 'dia' && !responsavel && loadingDiario)

  const rankingFatal = useMemo(() => {
    const rankingFiltrado = rankingDesvioFiltrado(
      ranking,
      (r) => r.usuario,
      responsavel,
      responsavel && acumResp.total > 0
        ? {
            usuario: responsavel,
            dentro_prazo: dentroPrazo,
            fora_prazo: foraPrazo,
            pct_do_total: 100,
          }
        : null,
    )
    const totalFora = rankingFiltrado.reduce((s, r) => s + (r.fora_prazo ?? 0), 0)
    return rankingFiltrado
      .filter((r) => (r.fora_prazo ?? 0) > 0)
      .map((r) => ({
        usuario: r.usuario,
        qtd_fatal: r.fora_prazo ?? 0,
        pct_do_total:
          totalFora > 0
            ? Math.round(((r.fora_prazo ?? 0) / totalFora) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.qtd_fatal - a.qtd_fatal)
  }, [ranking, responsavel, acumResp.total, dentroPrazo, foraPrazo])

  const resultadoRacional: HeatCell | null =
    pctGeral != null ? { value: pctGeral, label: formatPercent(pctGeral) } : null

  return (
    <div className="space-y-5">
      <EficienciaDetailFilters
        ano={ano}
        mesFiltro={mesFiltro}
        area={area}
        onAreaChange={setArea}
        allowedAreas={allowedAreas}
        allowTodas={allowTodas}
        responsavel={responsavel}
        onResponsavelChange={onResponsavelChange ?? (() => undefined)}
        responsavelEnabled={responsavelEnabled}
        responsavelHintDisabled={responsavelHintDisabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="SLA Ciência Agendamentos Gestão a Vista"
          value={pctGestaoVista != null ? formatPercent(pctGestaoVista) : '—'}
          hint={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : 'Ciência no D+1 ÷ tarefas · jun→hoje'
          }
          icon={CalendarCheck2}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
          scopeEquipe
          pessoaNome={responsavel}
        />
        <EficienciaKpiCard
          title="Agendamento/Ciência D+1 no período selecionado"
          value={pctGeral != null ? formatPercent(pctGeral) : '—'}
          hint={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : 'Ciência no D+1 ÷ tarefas · meses filtrados'
          }
          icon={CalendarCheck2}
          accentClass="bg-amber-100 text-amber-700"
          loading={loadingPeriodo}
          pessoaNome={responsavel}
          currentPct={pctGeral}
          vsEquipePct={pctGestaoVista}
        />
        <EficienciaKpiCard
          title="Fora do prazo no período selecionado"
          value={String(foraPrazo)}
          icon={CalendarCheck2}
          accentClass="bg-rose-100 text-rose-700"
          loading={loadingPeriodo}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Agendamento / Ciência D+1"
        subtitle={chartSubtitle}
        data={loadingChart ? [] : chartData}
        color="#d97706"
        metaFixa={EFICIENCIA_META_AGENDAMENTO}
        granularidade={drill.chartGranularidade}
        selectedIndex={selectedChartIndex != null && selectedChartIndex >= 0 ? selectedChartIndex : null}
        onPointClick={drill.onPointClickMes}
        toolbarExtra={
          <EvolucaoDrilldownToolbar
            granularidade={drill.chartGranularidade}
            drillDisponivel={drill.drillDisponivel}
            mesDrillTarget={mesDrillTarget}
            mesFiltro={mesFiltro}
            onPorDia={() => drill.setChartGranularidade('dia')}
            onPorMes={() => drill.setChartGranularidade('mes')}
          />
        }
        onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EficienciaRankingChart
          title="% Desvio Responsáveis"
          subtitle={areaHint}
          rows={rankingFatal}
          valueKey="pct_do_total"
          valueLabel="% do total"
          formatValue={(v) => formatPercent(v)}
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          showAvatars
          loading={loadingRanking}
          maxItems={9}
          scrollAll
          emptyLabel={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : emptyLabelDesvioResponsavel(
                  responsavel,
                  Boolean(responsavel && acumResp.total > 0),
                  'Sem fatals no período.',
                )
          }
          onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
        />
        <EficienciaRankingChart
          title="Qtd Desvio Responsáveis"
          subtitle={areaHint}
          rows={rankingFatal}
          valueKey="qtd_fatal"
          valueLabel="Fora do prazo"
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          showAvatars
          loading={loadingRanking}
          maxItems={9}
          scrollAll
          emptyLabel={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : emptyLabelDesvioResponsavel(
                  responsavel,
                  Boolean(responsavel && acumResp.total > 0),
                  'Sem fatals no período.',
                )
          }
          onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
        />
      </div>

      <RacionalSheet
        indicador={racionalAberto ? 'sla_ciencia_agendamentos' : null}
        titulo="SLA Ciência Agendamentos"
        ano={ano}
        mes={mesFiltro}
        area={area}
        responsavel={responsavel}
        resultado={resultadoRacional}
        metaAcumulado={95}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
