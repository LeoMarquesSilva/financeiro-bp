import { useMemo, useState } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_AGENDAMENTO,
  filtrarMensalPorMesFiltro,
  isAgendamentoVistagemIndisponivelPorArea,
  type MesFiltroEficiencia,
} from '../constants'
import { useAgendamento, useAgendamentoRanking } from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { AreaFilterButtons } from './AreaFilterButtons'
import { RacionalSheet } from './RacionalSheet'
import type { HeatCell } from './OverviewKpiHeatRow'

const BI_BAR = '#94a3b8'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

export function AgendamentoTab({ ano, mesFiltro }: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { data: mensal, loading } = useAgendamento(ano, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const { data: ranking, loading: loadingRanking } = useAgendamentoRanking(ano, mesFiltro, area)

  const indisponivel = isAgendamentoVistagemIndisponivelPorArea(area)
  const dentroPrazo = indisponivel ? 0 : mensalFiltrado.reduce((s, m) => s + m.dentro_prazo, 0)
  const foraPrazo = indisponivel ? 0 : mensalFiltrado.reduce((s, m) => s + m.fora_prazo, 0)
  const totalGeral = dentroPrazo + foraPrazo
  const pctGeral = !indisponivel && totalGeral > 0 ? (dentroPrazo / totalGeral) * 100 : null

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensalFiltrado.find((m) => m.mes === mesAtual)
  const areaHint = area ? `Área ${area}` : undefined

  const rankingFatal = useMemo(() => {
    const totalFora = ranking.reduce((s, r) => s + (r.fora_prazo ?? 0), 0)
    return ranking
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
  }, [ranking])

  const resultadoRacional: HeatCell | null =
    pctGeral != null ? { value: pctGeral, label: formatPercent(pctGeral) } : null

  return (
    <div className="space-y-5">
      <AreaFilterButtons
        value={area}
        onChange={setArea}
        allowedAreas={allowedAreas}
        allowTodas={allowTodas}
        ano={ano}
        mesFiltro={mesFiltro}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="SLA Ciência Agendamentos Gestão a Vista"
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_dentro_prazo) : '—'}
          hint={
            rowMesAtual
              ? `${rowMesAtual.dentro_prazo} de ${rowMesAtual.dentro_prazo + rowMesAtual.fora_prazo}`
              : 'sem dados'
          }
          icon={CalendarCheck2}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Agendamento/Ciência D+1 no período selecionado"
          value={pctGeral != null ? formatPercent(pctGeral) : '—'}
          hint={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : `${dentroPrazo} de ${totalGeral} tarefas dentro do prazo`
          }
          icon={CalendarCheck2}
          accentClass="bg-amber-100 text-amber-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Fora do prazo no período selecionado"
          value={String(foraPrazo)}
          icon={CalendarCheck2}
          accentClass="bg-rose-100 text-rose-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Agendamento / Ciência D+1"
        subtitle="% de tarefas concluídas dentro do prazo D+1"
        data={mensalFiltrado.map((m) => ({ mes: m.mes, valor: m.pct_dentro_prazo }))}
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
          emptyLabel={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : 'Sem fatals no período.'
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
          emptyLabel={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : 'Sem fatals no período.'
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
        resultado={resultadoRacional}
        metaAcumulado={95}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
