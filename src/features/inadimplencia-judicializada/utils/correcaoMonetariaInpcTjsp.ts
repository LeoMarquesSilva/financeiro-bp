import {
  INPC_VARIACAO_MENSAL,
  TJSP_JUROS_MENSAL_PCT,
} from '@/shared/constants/inpcMensal'

export type AtualizacaoInpcTjsp = {
  valorNominal: number
  valorCorrigidoInpc: number
  valorCorrecaoInpc: number
  valorJurosMora: number
  valorAtualizado: number
  mesesAtualizacao: number
  dataReferencia: string
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Atualiza valor com correção INPC (composta mês a mês) + juros moratórios TJSP (1% a.m. simples
 * sobre o principal), contados a partir do mês da judicialização até o mês de referência.
 */
export function atualizarValorInpcTjsp(
  valorNominal: number,
  dataJudicializacao: string | null | undefined,
  dataReferencia: Date = new Date(),
): AtualizacaoInpcTjsp {
  const dataRefIso = dataReferencia.toISOString().slice(0, 10)

  if (!valorNominal || valorNominal <= 0 || !dataJudicializacao) {
    return {
      valorNominal: valorNominal || 0,
      valorCorrigidoInpc: valorNominal || 0,
      valorCorrecaoInpc: 0,
      valorJurosMora: 0,
      valorAtualizado: valorNominal || 0,
      mesesAtualizacao: 0,
      dataReferencia: dataRefIso,
    }
  }

  const inicio = parseIsoDate(dataJudicializacao)
  let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
  const fim = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1)

  let valorCorrigido = valorNominal
  let mesesAtualizacao = 0

  while (cursor <= fim) {
    const key = monthKey(cursor)
    const variacao = INPC_VARIACAO_MENSAL[key]
    if (variacao != null) {
      valorCorrigido *= 1 + variacao / 100
    }
    mesesAtualizacao += 1
    cursor = addMonths(cursor, 1)
  }

  const valorCorrecaoInpc = valorCorrigido - valorNominal
  const valorJurosMora = valorNominal * (TJSP_JUROS_MENSAL_PCT / 100) * mesesAtualizacao
  const valorAtualizado = valorCorrigido + valorJurosMora

  return {
    valorNominal,
    valorCorrigidoInpc: roundMoney(valorCorrigido),
    valorCorrecaoInpc: roundMoney(valorCorrecaoInpc),
    valorJurosMora: roundMoney(valorJurosMora),
    valorAtualizado: roundMoney(valorAtualizado),
    mesesAtualizacao,
    dataReferencia: dataRefIso,
  }
}
