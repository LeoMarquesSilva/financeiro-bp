import type { ReceitaPrevistoFechamentoBucket } from '../types/receita.types'
import type { ReceitaRecebidoDetalheKey } from './recebidoClassificacao'
import { RECEBIDO_DETALHE_DESCRICOES, RECEBIDO_DETALHE_LABELS } from './recebidoClassificacao'

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
  inad_grupo: 'Saldo inadimplente (grupo)',
  previsto_grupo: 'Previsto do mês — por grupo',
}

export const FECHAMENTO_DRILL_HINTS: Record<FechamentoDrillKey, string> = {
  ...FECHAMENTO_BUCKET_HINTS,
  inad_grupo: 'Por grupo: max(0, faturado − recebido) no mês',
  previsto_grupo: 'Vencimentos do mês (valor item) e quitado no mês por grupo',
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
