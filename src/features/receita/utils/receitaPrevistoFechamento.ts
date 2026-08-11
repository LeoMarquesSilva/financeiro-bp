import type { ReceitaPrevistoFechamentoBucket, ReceitaPrevistoFechamentoMes } from '../types/receita.types'
import type { ReceitaRecebidoClassificacaoItemRow } from '../types/receita.types'
import type { ReceitaRecebidoDetalheKey } from './recebidoClassificacao'
import { agruparRecebidoDetalhe, RECEBIDO_DETALHE_DESCRICOES, RECEBIDO_DETALHE_LABELS } from './recebidoClassificacao'

export const FECHAMENTO_BUCKET_LABELS: Record<ReceitaPrevistoFechamentoBucket, string> = {
  em_aberto: 'Não quitado no item (sem baixa)',
  quitado_no_mes: 'Quitado no mês',
  quitado_antecipado: 'Quitado antecipado',
  quitado_pago_depois: 'Quitado pago depois',
}

export const FECHAMENTO_BUCKET_HINTS: Record<ReceitaPrevistoFechamentoBucket, string> = {
  em_aberto: 'Vencimento neste mês, sem baixa no item — soma valor item',
  quitado_no_mes: 'Vencimento e baixa neste mês — valor item',
  quitado_antecipado: 'Vencimento neste mês, baixa antes do mês — valor item',
  quitado_pago_depois: 'Vencimento neste mês, baixa após o mês — valor item',
}

export type FechamentoDrillKey = ReceitaPrevistoFechamentoBucket | 'inad_grupo' | 'previsto_grupo'

export const FECHAMENTO_DRILL_LABELS: Record<FechamentoDrillKey, string> = {
  ...FECHAMENTO_BUCKET_LABELS,
  inad_grupo: 'Inadimplência do mês — por grupo',
  previsto_grupo: 'Previsto do mês — por grupo',
}

export const FECHAMENTO_DRILL_HINTS: Record<FechamentoDrillKey, string> = {
  ...FECHAMENTO_BUCKET_HINTS,
  inad_grupo:
    'Vencido até hoje no mês, não pago — item a item, sem compensação entre razões sociais',
  previsto_grupo:
    'Vencimentos do mês por data e grupo. Inad. = vencido até hoje, não quitado no mês (item a item).',
}

export type ReceitaGerencialRecebidoLinha = {
  key: ReceitaRecebidoDetalheKey
  label: string
  hint: string
  valorKey:
    | 'inad_recebida'
    | 'receita_mes_caixa'
    | 'novos_vencimento_mes'
    | 'novos_vencimento_anterior'
  valorClassName: string
  barClassName: string
}

export const RECEBIDO_GERENCIAL_LINHAS: ReceitaGerencialRecebidoLinha[] = [
  {
    key: 'inadimplencia',
    label: RECEBIDO_DETALHE_LABELS.inadimplencia,
    hint: RECEBIDO_DETALHE_DESCRICOES.inadimplencia,
    valorKey: 'inad_recebida',
    valorClassName: 'text-red-700',
    barClassName: 'bg-red-500',
  },
  {
    key: 'receita_mes',
    label: RECEBIDO_DETALHE_LABELS.receita_mes,
    hint: RECEBIDO_DETALHE_DESCRICOES.receita_mes,
    valorKey: 'receita_mes_caixa',
    valorClassName: 'text-emerald-700',
    barClassName: 'bg-emerald-500',
  },
  {
    key: 'novos_vencimento_mes',
    label: RECEBIDO_DETALHE_LABELS.novos_vencimento_mes,
    hint: RECEBIDO_DETALHE_DESCRICOES.novos_vencimento_mes,
    valorKey: 'novos_vencimento_mes',
    valorClassName: 'text-violet-700',
    barClassName: 'bg-violet-500',
  },
  {
    key: 'novos_vencimento_anterior',
    label: RECEBIDO_DETALHE_LABELS.novos_vencimento_anterior,
    hint: RECEBIDO_DETALHE_DESCRICOES.novos_vencimento_anterior,
    valorKey: 'novos_vencimento_anterior',
    valorClassName: 'text-violet-600',
    barClassName: 'bg-violet-400',
  },
]

type PrevistoItemFechamento = {
  valor_item: number
  data_vencimento?: string | null
  data_pagamento?: string | null
}

function formatDateIsoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data de corte: hoje no mês corrente; último dia do mês em meses já encerrados. */
export function refDateCorteInadMes(ano: number, mes: number, ref = new Date()): string {
  const mesFim = new Date(ano, mes, 0)
  const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const corte = mesFim.getTime() < hoje.getTime() ? mesFim : hoje
  return formatDateIsoLocal(corte)
}

