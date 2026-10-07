/** Minutos inteiros → `H:MM`, com milhar pt-BR nas horas. */
export function formatTimesheetHoras(minutos: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(minutos) || 0))
  const horas = Math.floor(total / 60)
  const mm = total % 60
  return `${horas.toLocaleString('pt-BR')}:${String(mm).padStart(2, '0')}`
}
