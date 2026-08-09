import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL,
  EFICIENCIA_META_VISTAGEM,
  filtrarMensalPorMesFiltro,
  isAgendamentoVistagemIndisponivelPorArea,
  type MesFiltroEficiencia,
} from '../constants'
import { stripJsonArrayDecorators, toPriMaiuscula } from '../utils/textFormat'
import { useSlaVistagem, useSlaVistagemDesvioRankings } from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { AreaFilterButtons } from './AreaFilterButtons'
import { RacionalSheet } from './RacionalSheet'
import type { HeatCell } from './OverviewKpiHeatRow'
import type { RacionalIndicador } from '../types/eficiencia.types'

const BI_BAR = '#94a3b8'

type Props = {
  ano: number
  risco: boolean
  mesFiltro: MesFiltroEficiencia
}

export function SlaVistagemTab({ ano, risco, mesFiltro }: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { data: mensal, loading } = useSlaVistagem(ano, risco, area)
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const { porUsuario, porTipo, porGrupo, loading: loadingDesvio } = useSlaVistagemDesvioRankings(
    ano,
    mesFiltro,
    risco,
    area,
  )

  const indisponivelOps = isAgendamentoVistagemIndisponivelPorArea(area)
  const indisponivelNormal =
    !risco && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL
  const indisponivel = indisponivelOps || indisponivelNormal

  const totalPublicacoes = indisponivel ? 0 : mensalFiltrado.reduce((s, m) => s + m.total, 0)
  const totalVistadoD1 = indisponivel ? 0 : mensalFiltrado.reduce((s, m) => s + m.vistado_d1, 0)
  const pctGeral =
    !indisponivel && totalPublicacoes > 0 ? (totalVistadoD1 / totalPublicacoes) * 100 : null

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensalFiltrado.find((m) => m.mes === mesAtual)
  const areaHint = area ? `Área ${area}` : undefined

  const indicador: RacionalIndicador = risco ? 'sla_vistagem_risco' : 'sla_vistagem_normal'
  const resultadoRacional: HeatCell | null =
    pctGeral != null ? { value: pctGeral, label: formatPercent(pctGeral) } : null

  const emptyDesvio = indisponivelOps
    ? 'Indicador não se aplica a Operações Legais'
    : indisponivelNormal
      ? 'Trabalhista não possui SLA Vistagem Normal'
      : 'Sem desvios no período.'

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
          title={`SLA Vistagem ${risco ? 'Risco' : 'Normal'} Gestão a Vista`}
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_d1) : '—'}
          hint={rowMesAtual ? `${rowMesAtual.vistado_d1} de ${rowMesAtual.total}` : 'sem publicações'}
          icon={ShieldCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title={`SLA D+1 no período selecionado (${risco ? 'demanda de risco' : 'demanda comum'})`}
          value={pctGeral != null ? formatPercent(pctGeral) : '—'}
          hint={
            indisponivelOps
              ? 'Indicador não se aplica a Operações Legais'
              : indisponivelNormal
                ? 'Trabalhista não possui SLA Vistagem Normal'
                : `${totalVistadoD1} de ${totalPublicacoes} publicações`
          }
          icon={ShieldCheck}
          accentClass="bg-sky-100 text-sky-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Publicações no período selecionado"
          value={String(totalPublicacoes)}
          icon={ShieldCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title={`SLA de Vistagem D+1 — ${risco ? 'Demanda de Risco' : 'Demanda Comum'}`}
        subtitle="% de publicações vistadas até o próximo dia útil + 12h"
        data={mensalFiltrado.map((m) => ({ mes: m.mes, valor: m.pct_d1 }))}
        color={risco ? '#dc2626' : '#0ea5e9'}
        metaFixa={EFICIENCIA_META_VISTAGEM}
        onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <EficienciaRankingChart
          title="% Desvio Responsável"
          subtitle={areaHint}
          rows={porUsuario}
          labelKey="usuario"
          valueKey="pct_do_total"
          valueLabel="% do total"
          formatValue={(v) => formatPercent(v)}
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          showAvatars
          loading={loadingDesvio}
          maxItems={9}
          emptyLabel={emptyDesvio}
          onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
        />
        <EficienciaRankingChart
          title="Tipo Publicação"
          subtitle={areaHint}
          rows={porTipo.map((r) => ({
            ...r,
            tipo_publicacao: toPriMaiuscula(
              stripJsonArrayDecorators(String(r.tipo_publicacao ?? '')),
            ),
          }))}
          labelKey="tipo_publicacao"
          valueKey="qtd_desvio"
          valueLabel="Desvios"
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          loading={loadingDesvio}
          maxItems={9}
          emptyLabel={emptyDesvio}
          onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
        />
        <EficienciaRankingChart
          title="Grupo Cliente Desvio"
          subtitle={areaHint}
          rows={porGrupo}
          labelKey="grupo_cliente"
          valueKey="qtd_desvio"
          valueLabel="Desvios"
          pctKey={null}
          color={BI_BAR}
          truncateLabels={false}
          biStyle
          compact
          loading={loadingDesvio}
          maxItems={9}
          emptyLabel={emptyDesvio}
          onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
        />
      </div>

      <RacionalSheet
        indicador={racionalAberto ? indicador : null}
        titulo={risco ? 'SLA Vistagem Risco' : 'SLA Vistagem Normal'}
        ano={ano}
        mes={mesFiltro}
        area={area}
        resultado={resultadoRacional}
        metaAcumulado={98}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
