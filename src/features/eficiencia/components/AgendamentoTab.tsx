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
import { useAgendamento, useAgendamentoRanking } from '../hooks/useEficiencia'
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
  const { data: mensal, loading } = useAgendamento(ano, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const { data: ranking, loading: loadingRanking } = useAgendamentoRanking(ano, mesFiltro, area)
  const {
    chartData: evolucaoResp,
    acumulado: acumResp,
    loading: loadingEvol,
  } = useEvolucaoPorResponsavel(
    'sla_ciencia_agendamentos',
    ano,
    area,
    responsavel,
    mesFiltro,
  )

  const indisponivel = isAgendamentoVistagemIndisponivelPorArea(area)
  const mensalGestaoVista = filtrarMensalGestaoAVista(mensal, ano)

  const dentroPrazo = indisponivel
    ? 0
    : responsavel
      ? acumResp.ok
      : mensalFiltrado.reduce((s, m) => s + m.dentro_prazo, 0)
  const foraPrazo = indisponivel
    ? 0
    : responsavel
      ? Math.max(0, acumResp.total - acumResp.ok)
      : mensalFiltrado.reduce((s, m) => s + m.fora_prazo, 0)
  const total = dentroPrazo + foraPrazo
  const pctGeral = !indisponivel && total > 0 ? (dentroPrazo / total) * 100 : null

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
  const loadingPeriodo = loading || Boolean(responsavel && loadingEvol)

  const chartData = responsavel
    ? evolucaoResp
    : mensalFiltrado.map((m) => ({ mes: m.mes, valor: m.pct_dentro_prazo }))

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
        subtitle={
          responsavel
            ? `% no prazo · ${responsavel}`
            : '% de tarefas concluídas dentro do prazo D+1'
        }
        data={chartData}
        color="#d97706"
        metaFixa={EFICIENCIA_META_AGENDAMENTO}
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
