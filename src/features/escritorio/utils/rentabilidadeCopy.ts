import { formatCurrency, formatPercent } from '@/shared/utils/format'
import type { RentabilidadeContratoLinha } from '../services/escritorioRentabilidadeService'

export const RENTABILIDADE_COPY_LIMITE = 20

export const RENTABILIDADE_COPY_CARD_BG = '#FBFAF6'

export function mesesCalendarioNoPeriodo(dataInicio: string, dataFim: string): number {
  const [yi, mi] = dataInicio.split('-').map(Number)
  const [yf, mf] = dataFim.split('-').map(Number)
  if (!yi || !mi || !yf || !mf) return 1
  return Math.max(1, (yf - yi) * 12 + (mf - mi) + 1)
}

/** Horas totais no período, com separador de milhar (ex.: 1.428). */
export function formatHorasRentabilidadeCopia(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos) || minutos <= 0) return '—'
  const horas = Math.round(minutos / 60)
  return horas.toLocaleString('pt-BR')
}

export function formatHonorarioMensalCopia(previstoPeriodo: number, meses: number): string {
  if (meses <= 0 || previstoPeriodo <= 0) return '—'
  const mensal = previstoPeriodo / meses
  if (mensal >= 1_000) {
    const mil = mensal / 1_000
    return `R$ ${mil.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`
  }
  return formatCurrency(mensal).replace(/\s/g, ' ')
}

export function formatValorHoraCopia(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return formatCurrency(valor).replace(/\s/g, ' ')
}

export function pctVsMediaValorHora(
  valor: number | null | undefined,
  media: number | null | undefined,
): number | null {
  if (valor == null || media == null || !Number.isFinite(valor) || !Number.isFinite(media) || media <= 0) {
    return null
  }
  return ((valor - media) / media) * 100
}

export function formatVsMediaPercentualCopia(
  valor: number | null | undefined,
  media: number | null | undefined,
): string {
  const pct = pctVsMediaValorHora(valor, media)
  if (pct == null) return '—'
  const sinal = pct >= 0 ? '+' : '−'
  return `${sinal}${formatPercent(Math.abs(pct))}`
}

export type RentabilidadeCopiaTom = 'alto' | 'baixo' | 'neutro'

const LIMIAR_PCT_DESTAQUE = 5

export function tomVsMediaCopia(
  valor: number | null | undefined,
  media: number | null | undefined,
): RentabilidadeCopiaTom {
  const pct = pctVsMediaValorHora(valor, media)
  if (pct == null) return 'neutro'
  if (pct >= LIMIAR_PCT_DESTAQUE) return 'alto'
  if (pct <= -LIMIAR_PCT_DESTAQUE) return 'baixo'
  return 'neutro'
}

export function buildLeituraRentabilidadeCopia(
  linha: RentabilidadeContratoLinha,
  mediaValorHora: number | null,
  mediaEfetivo: number | null,
): string {
  const prev = linha.valor_hora_previsto
  const efet = linha.valor_hora_efetivo
  const pctPrev = pctVsMediaValorHora(prev, mediaValorHora)
  const ratioRecebido =
    prev != null && efet != null && prev > 0 ? efet / prev : null

  if (pctPrev != null && pctPrev >= 15) return 'Melhor preço;'

  if (
    ratioRecebido != null &&
    ratioRecebido < 0.75 &&
    pctPrev != null &&
    Math.abs(pctPrev) <= 10
  ) {
    if (ratioRecebido < 0.35) return 'Preço na média; recebe 1/4 do valor'
    if (ratioRecebido < 0.55) return 'Preço na média; recebe metade do valor'
    return 'Preço na média; recebimento abaixo do faturado'
  }

  if (
    prev != null &&
    mediaValorHora != null &&
    efet != null &&
    prev >= mediaValorHora * 0.95 &&
    efet >= prev * 0.85 &&
    Math.abs(efet - prev) / Math.max(prev, 1) < 0.15
  ) {
    return 'Contrato saudável: preço justo e pago em dia'
  }

  if (pctPrev != null && pctPrev <= -15 && (ratioRecebido == null || ratioRecebido >= 0.85)) {
    return 'Paga em dia, mas preço baixo para o esforço'
  }

  if (ratioRecebido != null && ratioRecebido < 0.75) {
    return 'Preço ok, mas recebimento abaixo do faturado;'
  }

  if (pctPrev != null && pctPrev <= -LIMIAR_PCT_DESTAQUE) {
    return 'Preço abaixo da média do escritório;'
  }

  if (pctPrev != null && pctPrev >= LIMIAR_PCT_DESTAQUE) {
    return 'Preço acima da média;'
  }

  if (efet != null && mediaEfetivo != null && efet < mediaEfetivo * 0.85) {
    return 'Hora efetiva abaixo da média;'
  }

  return 'Na média do escritório;'
}

export function inicioUltimos3Meses(dataFimIso: string): string {
  const [y, m] = dataFimIso.split('-').map(Number)
  if (!y || !m) return dataFimIso
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 2)
  return d.toISOString().slice(0, 10)
}

export function labelUltimos3Meses(dataFimIso: string): string {
  const inicio = inicioUltimos3Meses(dataFimIso)
  const fmt = (iso: string) => {
    const [yy, mm] = iso.split('-').map(Number)
    const nomes = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ]
    return `${nomes[(mm ?? 1) - 1]}/${String(yy).slice(-2)}`
  }
  return `${fmt(inicio)} – ${fmt(dataFimIso)}`
}

export function normalizarChaveGrupoRentabilidade(nome: string): string {
  return nome.trim().toLowerCase()
}

export function buildGruposComFaturamentoSet(chaves: string[] | undefined): Set<string> {
  const set = new Set<string>()
  for (const c of chaves ?? []) {
    const t = c.trim()
    if (t) set.add(normalizarChaveGrupoRentabilidade(t))
  }
  return set
}

export function rankingRentabilidadeParaCopia(
  linhas: RentabilidadeContratoLinha[],
  gruposComFaturamento: Set<string>,
  dir: 'desc' | 'asc',
  limit = RENTABILIDADE_COPY_LIMITE,
): RentabilidadeContratoLinha[] {
  const eligible = linhas.filter((l) => {
    if (l.valor_hora_efetivo == null || !Number.isFinite(l.valor_hora_efetivo)) return false
    if (gruposComFaturamento.size === 0) return false
    return gruposComFaturamento.has(normalizarChaveGrupoRentabilidade(l.cliente))
  })
  return [...eligible]
    .sort((a, b) => {
      const cmp = (a.valor_hora_efetivo ?? 0) - (b.valor_hora_efetivo ?? 0)
      if (cmp === 0) return a.cliente.localeCompare(b.cliente, 'pt-BR')
      return dir === 'desc' ? -cmp : cmp
    })
    .slice(0, limit)
}
