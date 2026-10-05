export type ResponsumTicket = {
  id: string
  title: string | null
  status: string | null
  service_score: number | string | null
  assigned_to: string | null
  assigned_to_name: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string | null
  updated_at: string | null
  started_at: string | null
  reopened_at: string | null
  assigned_at: string | null
  resolved_at: string | null
  category: string | null
  subcategory: string | null
  priority: string | null
  comment: string | null
  feedback_submitted_at: string | null
  request_fulfilled: boolean | null
  not_fulfilled_reason: string | null
  evidencia_enviada: boolean | null
}

export type ResponsumMessage = { id: string; ticket_id: string; user_id: string | null; created_at: string; is_system: boolean | null }
export type ResponsumCategory = { id: string; key: string; label: string; tag_id: string | null }
export type ResponsumSubcategory = { category_id: string; key: string; label: string }
export type ResponsumTag = { id: string; label: string }

export function responsumScore(value: number | string | null | undefined): number | null {
  if (value == null || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 10 ? number : null
}

function latestDate(values: (string | null | undefined)[]): string | null {
  return values.filter((v): v is string => Boolean(v) && Number.isFinite(Date.parse(v!)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
}

export function responsumTicketPresentation(
  ticket: ResponsumTicket,
  lastMessage: ResponsumMessage | undefined,
  categories: ResponsumCategory[],
  subcategories: ResponsumSubcategory[],
  tags: ResponsumTag[],
) {
  const category = categories.find(c => c.key === ticket.category)
  const subcategory = subcategories.find(s => s.key === ticket.subcategory && s.category_id === category?.id)
  const isSlaFatal = (ticket.title ?? '').toLocaleUpperCase('pt-BR').includes('EVIDÊNCIA SLA FATAL')
  // Messages before a reopening do not establish who must answer the new cycle.
  const cycleStart = latestDate([ticket.created_at, ticket.reopened_at])
  const message = lastMessage && !lastMessage.is_system &&
    (!cycleStart || Date.parse(lastMessage.created_at) >= Date.parse(cycleStart)) ? lastMessage : undefined
  let waitingFor: 'equipe' | 'solicitante' | 'indefinido' = 'indefinido'
  let waitingReason = 'Não foi possível identificar quem precisa responder.'
  let waitingSince: string | null = null
  if (isSlaFatal && ticket.evidencia_enviada != null) {
    waitingFor = ticket.evidencia_enviada ? 'equipe' : 'solicitante'
    waitingReason = ticket.evidencia_enviada ? 'Evidência enviada; falta analisar.' : 'Falta o envio da evidência pelo Jurídico.'
    waitingSince = latestDate([message?.created_at, cycleStart])
  } else if (message?.user_id && message.user_id === ticket.created_by && ticket.created_by !== ticket.assigned_to) {
    waitingFor = 'equipe'
    waitingReason = 'A última mensagem foi do solicitante.'
    waitingSince = message.created_at
  } else if (message?.user_id && message.user_id === ticket.assigned_to && ticket.created_by !== ticket.assigned_to) {
    waitingFor = 'solicitante'
    waitingReason = 'A última mensagem foi do responsável pelo atendimento.'
    waitingSince = message.created_at
  } else if (!message) {
    waitingFor = 'equipe'
    waitingReason = 'Ainda não houve resposta no chat deste atendimento.'
    waitingSince = cycleStart
  }
  const readable = (raw: string | null) => raw?.replace(/[_-]+/g, ' ') || null
  return {
    id: ticket.id,
    title: ticket.title ?? 'Chamado sem título',
    status: ticket.status ?? 'open',
    created_at: ticket.created_at,
    assigned_to_name: ticket.assigned_to_name?.trim() || null,
    created_by_name: ticket.created_by_name?.trim() || null,
    category: category?.label?.trim() || readable(ticket.category),
    subcategory: subcategory?.label?.trim() || readable(ticket.subcategory),
    frente: tags.find(t => t.id === category?.tag_id)?.label?.trim() || null,
    priority: ticket.priority,
    // updated_at can also change when an automatic notification is sent.
    last_activity_at: latestDate([message?.created_at, ticket.started_at, ticket.assigned_at, cycleStart]),
    waiting_for: waitingFor,
    waiting_reason: waitingReason,
    waiting_since: waitingSince,
    is_sla_fatal: isSlaFatal,
  }
}
