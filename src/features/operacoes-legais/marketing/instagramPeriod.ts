import type { InstagramPeriodFilter, InstagramPeriodRange } from './types'

function isoStart(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString()
}

function isoEnd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString()
}

export function resolveInstagramPeriod(filter: InstagramPeriodFilter): InstagramPeriodRange {
  if (filter.kind === 'all') return { from: null, to: null }
  if (filter.kind === 'custom') {
    return {
      from: `${filter.from}T00:00:00.000Z`,
      to: `${filter.to}T23:59:59.999Z`,
    }
  }
  if (filter.kind === 'year') {
    return { from: isoStart(filter.year, 0, 1), to: isoEnd(filter.year, 11, 31) }
  }
  const lastDay = new Date(Date.UTC(filter.year, filter.month, 0)).getUTCDate()
  return {
    from: isoStart(filter.year, filter.month - 1, 1),
    to: isoEnd(filter.year, filter.month - 1, lastDay),
  }
}

export function formatInstagramPeriod(filter: InstagramPeriodFilter): string {
  if (filter.kind === 'all') return 'Todo o histórico'
  if (filter.kind === 'year') return String(filter.year)
  if (filter.kind === 'custom') return `${filter.from} a ${filter.to}`
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(filter.year, filter.month - 1, 1)),
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}
