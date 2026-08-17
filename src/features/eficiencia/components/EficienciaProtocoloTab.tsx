import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
  filtrarMensalGestaoAVista,
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useEficienciaProtocolo, useEficienciaProtocoloRanking } from '../hooks/useEficiencia'
import { useEvolucaoPorResponsavel } from '../hooks/useEvolucaoPorResponsavel'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { RacionalSheet } from './RacionalSheet'
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
    acumulado: acumResp,
    loading: loadingEvol,
  } = useEvolucaoPorResponsavel('eficiencia_protocolo', ano, area, responsavel, mesFiltro)

  const semInconsistenciaArea = mensalFiltrado.reduce((s, m) => s + m.sem_inconsistencia, 0)
  const totalArea = mensalFiltrado.reduce((s, m) => s + m.total, 0)
  const semInconsistencia = responsavel ? acumResp.ok : semInconsistenciaArea
  const total = responsavel ? acumResp.total : totalArea
  const inconsistentes = Math.max(0, total - semInconsistencia)
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
  const pctGeral = total > 0 ? (semInconsistencia / total) * 100 : 0

  const semInconsistenciaGav = mensalGestaoVista.reduce((s, m) => s + m.sem_inconsistencia, 0)
  const totalGav = mensalGestaoVista.reduce((s, m) => s + m.total, 0)
  const pctGestaoVista = totalGav > 0 ? (semInconsistenciaGav / totalGav) * 100 : null
  const areaHint = area ? `Área ${area}` : undefined
  const loadingPeriodo = loading || Boolean(responsavel && loadingEvol)

  const chartData = responsavel
    ? evolucaoResp
    : mensalFiltrado.map((m) => ({ mes: m.mes, valor: m.pct_eficiencia }))

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
        subtitle={
          responsavel
            ? `% sem inconsistência · ${responsavel}`
            : '% de protocolos sem inconsistência jurídica'
        }
        data={chartData}
        color="#059669"
        metaFixa={EFICIENCIA_META_EFICIENCIA_PROTOCOLO}
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
