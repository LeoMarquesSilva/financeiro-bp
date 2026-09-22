import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPercent } from '@/shared/utils/format'
import {
  copyApresentacaoSlideToClipboard,
  copyOverviewKpiCardsToClipboard,
} from '@/shared/utils/copyChartImage'
import { Button } from '@/components/ui/button'
import {
  EFICIENCIA_AREA_OPS_LEGAIS,
  MESES_EFICIENCIA,
  EFICIENCIA_META_OPS_CADASTRO,
  EFICIENCIA_META_OPS_EFICIENCIA,
  EFICIENCIA_META_OPS_INICIATIVAS,
  EFICIENCIA_META_OPS_PUBLICACOES,
  EFICIENCIA_META_OPS_SLA_PROTOCOLO,
  EFICIENCIA_META_PDI,
  filtrarMensalPorMesFiltro,
  isMesesFiltro,
  isResultadoFiltro,
  mesesEfetivosFiltro,
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
  RacionalIndicador,
  TreinamentosMesRow,
} from '../types/eficiencia.types'
import {
  ApresentacaoUnificadoLinhasGrid,
  type UnificadoLinhaPonto,
  type UnificadoLinhaSerie,
} from './ApresentacaoUnificadoLinhasGrid'
import { OverviewKpiHeatRow, type HeatCell } from './OverviewKpiHeatRow'
import { formatMinutosHeatLabel, META_MENSAL_DESENVOLVIMENTO } from '../utils/desenvolvimentoEquipeHeatCell'
import { RacionalSheet } from './RacionalSheet'
import {
  useInstagramMarketing,
  useMarketingPautas,
} from '@/features/operacoes-legais/marketing/useInstagramMarketing'
import { buildMarketingPautas } from '@/features/operacoes-legais/marketing/marketingPautas'
import {
  MARKETING_META_ALCANCE,
  MARKETING_META_ENGAJAMENTO_PCT,
  MARKETING_META_PAUTAS_POR_MES,
  MARKETING_META_POSTS_ANUAL,
  buildMonthlyIndicadoresSeries,
} from '@/features/operacoes-legais/marketing/computeMarketingIndicadores'

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

