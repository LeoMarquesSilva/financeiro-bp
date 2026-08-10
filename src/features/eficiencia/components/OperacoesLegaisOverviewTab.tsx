import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPercent } from '@/shared/utils/format'
import { copyOverviewKpiCardsToClipboard } from '@/shared/utils/copyChartImage'
import { Button } from '@/components/ui/button'
import {
  EFICIENCIA_AREA_OPS_LEGAIS,
  EFICIENCIA_META_OPS_ANTECIPACAO,
  EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
  EFICIENCIA_META_OPS_EFICIENCIA,
  EFICIENCIA_META_OPS_INICIATIVAS,
  EFICIENCIA_META_OPS_PUBLICACOES,
  EFICIENCIA_META_OPS_SLA_PROTOCOLO,
  filtrarMensalPorMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useCobrancaKpiRows } from '@/features/cobranca/hooks/useWhatsapp'
import { useOpsLegaisRg, useTreinamentos, useTurnover } from '../hooks/useEficiencia'
import { eficienciaService } from '../services/eficienciaService'
import { buildOpsTreinamentosCategorias } from '../utils/opsTreinamentosCategorias'
import { serieMensalEfetividade } from '../utils/opsEfetividadeCobranca'
import { aplicarCelulasFiltro } from '../utils/overviewFinanceiroKpis'
import { toPriMaiuscula } from '../utils/textFormat'
import type { RacionalIndicador } from '../types/eficiencia.types'
import { OverviewKpiHeatRow, type HeatCell } from './OverviewKpiHeatRow'
import { RacionalSheet } from './RacionalSheet'

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

  const { protocoloMensal, publicacoesAnalise, publicacoesAgendamento, loading } =
    useOpsLegaisRg(ano, mesFiltro)

  const { anual: turnAnual, loading: loadingTurn } = useTurnover(
    ano,
    EFICIENCIA_AREA_OPS_LEGAIS,
  )
  const { itens, loading: loadingTreino } = useTreinamentos(ano, EFICIENCIA_AREA_OPS_LEGAIS)

  const { data: ativos = [], isLoading: loadingAtivos } = useQuery({
    queryKey: ['eficiencia', 'ops-turnover-ativos', ano],
    queryFn: () => eficienciaService.fetchTurnoverAtivosArea(ano, EFICIENCIA_AREA_OPS_LEGAIS),
  })
  const { rows: cobrancaRows, loading: loadingEfetividade } = useCobrancaKpiRows()

  const { data: antecipacaoMensal = [], isLoading: loadingAntecip } = useQuery({
    queryKey: ['eficiencia', 'ops-antecipacao-mensal', ano],
    queryFn: () => eficienciaService.fetchOpsLegaisAntecipacaoMensal(ano),
  })

  const { data: iniciativas, isLoading: loadingIniciativas } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-iniciativas', ano],
    queryFn: () => eficienciaService.fetchOpsLegaisIniciativas(ano, null),
  })

  const treinoResumos = useMemo(
    () => buildOpsTreinamentosCategorias(ativos, itens).resumos,
    [ativos, itens],
  )
  const equipeResumo = treinoResumos.find((r) => r.categoria === 'Equipe')

  const efetividadeMensal = useMemo(
    () => serieMensalEfetividade(cobrancaRows, ano),
    [cobrancaRows, ano],
  )

  const protFiltrado = filtrarMensalPorMesFiltro(protocoloMensal, mesFiltro, ano)
  const analiseFiltrado = filtrarMensalPorMesFiltro(publicacoesAnalise, mesFiltro, ano)
  const agendaFiltrado = filtrarMensalPorMesFiltro(publicacoesAgendamento, mesFiltro, ano)
  const efetividadeFiltrado = filtrarMensalPorMesFiltro(efetividadeMensal, mesFiltro, ano)
  const antecipFiltrado = filtrarMensalPorMesFiltro(antecipacaoMensal, mesFiltro, ano)

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
  const cellsEfetividade = aplicarCelulasFiltro(
    buildCells(efetividadeMensal, (r) => Number(r.pct_efetividade ?? 0)),
    mesFiltro,
    ano,
  )
  const cellsAntecip = aplicarCelulasFiltro(
    buildCells(antecipacaoMensal, (r) => Number(r.pct_antecipacao ?? 0)),
    mesFiltro,
    ano,
  )

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
  const acumEfetividade = somaRazaoPct(
    efetividadeFiltrado.map((m) => Number(m.cobrados_d1 ?? 0)),
    efetividadeFiltrado.map((m) => Number(m.total ?? 0)),
  )
  const acumAntecip = somaRazaoPct(
    antecipFiltrado.map((m) => Number(m.qtd_dentro_prazo ?? 0)),
    antecipFiltrado.map((m) => Number(m.total_faturavel ?? 0)),
  )

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

  /** Iniciativas: % acumulado da meta anual (24) nos meses com conclusão. */
  const iniciativasPorMes = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    const fontes =
      iniciativas?.painel?.concluidos?.length
        ? iniciativas.painel.concluidos.map((p) => p.data)
        : (iniciativas?.itens ?? []).map((p) => p.data)
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

  const mesDestaque =
    Array.isArray(mesFiltro) && mesFiltro.length === 1 ? mesFiltro[0]! : null

  const busy =
    loading ||
    loadingTurn ||
    loadingTreino ||
    loadingAtivos ||
    loadingEfetividade ||
    loadingAntecip ||
    loadingIniciativas

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
        />
        <OverviewKpiHeatRow
          title="Eficiência Protocolo"
          meta={EFICIENCIA_META_OPS_EFICIENCIA}
          mesDestaque={mesDestaque}
          cells={cellsEfi}
          acumulado={acumEfi}
          onRacionalClick={() => setRacionalAberto('ops_legais_eficiencia_protocolo')}
        />
        <OverviewKpiHeatRow
          title="Análise de Publicação"
          meta={EFICIENCIA_META_OPS_PUBLICACOES}
          mesDestaque={mesDestaque}
          cells={cellsAnalise}
          acumulado={acumAnalise}
          onRacionalClick={() => setRacionalAberto('ops_legais_pub_analise')}
        />
        <OverviewKpiHeatRow
          title="Agendamento de Publicação"
          meta={EFICIENCIA_META_OPS_PUBLICACOES}
          mesDestaque={mesDestaque}
          cells={cellsAgenda}
          acumulado={acumAgenda}
          onRacionalClick={() => setRacionalAberto('ops_legais_pub_agendamento')}
        />
        <OverviewKpiHeatRow
          title="Efetividade na Cobrança Inicial"
          meta={EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA}
          mesDestaque={mesDestaque}
          cells={
            loadingEfetividade
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsEfetividade
          }
          acumulado={
            loadingEfetividade ? { value: null, label: '…' } : acumEfetividade
          }
        />
        <OverviewKpiHeatRow
          title="Antecipação de Faturamento de Honorários"
          meta={EFICIENCIA_META_OPS_ANTECIPACAO}
          mesDestaque={mesDestaque}
          cells={
            loadingAntecip
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsAntecip
          }
          acumulado={loadingAntecip ? { value: null, label: '…' } : acumAntecip}
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
        />
        <OverviewKpiHeatRow
          title="Desenvolvimento Equipe"
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
        />
        <OverviewKpiHeatRow
          title="Retenção de Talentos"
          meta={turnAnual?.meta_pct_retencao_minima ?? 90}
          modoAnual
          anoLabel={String(ano)}
          cells={[]}
          acumulado={acumRetencao}
        />
      </div>

      <p className="text-center text-[11px] text-slate-400">
        {toPriMaiuscula(
          'Operações Legais · metas 98% em protocolo/publicação/antecipação · cobrança inicial meta 100%',
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
                ? 'Análise de Publicação'
                : racionalAberto === 'ops_legais_pub_agendamento'
                  ? 'Agendamento de Publicação'
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
              : racionalAberto != null
                ? EFICIENCIA_META_OPS_PUBLICACOES
                : null
        }
        onClose={() => setRacionalAberto(null)}
      />
    </div>
  )
}