export function itemVencimentoVencidoAteCorte(
  data_vencimento: string | null | undefined,
  corteIso: string,
): boolean {
  if (!data_vencimento?.trim()) return false
  return data_vencimento.trim().slice(0, 10) <= corteIso
}

/**
 * Vencimento no mês, já vencido até a data de corte, ainda não quitado no mês.
 * Sem compensação entre grupos; vencimentos futuros no mês não entram.
 */
export function inadimplenciaItemMesFaturadoNaoPago(
  item: PrevistoItemFechamento,
  ano: number,
  mes: number,
  ref = new Date(),
): number {
  const corte = refDateCorteInadMes(ano, mes, ref)
  if (!itemVencimentoVencidoAteCorte(item.data_vencimento, corte)) return 0

  const pg = item.data_pagamento
  if (!pg) return item.valor_item
  const d = new Date(`${pg}T12:00:00`)
  const mesInicio = new Date(ano, mes - 1, 1)
  if (d.getFullYear() === ano && d.getMonth() + 1 === mes) return 0
  if (d < mesInicio) return 0
  return item.valor_item
}

/** Vencido no mês e não quitado no mês (item a item, sem compensação de grupo). */
export function inadimplenciaMesFaturadoNaoPago(fechamento: ReceitaPrevistoFechamentoMes): number {
  return Math.max(0, fechamento.inadimplencia_kpi)
}

/** Monta KPIs de fechamento a partir de itens previsto + classificação (visão por área). */
export function buildPrevistoFechamentoMesFromDados(
  previstoItens: PrevistoItemFechamento[],
  classificacaoItens: ReceitaRecebidoClassificacaoItemRow[],
  ano: number,
  mes: number,
): ReceitaPrevistoFechamentoMes {
  const mesInicio = new Date(ano, mes - 1, 1)
  const mesFim = new Date(ano, mes, 0)

  let previsto = 0
  let quitado_no_mes = 0
  let quitado_antecipado = 0
  let quitado_pago_depois = 0
  let em_aberto = 0

  for (const item of previstoItens) {
    previsto += item.valor_item
    const pg = item.data_pagamento
    if (!pg) {
      em_aberto += item.valor_item
      continue
    }
    const d = new Date(`${pg}T12:00:00`)
    if (d.getFullYear() === ano && d.getMonth() + 1 === mes) {
      quitado_no_mes += item.valor_item
    } else if (d < mesInicio) {
      quitado_antecipado += item.valor_item
    } else if (d > mesFim) {
      quitado_pago_depois += item.valor_item
    }
  }

  const detalhe = agruparRecebidoDetalhe(classificacaoItens, ano, mes)
  const totalPorKey = Object.fromEntries(detalhe.map((d) => [d.key, d.total])) as Partial<
    Record<ReceitaRecebidoDetalheKey, number>
  >

  const inad_recebida = totalPorKey.inadimplencia ?? 0
  const receita_mes_caixa = totalPorKey.receita_mes ?? 0
  const novos_vencimento_mes = totalPorKey.novos_vencimento_mes ?? 0
  const novos_vencimento_anterior = totalPorKey.novos_vencimento_anterior ?? 0
  const novos_total = novos_vencimento_mes + novos_vencimento_anterior
  const recebido_classificado = inad_recebida + receita_mes_caixa + novos_total
  const recebido_previsto_caixa = receita_mes_caixa + novos_vencimento_mes
  let inadimplencia_mes = 0
  for (const item of previstoItens) {
    inadimplencia_mes += inadimplenciaItemMesFaturadoNaoPago(item, ano, mes)
  }

  return {
    previsto,
    quitado_no_mes,
    quitado_antecipado,
    quitado_pago_depois,
    quitado_outro_mes: quitado_antecipado + quitado_pago_depois,
    em_aberto,
    inadimplencia_kpi: inadimplencia_mes,
    receita_mes_caixa,
    inad_recebida,
    novos_total,
    novos_vencimento_mes,
    novos_vencimento_anterior,
    recebido_previsto_caixa,
    recebido_classificado,
  }
}

export function filtrarPrevistoMesItensPorCiItens<
  T extends { ci_item: number },
>(itens: T[], ciItensArea: Array<{ ci_item: number }>): T[] {
  if (ciItensArea.length === 0) return []
  const ids = new Set(ciItensArea.map((i) => i.ci_item))
  return itens.filter((i) => ids.has(i.ci_item))
}
