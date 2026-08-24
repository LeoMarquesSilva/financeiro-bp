import type { InstagramPeriodFilter, InstagramPeriodRange } from './types'

function isoStart(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString()
}

function isoEnd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString()
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function resolvePreset(
  preset: Extract<InstagramPeriodFilter, { kind: 'preset' }>['preset'],
  now: Date,
): InstagramPeriodRange {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (preset === 'this_week' || preset === 'last_week') {
    const mondayOffset = (today.getUTCDay() + 6) % 7
    const monday = new Date(today)
    monday.setUTCDate(today.getUTCDate() - mondayOffset - (preset === 'last_week' ? 7 : 0))
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)
    return {
      from: `${dateOnly(monday)}T00:00:00.000Z`,
      to: `${dateOnly(sunday)}T23:59:59.999Z`,
    }
  }
  if (preset === 'this_year') {
    return {
      from: isoStart(today.getUTCFullYear(), 0, 1),
      to: isoEnd(today.getUTCFullYear(), 11, 31),
    }
  }
  const monthOffset = preset === 'last_month' ? -1 : 0
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, 1))
  const lastDay = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate()
  return {
    from: isoStart(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1),
    to: isoEnd(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), lastDay),
  }
}

export function resolveInstagramPeriod(
  filter: InstagramPeriodFilter,
  now = new Date(),
): InstagramPeriodRange {
  if (filter.kind === 'all') return { from: null, to: null }
  if (filter.kind === 'preset') return resolvePreset(filter.preset, now)
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

export function getPreviousInstagramPeriod(range: InstagramPeriodRange): InstagramPeriodRange {
  if (!range.from || !range.to) return { from: null, to: null }
  const from = new Date(range.from).getTime()
  const to = new Date(range.to).getTime()
  const duration = to - from + 1
  const previousTo = from - 1
  const previousFrom = previousTo - duration + 1
  return {
    from: new Date(previousFrom).toISOString(),
    to: new Date(previousTo).toISOString(),
  }
}

export function shiftInstagramPeriod(
  filter: InstagramPeriodFilter,
  direction: -1 | 1,
  now = new Date(),
): InstagramPeriodFilter {
  if (filter.kind === 'all') return filter
  if (filter.kind === 'preset' && (filter.preset === 'this_month' || filter.preset === 'last_month')) {
    const baseOffset = filter.preset === 'last_month' ? -1 : 0
    const shifted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + baseOffset + direction, 1))
    return { kind: 'month', year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 }
  }
  if (filter.kind === 'preset' && filter.preset === 'this_year') {
    return { kind: 'year', year: now.getUTCFullYear() + direction }
  }
  if (filter.kind === 'month') {
    const shifted = new Date(Date.UTC(filter.year, filter.month - 1 + direction, 1))
    return {
      kind: 'month',
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
    }
  }
  if (filter.kind === 'year') return { kind: 'year', year: filter.year + direction }
  const range = resolveInstagramPeriod(filter, now)
  if (!range.from || !range.to) return filter
  const from = new Date(range.from).getTime()
  const to = new Date(range.to).getTime()
  const duration = to - from + 1
  const shiftedFrom = from + duration * direction
  const shiftedTo = to + duration * direction
  return {
    kind: 'custom',
    from: new Date(shiftedFrom).toISOString().slice(0, 10),
    to: new Date(shiftedTo).toISOString().slice(0, 10),
  }
}

export function formatInstagramPeriod(filter: InstagramPeriodFilter): string {
  if (filter.kind === 'all') return 'Todo o histórico'
  if (filter.kind === 'preset') {
    return {
      this_week: 'Esta semana',
      last_week: 'Semana anterior',
      this_month: 'Este mês',
      last_month: 'Mês anterior',
      this_year: 'Este ano',
    }[filter.preset]
  }
  if (filter.kind === 'year') return String(filter.year)
  if (filter.kind === 'custom') {
    const format = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(
      'pt-BR',
      { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' },
    )
    return `${format(filter.from)} a ${format(filter.to)}`
  }
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(filter.year, filter.month - 1, 1)),
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}
