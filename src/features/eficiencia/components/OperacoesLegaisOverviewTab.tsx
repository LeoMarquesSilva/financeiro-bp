import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPercent } from '@/shared/utils/format'
import { copyOverviewKpiCardsToClipboard } from '@/shared/utils/copyChartImage'
import { Button } from '@/components/ui/button'
import {
  EFICIENCIA_AREA_OPS_LEGAIS,
  EFICIENCIA_META_OPS_CADASTRO,
  EFICIENCIA_META_OPS_EFICIENCIA,
  EFICIENCIA_META_OPS_INICIATIVAS,
  EFICIENCIA_META_OPS_PUBLICACOES,
  EFICIENCIA_META_OPS_SLA_PROTOCOLO,
  EFICIENCIA_META_PDI,
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import {
  useGestaoPdi,
  useOpsLegaisRg,
  useTreinamentos,
  useTurnover,
} from '../hooks/useEficiencia'
import { eficienciaService } from '../services/eficienciaService'
import { buildOpsTreinamentosCategorias } from '../utils/opsTreinamentosCategorias'
import { acumuladoGestaoPdi, buildGestaoPdiCells } from '../utils/gestaoPdiCalc'
import { aplicarCelulasFiltro } from '../utils/overviewFinanceiroKpis'
import { toPriMaiuscula } from '../utils/textFormat'
import type {
  OpsLegaisIniciativasDashboard,
  OpsLegaisIniciativasItem,
  OpsLegaisIniciativasProjeto,
  RacionalIndicador,
} from '../types/eficiencia.types'
import { OverviewKpiHeatRow, type HeatCell } from './OverviewKpiHeatRow'
import { RacionalSheet } from './RacionalSheet'
import { useInstagramMarketing } from '@/features/operacoes-legais/marketing/useInstagramMarketing'
import {
  MARKETING_META_ALCANCE,
  MARKETING_META_ENGAJAMENTO_PCT,
  MARKETING_META_PAUTAS_POR_MES,
  MARKETING_META_POSTS_ANUAL,
  buildMonthlyIndicadoresSeries,
} from '@/features/operacoes-legais/marketing/computeMarketingIndicadores'
import { useErrorReportingOptional } from '@/shared/error-reporting/ErrorReportingProvider'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

const PCT0 = (v: number) => `${v.toFixed(2)}%`

function buildCells<T extends { mes: number }>(
  rows: T[],
  getValor: (r: T) => number,
): HeatCell[] {
  const porMes = new Map(rows.map((r) => [r.mes, r]))
  return Array.from({ length: 12 }, (_, i) => {
    const row = porMes.get(i + 1)
    if (!row) return { value: null, label: '-' }
    const v = getValor(row)
    return { value: v, label: PCT0(v) }
  })
}

function somaRazaoPct(nums: number[], dens: number[]): HeatCell {
  const num = nums.reduce((a, b) => a + b, 0)
  const den = dens.reduce((a, b) => a + b, 0)
  if (den === 0) return { value: null, label: '-' }
  const v = (num / den) * 100
  return { value: v, label: PCT0(v) }
}

export function OperacoesLegaisOverviewTab({ ano, mesFiltro }: Props) {
  const [racionalAberto, setRacionalAberto] = useState<RacionalIndicador | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const copyRef = useRef<HTMLDivElement>(null)
  const { openReport } = useErrorReportingOptional()
  const reportarIndicador = (indicador: string) => () =>
    openReport({
      indicador,
      modulo: 'Operações Legais',
      ano,
      mes: mesFiltro === 'resultado' ? null : mesFiltro,
      area: EFICIENCIA_AREA_OPS_LEGAIS,
    })

  const {
    protocoloMensal,
    cadastroMensal,
    publicacoesAnalise,
    publicacoesAgendamento,
    loading,
  } = useOpsLegaisRg(ano, mesFiltro)

  const { anual: turnAnual, loading: loadingTurn } = useTurnover(
    ano,
    EFICIENCIA_AREA_OPS_LEGAIS,
  )
  const { itens, loading: loadingTreino } = useTreinamentos(ano, EFICIENCIA_AREA_OPS_LEGAIS)

  const { data: ativos = [], isLoading: loadingAtivos } = useQuery({
    queryKey: ['eficiencia', 'ops-turnover-ativos', ano],
    queryFn: () => eficienciaService.fetchTurnoverAtivosArea(ano, EFICIENCIA_AREA_OPS_LEGAIS),
  })

  const { mensal: pdiMensal, loading: loadingPdi } = useGestaoPdi(
    ano,
    mesFiltro,
    EFICIENCIA_AREA_OPS_LEGAIS,
  )

  const { data: iniciativas, isLoading: loadingIniciativas } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-iniciativas', ano],
    queryFn: (): Promise<OpsLegaisIniciativasDashboard> =>
      eficienciaService.fetchOpsLegaisIniciativas(ano, null),
  })

  const { data: marketingDash, isLoading: loadingMarketing } = useInstagramMarketing()
  const treinoResumos = useMemo(
    () => buildOpsTreinamentosCategorias(ativos, itens).resumos,
    [ativos, itens],
  )
  const equipeResumo = treinoResumos.find((r) => r.categoria === 'Equipe')

  const protFiltrado = filtrarMensalPorMesFiltro(protocoloMensal, mesFiltro, ano)
  const analiseFiltrado = filtrarMensalPorMesFiltro(publicacoesAnalise, mesFiltro, ano)
  const agendaFiltrado = filtrarMensalPorMesFiltro(publicacoesAgendamento, mesFiltro, ano)
  const cadFiltrado = filtrarMensalPorMesFiltro(cadastroMensal, mesFiltro, ano)

  const cellsSla = aplicarCelulasFiltro(
    buildCells(protocoloMensal, (r) => Number(r.pct_d1 ?? 0)),
    mesFiltro,
    ano,
  )
  const cellsEfi = aplicarCelulasFiltro(
    buildCells(protocoloMensal, (r) => Number(r.pct_sem_inconsistencia ?? 0)),
    mesFiltro,
    ano,
  )
  const cellsAnalise = aplicarCelulasFiltro(
    buildCells(publicacoesAnalise, (r) => Number(r.pct_eficiencia ?? 0)),
    mesFiltro,
    ano,
  )
  const cellsAgenda = aplicarCelulasFiltro(
    buildCells(publicacoesAgendamento, (r) => Number(r.pct_eficiencia ?? 0)),
    mesFiltro,
    ano,
  )
  const cellsCadastro = aplicarCelulasFiltro(
    buildCells(cadastroMensal, (r) => Number(r.pct_dentro_prazo ?? 0)),
    mesFiltro,
    ano,
  )
  const cellsPdi = aplicarCelulasFiltro(buildGestaoPdiCells(pdiMensal), mesFiltro, ano)

  const acumSla = somaRazaoPct(
    protFiltrado.map((m) => Number(m.qtd_d1 ?? 0)),
    protFiltrado.map((m) => Number(m.total ?? 0)),
  )
  const acumEfi = somaRazaoPct(
    protFiltrado.map((m) => Number(m.sem_inconsistencia ?? 0)),
    protFiltrado.map((m) => Number(m.total_eficiencia ?? m.total ?? 0)),
  )
  const acumAnalise = somaRazaoPct(
    analiseFiltrado.map((m) => Number(m.qtd_eficiencia ?? 0)),
    analiseFiltrado.map((m) => Number(m.total ?? 0)),
  )
  const acumAgenda = somaRazaoPct(
    agendaFiltrado.map((m) => Number(m.qtd_eficiencia ?? 0)),
    agendaFiltrado.map((m) => Number(m.total ?? 0)),
  )
  const acumCadastro = somaRazaoPct(
    cadFiltrado.map((m) => Number(m.dentro_prazo ?? 0)),
    cadFiltrado.map((m) => Number(m.dentro_prazo ?? 0) + Number(m.fora_prazo ?? 0)),
  )
  const acumPdi = acumuladoGestaoPdi(pdiMensal, mesFiltro, ano)

  const acumTreino: HeatCell =
    equipeResumo?.pctAtingimento != null
      ? {
          value: equipeResumo.pctAtingimento,
          label: formatPercent(equipeResumo.pctAtingimento),
        }
      : { value: null, label: '-' }

  const acumRetencao: HeatCell = turnAnual
    ? { value: turnAnual.pct_retencao, label: formatPercent(turnAnual.pct_retencao) }
    : { value: null, label: '-' }

  const iniciativasPorMes = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    const fontes: Array<string | null> =
      iniciativas?.painel?.concluidos?.length
        ? iniciativas.painel.concluidos.map((p: OpsLegaisIniciativasProjeto) => p.data)
        : (iniciativas?.itens ?? []).map((p: OpsLegaisIniciativasItem) => p.data)
    for (const data of fontes) {
      if (!data || !data.startsWith(`${ano}-`)) continue
      const mes = Number(data.slice(5, 7))
      if (mes >= 1 && mes <= 12) counts[mes - 1]! += 1
    }
    let ytd = 0
    return counts.map((qtd, i) => {
      ytd += qtd
      const pctYtd =
        EFICIENCIA_META_OPS_INICIATIVAS > 0
          ? (ytd / EFICIENCIA_META_OPS_INICIATIVAS) * 100
          : 0
      return { mes: i + 1, qtd, ytd, pctYtd }
    })
  }, [iniciativas?.painel?.concluidos, iniciativas?.itens, ano])

  const cellsIniciativas = aplicarCelulasFiltro(
    iniciativasPorMes.map((r) =>
      r.qtd > 0
        ? { value: r.pctYtd, label: formatPercent(r.pctYtd) }
        : { value: null, label: '-' },
    ),
    mesFiltro,
    ano,
  )

  const acumIniciativas: HeatCell = (() => {
    if (loadingIniciativas) return { value: null, label: '…' }
    if (mesFiltro == null) {
      const pct = iniciativas?.pct_progresso
      if (pct == null || (iniciativas?.projetos_concluidos ?? 0) <= 0) {
        return { value: null, label: '-' }
      }
      return { value: pct, label: formatPercent(pct) }
    }
    const filtrados = filtrarMensalPorMesFiltro(iniciativasPorMes, mesFiltro, ano)
    const qtd = filtrados.reduce((s, r) => s + r.qtd, 0)
    if (qtd <= 0) return { value: null, label: '-' }
    const pct = (qtd / EFICIENCIA_META_OPS_INICIATIVAS) * 100
    return { value: pct, label: formatPercent(pct) }
  })()

  const marketingPorMes = useMemo(() => {
    return buildMonthlyIndicadoresSeries(marketingDash?.posts ?? [], ano, null).map(
      (row, i) => ({
        mes: i + 1,
        posts: row.posts,
        postsPct: row.postsMetaMensal > 0 ? (row.posts / row.postsMetaMensal) * 100 : 0,
        engajamentoPct: row.engajamentoPct,
        pautas: row.pautas,
        pautasPct: row.pautasMeta > 0 ? (row.pautas / row.pautasMeta) * 100 : 0,
        alcance: row.alcance,
      }),
    )
  }, [marketingDash?.posts, ano])

  const cellsMarketingPosts = aplicarCelulasFiltro(
    marketingPorMes.map((r) =>
      r.posts > 0
        ? { value: r.postsPct, label: formatPercent(r.postsPct) }
        : { value: null, label: '-' },
    ),
    mesFiltro,
    ano,
  )
  const cellsMarketingEngaj = aplicarCelulasFiltro(
    marketingPorMes.map((r) =>
      r.posts > 0
        ? { value: r.engajamentoPct, label: formatPercent(r.engajamentoPct) }
        : { value: null, label: '-' },
    ),
    mesFiltro,
    ano,
  )
  const cellsMarketingPautas = aplicarCelulasFiltro(
    marketingPorMes.map((r) =>
      r.pautas > 0
        ? { value: r.pautasPct, label: formatPercent(r.pautasPct) }
        : { value: null, label: '-' },
    ),
    mesFiltro,
    ano,
  )
  const cellsMarketingAlcance = aplicarCelulasFiltro(
    marketingPorMes.map((r) =>
      r.posts > 0
        ? {
            value: r.alcance,
            label: Math.round(r.alcance).toLocaleString('pt-BR'),
          }
        : { value: null, label: '-' },
    ),
    mesFiltro,
    ano,
  )

  const marketingFiltrado = filtrarMensalPorMesFiltro(marketingPorMes, mesFiltro, ano)
  const marketingComDado = marketingFiltrado.filter((r) => r.posts > 0)

  const acumMarketingPosts: HeatCell = (() => {
    if (loadingMarketing) return { value: null, label: '…' }
    const qtd = marketingFiltrado.reduce((s, r) => s + r.posts, 0)
    if (qtd <= 0) return { value: null, label: '-' }
    const pct = (qtd / MARKETING_META_POSTS_ANUAL) * 100
    return { value: pct, label: formatPercent(pct) }
  })()

  const acumMarketingEngaj: HeatCell = (() => {
    if (loadingMarketing) return { value: null, label: '…' }
    if (marketingComDado.length === 0) return { value: null, label: '-' }
    const media =
      marketingComDado.reduce((s, r) => s + r.engajamentoPct, 0) / marketingComDado.length
    return { value: media, label: formatPercent(media) }
  })()

  const acumMarketingPautas: HeatCell = (() => {
    if (loadingMarketing) return { value: null, label: '…' }
    const qtd = marketingFiltrado.reduce((s, r) => s + r.pautas, 0)
    if (qtd <= 0) return { value: null, label: '-' }
    const meta = Math.max(marketingFiltrado.length, 1) * MARKETING_META_PAUTAS_POR_MES
    const pct = (qtd / meta) * 100
    return { value: pct, label: formatPercent(pct) }
  })()

  const acumMarketingAlcance: HeatCell = (() => {
    if (loadingMarketing) return { value: null, label: '…' }
    if (marketingComDado.length === 0) return { value: null, label: '-' }
    const media =
      marketingComDado.reduce((s, r) => s + r.alcance, 0) / marketingComDado.length
    return {
      value: media,
      label: Math.round(media).toLocaleString('pt-BR'),
    }
  })()

  const mesDestaque =
    Array.isArray(mesFiltro) && mesFiltro.length === 1 ? mesFiltro[0]! : null

  const busy =
    loading ||
    loadingTurn ||
    loadingTreino ||
    loadingAtivos ||
    loadingPdi ||
    loadingIniciativas ||
    loadingMarketing

  const handleCopiar = async () => {
    const container = copyRef.current
    if (!container) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-overview-copy-card]'))
    if (cards.length === 0) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }
    setCopyStatus('loading')
    try {
      await copyOverviewKpiCardsToClipboard(cards)
      setCopyStatus('done')
      toast.success('Overview copiado')
      window.setTimeout(() => setCopyStatus('idle'), 1500)
    } catch {
      setCopyStatus('idle')
      toast.error('Falha ao copiar')
    }
  }

  if (busy && protocoloMensal.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700"
          onClick={() => void handleCopiar()}
          disabled={copyStatus === 'loading'}
        >
          {copyStatus === 'loading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : copyStatus === 'done' ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          COPIAR
        </Button>
      </div>

      <div ref={copyRef} className="space-y-3">
        <OverviewKpiHeatRow
          title="SLA Protocolo"
          meta={EFICIENCIA_META_OPS_SLA_PROTOCOLO}
          mesDestaque={mesDestaque}
          cells={cellsSla}
          acumulado={acumSla}
          onRacionalClick={() => setRacionalAberto('ops_legais_sla_protocolo')}
          onReportarErroClick={reportarIndicador('SLA Protocolo')}
        />
        <OverviewKpiHeatRow
          title="Eficiência Protocolo"
          meta={EFICIENCIA_META_OPS_EFICIENCIA}
          mesDestaque={mesDestaque}
          cells={cellsEfi}
          acumulado={acumEfi}
          onRacionalClick={() => setRacionalAberto('ops_legais_eficiencia_protocolo')}
          onReportarErroClick={reportarIndicador('Eficiência Protocolo')}
        />
        <OverviewKpiHeatRow
          title="Eficiência Análise de Publicação"
          meta={EFICIENCIA_META_OPS_PUBLICACOES}
          mesDestaque={mesDestaque}
          cells={cellsAnalise}
          acumulado={acumAnalise}
          onRacionalClick={() => setRacionalAberto('ops_legais_pub_analise')}
          onReportarErroClick={reportarIndicador('Eficiência Análise de Publicação')}
        />
        <OverviewKpiHeatRow
          title="Eficiência Agendamento"
          meta={EFICIENCIA_META_OPS_PUBLICACOES}
          mesDestaque={mesDestaque}
          cells={cellsAgenda}
          acumulado={acumAgenda}
          onRacionalClick={() => setRacionalAberto('ops_legais_pub_agendamento')}
          onReportarErroClick={reportarIndicador('Eficiência Agendamento')}
        />
        <OverviewKpiHeatRow
          title="Eficiência no Cadastro de Processos"
          meta={EFICIENCIA_META_OPS_CADASTRO}
          mesDestaque={mesDestaque}
          cells={cellsCadastro}
          acumulado={acumCadastro}
          onRacionalClick={() => setRacionalAberto('ops_legais_cadastro')}
          onReportarErroClick={reportarIndicador('Eficiência no Cadastro de Processos')}
        />
        <OverviewKpiHeatRow
          title="Desenvolvimento Contínuo"
          meta={100}
          metaLabel={
            equipeResumo && equipeResumo.qtdPessoas > 0
              ? `Meta: ${equipeResumo.qtdPessoas * 14}h (${equipeResumo.qtdPessoas} × 14h)`
              : 'Meta 100%'
          }
          modoAnual
          anoLabel={String(ano)}
          cells={[]}
          acumulado={acumTreino}
          onReportarErroClick={reportarIndicador('Desenvolvimento Contínuo')}
        />
        <OverviewKpiHeatRow
          title="Retenção de Talentos"
          meta={turnAnual?.meta_pct_retencao_minima ?? 90}
          modoAnual
          anoLabel={String(ano)}
          cells={[]}
          acumulado={acumRetencao}
          onReportarErroClick={reportarIndicador('Retenção de Talentos')}
        />
        <OverviewKpiHeatRow
          title="Gestão de PDI"
          meta={EFICIENCIA_META_PDI}
          mesDestaque={mesDestaque}
          cells={
            loadingPdi
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsPdi
          }
          acumulado={loadingPdi ? { value: null, label: '…' } : acumPdi}
          onReportarErroClick={reportarIndicador('Gestão de PDI')}
        />
        <OverviewKpiHeatRow
          title="Iniciativas Estratégicas"
          meta={100}
          metaLabel={`Meta: ${EFICIENCIA_META_OPS_INICIATIVAS} projetos`}
          mesDestaque={mesDestaque}
          cells={
            loadingIniciativas
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsIniciativas
          }
          acumulado={acumIniciativas}
          onReportarErroClick={reportarIndicador('Iniciativas Estratégicas')}
        />
        <OverviewKpiHeatRow
          title="MKT - Posts Anuais"
          meta={100}
          metaLabel="Meta: 144 posts/ano"
          mesDestaque={mesDestaque}
          cells={
            loadingMarketing
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsMarketingPosts
          }
          acumulado={acumMarketingPosts}
          onReportarErroClick={reportarIndicador('MKT - Posts Anuais')}
        />
        <OverviewKpiHeatRow
          title="MKT - Engajamento"
          meta={MARKETING_META_ENGAJAMENTO_PCT}
          metaLabel="Meta: ≥ 3,50%"
          mesDestaque={mesDestaque}
          cells={
            loadingMarketing
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsMarketingEngaj
          }
          acumulado={acumMarketingEngaj}
          onReportarErroClick={reportarIndicador('MKT - Engajamento')}
        />
        <OverviewKpiHeatRow
          title="MKT - Pautas Anuais"
          meta={100}
          metaLabel="Meta: 10 pautas/mês"
          mesDestaque={mesDestaque}
          cells={
            loadingMarketing
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsMarketingPautas
          }
          acumulado={acumMarketingPautas}
          onReportarErroClick={reportarIndicador('MKT - Pautas Anuais')}
        />
        <OverviewKpiHeatRow
          title="MKT - Alcance Mensal"
          meta={MARKETING_META_ALCANCE}
          metaLabel="Meta: ≥ 15.000 pessoas"
          mesDestaque={mesDestaque}
          cells={
            loadingMarketing
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsMarketingAlcance
          }
          acumulado={acumMarketingAlcance}
          onReportarErroClick={reportarIndicador('MKT - Alcance Mensal')}
        />
      </div>

      <p className="text-center text-[11px] text-slate-400">
        {toPriMaiuscula(
          'Operações Legais · metas 98% protocolo/publicação · cadastro 95% · PDI e iniciativas meta 100%',
        )}
      </p>

      <RacionalSheet
        indicador={racionalAberto}
        titulo={
          racionalAberto === 'ops_legais_sla_protocolo'
            ? 'SLA Protocolo'
            : racionalAberto === 'ops_legais_eficiencia_protocolo'
              ? 'Eficiência Protocolo'
              : racionalAberto === 'ops_legais_pub_analise'
                ? 'Eficiência Análise de Publicação'
                : racionalAberto === 'ops_legais_pub_agendamento'
                  ? 'Eficiência Agendamento'
                  : racionalAberto === 'ops_legais_cadastro'
                    ? 'Eficiência Cadastro'
                    : ''
        }
        ano={ano}
        mes={mesFiltro}
        area={null}
        metaAcumulado={
          racionalAberto === 'ops_legais_sla_protocolo'
            ? EFICIENCIA_META_OPS_SLA_PROTOCOLO
            : racionalAberto === 'ops_legais_eficiencia_protocolo'
              ? EFICIENCIA_META_OPS_EFICIENCIA
              : racionalAberto === 'ops_legais_cadastro'
                ? EFICIENCIA_META_OPS_CADASTRO
                : racionalAberto != null
                  ? EFICIENCIA_META_OPS_PUBLICACOES
                  : null
        }
        onClose={() => setRacionalAberto(null)}
      />
    </div>
  )
}
