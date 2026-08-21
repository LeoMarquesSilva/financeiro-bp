/**
 * Timesheet — mesma regra do Excel/BI: arredonda minutos por linha, depois soma.
 * Evita divergência entre SUM(decimal) no KPI vs SOMA de [h]:mm na planilha.
 */

/** Minutos exibidos por apontamento (floor h + round fração). */
export function minutosTimesheetLinha(horasDecimais: number): number {
  if (!Number.isFinite(horasDecimais) || horasDecimais <= 0) return 0
  const h = Math.floor(horasDecimais)
  let min = Math.round((horasDecimais - h) * 60)
  if (min >= 60) min = 0
  return h * 60 + min
}

/** Total em horas decimais após somar minutos linha a linha (estilo Excel). */
export function horasTimesheetTotalEstiloExcel(minutosTotais: number): number {
  return minutosTotais / 60
}

/** Formato compacto HH:MM (ex.: 154:55) — total ou linha. */
export function formatHorasTimesheetHHMM(minutosTotais: number): string {
  const safe = Math.max(0, Math.round(minutosTotais))
  const h = Math.floor(safe / 60)
  const min = safe % 60
  return `${h}:${String(min).padStart(2, '0')}`
}

/** HH:MM de um apontamento (decimal → arredondamento por linha). */
export function formatHorasTimesheetLinhaHHMM(horasDecimais: number): string {
  return formatHorasTimesheetHHMM(minutosTimesheetLinha(horasDecimais))
}

/** HH:MM do total (horas decimais já somadas estilo Excel). */
export function formatHorasTimesheetTotalHHMM(horasDecimaisTotal: number): string {
  return formatHorasTimesheetHHMM(Math.round(horasDecimaisTotal * 60))
}

export function parseHorasDecimaisValor(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
