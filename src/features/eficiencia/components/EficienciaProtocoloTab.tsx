import { useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
  filtrarMensalGestaoAVista,
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import {
  useEficienciaProtocolo,
  useEficienciaProtocoloDiario,
  useEficienciaProtocoloRanking,
} from '../hooks/useEficiencia'
import { useEvolucaoPorResponsavel } from '../hooks/useEvolucaoPorResponsavel'
import { useEvolucaoDrilldownState } from '../hooks/useEvolucaoDrilldownState'
import { usePeriodoCurtoResumo } from '../hooks/usePeriodoCurtoResumo'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { totaisEficienciaProtocoloFromResumo } from '../utils/periodoCurtoIndicadorTotais'
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
import type { EficienciaProtocoloDiaRow } from '../types/eficiencia.types'
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

export function EficienciaProtocoloTab({
  ano,
  mesFiltro,
  responsavel = null,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const drill = useEvolucaoDrilldownState(mesFiltro, [mesFiltro, ano, area, responsavel])
  const mesDrillTarget = drill.mesDrillTarget

  const { data: mensal, loading } = useEficienciaProtocolo(ano, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const mensalGestaoVista = filtrarMensalGestaoAVista(mensal, ano)
  const { data: ranking, loading: loadingRanking } = useEficienciaProtocoloRanking(
    ano,
    mesFiltro,
    area,
  )
  const {
    chartData: evolucaoResp,
    chartDataDiario: evolucaoDiarioResp,
    acumulado: acumResp,
    loading: loadingEvol,
  } = useEvolucaoPorResponsavel(
    'eficiencia_protocolo',
    ano,
    area,
    responsavel,
    mesFiltro,
    drill.chartGranularidade === 'dia' ? mesDrillTarget : null,
  )

  const { data: diario, loading: loadingDiario } = useEficienciaProtocoloDiario(
    ano,
    drill.chartGranularidade === 'dia' && !responsavel ? mesDrillTarget : null,
    area,
  )

  const periodoCurto = usePeriodoCurtoResumo(
    'eficiencia_protocolo',
    ano,
    mesFiltro,
    area,
    responsavel,
  )

  const periodoTotais = useMemo(() => {
    if (periodoCurto.periodoCurtoAtivo && periodoCurto.resumo) {
      return totaisEficienciaProtocoloFromResumo(periodoCurto.resumo)
    }
    const semInconsistencia = mensalFiltrado.reduce((s, m) => s + m.sem_inconsistencia, 0)
    const total = mensalFiltrado.reduce((s, m) => s + m.total, 0)
    return {
      semInconsistencia,
      total,
      inconsistentes: Math.max(0, total - semInconsistencia),
      pctGeral: total > 0 ? (semInconsistencia / total) * 100 : 0,
    }
  }, [periodoCurto.periodoCurtoAtivo, periodoCurto.resumo, mensalFiltrado])

  const semInconsistenciaArea = periodoTotais.semInconsistencia
  const totalArea = periodoTotais.total
  const semInconsistencia =
    responsavel && !periodoCurto.periodoCurtoAtivo ? acumResp.ok : semInconsistenciaArea
  const total =
    responsavel && !periodoCurto.periodoCurtoAtivo ? acumResp.total : totalArea
  const inconsistentes =
    responsavel && !periodoCurto.periodoCurtoAtivo
      ? Math.max(0, acumResp.total - acumResp.ok)
      : periodoTotais.inconsistentes
  const rankingFiltrado = rankingDesvioFiltrado(
    ranking,
    (r) => r.usuario,
    responsavel,
    responsavel && acumResp.total > 0
      ? {
          usuario: responsavel,
          qtd_inconsistencia: inconsistentes,
          pct_do_total: 100,
        }
      : null,
  )
  const pctGeral =
    responsavel && !periodoCurto.periodoCurtoAtivo
      ? total > 0
        ? (semInconsistencia / total) * 100
        : 0
      : periodoTotais.pctGeral

  const semInconsistenciaGav = mensalGestaoVista.reduce((s, m) => s + m.sem_inconsistencia, 0)
  const totalGav = mensalGestaoVista.reduce((s, m) => s + m.total, 0)
  const pctGestaoVista = totalGav > 0 ? (semInconsistenciaGav / totalGav) * 100 : null
  const areaHint = area ? `Área ${area}` : undefined
  const loadingPeriodo =
    loading ||
    periodoCurto.loading ||
    Boolean(responsavel && !periodoCurto.periodoCurtoAtivo && loadingEvol)

  const chartDataMes = responsavel
    ? evolucaoResp.map((p) => ({ mes: p.mes, valor: p.valor, meta: EFICIENCIA_META_EFICIENCIA_PROTOCOLO }))
    : mensalFiltrado.map((m) => ({
        mes: m.mes,
        valor: m.pct_eficiencia,
        meta: EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
      }))

  const chartDataDiarioRpc = useMemo(
    () =>
      buildEvolucaoDiarioChart(
        diario.map((row: EficienciaProtocoloDiaRow) => ({
          dia: row.dia,
          total: row.total,
          pct: row.pct_eficiencia,
        })),
        EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
      ),
    [diario],
  )

  const chartDataDiarioResp = useMemo(
    () =>
      evolucaoDiarioResp.map((p) => ({
        mes: p.mes,
        label: p.label,
        valor: p.valor,
        meta: EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
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
    '% de protocolos sem inconsistência jurídica',
    `% sem inconsistência · ${responsavel ?? ''}`,
    responsavel,
  )

  const loadingChart =
    loading ||
    Boolean(responsavel && loadingEvol) ||
    (drill.chartGranularidade === 'dia' && !responsavel && loadingDiario)

  const resultadoRacional: HeatCell = {
    value: pctGeral,
    label: formatPercent(pctGeral),
  }

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
          title="Eficiência de Protocolo Gestão a Vista"
          value={pctGestaoVista != null ? formatPercent(pctGestaoVista) : '—'}
          hint="Protocolos sem inconsistência ÷ total · jun→hoje"
          icon={ClipboardCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
          scopeEquipe
          pessoaNome={responsavel}
        />
        <EficienciaKpiCard
          title="Eficiência de Protocolo no período selecionado"
          value={formatPercent(pctGeral)}
          hint="Protocolos sem inconsistência ÷ total · meses filtrados"
          icon={ClipboardCheck}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loadingPeriodo}
          pessoaNome={responsavel}
          currentPct={pctGeral}
          vsEquipePct={pctGestaoVista}
        />
        <EficienciaKpiCard
          title="Protocolos no período selecionado"
          value={String(total)}
          hint={
            total > 0
              ? `${inconsistentes} inconsistente${inconsistentes === 1 ? '' : 's'}`
              : 'sem protocolos'
          }
          icon={ClipboardCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loadingPeriodo}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Eficiência de Protocolo"
        subtitle={chartSubtitle}
        data={loadingChart ? [] : chartData}
        color="#059669"
        metaFixa={EFICIENCIA_META_EFICIENCIA_PROTOCOLO}
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
        onRacionalClick={() => setRacionalAberto(true)}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EficienciaRankingChart
          title="% Desvio Responsáveis"
          subtitle={areaHint}
          rows={rankingFiltrado}
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
          emptyLabel={emptyLabelDesvioResponsavel(
            responsavel,
            Boolean(responsavel && acumResp.total > 0),
          )}
          onRacionalClick={() => setRacionalAberto(true)}
        />
        <EficienciaRankingChart
          title="Qtd Desvio Responsáveis"
          subtitle={areaHint}
          rows={rankingFiltrado}
          valueKey="qtd_inconsistencia"
          valueLabel="Inconsistências"
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          showAvatars
          loading={loadingRanking}
          maxItems={9}
          scrollAll
          emptyLabel={emptyLabelDesvioResponsavel(
            responsavel,
            Boolean(responsavel && acumResp.total > 0),
          )}
          onRacionalClick={() => setRacionalAberto(true)}
        />
      </div>

      <RacionalSheet
        indicador={racionalAberto ? 'eficiencia_protocolo' : null}
        titulo="Eficiência Protocolo"
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
