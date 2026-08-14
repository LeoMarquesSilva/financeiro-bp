import { EFICIENCIA_META_TREINAMENTO_MINUTOS } from '../constants'

/**
 * Meses elegíveis de treinamento no ano-calendário.
 * - Admitido em ano anterior: 12
 * - Admitido no ano: a partir do mês da admissão; se dia > 15, mês seguinte
 * - Admitido após o ano: 0
 */
export function mesesElegiveisTreinamento(
  admissao: string | Date | null | undefined,
  ano: number,
): number {
  if (admissao == null || admissao === '') return 12
  const iso =
    typeof admissao === 'string'
      ? admissao.slice(0, 10)
      : admissao.toISOString().slice(0, 10)
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 12
  if (y < ano) return 12
  if (y > ano) return 0
  const primeiroMes = d > 15 ? m + 1 : m
  if (primeiroMes > 12) return 0
  return 12 - primeiroMes + 1
}

/** Meta individual em minutos: 14h × meses_elegíveis / 12. */
export function metaTreinamentoMinutosProporcional(
  admissao: string | Date | null | undefined,
  ano: number,
): number {
  const meses = mesesElegiveisTreinamento(admissao, ano)
  return Math.round(((EFICIENCIA_META_TREINAMENTO_MINUTOS * meses) / 12) * 100) / 100
}
