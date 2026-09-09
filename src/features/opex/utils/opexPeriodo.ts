import { MESES_CURTOS } from '../constants'

export function planoFiltroKey(filtro: { gruposExcluidos: string[]; planosExcluidos: string[] }): string {
  const g = [...filtro.gruposExcluidos].sort().join('\u001f')
  const p = [...filtro.planosExcluidos].sort().join('\u001f')
  return `${g}\u001e${p}`
}

export function mesesFiltroKey(meses: number[]): string {
  if (!meses.length) return 'ano'
  return [...meses].sort((a, b) => a - b).join(',')
}

export function toggleMesFiltro(meses: number[], mes: number): number[] {
  if (meses.includes(mes)) {
    return meses.filter((m) => m !== mes).sort((a, b) => a - b)
  }
  return [...meses, mes].sort((a, b) => a - b)
}

export function temFiltroMeses(meses: number[]): boolean {
  return meses.length > 0
}

export function formatPeriodoOpex(meses: number[], mesAtual: number, ano: number): string {
  if (!meses.length) {
    return mesAtual > 0 ? `jan–${MESES_CURTOS[mesAtual - 1]} / ${ano}` : `ano / ${ano}`
  }
  const sorted = [...meses].sort((a, b) => a - b)
  if (sorted.length === 1) {
    return `${MESES_CURTOS[sorted[0] - 1]} / ${ano}`
  }
  const consecutivo =
    sorted[sorted.length - 1] - sorted[0] + 1 === sorted.length
  if (consecutivo) {
    return `${MESES_CURTOS[sorted[0] - 1]}–${MESES_CURTOS[sorted[sorted.length - 1] - 1]} / ${ano}`
  }
  return sorted.map((m) => MESES_CURTOS[m - 1]).join(', ') + ` / ${ano}`
}

export function mesesYtd(mesAtual: number): number[] {
  if (mesAtual <= 0) return []
  return Array.from({ length: mesAtual }, (_, i) => i + 1)
}

/** Meses do KPI atual, para buscar o mesmo recorte no ano anterior (não o ano cheio). */
export function mesesComparacaoYoY(mesesFiltro: number[], mesAtual: number): number[] {
  if (mesesFiltro.length) return [...mesesFiltro].sort((a, b) => a - b)
  return mesesYtd(mesAtual)
}

/** Variação % do realizado atual vs o mesmo período do ano anterior. Sem base → null. */
export function yoyPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null
  if (anterior === 0) return atual === 0 ? 0 : null
  return ((atual - anterior) / anterior) * 100
}
