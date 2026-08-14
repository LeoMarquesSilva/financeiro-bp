import { MESES_ABREV } from '@/features/receita/constants'

/** Ano mínimo do filtro De/Até do Jurídico Unificado. */
export const UNIFICADO_ANO_MIN = 2025

export type MesAno = { ano: number; mes: number }

export function mesAnoKey(m: MesAno): number {
  return m.ano * 12 + m.mes
}

export function compareMesAno(a: MesAno, b: MesAno): number {
  return mesAnoKey(a) - mesAnoKey(b)
}

/** Ex.: Jan/25, Ago/26 */
export function labelMesAno(m: MesAno): string {
  const abrev = MESES_ABREV[m.mes - 1] ?? String(m.mes)
  return `${abrev}/${String(m.ano).slice(2)}`
}

export function enumerateMesAno(inicio: MesAno, fim: MesAno): MesAno[] {
  const a = compareMesAno(inicio, fim) <= 0 ? inicio : fim
  const b = compareMesAno(inicio, fim) <= 0 ? fim : inicio
  const out: MesAno[] = []
  let y = a.ano
  let m = a.mes
  while (y < b.ano || (y === b.ano && m <= b.mes)) {
    out.push({ ano: y, mes: m })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** Opções do select: Jan/2025 … mês corrente. */
export function opcoesMesAnoAteHoje(ref = new Date()): MesAno[] {
  return enumerateMesAno(
    { ano: UNIFICADO_ANO_MIN, mes: 1 },
    { ano: ref.getFullYear(), mes: ref.getMonth() + 1 },
  )
}

export function anosNoPeriodo(inicio: MesAno, fim: MesAno): number[] {
  const slots = enumerateMesAno(inicio, fim)
  return [...new Set(slots.map((s) => s.ano))].sort((a, b) => a - b)
}

export function mesAnoFromValue(value: string): MesAno {
  const [ano, mes] = value.split('-').map(Number)
  return { ano: ano!, mes: mes! }
}

export function mesAnoToValue(m: MesAno): string {
  return `${m.ano}-${m.mes}`
}
