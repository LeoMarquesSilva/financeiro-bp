import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL,
  EFICIENCIA_META_VISTAGEM,
  filtrarMensalGestaoAVista,
  filtrarMensalPorMesFiltro,
  isAgendamentoVistagemIndisponivelPorArea,
  type MesFiltroEficiencia,
} from '../constants'
import { stripJsonArrayDecorators, toPriMaiuscula } from '../utils/textFormat'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import {
  useSlaVistagem,
  useSlaVistagemDesvioRankings,
} from '../hooks/useEficiencia'
import { useEvolucaoPorResponsavel } from '../hooks/useEvolucaoPorResponsavel'
import { usePeriodoCurtoResumo } from '../hooks/usePeriodoCurtoResumo'
import { totaisVistagemFromResumo } from '../utils/periodoCurtoIndicadorTotais'
import {
  isSlaVistagemRiscoContratosSemCasos,
  pctSlaVistagemAcumulado,
  SLA_VISTAGEM_RISCO_CONTRATOS_SEM_CASOS_PCT,
} from '../utils/slaVistagemKpi'
import {
  emptyLabelDesvioResponsavel,
  rankingDesvioFiltrado,
} from '../utils/responsavelMatch'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { RacionalSheet } from './RacionalSheet'
import type { HeatCell } from './OverviewKpiHeatRow'
import type { RacionalIndicador } from '../types/eficiencia.types'

const BI_BAR = '#94a3b8'

