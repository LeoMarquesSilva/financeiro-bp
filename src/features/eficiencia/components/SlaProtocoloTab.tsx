import { useState } from 'react'
import { FileCheck2 } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_SLA_PROTOCOLO,
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { toPriMaiuscula } from '../utils/textFormat'
import {
  useSlaProtocolo,
  useSlaProtocoloJustificativaFatal,
  useSlaProtocoloRankingFatal,
} from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { AreaFilterButtons } from './AreaFilterButtons'
import { RacionalSheet } from './RacionalSheet'
import type { HeatCell } from './OverviewKpiHeatRow'
import type { RacionalEscopo } from '../types/eficiencia.types'

/** Cor das barras no visual BI (cinza). */
const BI_BAR = '#94a3b8'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

export function SlaProtocoloTab({ ano, mesFiltro }: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalEscopo, setRacionalEscopo] = useState<RacionalEscopo>('default')
  const [racionalAberto, setRacionalAberto] = useState(false)

  const { data: mensal, loading } = useSlaProtocolo(ano, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)

  const { data: ranking, loading: loadingRanking } = useSlaProtocoloRankingFatal(
    ano,
    mesFiltro,
    area,
  )
  const { data: justificativas, loading: loadingJustificativas } =
    useSlaProtocoloJustificativaFatal(ano, mesFiltro, area)

  const qtdD1 = mensalFiltrado.reduce((s, m) => s + m.qtd_d1, 0)
  const qtdTotal = mensalFiltrado.reduce((s, m) => s + m.qtd_total, 0)
  const qtdFatal = mensalFiltrado.reduce((s, m) => s + m.qtd_fatal, 0)
  const qtdExcludente = mensalFiltrado.reduce((s, m) => s + (m.qtd_excludente ?? 0), 0)
  const pctGeral = qtdTotal > 0 ? (qtdD1 / qtdTotal) * 100 : 0
  const metaAtual = mensalFiltrado.length
    ? mensalFiltrado[mensalFiltrado.length - 1]!.meta
    : null

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensalFiltrado.find((m) => m.mes === mesAtual)

  const areaHint = area ? `Área ${area}` : undefined

  function openRacional(escopo: RacionalEscopo = 'default') {
    setRacionalEscopo(escopo)
    setRacionalAberto(true)
  }

  const resultadoRacional: HeatCell = {
    value: pctGeral,
    label: formatPercent(pctGeral),
  }

  const metaRacional = metaAtual ?? EFICIENCIA_META_SLA_PROTOCOLO

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
          title="SLA de Protocolo Gestão a Vista"
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_eficiencia) : '—'}
          hint={rowMesAtual ? `${rowMesAtual.qtd_d1} D-1 de ${rowMesAtual.qtd_total}` : 'sem dados'}
          meta={rowMesAtual?.meta != null ? formatPercent(rowMesAtual.meta) : undefined}
          atingiuMeta={
            rowMesAtual?.meta != null ? rowMesAtual.pct_eficiencia >= rowMesAtual.meta : null
          }
          icon={FileCheck2}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="SLA de Protocolo no período selecionado"
          value={formatPercent(pctGeral)}
          hint={`${qtdD1} D-1 de ${qtdTotal} CIs`}
          meta={metaAtual != null ? formatPercent(metaAtual) : undefined}
          atingiuMeta={metaAtual != null ? pctGeral >= metaAtual : null}
          icon={FileCheck2}
          accentClass="bg-violet-100 text-violet-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="FATAL no período selecionado"
          value={String(qtdFatal)}
          hint={`${qtdExcludente} excludente${qtdExcludente === 1 ? '' : 's'}`}
          icon={FileCheck2}
          accentClass="bg-rose-100 text-rose-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="SLA de Protocolo (D-1 vs FATAL)"
        subtitle="% de CIs concluídos dentro do prazo D-1, com meta vigente no período"
        data={mensalFiltrado.map((m) => ({ mes: m.mes, valor: m.pct_eficiencia, meta: m.meta }))}
        color="#7c3aed"
        metaFixa={metaRacional}
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
          onRacionalClick={() => openRacional('sla_protocolo_fatal')}
        />
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
          onRacionalClick={() => openRacional('sla_protocolo_fatal')}
        />
        <EficienciaRankingChart
          title="Qtd Desvio Responsáveis"
          subtitle={areaHint}
          rows={ranking}
          valueKey="qtd_fatal"
          valueLabel="Desvio"
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          showAvatars
          loading={loadingRanking}
          maxItems={9}
          onRacionalClick={() => openRacional('sla_protocolo_fatal')}
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
        resultado={racionalEscopo === 'default' ? resultadoRacional : null}
        metaAcumulado={racionalEscopo === 'default' ? metaRacional : null}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
