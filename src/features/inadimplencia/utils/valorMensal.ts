import type { ParcelaRow } from '../services/parcelasService'

type ParcelaValorMensal = Pick<ParcelaRow, 'data_vencimento' | 'valor' | 'plano_contas' | 'descricao'>

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function normPlano(plano: string | null | undefined): string {
  return (plano ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
}

/** Parcela do contrato mensal — exclui ND / reembolso de despesas. */
export function isParcelaContratoMensal(
  p: Pick<ParcelaValorMensal, 'plano_contas' | 'descricao'>,
): boolean {
  const plano = normPlano(p.plano_contas)
  if (!plano.includes('HONOR') || !plano.includes('MENSAIS')) return false
  const desc = (p.descricao ?? '').trim().toUpperCase()
  if (desc === 'ND' || desc.startsWith('ND ')) return false
  return true
}

/**
 * Soma as parcelas de honorários mensais em aberto do mês de referência:
 * mês calendário atual, se houver; senão, o próximo mês com parcela de contrato.
 */
export function calcularValorMensalParcelas(
  parcelas: ParcelaValorMensal[],
  hoje = hojeIso(),
): number | null {
  const comVencimento = parcelas.filter(
    (p) => Boolean(p.data_vencimento) && isParcelaContratoMensal(p),
  )
  if (comVencimento.length === 0) return null

  const inicioMesAtual = `${hoje.slice(0, 7)}-01`
  const aPartirDoMesAtual = comVencimento.filter((p) => p.data_vencimento >= inicioMesAtual)
  const alvo = aPartirDoMesAtual.length > 0 ? aPartirDoMesAtual : comVencimento
  const mesRef = alvo
    .slice()
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))[0]
    .data_vencimento.slice(0, 7)

  const total = alvo
    .filter((p) => p.data_vencimento.startsWith(mesRef))
    .reduce((sum, p) => sum + Number(p.valor ?? 0), 0)

  return total > 0 ? total : null
}
