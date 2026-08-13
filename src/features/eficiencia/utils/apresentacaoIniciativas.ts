import { MESES_NOME } from '@/features/receita/constants'
import {
  EFICIENCIA_META_OPS_INICIATIVAS,
  mesesEfetivosFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type { OpsLegaisIniciativasDashboard, OpsLegaisIniciativasItem } from '../types/eficiencia.types'
import { formatPercent } from '@/shared/utils/format'

export type IniciativasMesEvo = {
  mes: number
  mesLabel: string
  total: number
  projetos: number
  melhorias: number
  ytd: number
  pctYtd: number
  pctYtdLabel: string
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

export type ApresentacaoIniciativasData = {
  ano: number
  meta: number
  mesDestaque: number | null
  mesDestaqueLabel: string | null
  evolucao: IniciativasMesEvo[]
  /** Meses com movimento (ou até o destaque). */
  evolucaoAtiva: IniciativasMesEvo[]
  entregas: IniciativasEntrega[]
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
    return {
      mes,
      mesLabel: MESES_NOME[i] ?? String(mes),
      total: b.total,
      projetos: b.projetos,
      melhorias: b.melhorias,
      ytd,
      pctYtd,
      pctYtdLabel: formatPercent(pctYtd),
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
    .sort((a, b) => {
      if (a.destaque !== b.destaque) return a.destaque ? -1 : 1
      return (b.data ?? '').localeCompare(a.data ?? '')
    })

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
