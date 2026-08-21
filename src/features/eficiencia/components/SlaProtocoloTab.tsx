import { useMemo, useState } from 'react'
import { FileCheck2 } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_SLA_PROTOCOLO,
  filtrarMensalGestaoAVista,
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import {
  useSlaProtocolo,
  useSlaProtocoloDiario,
  useSlaProtocoloJustificativaFatal,
  useSlaProtocoloRankingFatal,
  useSlaProtocoloRankingFatalGrupo,
} from '../hooks/useEficiencia'
import { useEvolucaoPorResponsavel } from '../hooks/useEvolucaoPorResponsavel'
import { useEvolucaoDrilldownState } from '../hooks/useEvolucaoDrilldownState'
import { usePeriodoCurtoResumo } from '../hooks/usePeriodoCurtoResumo'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { totaisSlaProtocoloFromResumo } from '../utils/periodoCurtoIndicadorTotais'
import { toPriMaiuscula } from '../utils/textFormat'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EvolucaoDrilldownToolbar } from './EvolucaoDrilldownToolbar'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { RacionalSheet } from './RacionalSheet'
import type { HeatCell } from './OverviewKpiHeatRow'
import type { RacionalEscopo } from '../types/eficiencia.types'
import {
  emptyLabelDesvioResponsavel,
  rankingDesvioFiltrado,
} from '../utils/responsavelMatch'
import {
  buildEvolucaoDiarioChart,
  evolucaoDrilldownSubtitle,
  resolveEvolucaoDrilldownChart,
} from '../utils/evolucaoDrilldown'

