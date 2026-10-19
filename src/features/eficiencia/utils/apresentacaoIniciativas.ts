import { MESES_NOME } from '@/features/receita/constants'
import {
  EFICIENCIA_META_OPS_INICIATIVAS,
  mesesEfetivosFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type {
  OpsLegaisIniciativasDashboard,
  OpsLegaisIniciativasItem,
  OpsLegaisIniciativasProjeto,
} from '../types/eficiencia.types'
import { formatPercent } from '@/shared/utils/format'

/** Meta de iniciativas estratégicas em cada mês. */
export const INICIATIVAS_META_MENSAL = 2

export type IniciativasMesEvo = {
  mes: number
  mesLabel: string
  total: number
  projetos: number
  melhorias: number
  ytd: number
  pctYtd: number
  pctYtdLabel: string
  metaMensal: number
  pctMes: number
  pctMesLabel: string
  atingiu: boolean
  destaque: boolean
}

export type IniciativasEntrega = {
  id: string
  nome: string
  /** Tag ClickUp: Projetos, Melhorias ou demais tags (vazio = "—"). */
  tipo: string
  data: string | null
  dataLabel: string
  mes: number | null
  horas: number
  tags: string[]
  destaque: boolean
}

/** Classe de prioridade do FORJAI; `null` = projeto sem avaliação. */
export type IniciativaPrioridade = 'urgent' | 'high' | 'normal' | 'low' | 'backlog'

export type IniciativaAndamento = {
  id: string
  nome: string
  etapa: string
  prioridade: IniciativaPrioridade | null
  score: number | null
  responsavel: string
  prazo: string | null
  prazoLabel: string
}

export type ApresentacaoIniciativasData = {
  ano: number
  meta: number
  mesDestaque: number | null
  mesDestaqueLabel: string | null
  evolucao: IniciativasMesEvo[]
  /** Meses com movimento (ou até o destaque). */
  evolucaoAtiva: IniciativasMesEvo[]
  entregas: IniciativasEntrega[]
  /** Projetos em andamento no FORJAI, na ordem do ranking de prioridade. */
  andamento: IniciativaAndamento[]
  totais: {
    total: number
    projetos: number
    melhorias: number
    pct_progresso: number
    pct_progresso_label: string
  }
}

function tagNorm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function tipoItem(tags: string[]): string {
  const norms = tags.map(tagNorm)
  if (norms.includes('projetos')) return 'Projetos'
  if (norms.includes('melhorias')) return 'Melhorias'
  const outros = tags.map((t) => t.trim()).filter(Boolean)
  return outros.length > 0 ? outros.join(', ') : '—'
}

function formatDataBr(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

const PRIORIDADES: readonly IniciativaPrioridade[] = ['urgent', 'high', 'normal', 'low', 'backlog']

function prioridadeOuNull(v: string | null | undefined): IniciativaPrioridade | null {
  return PRIORIDADES.includes(v as IniciativaPrioridade) ? (v as IniciativaPrioridade) : null
}

/** Ranking do FORJAI primeiro (score); sem avaliação no fim, por nome. */
function buildAndamento(projetos: OpsLegaisIniciativasProjeto[]): IniciativaAndamento[] {
  return [...projetos]
    .sort((a, b) => {
      const ra = a.rank_prioridade ?? Number.POSITIVE_INFINITY
      const rb = b.rank_prioridade ?? Number.POSITIVE_INFINITY
      if (ra !== rb) return ra - rb
      const sa = a.score ?? Number.NEGATIVE_INFINITY
      const sb = b.score ?? Number.NEGATIVE_INFINITY
      if (sa !== sb) return sb - sa
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      etapa: p.etapa ?? '',
      prioridade: prioridadeOuNull(p.prioridade),
      score: p.score ?? null,
      responsavel: p.responsavel,
      prazo: p.prazo ?? null,
      prazoLabel: p.prazo ? formatDataBr(p.prazo) : '',
    }))
}

/** Último mês do filtro (ou mês corrente / dez se ano passado). */
export function mesDestaqueFiltro(
  mesFiltro: MesFiltroEficiencia,
  ano: number,
  ref = new Date(),
): number {
  const meses = mesesEfetivosFiltro(mesFiltro, ano, ref)
  if (meses && meses.length > 0) return Math.max(...meses)
  const agora = ref
  if (ano < agora.getFullYear()) return 12
  if (ano > agora.getFullYear()) return 1
  return agora.getMonth() + 1
}

function itemNoEscopo(
  dataIso: string | null,
  ano: number,
  mesesEscopo: number[] | null,
): boolean {
  if (!dataIso || !dataIso.startsWith(`${ano}-`)) return false
  const mes = Number(dataIso.slice(5, 7))
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return false
  if (mesesEscopo == null) return true
  return mesesEscopo.includes(mes)
}

export function buildApresentacaoIniciativas(
  dash: OpsLegaisIniciativasDashboard,
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): ApresentacaoIniciativasData {
  const meta = dash.meta_anual || EFICIENCIA_META_OPS_INICIATIVAS
  const mesDestaque = mesDestaqueFiltro(mesFiltro, ano)
  const mesesEscopo = mesesEfetivosFiltro(mesFiltro, ano)

  const buckets = Array.from({ length: 12 }, () => ({
    total: 0,
    projetos: 0,
    melhorias: 0,
  }))

  const itensAno = (dash.itens ?? []).filter((i) =>
    itemNoEscopo(i.data, ano, null),
  )

  for (const item of itensAno) {
    const t = tipoItem(item.tags)
    if (t !== 'Projetos' && t !== 'Melhorias') continue
    const mes = Number((item.data ?? '').slice(5, 7))
    if (mes < 1 || mes > 12) continue
    const b = buckets[mes - 1]!
    b.total += 1
    if (t === 'Projetos') b.projetos += 1
    else b.melhorias += 1
  }

  let ytd = 0
  const evolucao: IniciativasMesEvo[] = buckets.map((b, i) => {
    const mes = i + 1
    ytd += b.total
    const pctYtd = meta > 0 ? (ytd / meta) * 100 : 0
    const pctMes =
      INICIATIVAS_META_MENSAL > 0 ? (b.total / INICIATIVAS_META_MENSAL) * 100 : 0
    return {
      mes,
      mesLabel: MESES_NOME[i] ?? String(mes),
      total: b.total,
      projetos: b.projetos,
      melhorias: b.melhorias,
      ytd,
      pctYtd,
      pctYtdLabel: formatPercent(pctYtd),
      metaMensal: INICIATIVAS_META_MENSAL,
      pctMes,
      pctMesLabel: formatPercent(pctMes),
      atingiu: b.total >= INICIATIVAS_META_MENSAL,
      destaque: mes === mesDestaque,
    }
  })

  const evolucaoAtiva = evolucao.filter((r) => {
    if (mesesEscopo) return mesesEscopo.includes(r.mes)
    return r.mes <= mesDestaque
  })

  const itensEscopo = itensAno.filter(
    (i) =>
      itemNoEscopo(i.data, ano, mesesEscopo) &&
      (tipoItem(i.tags) === 'Projetos' || tipoItem(i.tags) === 'Melhorias'),
  )

  const entregas: IniciativasEntrega[] = itensEscopo
    .map((i: OpsLegaisIniciativasItem) => {
      const mes = i.data ? Number(i.data.slice(5, 7)) : null
      return {
        id: i.id,
        nome: i.nome,
        tipo: tipoItem(i.tags),
        data: i.data,
        dataLabel: formatDataBr(i.data),
        mes: Number.isFinite(mes) ? mes : null,
        horas: i.horas,
        tags: i.tags,
        destaque: mes === mesDestaque,
      }
    })
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

  const total = itensEscopo.length
  const projetos = itensEscopo.filter((i) => tipoItem(i.tags) === 'Projetos').length
  const melhorias = itensEscopo.filter((i) => tipoItem(i.tags) === 'Melhorias').length
  const pct = meta > 0 ? (total / meta) * 100 : 0

  return {
    ano,
    meta,
    mesDestaque,
    mesDestaqueLabel: MESES_NOME[mesDestaque - 1] ?? String(mesDestaque),
    evolucao,
    evolucaoAtiva: evolucaoAtiva.length > 0 ? evolucaoAtiva : evolucao.slice(0, mesDestaque),
    entregas,
    andamento: buildAndamento(dash.painel?.andamento ?? []),
    totais: {
      total,
      projetos,
      melhorias,
      pct_progresso: pct,
      pct_progresso_label: formatPercent(pct),
    },
  }
}

export async function fetchApresentacaoIniciativas(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): Promise<ApresentacaoIniciativasData> {
  const dash = await eficienciaService.fetchOpsLegaisIniciativas(ano, null)
  return buildApresentacaoIniciativas(dash, ano, mesFiltro)
}