type Props = {
  ano: number
  risco: boolean
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function SlaVistagemTab({
  ano,
  risco,
  mesFiltro,
  responsavel = null,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
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
  const indicador: RacionalIndicador = risco ? 'sla_vistagem_risco' : 'sla_vistagem_normal'
  const {
    chartData: evolucaoResp,
    acumulado: acumResp,
    loading: loadingEvol,
  } = useEvolucaoPorResponsavel(indicador, ano, area, responsavel, mesFiltro)

  const indisponivelOps = isAgendamentoVistagemIndisponivelPorArea(area)
  const indisponivelNormal =
    !risco && area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL
  const indisponivel = indisponivelOps || indisponivelNormal

  const periodoCurto = usePeriodoCurtoResumo(indicador, ano, mesFiltro, area, responsavel)

  const mensalGestaoVista = filtrarMensalGestaoAVista(mensal, ano)

  const periodoTotais = useMemo(() => {
    if (periodoCurto.periodoCurtoAtivo && periodoCurto.resumo) {
      return totaisVistagemFromResumo(periodoCurto.resumo)
    }
    const total = mensalFiltrado.reduce((s, m) => s + m.total, 0)
    const vistadoD1 = mensalFiltrado.reduce((s, m) => s + m.vistado_d1, 0)
    return {
      total,
      vistadoD1,
      pctGeral: pctSlaVistagemAcumulado(vistadoD1, total),
    }
  }, [periodoCurto.periodoCurtoAtivo, periodoCurto.resumo, mensalFiltrado])

  const totalPublicacoes = indisponivel
    ? 0
    : responsavel && !periodoCurto.periodoCurtoAtivo
      ? acumResp.total
      : periodoTotais.total
  const totalVistadoD1 = indisponivel
    ? 0
    : responsavel && !periodoCurto.periodoCurtoAtivo
      ? acumResp.ok
      : periodoTotais.vistadoD1
  const pctGeral = indisponivel
    ? null
    : responsavel && !periodoCurto.periodoCurtoAtivo
      ? isSlaVistagemRiscoContratosSemCasos(area, risco, totalPublicacoes)
        ? SLA_VISTAGEM_RISCO_CONTRATOS_SEM_CASOS_PCT
        : pctSlaVistagemAcumulado(totalVistadoD1, totalPublicacoes)
      : isSlaVistagemRiscoContratosSemCasos(area, risco, periodoTotais.total)
        ? SLA_VISTAGEM_RISCO_CONTRATOS_SEM_CASOS_PCT
        : periodoTotais.pctGeral

  const totalPublicacoesGav = indisponivel
    ? 0
    : mensalGestaoVista.reduce((s, m) => s + m.total, 0)
  const totalVistadoD1Gav = indisponivel
    ? 0
    : mensalGestaoVista.reduce((s, m) => s + m.vistado_d1, 0)
  const pctGestaoVista =
    !indisponivel && totalPublicacoesGav > 0
      ? (totalVistadoD1Gav / totalPublicacoesGav) * 100
      : isSlaVistagemRiscoContratosSemCasos(area, risco, totalPublicacoesGav)
        ? SLA_VISTAGEM_RISCO_CONTRATOS_SEM_CASOS_PCT
        : null
  const areaHint = area ? `Área ${area}` : undefined

  const resultadoRacional: HeatCell | null =
    pctGeral != null ? { value: pctGeral, label: formatPercent(pctGeral) } : null

  const porUsuarioFiltrado = rankingDesvioFiltrado(
    porUsuario,
    (r) => r.usuario,
    responsavel,
    responsavel && acumResp.total > 0
      ? {
          usuario: responsavel,
          qtd_desvio: Math.max(0, acumResp.total - acumResp.ok),
          pct_do_total: 100,
        }
      : null,
  )

  const emptyDesvio = indisponivelOps
    ? 'Indicador não se aplica a Operações Legais'
    : indisponivelNormal
      ? 'Trabalhista não possui SLA Vistagem Normal'
      : emptyLabelDesvioResponsavel(
          responsavel,
          Boolean(responsavel && acumResp.total > 0),
          'Sem desvios no período.',
        )

  const loadingKpi =
    loading ||
    periodoCurto.loading ||
    Boolean(responsavel && !periodoCurto.periodoCurtoAtivo && loadingEvol)
  const chartData = responsavel
    ? evolucaoResp
    : mensalFiltrado.map((m) => ({ mes: m.mes, valor: m.pct_d1 }))

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
          title={`SLA Vistagem ${risco ? 'Risco' : 'Normal'} Gestão a Vista`}
          value={pctGestaoVista != null ? formatPercent(pctGestaoVista) : '—'}
          hint={
            indisponivel
              ? emptyDesvio
              : 'Vistado no D+1 ÷ pubs · jun→hoje'
          }
          icon={ShieldCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
          scopeEquipe
          pessoaNome={responsavel}
        />
        <EficienciaKpiCard
          title={`SLA D+1 no período selecionado (${risco ? 'demanda de risco' : 'demanda comum'})`}
          value={pctGeral != null ? formatPercent(pctGeral) : '—'}
          hint={
            indisponivelOps
              ? 'Indicador não se aplica a Operações Legais'
              : indisponivelNormal
                ? 'Trabalhista não possui SLA Vistagem Normal'
                : 'Vistado no D+1 ÷ pubs · meses filtrados'
          }
          icon={ShieldCheck}
          accentClass="bg-sky-100 text-sky-700"
          loading={loadingKpi}
          pessoaNome={responsavel}
          currentPct={pctGeral}
          vsEquipePct={pctGestaoVista}
        />
        <EficienciaKpiCard
          title="Publicações no período selecionado"
          value={String(totalPublicacoes)}
          icon={ShieldCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loadingKpi}
        />
      </div>

      <EficienciaEvolucaoChart
        title={`SLA de Vistagem D+1 — ${risco ? 'Demanda de Risco' : 'Demanda Comum'}`}
        subtitle={
          responsavel
            ? `% D+1 · ${responsavel}`
            : '% de publicações vistadas até o próximo dia útil + 12h'
        }
        data={chartData}
        color={risco ? '#dc2626' : '#0ea5e9'}
        metaFixa={EFICIENCIA_META_VISTAGEM}
        onRacionalClick={indisponivel ? undefined : () => setRacionalAberto(true)}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <EficienciaRankingChart
          title="% Desvio Responsável"
          subtitle={areaHint}
          rows={porUsuarioFiltrado}
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
          scrollAll
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
          scrollAll
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
          scrollAll
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
        responsavel={responsavel}
        resultado={resultadoRacional}
        metaAcumulado={98}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