function mesesDoGrafico(filtro: MesFiltroEficiencia, ano: number): number[] {
  const efetivos = mesesEfetivosFiltro(filtro, ano)
  return efetivos ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

function cellsToLinePoints(
  cells: HeatCell[],
  meses: number[],
): UnificadoLinhaPonto[] {
  return meses.map((mes) => {
    const cell = cells[mes - 1]
    return {
      label: MESES_EFICIENCIA[mes - 1] ?? String(mes),
      valor: cell?.value ?? null,
      rotulo:
        cell?.value == null || cell.label === '-' || cell.label === '…'
          ? undefined
          : cell.label,
    }
  })
}

function formatMinutosTreino(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function OperacoesLegaisOverviewTab({ ano, mesFiltro }: Props) {
  const [racionalAberto, setRacionalAberto] = useState<RacionalIndicador | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [visao, setVisao] = useState<'tabela' | 'linha'>('tabela')
  const copyRef = useRef<HTMLDivElement>(null)

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
  const { anual: treinoAnual, itens, loading: loadingTreino } = useTreinamentos(
    ano,
    EFICIENCIA_AREA_OPS_LEGAIS,
  )

  const { data: ativos = [], isLoading: loadingAtivos } = useQuery({
    queryKey: ['eficiencia', 'ops-turnover-ativos', ano],
    queryFn: () => eficienciaService.fetchTurnoverAtivosArea(ano, EFICIENCIA_AREA_OPS_LEGAIS),
  })

  const treinoMensalQuery = useQuery({
    queryKey: ['eficiencia', 'treinamentos-mensal', ano, EFICIENCIA_AREA_OPS_LEGAIS],
    queryFn: (): Promise<TreinamentosMesRow[]> =>
      eficienciaService.fetchTreinamentosMensal(ano, EFICIENCIA_AREA_OPS_LEGAIS),
  })
  const treinoMensal: TreinamentosMesRow[] = treinoMensalQuery.data ?? []
  const loadingTreinoMensal = treinoMensalQuery.isLoading

  const { mensal: pdiMensal, loading: loadingPdi } = useGestaoPdi(
    ano,
    mesFiltro,
    EFICIENCIA_AREA_OPS_LEGAIS,
  )

  const { data: iniciativas, isLoading: loadingIniciativas } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-iniciativas', ano],
    queryFn: (): Promise<OpsLegaisIniciativasDashboard> =>
      eficienciaService.fetchOpsLegaisIniciativas(ano, null),
    staleTime: 5 * 60_000,
  })

  const { data: marketingDash, isLoading: loadingInstagram } = useInstagramMarketing()
  const { data: marketingTaskRows, isLoading: loadingPautas } = useMarketingPautas()
  const loadingMarketing = loadingInstagram || loadingPautas
  const marketingPautas = useMemo(
    () => buildMarketingPautas(marketingTaskRows ?? []),
    [marketingTaskRows],
  )
  const treinoResumos = useMemo(
    () => buildOpsTreinamentosCategorias(ativos, itens, ano).resumos,
    [ativos, itens, ano],
  )
  const equipeResumo = treinoResumos.find((r) => r.categoria === 'Equipe')
  const metaTreinoLabel =
    treinoAnual && treinoAnual.pessoas_ativas > 0
      ? `Meta: ${Math.floor(Number(treinoAnual.meta_minutos) / 60)}h (${treinoAnual.pessoas_ativas} pessoas · proporcional)`
      : equipeResumo && equipeResumo.qtdPessoas > 0 && equipeResumo.metaMinutos != null
        ? `Meta: ${Math.round(equipeResumo.metaMinutos / 60)}h (${equipeResumo.qtdPessoas} pessoas · proporcional)`
        : 'Meta 100%'

  const cellsTreinoAnual: HeatCell[] = Array.from({ length: 12 }, (_, i) => {
    const row = treinoMensal.find((r) => r.mes === i + 1)
    if (!row) return { value: null, label: '-' }
    const minutos = Number(row.minutos_lancados)
    const pct = Number(row.pct_atingimento)
    return {
      value: pct,
      label: `${formatMinutosTreino(minutos)} (${formatPercent(pct)})`,
    }
  })
  const cellsTreino: HeatCell[] = aplicarCelulasFiltro(cellsTreinoAnual, mesFiltro, ano)

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

  const acumTreinoAnual: HeatCell = (() => {
    if (loadingTreino || loadingTreinoMensal) return { value: null, label: '…' }
    if (!treinoAnual) return { value: null, label: '-' }
    const minutos = Number(treinoAnual.minutos_lancados)
    const pct = Number(treinoAnual.pct_atingimento)
    return {
      value: pct,
      label: `${formatMinutosTreino(minutos)} (${formatPercent(pct)})`,
    }
  })()
  const acumTreino: HeatCell = (() => {
    if (loadingTreino || loadingTreinoMensal) return { value: null, label: '…' }
    // Ano todo: atingimento anual (pessoas × 14h).
    if (mesFiltro == null) return acumTreinoAnual
    const rows = filtrarMensalPorMesFiltro(treinoMensal, mesFiltro, ano)
    if (rows.length === 0) return { value: null, label: '-' }
    const minutos = rows.reduce((s, r) => s + Number(r.minutos_lancados), 0)
    const metaAno =
      Number(treinoAnual?.meta_minutos) || Number(rows[0]?.meta_minutos) || 0
    const pct =
      metaAno > 0 ? (minutos / metaAno) * 100 : Number(rows[0]?.pct_atingimento)
    return {
      value: pct,
      label: `${formatMinutosTreino(minutos)} (${formatPercent(pct)})`,
    }
  })()

  const acumRetencao: HeatCell = turnAnual
    ? { value: turnAnual.pct_retencao, label: formatPercent(turnAnual.pct_retencao) }
    : { value: null, label: '-' }

  const iniciativasPorMes = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0)
    // Mesma base do KPI Total: `itens` (tarefas topo com tag Projetos/Melhorias).
    // Não usar painel.concluidos — agrega por subtarefa e infla o %.
    const tagOk = (tags: string[]) => {
      const norms = tags.map((t) =>
        t
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase(),
      )
      return norms.includes('projetos') || norms.includes('melhorias')
    }
    for (const item of iniciativas?.itens ?? []) {
      if (!tagOk(item.tags ?? [])) continue
      const data = item.data
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
  }, [iniciativas?.itens, ano])

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
    const serie =
      mesFiltro == null
        ? iniciativasPorMes
        : filtrarMensalPorMesFiltro(iniciativasPorMes, mesFiltro, ano)
    const qtd = serie.reduce((s, r) => s + r.qtd, 0)
    if (qtd <= 0) return { value: null, label: '-' }
    const pct = (qtd / EFICIENCIA_META_OPS_INICIATIVAS) * 100
    return { value: pct, label: formatPercent(pct) }
  })()

  const marketingPorMes = useMemo(() => {
    return buildMonthlyIndicadoresSeries(
      marketingDash?.posts ?? [],
      ano,
      null,
      marketingPautas,
    ).map(
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
  }, [marketingDash?.posts, marketingPautas, ano])

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

  /** Destaca só quando o usuário marca meses; Resultado/semana não pintam o heat. */
  const mesDestaque: number | number[] | null = isMesesFiltro(mesFiltro)
    ? mesFiltro
    : null

  const seriesLinha: UnificadoLinhaSerie[] = useMemo(() => {
    const meses = mesesDoGrafico(mesFiltro, ano)
    const metaRetencao = turnAnual?.meta_pct_retencao_minima ?? 90
    const retencaoPct = turnAnual?.pct_retencao

    const treinoPoints: UnificadoLinhaPonto[] = (() => {
      let acc = 0
      let started = false
      return meses.map((mes) => {
        const row = treinoMensal.find((r) => r.mes === mes)
        const cell = cellsTreino[mes - 1]
        if (cell?.value != null && row) {
          acc += Number(row.minutos_lancados)
          started = true
        }
        return {
          label: MESES_EFICIENCIA[mes - 1] ?? String(mes),
          valor: started ? acc : null,
          rotulo: started ? formatMinutosHeatLabel(acc) : undefined,
        }
      })
    })()

    const retencaoPoints: UnificadoLinhaPonto[] = meses.map((mes, idx) => ({
      label: MESES_EFICIENCIA[mes - 1] ?? String(mes),
      valor: retencaoPct ?? null,
      rotulo: idx === 0 && retencaoPct != null ? formatPercent(retencaoPct) : undefined,
    }))

    const iniciativasPoints: UnificadoLinhaPonto[] = meses.map((mes) => {
      const row = iniciativasPorMes[mes - 1]
      const ytd = row?.ytd ?? 0
      return {
        label: MESES_EFICIENCIA[mes - 1] ?? String(mes),
        valor: ytd > 0 ? ytd : null,
        rotulo: ytd > 0 ? String(ytd) : undefined,
      }
    })

    const metaTreinoMin = Number(treinoAnual?.meta_minutos) || 0

    return [
      {
        id: 'sla',
        title: 'SLA Protocolo',
        meta: EFICIENCIA_META_OPS_SLA_PROTOCOLO,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_OPS_SLA_PROTOCOLO)}`,
        yKind: 'pct',
        points: cellsToLinePoints(cellsSla, meses),
      },
      {
        id: 'efi',
        title: 'Eficiência Protocolo',
        meta: EFICIENCIA_META_OPS_EFICIENCIA,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_OPS_EFICIENCIA)}`,
        yKind: 'pct',
        points: cellsToLinePoints(cellsEfi, meses),
      },
      {
        id: 'analise',
        title: 'Eficiência Análise de Publicação',
        meta: EFICIENCIA_META_OPS_PUBLICACOES,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_OPS_PUBLICACOES)}`,
        yKind: 'pct',
        points: cellsToLinePoints(cellsAnalise, meses),
      },
      {
        id: 'agenda',
        title: 'Eficiência Agendamento',
        meta: EFICIENCIA_META_OPS_PUBLICACOES,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_OPS_PUBLICACOES)}`,
        yKind: 'pct',
        points: cellsToLinePoints(cellsAgenda, meses),
      },
      {
        id: 'cadastro',
        title: 'Eficiência no Cadastro de Processos',
        meta: EFICIENCIA_META_OPS_CADASTRO,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_OPS_CADASTRO)}`,
        yKind: 'pct',
        points: cellsToLinePoints(cellsCadastro, meses),
      },
      {
        id: 'desenvolvimento',
        title: 'Desenvolvimento Contínuo',
        meta: metaTreinoMin,
        metaLabel: metaTreinoLabel,
        yKind: 'horas',
        points: treinoPoints,
      },
      {
        id: 'retencao',
        title: 'Retenção de Talentos',
        meta: metaRetencao,
        metaLabel: `Meta ${formatPercent(metaRetencao)}`,
        yKind: 'pct',
        points: retencaoPoints,
      },
      {
        id: 'pdi',
        title: 'Gestão de PDI',
        meta: EFICIENCIA_META_PDI,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_PDI)}`,
        yKind: 'pct',
        points: cellsToLinePoints(cellsPdi, meses),
      },
      {
        id: 'iniciativas',
        title: 'Iniciativas Estratégicas',
        meta: EFICIENCIA_META_OPS_INICIATIVAS,
        metaLabel: `Meta ${EFICIENCIA_META_OPS_INICIATIVAS} projetos`,
        yKind: 'numero',
        points: iniciativasPoints,
      },
    ]
  }, [
    cellsSla,
    cellsEfi,
    cellsAnalise,
    cellsAgenda,
    cellsCadastro,
    cellsTreino,
    cellsPdi,
    cellsIniciativas,
    treinoMensal,
    treinoAnual,
    turnAnual,
    iniciativasPorMes,
    metaTreinoLabel,
    mesFiltro,
    ano,
  ])

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
    setCopyStatus('loading')
    try {
      if (visao === 'linha') {
        const slide = container.querySelector<HTMLElement>(
          '[data-apresentacao-export="juridico_unificado"]',
        )
        if (!slide) {
          throw new Error('Gráfico não disponível para cópia')
        }
        await copyApresentacaoSlideToClipboard(slide)
      } else {
        const cards = Array.from(
          container.querySelectorAll<HTMLElement>('[data-overview-copy-card]'),
        ).filter((el) => !el.closest('[data-overview-copy-group="mkt"]'))
        if (cards.length === 0) {
          throw new Error('Conteúdo não disponível para cópia')
        }
        await copyOverviewKpiCardsToClipboard(cards)
      }
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
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant={visao === 'linha' ? 'default' : 'outline'}
          size="sm"
          className="h-8 shrink-0 text-xs font-semibold"
          onClick={() => setVisao((v) => (v === 'linha' ? 'tabela' : 'linha'))}
        >
          Gráfico de linha
        </Button>
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
        {visao === 'linha' ? (
          <div
            data-apresentacao-export="juridico_unificado"
            data-apresentacao-fill-slide
            className="min-h-[720px]"
          >
            <ApresentacaoUnificadoLinhasGrid series={seriesLinha} />
          </div>
        ) : null}
        <div
          data-overview-copy-group="ops"
          className={visao === 'linha' ? 'hidden' : 'space-y-3'}
        >
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
          title="Eficiência Análise de Publicação"
          meta={EFICIENCIA_META_OPS_PUBLICACOES}
          mesDestaque={mesDestaque}
          cells={cellsAnalise}
          acumulado={acumAnalise}
          onRacionalClick={() => setRacionalAberto('ops_legais_pub_analise')}
        />
        <OverviewKpiHeatRow
          title="Eficiência Agendamento"
          meta={EFICIENCIA_META_OPS_PUBLICACOES}
          mesDestaque={mesDestaque}
          cells={cellsAgenda}
          acumulado={acumAgenda}
          onRacionalClick={() => setRacionalAberto('ops_legais_pub_agendamento')}
        />
        <OverviewKpiHeatRow
          title="Eficiência no Cadastro de Processos"
          meta={EFICIENCIA_META_OPS_CADASTRO}
          mesDestaque={mesDestaque}
          cells={cellsCadastro}
          acumulado={acumCadastro}
          onRacionalClick={() => setRacionalAberto('ops_legais_cadastro')}
        />
        <OverviewKpiHeatRow
          title="Desenvolvimento Contínuo"
          meta={META_MENSAL_DESENVOLVIMENTO}
          metasPorMes={Array.from({ length: 12 }, () => META_MENSAL_DESENVOLVIMENTO)}
          metaAcumulado={100}
          metaLabel={metaTreinoLabel}
          mesDestaque={mesDestaque}
          cells={
            loadingTreino || loadingTreinoMensal
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsTreino
          }
          acumulado={acumTreino}
          copyAnualAcumulado={
            isResultadoFiltro(mesFiltro) ? undefined : acumTreinoAnual
          }
          copyAnualCells={isResultadoFiltro(mesFiltro) ? undefined : cellsTreinoAnual}
          onRacionalClick={() => setRacionalAberto('desenvolvimento_equipe')}
        />
        <OverviewKpiHeatRow
          title="Retenção de Talentos"
          meta={turnAnual?.meta_pct_retencao_minima ?? 90}
          modoAnual
          anoLabel={String(ano)}
          cells={[]}
          acumulado={acumRetencao}
          onRacionalClick={() => setRacionalAberto('retencao_talentos')}
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
          onRacionalClick={() => setRacionalAberto('gestao_pdi')}
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
          onRacionalClick={() => setRacionalAberto('ops_legais_iniciativas')}
        />
        </div>
        <div
          data-overview-copy-group="mkt"
          className={visao === 'linha' ? 'hidden' : 'space-y-3'}
        >
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
          onRacionalClick={() => setRacionalAberto('ops_legais_marketing')}
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
          onRacionalClick={() => setRacionalAberto('ops_legais_marketing')}
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
          onRacionalClick={() => setRacionalAberto('ops_legais_marketing')}
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
          onRacionalClick={() => setRacionalAberto('ops_legais_marketing')}
        />
        </div>
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
                    : racionalAberto === 'desenvolvimento_equipe'
                      ? 'Desenvolvimento Contínuo'
                      : racionalAberto === 'retencao_talentos'
                        ? 'Retenção de Talentos'
                        : racionalAberto === 'gestao_pdi'
                          ? 'Gestão de PDI'
                          : racionalAberto === 'ops_legais_iniciativas'
                            ? 'Iniciativas Estratégicas'
                            : racionalAberto === 'ops_legais_marketing'
                              ? 'Marketing Instagram'
                              : ''
        }
        ano={ano}
        mes={
          racionalAberto === 'desenvolvimento_equipe' || racionalAberto === 'retencao_talentos'
            ? isResultadoFiltro(mesFiltro)
              ? null
              : mesFiltro
            : mesFiltro
        }
        area={
          racionalAberto === 'desenvolvimento_equipe' ||
          racionalAberto === 'retencao_talentos' ||
          racionalAberto === 'gestao_pdi'
            ? EFICIENCIA_AREA_OPS_LEGAIS
            : null
        }
        resultado={
          racionalAberto === 'desenvolvimento_equipe'
            ? acumTreino
            : racionalAberto === 'retencao_talentos'
              ? acumRetencao
              : racionalAberto === 'gestao_pdi'
                ? acumPdi
                : racionalAberto === 'ops_legais_iniciativas'
                  ? acumIniciativas
                  : racionalAberto === 'ops_legais_marketing'
                    ? acumMarketingPosts
                    : null
        }
        metaAcumulado={
          racionalAberto === 'ops_legais_sla_protocolo'
            ? EFICIENCIA_META_OPS_SLA_PROTOCOLO
            : racionalAberto === 'ops_legais_eficiencia_protocolo'
              ? EFICIENCIA_META_OPS_EFICIENCIA
              : racionalAberto === 'ops_legais_cadastro'
                ? EFICIENCIA_META_OPS_CADASTRO
                : racionalAberto === 'desenvolvimento_equipe'
                  ? 100
                  : racionalAberto === 'retencao_talentos'
                    ? (turnAnual?.meta_pct_retencao_minima ?? 90)
                    : racionalAberto === 'gestao_pdi'
                      ? EFICIENCIA_META_PDI
                      : racionalAberto === 'ops_legais_iniciativas'
                        ? 100
                        : racionalAberto === 'ops_legais_marketing'
                          ? 100
                          : racionalAberto != null
                            ? EFICIENCIA_META_OPS_PUBLICACOES
                            : null
        }
        metaLabel={
          racionalAberto === 'desenvolvimento_equipe' &&
          equipeResumo &&
          equipeResumo.qtdPessoas > 0
            ? `Meta: ${Math.round((equipeResumo.metaMinutos ?? 0) / 60)}h (${equipeResumo.qtdPessoas} pessoas · proporcional)`
            : racionalAberto === 'ops_legais_iniciativas'
              ? `Meta: ${EFICIENCIA_META_OPS_INICIATIVAS} projetos`
              : racionalAberto === 'ops_legais_marketing'
                ? 'Meta: 144 posts/ano'
                : undefined
        }
        onClose={() => setRacionalAberto(null)}
      />
    </div>
  )
}
