/** Minutos → `HH:MM` (ex.: 90 → `01:30`) — exibição na UI. */
export function formatMinutosHHMM(minutos: number): string {
  const total = Math.max(0, Math.round(minutos))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Serial Excel (fração do dia) para somar em pivot/tabela dinâmica com formato `[h]:mm`. */
export function minutosParaExcelDuracao(minutos: number): number {
  return Math.max(0, Math.round(minutos)) / (24 * 60)
}

export const EXCEL_DURACAO_NUMFMT = '[h]:mm'
