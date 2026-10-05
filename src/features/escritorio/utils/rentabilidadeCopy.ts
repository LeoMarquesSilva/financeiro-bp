import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import { formatHorasTimesheetHHMM } from './timesheetHorasExcel'
import type { RentabilidadeContratoLinha } from '../services/escritorioRentabilidadeService'

export const RENTABILIDADE_COPY_LIMITE = 20

/** Fundo do slide de cópia — transparente para colar no PowerPoint com fundo próprio. */
export const RENTABILIDADE_COPY_CARD_BG = 'transparent'

export function mesesCalendarioNoPeriodo(dataInicio: string, dataFim: string): number {
  const [yi, mi] = dataInicio.split('-').map(Number)
  const [yf, mf] = dataFim.split('-').map(Number)
  if (!yi || !mi || !yf || !mf) return 1
  return Math.max(1, (yf - yi) * 12 + (mf - mi) + 1)
}

/** Horas totais no período — mesmo HH:MM do timesheet (ex.: 1428:00). */
export function formatHorasRentabilidadeCopia(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos) || minutos <= 0) return '—'
  return formatHorasTimesheetHHMM(Math.round(minutos))
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

/** Export PPT: percentuais enormes viram "mil%" para caber na coluna. */
export function formatVsMediaPercentualCopiaExport(
  valor: number | null | undefined,
  media: number | null | undefined,
): string {
  const pct = pctVsMediaValorHora(valor, media)
  if (pct == null) return '—'
  const abs = Math.abs(pct)
  const sinal = pct >= 0 ? '+' : '−'
  if (abs >= 1_000) {
    const mil = abs / 1_000
    return `${sinal}${mil.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mil%`
  }
  return formatVsMediaPercentualCopia(valor, media)
}

