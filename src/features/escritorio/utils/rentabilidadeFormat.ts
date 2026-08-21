import { formatCurrency } from '@/shared/utils/format'
import { formatHorasTimesheetHHMM } from './timesheetHorasExcel'

export function formatValorHoraRecebido(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return `${formatCurrency(valor).replace(/\s/g, ' ')}/h`
}

export function formatResultadoHora(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  const prefix = valor >= 0 ? '+' : '−'
  return `${prefix}${formatCurrency(Math.abs(valor)).replace(/\s/g, ' ')}/h`
}

export function formatMediaHorasMes(minutos: number | null | undefined): string {
  if (minutos == null || !Number.isFinite(minutos) || minutos <= 0) return '—'
  return formatHorasTimesheetHHMM(Math.round(minutos))
}

export function resultadoHoraPositivo(valor: number | null | undefined): boolean | null {
  if (valor == null || !Number.isFinite(valor)) return null
  return valor >= 0
}

export function labelPeriodo(dataInicio: string, dataFim: string): string {
  const fmt = (iso: string) => {
    const [y, m] = iso.split('-').map(Number)
    const nomes = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    return `${nomes[m - 1] ?? m} ${y}`
  }
  if (dataInicio.slice(0, 7) === dataFim.slice(0, 7)) return fmt(dataInicio)
  return `${fmt(dataInicio)} – ${fmt(dataFim)}`
}
