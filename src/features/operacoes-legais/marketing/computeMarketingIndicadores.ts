import { groupPostsByMonth, summarizeInstagram } from './instagramAnalytics'
import type { InstagramPeriodRange, InstagramPost } from './types'

/** Meta fixa anual de posts (BI: Pct_Meta_Posts_Anual). */
export const MARKETING_META_POSTS_ANUAL = 144
/** Meta de engajamento médio mensal (BI: ≥ 3,5%). */
export const MARKETING_META_ENGAJAMENTO_PCT = 3.5
/** Meta de alcance médio mensal (BI: ≥ 15.000). */
export const MARKETING_META_ALCANCE = 15_000
/** Meta de pautas por mês (BI: Pautas_Meta_Dinamica = meses × 10). */
export const MARKETING_META_PAUTAS_POR_MES = 10

export type MarketingIndicadorKpi = {
  titulo: string
  descricao: string
  /** Valor principal exibido (qtd / engajamento / alcance). */
  valorPrincipal: string
  /** % vs meta (já formatado com 2 casas). */
  pctMetaFormatado: string
  corValor: string
  metaLabel: string
  /** Só no card de Alcance. */
  crescimento?: { texto: string; cor: string }
}

const COR_OK = '#059669'
const COR_NOK = '#B91C1C'
const COR_NEUTRO = '#6B7280'

