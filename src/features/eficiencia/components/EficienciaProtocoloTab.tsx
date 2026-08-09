import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useEficienciaProtocolo, useEficienciaProtocoloRanking } from '../hooks/useEficiencia'
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

export function EficienciaProtocoloTab({ ano, mesFiltro }: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { data: mensal, loading } = useEficienciaProtocolo(ano, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const { data: ranking, loading: loadingRanking } = useEficienciaProtocoloRanking(
    ano,
    mesFiltro,
    area,
  )

  const semInconsistencia = mensalFiltrado.reduce((s, m) => s + m.sem_inconsistencia, 0)
  const total = mensalFiltrado.reduce((s, m) => s + m.total, 0)
  const pctGeral = total > 0 ? (semInconsistencia / total) * 100 : 0

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensalFiltrado.find((m) => m.mes === mesAtual)
  const areaHint = area ? `Área ${area}` : undefined

  const resultadoRacional: HeatCell = {
    value: pctGeral,
    label: formatPercent(pctGeral),
  }

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
          title="Eficiência de Protocolo Gestão a Vista"
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_eficiencia) : '—'}
          hint={rowMesAtual ? `${rowMesAtual.total} protocolos no mês` : 'sem dados'}
          icon={ClipboardCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Eficiência de Protocolo no período selecionado"
          value={formatPercent(pctGeral)}
          hint={`${semInconsistencia} de ${total} protocolos sem inconsistência`}
          icon={ClipboardCheck}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Protocolos no período selecionado"
          value={String(total)}
          icon={ClipboardCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Eficiência de Protocolo"
        subtitle="% de protocolos sem inconsistência jurídica"
        data={mensalFiltrado.map((m) => ({ mes: m.mes, valor: m.pct_eficiencia }))}
        color="#059669"
        metaFixa={EFICIENCIA_META_EFICIENCIA_PROTOCOLO}
        onRacionalClick={() => setRacionalAberto(true)}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EficienciaRankingChart
          title="% Desvio Responsáveis"
          subtitle={areaHint}
          rows={ranking}
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
          onRacionalClick={() => setRacionalAberto(true)}
        />
        <EficienciaRankingChart
          title="Qtd Desvio Responsáveis"
          subtitle={areaHint}
          rows={ranking}
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
          onRacionalClick={() => setRacionalAberto(true)}
        />
      </div>

      <RacionalSheet
        indicador={racionalAberto ? 'eficiencia_protocolo' : null}
        titulo="Eficiência Protocolo"
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