/** Export PPT: valores altos em notação compacta. */
export function formatValorHoraCopiaExport(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  if (Math.abs(valor) >= 10_000) {
    return `${formatCurrencyCompact(valor).replace(/\s/g, ' ')}/h`
  }
  return formatValorHoraCopia(valor)
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

export type RentabilidadeCopiaVariant = 'top' | 'bottom'

export type RentabilidadeCopiaInsightCard = {
  accent: string
  headlineMetric: string
  headlineRest: string
  body: string
  footerBold?: string
}

const INSIGHT_ACCENT_NAVY = '#0f2744'
const INSIGHT_ACCENT_GREEN = '#1a6b42'
const INSIGHT_ACCENT_ORANGE = '#b45309'

export function nomeCurtoRentabilidade(cliente: string): string {
  return cliente.replace(/^Grupo\s+/i, '').trim() || cliente
}

function listaNomesRentabilidadeCurta(linhas: RentabilidadeContratoLinha[], max = 3): string {
  const nomes = linhas.slice(0, max).map((l) => nomeCurtoRentabilidade(l.cliente))
  if (nomes.length === 0) return '—'
  if (nomes.length === 1) return nomes[0]!
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

function cardMediaHoraEscritorio(input: {
  mediaValorHoraEscritorio: number | null
  mediaEfetivoEscritorio: number | null
  horasEscritorioMinutos: number
  recebidoEscritorio: number
}): RentabilidadeCopiaInsightCard {
  const recebidoFmt = formatCurrency(input.recebidoEscritorio).replace(/\s/g, ' ')
  return {
    accent: INSIGHT_ACCENT_NAVY,
    headlineMetric: formatValorHoraCopia(input.mediaEfetivoEscritorio),
    headlineRest: ' hora efetiva média',
    body: `Média do escritório no período: hora prevista/faturada ${formatValorHoraCopia(input.mediaValorHoraEscritorio)} · ${formatHorasRentabilidadeCopia(input.horasEscritorioMinutos)} no timesheet · ${recebidoFmt} recebidos.`,
  }
}

export function buildInsightsRentabilidadeCopia(input: {
  variant: RentabilidadeCopiaVariant
  linhas: RentabilidadeContratoLinha[]
  mediaValorHoraEscritorio: number | null
  mediaEfetivoEscritorio: number | null
  horasEscritorioMinutos: number
  recebidoEscritorio: number
}): RentabilidadeCopiaInsightCard[] {
  const media = cardMediaHoraEscritorio(input)
  const { linhas, mediaValorHoraEscritorio, mediaEfetivoEscritorio, horasEscritorioMinutos, recebidoEscritorio } =
    input

  if (linhas.length === 0) return [media]

  if (input.variant === 'top') {
    const lider = linhas[0]!
    const pctLider = formatVsMediaPercentualCopiaExport(
      lider.valor_hora_efetivo,
      mediaEfetivoEscritorio,
    )
    const destaque: RentabilidadeCopiaInsightCard = {
      accent: INSIGHT_ACCENT_GREEN,
      headlineMetric: pctLider !== '—' ? pctLider : formatValorHoraCopia(lider.valor_hora_efetivo),
      headlineRest: pctLider !== '—' ? ' vs média · hora efetiva' : ' · melhor hora efetiva',
      body: `${nomeCurtoRentabilidade(lider.cliente)} lidera o ranking: ${formatValorHoraCopia(lider.valor_hora_efetivo)}/h recebido, hora faturada ${formatValorHoraCopia(lider.valor_hora_previsto)} e ${formatHorasRentabilidadeCopia(lider.horas_minutos)} registradas.`,
      footerBold: buildLeituraRentabilidadeCopia(
        lider,
        mediaValorHoraEscritorio,
        mediaEfetivoEscritorio,
      ),
    }

    const top3 = linhas.slice(0, Math.min(3, linhas.length))
    const horasTop3 = top3.reduce((s, l) => s + l.horas_minutos, 0)
    const recebidoTop3 = top3.reduce((s, l) => s + l.recebido_periodo, 0)
    const pctHoras =
      horasEscritorioMinutos > 0 ? (horasTop3 / horasEscritorioMinutos) * 100 : 0
    const pctRecebido =
      recebidoEscritorio > 0 ? (recebidoTop3 / recebidoEscritorio) * 100 : 0

    const concentracao: RentabilidadeCopiaInsightCard = {
      accent: INSIGHT_ACCENT_NAVY,
      headlineMetric: `${top3.length} cliente${top3.length === 1 ? '' : 's'}`,
      headlineRest: '',
      body: `${listaNomesRentabilidadeCurta(top3)} concentram ${formatPercent(pctHoras)} das horas e ${formatPercent(pctRecebido)} do recebido do escritório entre os mais rentáveis.`,
    }

    return [media, destaque, concentracao]
  }

  const pior = linhas[0]!
  const piorPct = formatVsMediaPercentualCopiaExport(pior.valor_hora_efetivo, mediaEfetivoEscritorio)
  const alerta: RentabilidadeCopiaInsightCard = {
    accent: INSIGHT_ACCENT_ORANGE,
    headlineMetric: piorPct !== '—' ? piorPct : formatValorHoraCopia(pior.valor_hora_efetivo),
    headlineRest: piorPct !== '—' ? ' vs média · hora efetiva' : ' · menor hora efetiva',
    body: `${nomeCurtoRentabilidade(pior.cliente)}: ${formatValorHoraCopia(pior.valor_hora_efetivo)}/h efetivo, hora faturada ${formatValorHoraCopia(pior.valor_hora_previsto)} e ${formatHorasRentabilidadeCopia(pior.horas_minutos)} no período.`,
    footerBold: buildLeituraRentabilidadeCopia(
      pior,
      mediaValorHoraEscritorio,
      mediaEfetivoEscritorio,
    ),
  }

  const abaixoMedia = linhas.filter((l) => {
    const pct = pctVsMediaValorHora(l.valor_hora_efetivo, mediaEfetivoEscritorio)
    return pct != null && pct <= -LIMIAR_PCT_DESTAQUE
  })
  const recebimentoAbaixo = linhas.filter((l) => {
    const p = l.valor_hora_previsto
    const e = l.valor_hora_efetivo
    return p != null && e != null && p > 0 && e < p * 0.75
  })
  const amostra = (recebimentoAbaixo.length > 0 ? recebimentoAbaixo : abaixoMedia).slice(0, 3)

  const pressao: RentabilidadeCopiaInsightCard = {
    accent: INSIGHT_ACCENT_ORANGE,
    headlineMetric: `${abaixoMedia.length} contrato${abaixoMedia.length === 1 ? '' : 's'}`,
    headlineRest: ' abaixo da média',
    body:
      amostra.length > 0
        ? `${listaNomesRentabilidadeCurta(amostra)}${recebimentoAbaixo.length > 0 ? `: recebimento efetivo abaixo de 75% da hora faturada em ${recebimentoAbaixo.length} grupo${recebimentoAbaixo.length === 1 ? '' : 's'}.` : ': hora efetiva abaixo da média do escritório.'}`
        : 'Nenhum grupo nesta lista ficou materialmente abaixo da média de hora efetiva.',
    footerBold:
      recebimentoAbaixo.length > 0
        ? 'Revisar preço e inadimplência nos contratos com maior esforço de horas.'
        : 'Priorizar renegociação de honorários nos grupos com preço baixo.',
  }

  return [media, alerta, pressao]
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
