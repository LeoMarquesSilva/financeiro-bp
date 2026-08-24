import type { ParcelaRow } from '../services/parcelasService'

type ParcelaValorMensal = Pick<ParcelaRow, 'data_vencimento' | 'valor'>

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Soma todas as parcelas em aberto do mês de referência:
 * mês calendário atual, se houver parcela nele; senão, o próximo mês com parcela.
 * Evita usar só a primeira parcela a vencer (ex.: êxito residual).
 */
export function calcularValorMensalParcelas(
  parcelas: ParcelaValorMensal[],
  hoje = hojeIso(),
): number | null {
  const comVencimento = parcelas.filter((p) => Boolean(p.data_vencimento))
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
