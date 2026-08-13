import { MESES_NOME } from '@/features/receita/constants'
import { formatPercent } from '@/shared/utils/format'
import {
  MARKETING_META_ALCANCE,
  MARKETING_META_ENGAJAMENTO_PCT,
  MARKETING_META_PAUTAS_POR_MES,
  MARKETING_META_POSTS_ANUAL,
  buildMonthlyIndicadoresSeries,
} from '@/features/operacoes-legais/marketing/computeMarketingIndicadores'
import type { InstagramPost } from '@/features/operacoes-legais/marketing/types'
import { instagramService } from '@/features/operacoes-legais/marketing/instagramService'
import {
  mesesEfetivosFiltro,
  type MesFiltroEficiencia,
} from '../constants'

export type MarketingMesCell = {
  mes: number
  mesLabel: string
  mesLabelLong: string
  valor: number
  label: string
  atingiu: boolean
}

export type MarketingIndicadorRow = {
  id: 'posts' | 'engajamento' | 'alcance' | 'pautas'
  titulo: string
  metaLabel: string
  metaMensal: number
  cells: MarketingMesCell[]
  acumValor: number
  acumLabel: string
  acumPct: number
  acumPctLabel: string
  acumAtingiu: boolean
  /** Exibe valor mensal como % (engajamento). */
  valorPercent?: boolean
}

export type ApresentacaoMarketingData = {
  ano: number
  meses: number[]
  rows: MarketingIndicadorRow[]
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function mesesAtivos(
  mesFiltro: MesFiltroEficiencia,
  ano: number,
  ref = new Date(),
): number[] {
  const efetivos = mesesEfetivosFiltro(mesFiltro, ano, ref)
  if (efetivos && efetivos.length > 0) return efetivos
  if (ano < ref.getFullYear()) return Array.from({ length: 12 }, (_, i) => i + 1)
  if (ano > ref.getFullYear()) return [1]
  return Array.from({ length: ref.getMonth() + 1 }, (_, i) => i + 1)
}

function average(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

export function buildApresentacaoMarketing(
  posts: InstagramPost[],
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): ApresentacaoMarketingData {
  const meses = mesesAtivos(mesFiltro, ano)
  const serieFull = buildMonthlyIndicadoresSeries(posts, ano, null)
  const byMes = new Map(
    serieFull.map((p) => [Number(p.month.slice(5, 7)), p]),
  )

  const postsMetaMensal = MARKETING_META_POSTS_ANUAL / 12

  const cellsFor = (
    getValor: (mes: number) => number,
    metaMensal: number,
    asPercent: boolean,
  ): MarketingMesCell[] =>
    meses.map((mes) => {
      const valor = getValor(mes)
      const atingiu = asPercent ? valor >= metaMensal : valor >= metaMensal
      return {
        mes,
        mesLabel: MESES_NOME[mes - 1] ?? String(mes),
        mesLabelLong: titleCase(MESES_NOME[mes - 1] ?? String(mes)),
        valor,
        label: asPercent ? formatPercent(valor) : fmtInt(valor),
        atingiu,
      }
    })

  const getPosts = (mes: number) => byMes.get(mes)?.posts ?? 0
  const getEngaj = (mes: number) => byMes.get(mes)?.engajamentoPct ?? 0
  const getAlcance = (mes: number) => byMes.get(mes)?.alcance ?? 0
  const getPautas = (mes: number) => byMes.get(mes)?.pautas ?? 0

  const postsCells = cellsFor(getPosts, postsMetaMensal, false)
  const engajCells = cellsFor(getEngaj, MARKETING_META_ENGAJAMENTO_PCT, true)
  const alcanceCells = cellsFor(getAlcance, MARKETING_META_ALCANCE, false)
  const pautasCells = cellsFor(getPautas, MARKETING_META_PAUTAS_POR_MES, false)

  const n = meses.length
  const postsTotal = postsCells.reduce((s, c) => s + c.valor, 0)
  const postsMetaPeriodo = postsMetaMensal * n
  const postsPct = postsMetaPeriodo > 0 ? (postsTotal / postsMetaPeriodo) * 100 : 0

  const engajComDado = engajCells.filter((c) => getPosts(c.mes) > 0)
  const engajMedia = average(engajComDado.map((c) => c.valor))
  const engajPctMeta =
    MARKETING_META_ENGAJAMENTO_PCT > 0
      ? (engajMedia / MARKETING_META_ENGAJAMENTO_PCT) * 100
      : 0

  const alcanceComDado = alcanceCells.filter((c) => getPosts(c.mes) > 0)
  const alcanceMedia = average(alcanceComDado.map((c) => c.valor))
  const alcancePctMeta =
    MARKETING_META_ALCANCE > 0 ? (alcanceMedia / MARKETING_META_ALCANCE) * 100 : 0

  const pautasTotal = pautasCells.reduce((s, c) => s + c.valor, 0)
  const pautasMetaPeriodo = MARKETING_META_PAUTAS_POR_MES * n
  const pautasPct =
    pautasMetaPeriodo > 0 ? (pautasTotal / pautasMetaPeriodo) * 100 : 0

  const rows: MarketingIndicadorRow[] = [
    {
      id: 'posts',
      titulo: 'Frequência De Postagens',
      metaLabel: `Meta: ${fmtInt(postsMetaMensal)}/mês`,
      metaMensal: postsMetaMensal,
      cells: postsCells,
      acumValor: postsTotal,
      acumLabel: fmtInt(postsTotal),
      acumPct: postsPct,
      acumPctLabel: formatPercent(postsPct),
      acumAtingiu: postsPct >= 100,
    },
    {
      id: 'engajamento',
      titulo: 'Engajamento Médio Por Post*',
      metaLabel: `Meta: ${formatPercent(MARKETING_META_ENGAJAMENTO_PCT)} ano`,
      metaMensal: MARKETING_META_ENGAJAMENTO_PCT,
      cells: engajCells,
      acumValor: engajMedia,
      acumLabel: formatPercent(engajMedia),
      acumPct: engajPctMeta,
      acumPctLabel: formatPercent(engajPctMeta),
      acumAtingiu: engajPctMeta >= 100,
      valorPercent: true,
    },
    {
      id: 'alcance',
      titulo: 'Alcance Mensal*',
      metaLabel: `Meta: ${fmtInt(MARKETING_META_ALCANCE)}/mês`,
      metaMensal: MARKETING_META_ALCANCE,
      cells: alcanceCells,
      acumValor: alcanceMedia,
      acumLabel: fmtInt(alcanceMedia),
      acumPct: alcancePctMeta,
      acumPctLabel: formatPercent(alcancePctMeta),
      acumAtingiu: alcancePctMeta >= 100,
    },
    {
      id: 'pautas',
      titulo: 'Produção Interna De Conteúdo',
      metaLabel: `Meta: ${MARKETING_META_PAUTAS_POR_MES}/mês`,
      metaMensal: MARKETING_META_PAUTAS_POR_MES,
      cells: pautasCells,
      acumValor: pautasTotal,
      acumLabel: fmtInt(pautasTotal),
      acumPct: pautasPct,
      acumPctLabel: formatPercent(pautasPct),
      acumAtingiu: pautasPct >= 100,
    },
  ]

  return { ano, meses, rows }
}

function titleCase(s: string): string {
  const lower = s.toLocaleLowerCase('pt-BR')
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}

export async function fetchApresentacaoMarketing(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): Promise<ApresentacaoMarketingData> {
  const dash = await instagramService.getDashboard()
  return buildApresentacaoMarketing(dash.posts ?? [], ano, mesFiltro)
}