/** Cor das barras no visual BI (cinza). */
const BI_BAR = '#94a3b8'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function SlaProtocoloTab({
  ano,
  mesFiltro,
  responsavel = null,
  onResponsavelChange,
  responsavelEnabled = true,
  responsavelHintDisabled,
}: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalEscopo, setRacionalEscopo] = useState<RacionalEscopo>('default')
  const [racionalAberto, setRacionalAberto] = useState(false)
  const [rankingPorGrupo, setRankingPorGrupo] = useState(false)

  const drill = useEvolucaoDrilldownState(mesFiltro, [mesFiltro, ano, area, responsavel])

  const { data: mensal, loading } = useSlaProtocolo(ano, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)

  const { data: ranking, loading: loadingRanking } = useSlaProtocoloRankingFatal(
    ano,
    mesFiltro,
    area,
  )
  const { data: rankingGrupo, loading: loadingRankingGrupo } =
    useSlaProtocoloRankingFatalGrupo(ano, mesFiltro, area)
  const { data: justificativas, loading: loadingJustificativas } =
    useSlaProtocoloJustificativaFatal(ano, mesFiltro, area)

  const mesDrillTarget = drill.mesDrillTarget

  const {
    chartData: evolucaoResp,
    chartDataDiario: evolucaoDiarioResp,
    acumulado: acumResp,
    loading: loadingEvol,
  } = useEvolucaoPorResponsavel(
    'sla_protocolo',
    ano,
    area,
    responsavel,
    mesFiltro,
    drill.chartGranularidade === 'dia' ? mesDrillTarget : null,
  )

  const periodoCurto = usePeriodoCurtoResumo(
    'sla_protocolo',
    ano,
    mesFiltro,
    area,
    responsavel,
  )

  const mensalGestaoVista = filtrarMensalGestaoAVista(mensal, ano)

  const periodoTotais = useMemo(() => {
    if (periodoCurto.periodoCurtoAtivo && periodoCurto.resumo) {
      return totaisSlaProtocoloFromResumo(periodoCurto.resumo)
    }

    const qtdD1 = mensalFiltrado.reduce((s, m) => s + m.qtd_d1, 0)
    const qtdTotal = mensalFiltrado.reduce((s, m) => s + m.qtd_total, 0)
    const qtdFatal = mensalFiltrado.reduce((s, m) => s + m.qtd_fatal, 0)
    return {
      qtdD1,
      qtdFatal,
      qtdTotal,
      qtdExcludente: mensalFiltrado.reduce((s, m) => s + (m.qtd_excludente ?? 0), 0),
      pctGeral: qtdTotal > 0 ? (qtdD1 / qtdTotal) * 100 : 0,
    }
  }, [periodoCurto.periodoCurtoAtivo, periodoCurto.resumo, mensalFiltrado])

  const qtdD1Area = periodoTotais.qtdD1
  const qtdTotalArea = periodoTotais.qtdTotal
  const qtdFatalArea = periodoTotais.qtdFatal
  const qtdExcludente = periodoTotais.qtdExcludente

  const qtdD1 =
    responsavel && !periodoCurto.periodoCurtoAtivo ? acumResp.ok : qtdD1Area
  const qtdTotal =
    responsavel && !periodoCurto.periodoCurtoAtivo ? acumResp.total : qtdTotalArea
  const qtdFatal =
    responsavel && !periodoCurto.periodoCurtoAtivo
      ? Math.max(0, acumResp.total - acumResp.ok)
      : qtdFatalArea
  const rankingFiltrado = rankingDesvioFiltrado(
    ranking,
    (r) => r.usuario,
    responsavel,
    responsavel && acumResp.total > 0
      ? { usuario: responsavel, qtd_fatal: qtdFatal, pct_do_total: 100 }
      : null,
  )
  const rankingDesvioRows = rankingPorGrupo
    ? rankingGrupo.map((r) => ({
        ...r,
        grupo_cliente: toPriMaiuscula(String(r.grupo_cliente ?? '')),
      }))
    : rankingFiltrado
  const rankingDesvioLabelKey = rankingPorGrupo ? 'grupo_cliente' : 'usuario'
  const rankingDesvioLoading = rankingPorGrupo ? loadingRankingGrupo : loadingRanking
  const rankingDesvioShowAvatars = !rankingPorGrupo
  const rankingDesvioEmptyLabel = rankingPorGrupo
    ? 'Sem dados no período.'
    : emptyLabelDesvioResponsavel(
        responsavel,
        Boolean(responsavel && acumResp.total > 0),
      )
  const toggleRankingGrupo = () => setRankingPorGrupo((v) => !v)
  const grupoClienteToggle = {
    active: rankingPorGrupo,
    onToggle: toggleRankingGrupo,
  }
  const pctGeral =
    responsavel && !periodoCurto.periodoCurtoAtivo
      ? qtdTotal > 0
        ? (qtdD1 / qtdTotal) * 100
        : 0
      : periodoTotais.pctGeral
  const metaAtual = mensalFiltrado.length
    ? mensalFiltrado[mensalFiltrado.length - 1]!.meta
    : null

  const qtdD1Gav = mensalGestaoVista.reduce((s, m) => s + m.qtd_d1, 0)
  const qtdTotalGav = mensalGestaoVista.reduce((s, m) => s + m.qtd_total, 0)
  const pctGestaoVista = qtdTotalGav > 0 ? (qtdD1Gav / qtdTotalGav) * 100 : null
  const metaGestaoVista = mensalGestaoVista.length
    ? mensalGestaoVista[mensalGestaoVista.length - 1]!.meta
    : null

  const areaHint = area ? `Área ${area}` : undefined
  const loadingPeriodo =
    loading ||
    periodoCurto.loading ||
    Boolean(responsavel && !periodoCurto.periodoCurtoAtivo && loadingEvol)

  function openRacional(escopo: RacionalEscopo = 'default') {
    setRacionalEscopo(escopo)
    setRacionalAberto(true)
  }

  const resultadoRacional: HeatCell = {
    value: pctGeral,
    label: formatPercent(pctGeral),
  }

  const metaRacional = metaAtual ?? EFICIENCIA_META_SLA_PROTOCOLO

  const { data: diario, loading: loadingDiario } = useSlaProtocoloDiario(
    ano,
    drill.chartGranularidade === 'dia' && !responsavel ? mesDrillTarget : null,
    area,
  )

  const chartDataMes = responsavel
    ? evolucaoResp.map((p) => ({
        mes: p.mes,
        valor: p.valor,
        meta: mensal.find((m) => m.mes === p.mes)?.meta ?? metaRacional,
      }))
    : mensalFiltrado.map((m) => ({
        mes: m.mes,
        valor: m.pct_eficiencia,
        meta: m.meta,
      }))

  const chartDataDiarioRpc = useMemo(
    () =>
      buildEvolucaoDiarioChart(
        diario.map((row) => ({
          dia: row.dia,
          total: row.qtd_total,
          pct: row.pct_eficiencia,
        })),
        metaRacional,
      ),
    [diario, metaRacional],
  )

  const chartDataDiarioResp = useMemo(
    () =>
      evolucaoDiarioResp.map((p) => ({
        mes: p.mes,
        label: p.label,
        valor: p.valor,
        meta: metaRacional,
      })),
    [evolucaoDiarioResp, metaRacional],
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
    '% de CIs concluídos dentro do prazo D-1, com meta vigente no período',
    `% D-1 do responsável · ${responsavel ?? ''}`,
    responsavel,
  )

  const loadingChart =
    loading ||
    Boolean(responsavel && loadingEvol) ||
    (drill.chartGranularidade === 'dia' && !responsavel && loadingDiario)

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

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="SLA de Protocolo Gestão a Vista"
          value={pctGestaoVista != null ? formatPercent(pctGestaoVista) : '—'}
          hint="Protocolos no prazo D-1 ÷ total · jun→hoje"
          meta={metaGestaoVista != null ? formatPercent(metaGestaoVista) : undefined}
          atingiuMeta={
            pctGestaoVista != null && metaGestaoVista != null
              ? pctGestaoVista >= metaGestaoVista
              : null
          }
          icon={FileCheck2}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
          scopeEquipe
          pessoaNome={responsavel}
        />
        <EficienciaKpiCard
          title="SLA de Protocolo no período selecionado"
          value={formatPercent(pctGeral)}
          hint="Protocolos no prazo D-1 ÷ total · meses filtrados"
          meta={metaAtual != null ? formatPercent(metaAtual) : undefined}
          atingiuMeta={metaAtual != null ? pctGeral >= metaAtual : null}
          icon={FileCheck2}
          accentClass="bg-violet-100 text-violet-700"
          loading={loadingPeriodo}
          pessoaNome={responsavel}
          currentPct={pctGeral}
          vsEquipePct={pctGestaoVista}
        />
        <EficienciaKpiCard
          title="FATAL no período selecionado"
          value={String(qtdFatal)}
          hint={
            responsavel
              ? 'FATAL do responsável no período'
              : `${qtdExcludente} excludente${qtdExcludente === 1 ? '' : 's'}`
          }
          icon={FileCheck2}
          accentClass="bg-rose-100 text-rose-700"
          loading={loadingPeriodo}
          reservePessoaSlot={Boolean(responsavel?.trim())}
        />
      </div>

      <EficienciaEvolucaoChart
        title="SLA de Protocolo (D-1 vs FATAL)"
        subtitle={chartSubtitle}
        data={loadingChart ? [] : chartData}
        color="#7c3aed"
        metaFixa={metaRacional}
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
        onRacionalClick={() => openRacional('default')}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <EficienciaRankingChart
          title="Justificativa de Fatal"
          subtitle={areaHint}
          rows={justificativas.map((j) => ({
            ...j,
            justificativa: toPriMaiuscula(String(j.justificativa ?? '')),
          }))}
          labelKey="justificativa"
          valueKey="qtd"
          valueLabel="Qtd"
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          loading={loadingJustificativas}
          maxItems={9}
          scrollAll
          onRacionalClick={() => openRacional('sla_protocolo_fatal')}
        />
        <EficienciaRankingChart
          title={rankingPorGrupo ? '% Desvio Grupo Cliente' : '% Desvio Responsáveis'}
          subtitle={areaHint}
          rows={rankingDesvioRows}
          labelKey={rankingDesvioLabelKey}
          valueKey="pct_do_total"
          valueLabel="% do total"
          formatValue={(v) => formatPercent(v)}
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          showAvatars={rankingDesvioShowAvatars}
          loading={rankingDesvioLoading}
          maxItems={9}
          scrollAll
          emptyLabel={rankingDesvioEmptyLabel}
          onRacionalClick={() => openRacional('sla_protocolo_fatal')}
          grupoClienteToggle={grupoClienteToggle}
        />
        <EficienciaRankingChart
          title={rankingPorGrupo ? 'Qtd Desvio Grupo Cliente' : 'Qtd Desvio Responsáveis'}
          subtitle={areaHint}
          rows={rankingDesvioRows}
          labelKey={rankingDesvioLabelKey}
          valueKey="qtd_fatal"
          valueLabel="Desvio"
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          showAvatars={rankingDesvioShowAvatars}
          loading={rankingDesvioLoading}
          maxItems={9}
          scrollAll
          emptyLabel={rankingDesvioEmptyLabel}
          onRacionalClick={() => openRacional('sla_protocolo_fatal')}
          grupoClienteToggle={grupoClienteToggle}
        />
      </div>

      <RacionalSheet
        indicador={racionalAberto ? 'sla_protocolo' : null}
        titulo={
          racionalEscopo === 'sla_protocolo_fatal'
            ? 'FATAL não-excludente'
            : 'SLA PROTOCOLO'
        }
        ano={ano}
        mes={mesFiltro}
        area={area}
        escopo={racionalEscopo}
        responsavel={responsavel}
        resultado={racionalEscopo === 'default' ? resultadoRacional : null}
        metaAcumulado={racionalEscopo === 'default' ? metaRacional : null}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
