import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleX, Clock3, Eye, EyeOff, MessageSquare, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OpsLegaisResponsumAvaliacao, OpsLegaisResponsumPendente, OpsLegaisResponsumTicketItem } from '../types/eficiencia.types'
import { defaultResponsumAvaliacaoFilters, filterResponsumAvaliacoes, filterResponsumPendentes, flattenResponsumPendentes, responsumAvaliacaoScoreGroup, responsumElapsedLabel, responsumElapsedMinutes, type ResponsumAvaliacaoFilters, type ResponsumAvaliacaoScoreFilter } from '../utils/opsLegaisResponsumPresentation'

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2'
const waitingLabels = { equipe: 'Aguardando nossa resposta', solicitante: 'Aguardando solicitante', indefinido: 'Resposta a confirmar' }
const priorityLabels: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente', critical: 'Crítica' }
const dateLabel = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Não informado'

function TicketClassification({ ticket }: { ticket: OpsLegaisResponsumTicketItem }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{ticket.frente || 'Frente não informada'}</span>
      <span className="min-w-0 break-words text-slate-500">{ticket.category || 'Categoria não informada'} <span className="px-1 text-slate-300">/</span> {ticket.subcategory || 'Subcategoria não informada'}</span>
    </div>
  )
}

export function OpsLegaisResponsumPendentes({ groups, updatedAt, renderPerson, resolvePersonName }: {
  groups: OpsLegaisResponsumPendente[]
  updatedAt?: string
  renderPerson: (name: string) => ReactNode
  resolvePersonName: (name: string) => string
}) {
  const [filters, setFilters] = useState({ waiting: 'todos', frente: '', owner: '', query: '' })
  const [limit, setLimit] = useState(8)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const fieldId = useId()
  const all = useMemo(() => flattenResponsumPendentes(groups).map(ticket => ({
    ...ticket,
    assigned_to_name: resolvePersonName(ticket.assigned_to_name || 'Sem responsável'),
  })), [groups, resolvePersonName])
  const filtered = useMemo(() => filterResponsumPendentes(all, filters), [all, filters])
  const frentes = [...new Set(all.map(t => t.frente).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const owners = [...all.reduce((counts, ticket) => {
    const name = ticket.assigned_to_name
    counts.set(name, (counts.get(name) ?? 0) + 1)
    return counts
  }, new Map<string, number>())].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, 'pt-BR'))
  const changeFilter = (name: keyof typeof filters, value: string) => { setFilters(prev => ({ ...prev, [name]: value })); setLimit(8) }
  return (
    <section aria-label="Chamados pendentes" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Clock3 className="h-5 w-5" aria-hidden /></span>
            <div><h3 className="text-lg font-semibold tracking-tight text-slate-900 xl:text-xl">Chamados pendentes <span className="ml-2 text-slate-400">{all.length}</span></h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">Todos os chamados em aberto, independentemente do período. Mais tempo sem movimentação primeiro.</p></div>
          </div>
          {updatedAt ? <p className="text-xs text-slate-400">Atualizado em {dateLabel(updatedAt)}</p> : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Filtrar por resposta esperada">
          {(['todos', 'equipe', 'solicitante', 'indefinido'] as const).map(key => {
            const count = key === 'todos' ? all.length : all.filter(t => (t.waiting_for ?? 'indefinido') === key).length
            return <button key={key} type="button" aria-pressed={filters.waiting === key} onClick={() => changeFilter('waiting', key)} className={cn('rounded-lg border px-3 py-2 text-sm font-medium transition-colors', focus, filters.waiting === key ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
              {key === 'todos' ? 'Todos' : waitingLabels[key]} <span className="ml-2 tabular-nums opacity-70">{count}</span>
            </button>
          })}
        </div>
        {owners.length > 0 ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-700">Pendentes por responsável</h4>
              <p className="text-xs text-slate-500">Todos os chamados pendentes de cada pessoa.</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2.5" role="group" aria-label="Filtrar chamados por colaborador">
              <button type="button" aria-pressed={!filters.owner} onClick={() => changeFilter('owner', '')} className={cn('flex min-h-14 items-center gap-4 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors', focus, !filters.owner ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500' : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50')}>Todos os responsáveis <span className="rounded-lg bg-white px-2 py-1 font-semibold tabular-nums text-emerald-700">{all.length}</span></button>
              {owners.map(([name, count]) => (
                <button key={name} type="button" aria-pressed={filters.owner === name} onClick={() => changeFilter('owner', filters.owner === name ? '' : name)} className={cn('flex min-h-14 max-w-full items-center gap-4 rounded-xl border px-3 py-2.5 text-left transition-colors', focus, filters.owner === name ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 bg-slate-50/60 hover:border-emerald-300 hover:bg-emerald-50/50')}>
                  {renderPerson(name)}
                  <span aria-label={`${count} chamado${count === 1 ? '' : 's'} pendente${count === 1 ? '' : 's'}`} className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-white px-2 text-sm font-semibold tabular-nums text-emerald-700">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
          <label className="relative block"><span className="sr-only">Buscar chamados pendentes</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden /><input value={filters.query} onChange={e => changeFilter('query', e.target.value)} placeholder="Buscar chamado ou categoria" className={cn('h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-slate-700', focus)} /></label>
          <select aria-label="Filtrar por frente de atuação" value={filters.frente} onChange={e => changeFilter('frente', e.target.value)} className={cn('h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600', focus)}><option value="">Todas as frentes</option>{frentes.map(f => <option key={f}>{f}</option>)}</select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 bg-slate-50/60 px-4 py-3 text-sm text-slate-500 sm:px-6" aria-live="polite">
        <span>{filtered.length} chamado{filtered.length === 1 ? '' : 's'} nesta visão</span>
        {Object.values(filters).some(v => v && v !== 'todos') ? <button type="button" className={cn('rounded px-1 font-medium underline underline-offset-4', focus)} onClick={() => { setFilters({ waiting: 'todos', frente: '', owner: '', query: '' }); setLimit(8) }}>Limpar filtros</button> : null}
      </div>
      <ul className="divide-y divide-slate-200">
        {filtered.slice(0, limit).map((ticket, index) => {
          const waiting = ticket.waiting_for ?? 'indefinido'
          const elapsed = responsumElapsedMinutes(ticket.last_activity_at ?? ticket.created_at, now)
          const age = responsumElapsedMinutes(ticket.created_at, now)
          const replyAge = responsumElapsedMinutes(ticket.waiting_since, now)
          const reasonId = `${fieldId}-${index}`
          return <li key={ticket.id ?? `${ticket.title}-${index}`} className="px-4 py-5 sm:px-6">
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className={cn('rounded-md px-2 py-1', ticket.status === 'open' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700')}>{ticket.status === 'open' ? 'Aberto' : 'Em andamento'}</span>
                  {ticket.priority ? <span className={cn('rounded-md px-2 py-1', ['urgent', 'critical', 'high'].includes(ticket.priority) ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500')}>Prioridade {priorityLabels[ticket.priority] ?? ticket.priority}</span> : null}
                  {ticket.is_sla_fatal ? <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">Evidência SLA Fatal</span> : null}
                </div>
                <h4 className="break-words text-lg font-semibold leading-snug tracking-tight text-slate-900 xl:text-xl">{ticket.title}</h4>
                <TicketClassification ticket={ticket} />
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500"><div className="flex flex-wrap items-center gap-2"><span>Responsável</span>{renderPerson(ticket.assigned_to_name || 'Sem responsável')}</div>{ticket.created_by_name ? <div className="flex flex-wrap items-center gap-2"><span>Solicitante</span>{renderPerson(ticket.created_by_name)}</div> : null}<span title={dateLabel(ticket.created_at)}>Aberto há {responsumElapsedLabel(age)}</span></div>
              </div>
              <div className={cn('rounded-xl border p-4', waiting === 'equipe' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50/70')}>
                <p className={cn('flex items-center gap-2 text-sm font-semibold', waiting === 'equipe' ? 'text-amber-900' : 'text-slate-700')} aria-describedby={reasonId}><MessageSquare className="h-4 w-4 shrink-0" aria-hidden />{waitingLabels[waiting]}</p>
                <p id={reasonId} className="mt-2 text-xs leading-relaxed text-slate-500">{ticket.waiting_reason || 'O histórico de respostas não está disponível.'}</p>
                {waiting !== 'indefinido' && replyAge != null ? <p className="mt-3 text-sm font-medium tabular-nums text-slate-700">Espera de {responsumElapsedLabel(replyAge)}</p> : null}
                <p className="mt-2 text-sm leading-relaxed text-slate-500" title={`Última movimentação: ${dateLabel(ticket.last_activity_at ?? ticket.created_at)}`}>Sem movimentação há <strong className="font-semibold tabular-nums text-slate-800">{responsumElapsedLabel(elapsed)}</strong></p>
              </div>
            </div>
          </li>
        })}
      </ul>
      {!filtered.length ? <div className="flex flex-col items-center gap-3 px-6 py-10 text-center"><CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden /><p className="text-sm text-slate-500">{all.length ? 'Nenhum chamado corresponde aos filtros.' : 'Nenhum chamado pendente.'}</p></div> : null}
      {filtered.length > limit ? <div className="border-t border-slate-200 px-6 py-4 text-center"><button type="button" onClick={() => setLimit(n => n + 8)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50', focus)}>Mostrar mais chamados ({filtered.length - limit})</button></div> : null}
    </section>
  )
}

function AvaliacaoRow({ ticket, renderPerson }: { ticket: OpsLegaisResponsumAvaliacao; renderPerson: (name: string) => ReactNode }) {
  const [visible, setVisible] = useState(false)
  const detailsId = useId()
  const score = ticket.score
  const scoreClass = score == null ? 'border-slate-200 bg-slate-50 text-slate-500'
    : score >= 9 ? 'border-green-200 bg-green-50 text-green-700'
      : score >= 7 ? 'border-blue-200 bg-blue-50 text-blue-700'
        : score >= 5 ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
          : 'border-red-200 bg-red-50 text-red-700'
  return <li className="px-4 py-5 sm:px-6">
    <div className="flex items-start gap-3 sm:gap-4">
      <span className={cn('flex h-12 w-14 shrink-0 items-center justify-center rounded-xl border text-xl font-semibold tabular-nums', scoreClass)} aria-label={score == null ? 'Avaliação sem nota' : `Nota ${score} de 10`}>{score == null ? <span className="text-xs font-medium">Sem nota</span> : <>{score}<span className="ml-0.5 mt-1 text-xs opacity-60">/10</span></>}</span>
      <div className="min-w-0 flex-1">
        <h4 className="break-words text-lg font-semibold leading-snug text-slate-900 xl:text-xl">{ticket.title}</h4>
        <p className="mt-1 text-sm text-slate-500">{ticket.feedback_at ? `Avaliado em ${dateLabel(ticket.feedback_at)}` : 'Data da avaliação não informada'}</p>
        <TicketClassification ticket={ticket} />
        {ticket.request_fulfilled === false ? <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"><CircleX className="h-4 w-4 shrink-0" aria-hidden />Solicitação não atendida</p> : null}
      </div>
      <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Ocultar detalhes da avaliação' : 'Mostrar detalhes da avaliação'} aria-expanded={visible} aria-controls={detailsId} title={visible ? 'Ocultar detalhes da avaliação' : 'Mostrar detalhes da avaliação'} className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50', focus)}>{visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}</button>
    </div>
    {visible ? <div id={detailsId} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" role="region" aria-label="Detalhes da avaliação">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0"><p className="mb-2 text-sm text-slate-500">{ticket.request_fulfilled === false ? 'Responsável pelo atendimento' : 'Atendido por'}</p>{renderPerson(ticket.assigned_to_name || 'Sem responsável')}</div>
        <div className="min-w-0"><p className="mb-2 text-sm text-slate-500">Avaliado por</p>{renderPerson(ticket.created_by_name || 'Não informado')}</div>
      </div>
      {ticket.request_fulfilled === false ? <div className="mt-4"><h5 className="text-sm font-semibold text-red-700">Motivo de não atendimento</h5><p className="mt-1 whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700">{ticket.not_fulfilled_reason || 'Motivo não informado.'}</p></div> : null}
      <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700">{ticket.comment || 'Avaliação sem comentário.'}</p>
    </div> : null}
  </li>
}

export function OpsLegaisResponsumAvaliacoes({ items, compact = false, renderPerson }: { items: OpsLegaisResponsumAvaliacao[] | undefined; compact?: boolean; renderPerson: (name: string) => ReactNode }) {
  const [limit, setLimit] = useState(4)
  const [filters, setFilters] = useState<ResponsumAvaliacaoFilters>(defaultResponsumAvaliacaoFilters)
  const fieldId = useId()
  const relevant = useMemo(() => filterResponsumAvaliacoes(items ?? [], defaultResponsumAvaliacaoFilters), [items])
  const filtered = useMemo(() => filterResponsumAvaliacoes(relevant, filters), [relevant, filters])
  const scoreItems = useMemo(() => filterResponsumAvaliacoes(relevant, { ...filters, score: 'todos' }), [relevant, filters])
  const frentes = [...new Set(relevant.map(t => t.frente).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const hasFilters = Object.entries(filters).some(([key, value]) => value !== defaultResponsumAvaliacaoFilters[key as keyof ResponsumAvaliacaoFilters])
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to)
  const changeFilters = (next: Partial<ResponsumAvaliacaoFilters>) => { setFilters(prev => ({ ...prev, ...next })); setLimit(4) }
  const filtersKey = JSON.stringify(filters)
  const fieldClass = cn('mt-1.5 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700', focus)
  const scoreOptions: { key: ResponsumAvaliacaoScoreFilter; label: string; color: string }[] = [
    { key: 'todos', label: 'Todas as notas', color: 'border-amber-500 bg-amber-50 text-amber-900 ring-amber-500' },
    { key: 'ruim', label: 'Ruim · 0–4', color: 'border-red-500 bg-red-50 text-red-700 ring-red-500' },
    { key: 'regular', label: 'Regular · 5–6', color: 'border-yellow-500 bg-yellow-50 text-yellow-700 ring-yellow-500' },
    { key: 'neutro', label: 'Neutro · 7–8', color: 'border-blue-500 bg-blue-50 text-blue-700 ring-blue-500' },
    { key: 'alta', label: 'Notas 9–10', color: 'border-green-500 bg-green-50 text-green-700 ring-green-500' },
    { key: 'sem-nota', label: 'Sem nota', color: 'border-slate-500 bg-slate-100 text-slate-700 ring-slate-500' },
  ]
  return <section aria-label="Avaliações que precisam de atenção" className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
    <div className="border-b border-amber-100 px-4 py-5 sm:px-6">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-5 w-5" aria-hidden /></span><div><h3 className="text-lg font-semibold tracking-tight text-slate-900 xl:text-xl">Avaliações que precisam de atenção <span className="ml-2 text-amber-700">{relevant.length}</span></h3><p className="mt-1 text-sm leading-relaxed text-slate-500">Histórico de avaliações com nota até 8 e solicitações não atendidas.</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar avaliações por nota">
        {scoreOptions.map(option => {
          const count = option.key === 'todos' ? scoreItems.length : scoreItems.filter(t => responsumAvaliacaoScoreGroup(t.score) === option.key).length
          return <button key={option.key} type="button" aria-pressed={filters.score === option.key} onClick={() => changeFilters({ score: option.key })} className={cn('rounded-lg border px-3 py-2 text-sm font-medium transition-colors', focus, filters.score === option.key ? `${option.color} ring-1` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{option.label}<span className="ml-2 tabular-nums opacity-70">{count}</span></button>
        })}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-sm font-medium text-slate-600 md:col-span-2">Buscar avaliações<div className="relative"><Search className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" aria-hidden /><input type="search" value={filters.query} onChange={e => changeFilters({ query: e.target.value })} placeholder="Chamado, categoria ou subcategoria" className={cn(fieldClass, 'pl-9')} /></div></label>
        <label className="min-w-0 text-sm font-medium text-slate-600">Frente de atuação<select aria-label="Frente de atuação" value={filters.frente} onChange={e => changeFilters({ frente: e.target.value })} className={fieldClass}><option value="">Todas as frentes</option>{frentes.map(frente => <option key={frente}>{frente}</option>)}</select></label>
        <label className="min-w-0 text-sm font-medium text-slate-600">Situação da solicitação<select aria-label="Situação da solicitação" value={filters.fulfillment} onChange={e => changeFilters({ fulfillment: e.target.value as ResponsumAvaliacaoFilters['fulfillment'] })} className={fieldClass}><option value="todos">Todas as situações</option><option value="nao-atendida">Não atendida</option><option value="atendida">Atendida</option><option value="nao-informado">Não informada</option></select></label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-sm font-medium text-slate-600">Avaliada a partir de<input type="date" value={filters.from} max={filters.to || undefined} aria-invalid={invalidDates} aria-describedby={invalidDates ? `${fieldId}-dates` : undefined} onChange={e => changeFilters({ from: e.target.value })} className={fieldClass} /></label>
        <label className="min-w-0 text-sm font-medium text-slate-600">Avaliada até<input type="date" value={filters.to} min={filters.from || undefined} aria-invalid={invalidDates} aria-describedby={invalidDates ? `${fieldId}-dates` : undefined} onChange={e => changeFilters({ to: e.target.value })} className={fieldClass} /></label>
        <label className="min-w-0 text-sm font-medium text-slate-600 xl:col-span-2">Ordenar avaliações<select aria-label="Ordenar avaliações" value={filters.sort} onChange={e => changeFilters({ sort: e.target.value as ResponsumAvaliacaoFilters['sort'] })} className={fieldClass}><option value="recentes">Mais recentes primeiro</option><option value="antigas">Mais antigas primeiro</option><option value="menor-nota">Menor nota primeiro</option></select></label>
      </div>
      {invalidDates ? <p id={`${fieldId}-dates`} role="alert" className="mt-3 text-sm text-red-700">A data inicial deve ser anterior ou igual à data final.</p> : null}
    </div>
    <div className="flex items-center justify-between gap-3 bg-slate-50/60 px-4 py-3 text-sm text-slate-500 sm:px-6" aria-live="polite"><span>{filtered.length} de {relevant.length} {relevant.length === 1 ? 'avaliação' : 'avaliações'}</span>{hasFilters ? <button type="button" className={cn('rounded px-1 font-medium underline underline-offset-4', focus)} onClick={() => { setFilters(defaultResponsumAvaliacaoFilters); setLimit(4) }}>Limpar filtros</button> : null}</div>
    <ul className={cn('grid [&>li]:border-b [&>li]:border-slate-200 lg:grid-cols-2 lg:[&>li:nth-child(even)]:border-l', compact && 'max-h-72 overflow-y-auto')}>{filtered.slice(0, limit).map(t => <AvaliacaoRow key={`${filtersKey}-${t.id ?? t.title}-${t.feedback_at}`} ticket={t} renderPerson={renderPerson} />)}</ul>
    {!filtered.length && !invalidDates ? <p className="px-6 py-8 text-center text-sm text-slate-500">{items === undefined ? 'Os detalhes das avaliações ainda não estão disponíveis.' : relevant.length ? 'Nenhuma avaliação corresponde aos filtros.' : 'Nenhuma avaliação com nota de 8 ou menos ou solicitação não atendida.'}</p> : null}
    {filtered.length > limit ? <div className="border-t border-slate-200 px-6 py-3 text-center"><button type="button" onClick={() => setLimit(n => n + 4)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50', focus)}>Mostrar mais avaliações ({filtered.length - limit})</button></div> : null}
  </section>
}
