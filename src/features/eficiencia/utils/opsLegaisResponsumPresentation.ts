import type { OpsLegaisResponsumAvaliacao, OpsLegaisResponsumPendente, OpsLegaisResponsumTicketItem } from '../types/eficiencia.types'

export type ResponsumAvaliacaoScoreFilter = 'todos' | 'ruim' | 'regular' | 'neutro' | 'alta' | 'sem-nota'
export interface ResponsumAvaliacaoFilters {
  score: ResponsumAvaliacaoScoreFilter
  fulfillment: 'todos' | 'nao-atendida' | 'atendida' | 'nao-informado'
  frente: string
  query: string
  from: string
  to: string
  sort: 'recentes' | 'antigas' | 'menor-nota'
}

export const defaultResponsumAvaliacaoFilters: ResponsumAvaliacaoFilters = {
  score: 'todos', fulfillment: 'todos', frente: '', query: '', from: '', to: '', sort: 'recentes',
}

const feedbackDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function responsumAvaliacaoScoreGroup(score: number | null): Exclude<ResponsumAvaliacaoScoreFilter, 'todos'> {
  if (score == null || !Number.isFinite(score) || score < 0 || score > 10) return 'sem-nota'
  if (score >= 9) return 'alta'
  if (score >= 7) return 'neutro'
  if (score >= 5) return 'regular'
  return 'ruim'
}

export function filterResponsumAvaliacoes(items: OpsLegaisResponsumAvaliacao[], filters: ResponsumAvaliacaoFilters) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const query = normalize(filters.query.trim())
  const feedbackTime = (item: OpsLegaisResponsumAvaliacao) => item.feedback_at ? Date.parse(item.feedback_at) : NaN
  if (filters.from && filters.to && filters.from > filters.to) return []
  return items.filter(item => {
    if (!(item.request_fulfilled === false || (item.score != null && Number.isFinite(item.score) && item.score >= 0 && item.score <= 8))) return false
    if (filters.score !== 'todos' && responsumAvaliacaoScoreGroup(item.score) !== filters.score) return false
    if (filters.fulfillment === 'nao-atendida' && item.request_fulfilled !== false) return false
    if (filters.fulfillment === 'atendida' && item.request_fulfilled !== true) return false
    if (filters.fulfillment === 'nao-informado' && item.request_fulfilled != null) return false
    if (filters.frente && item.frente !== filters.frente) return false
    if (query && !normalize([item.title, item.category, item.subcategory, item.frente].join(' ')).includes(query)) return false
    if (filters.from || filters.to) {
      const time = feedbackTime(item)
      if (!Number.isFinite(time)) return false
      const parts = feedbackDayFormatter.formatToParts(time)
      const part = (type: string) => parts.find(value => value.type === type)?.value
      const day = `${part('year')}-${part('month')}-${part('day')}`
      if ((filters.from && day < filters.from) || (filters.to && day > filters.to)) return false
    }
    return true
  }).sort((a, b) => {
    if (filters.sort === 'menor-nota') {
      const scoreA = responsumAvaliacaoScoreGroup(a.score) === 'sem-nota' ? Infinity : a.score!
      const scoreB = responsumAvaliacaoScoreGroup(b.score) === 'sem-nota' ? Infinity : b.score!
      if (scoreA !== scoreB) return scoreA - scoreB
    }
    const timeA = feedbackTime(a)
    const timeB = feedbackTime(b)
    if (Number.isFinite(timeA) !== Number.isFinite(timeB)) return Number.isFinite(timeA) ? -1 : 1
    if (Number.isFinite(timeA) && timeA !== timeB) return filters.sort === 'antigas' ? timeA - timeB : timeB - timeA
    return (a.id ?? a.title).localeCompare(b.id ?? b.title, 'pt-BR')
  })
}

export function flattenResponsumPendentes(groups: OpsLegaisResponsumPendente[]) {
  const seen = new Set<string>()
  return groups.flatMap(group => {
    const rows = group.is_sla_fatal && group.pessoas_sla?.length
      ? group.pessoas_sla.flatMap(person => person.tickets.map(ticket => ({ ...ticket, assigned_to_name: ticket.assigned_to_name ?? person.nome, is_sla_fatal: true })))
      : group.tickets.map(ticket => ({ ...ticket, assigned_to_name: ticket.assigned_to_name ?? group.nome, is_sla_fatal: group.is_sla_fatal }))
    return rows.filter((ticket, i) => {
      const key = ticket.id ?? `${group.nome}-${i}-${ticket.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })
}

export function responsumElapsedMinutes(iso: string | null | undefined, now: number): number | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60000))
}

export function responsumElapsedLabel(minutes: number | null): string {
  if (minutes == null) return 'Tempo não informado'
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes % 1440 / 60)
  return `${days} dia${days === 1 ? '' : 's'}${hours ? ` e ${hours} h` : ''}`
}

export function filterResponsumPendentes(items: OpsLegaisResponsumTicketItem[], filters: { waiting: string; frente: string; owner: string; query: string }) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const query = normalize(filters.query.trim())
  return items.filter(item =>
    (filters.waiting === 'todos' || (item.waiting_for ?? 'indefinido') === filters.waiting) &&
    (!filters.frente || item.frente === filters.frente) &&
    (!filters.owner || item.assigned_to_name === filters.owner) &&
    (!query || normalize([item.title, item.category, item.subcategory, item.frente, item.assigned_to_name].join(' ')).includes(query)),
  ).sort((a, b) => {
    const age = (item: OpsLegaisResponsumTicketItem) => {
      const date = item.last_activity_at ?? item.created_at
      return date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : Infinity
    }
    return age(a) - age(b) || a.title.localeCompare(b.title, 'pt-BR')
  })
}