/** Sempre 2 casas (regra formato-percentual). */
function formatPct(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** Meses de calendário cobertos pelo filtro (inclusive). */
export function countMonthsInRange(
  range: InstagramPeriodRange,
  posts: InstagramPost[],
  now = new Date(),
): number {
  let start: string | null = null
  let end: string | null = null

  if (range.from) start = monthKey(range.from)
  if (range.to) end = monthKey(range.to)

  if (!start || !end) {
    const keys = posts
      .map((p) => (p.published_at ? monthKey(p.published_at) : null))
      .filter((k): k is string => Boolean(k))
      .sort()
    if (!keys.length) return 1
    start = start ?? keys[0]
    const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    end = end ?? (keys[keys.length - 1] > current ? keys[keys.length - 1] : current)
  }

  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  const months = (ey - sy) * 12 + (em - sm) + 1
  return Math.max(1, months)
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function average(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function corMeta(atingiu: boolean): string {
  return atingiu ? COR_OK : COR_NOK
}

/** Média mensal de engajamento (%) e alcance no período. */
export function mediasMensaisPeriodo(posts: InstagramPost[]): {
  engajamentoPct: number
  alcance: number
  months: string[]
} {
  const monthly = groupPostsByMonth(posts)
  if (!monthly.length) return { engajamentoPct: 0, alcance: 0, months: [] }
  return {
    engajamentoPct: average(monthly.map((m) => m.engagementRate)),
    alcance: average(monthly.map((m) => m.reach)),
    months: monthly.map((m) => m.month),
  }
}

function alcanceMedioEntreMeses(
  allPosts: InstagramPost[],
  startYm: string,
  endYm: string,
): number | null {
  const inWindow = allPosts.filter((p) => {
    if (!p.published_at) return false
    const m = monthKey(p.published_at)
    return m >= startYm && m <= endYm
  })
  if (!inWindow.length) return null
  const monthly = groupPostsByMonth(inWindow)
  if (!monthly.length) return null
  return average(monthly.map((m) => m.reach))
}

export function crescimentoAlcanceMedio(
  postsNoPeriodo: InstagramPost[],
  allPosts: InstagramPost[],
  range: InstagramPeriodRange,
): { texto: string; cor: string } {
  const months = countMonthsInRange(range, postsNoPeriodo)
  const medias = mediasMensaisPeriodo(postsNoPeriodo)
  if (!medias.months.length) return { texto: 'N/A', cor: COR_NEUTRO }

  const startYm = medias.months[0]
  const prevEnd = shiftMonth(startYm, -1)
  const prevStart = shiftMonth(prevEnd, -(months - 1))

  const atual = medias.alcance
  const anterior = alcanceMedioEntreMeses(allPosts, prevStart, prevEnd)
  if (anterior == null || anterior <= 0) {
    if (atual <= 0) return { texto: 'N/A', cor: COR_NEUTRO }
    return { texto: '▲ —', cor: COR_OK }
  }

  const deltaPct = ((atual - anterior) / anterior) * 100
  const seta = deltaPct >= 0 ? '▲' : '▼'
  return {
    texto: `${seta} ${formatPct(Math.abs(deltaPct))}`,
    cor: deltaPct >= 0 ? COR_OK : COR_NOK,
  }
}

export function computeMarketingIndicadores(
  postsNoPeriodo: InstagramPost[],
  allPosts: InstagramPost[],
  range: InstagramPeriodRange,
): {
  posts: MarketingIndicadorKpi
  engajamento: MarketingIndicadorKpi
  pautas: MarketingIndicadorKpi
  alcance: MarketingIndicadorKpi
} {
  const qtdPosts = postsNoPeriodo.length
  const pctPosts = MARKETING_META_POSTS_ANUAL > 0 ? qtdPosts / MARKETING_META_POSTS_ANUAL : 0

  const medias = mediasMensaisPeriodo(postsNoPeriodo)
  const engajDisplay =
    medias.months.length > 0
      ? medias.engajamentoPct
      : summarizeInstagram(postsNoPeriodo).engagementRate
  const pctEngaj =
    MARKETING_META_ENGAJAMENTO_PCT > 0
      ? engajDisplay / MARKETING_META_ENGAJAMENTO_PCT
      : 0

  // BI: Pautas_Realizadas — sem ClickUp TarefasMarketing no SIOE, usa volume de posts do período.
  const qtdPautas = qtdPosts
  const metaPautas =
    countMonthsInRange(range, postsNoPeriodo) * MARKETING_META_PAUTAS_POR_MES
  const pctPautas = metaPautas > 0 ? qtdPautas / metaPautas : 0

  const pctAlcance =
    MARKETING_META_ALCANCE > 0 ? medias.alcance / MARKETING_META_ALCANCE : 0
  const crescimento = crescimentoAlcanceMedio(postsNoPeriodo, allPosts, range)

  return {
    posts: {
      titulo: 'Posts Anuais',
      descricao: 'Frequência de postagens no Instagram vs meta anual (144 posts)',
      valorPrincipal: formatInt(qtdPosts),
      pctMetaFormatado: formatPct(pctPosts * 100),
      corValor: corMeta(pctPosts * 100 >= 100),
      metaLabel: '144 posts/ano',
    },
    engajamento: {
      titulo: 'Engajamento',
      descricao: 'Média de engajamento no Instagram vs meta anual (3,5%)',
      valorPrincipal: formatPct(engajDisplay),
      pctMetaFormatado: formatPct(pctEngaj * 100),
      corValor: corMeta(pctEngaj * 100 >= 100),
      metaLabel: '≥ 3,5%',
    },
    pautas: {
      titulo: 'Pautas Anuais',
      descricao: 'Pautas de conteúdo realizadas vs meta do período (10/mês)',
      valorPrincipal: formatInt(qtdPautas),
      pctMetaFormatado: formatPct(pctPautas * 100),
      corValor: corMeta(pctPautas >= 1),
      metaLabel: `${formatInt(metaPautas)} pautas no período`,
    },
    alcance: {
      titulo: 'Alcance Mensal',
      descricao: 'Alcance médio mensal no Instagram vs meta (15.000 pessoas)',
      valorPrincipal: formatInt(medias.alcance),
      pctMetaFormatado: formatPct(pctAlcance * 100),
      corValor: corMeta(pctAlcance * 100 >= 100),
      metaLabel: '≥ 15.000 pessoas',
      crescimento,
    },
  }
}

export type MonthlyIndicadorPoint = {
  month: string
  posts: number
  postsMetaMensal: number
  engajamentoPct: number
  engajamentoMeta: number
  pautas: number
  pautasMeta: number
  alcance: number
  alcanceMeta: number
}

/**
 * Série mensal dos 4 indicadores no ano (ou num mês específico).
 * Preenche meses sem post com zero para o gráfico contínuo.
 */
export function buildMonthlyIndicadoresSeries(
  posts: InstagramPost[],
  ano: number,
  mesFiltro: number | null,
): MonthlyIndicadorPoint[] {
  const monthsToShow =
    mesFiltro != null
      ? [`${ano}-${String(mesFiltro).padStart(2, '0')}`]
      : Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`)

  const inScope = posts.filter((p) => {
    if (!p.published_at) return false
    const y = Number(p.published_at.slice(0, 4))
    const m = Number(p.published_at.slice(5, 7))
    if (y !== ano) return false
    if (mesFiltro != null && m !== mesFiltro) return false
    return true
  })

  const byMonth = new Map(groupPostsByMonth(inScope).map((row) => [row.month, row]))
  const postsMetaMensal = MARKETING_META_POSTS_ANUAL / 12

  return monthsToShow.map((month) => {
    const row = byMonth.get(month)
    const qtd = row?.posts ?? 0
    return {
      month,
      posts: qtd,
      postsMetaMensal,
      engajamentoPct: row?.engagementRate ?? 0,
      engajamentoMeta: MARKETING_META_ENGAJAMENTO_PCT,
      pautas: qtd,
      pautasMeta: MARKETING_META_PAUTAS_POR_MES,
      alcance: row?.reach ?? 0,
      alcanceMeta: MARKETING_META_ALCANCE,
    }
  })
}
