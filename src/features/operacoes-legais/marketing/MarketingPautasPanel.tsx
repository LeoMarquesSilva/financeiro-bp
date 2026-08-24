import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Loader2,
  RotateCcw,
  Search,
  Send,
  UserRoundX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/shared/components/Avatar'
import {
  marketingPautasInRange,
  getMarketingPautaTiming,
  rankMarketingPautaDeliveries,
  summarizeMarketingPautas,
} from './marketingPautas'
import type { MarketingPerson } from './instagramService'
import type {
  InstagramPeriodRange,
  MarketingPauta,
  MarketingPautaStage,
} from './types'

const STAGES: Record<MarketingPautaStage, {
  label: string
  shortLabel: string
  icon: typeof Send
  tone: string
  dot: string
}> = {
  aguardando_envio: {
    label: 'Aguardando envio',
    shortLabel: 'Enviar',
    icon: Send,
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
  },
  em_revisao: {
    label: 'Em revisão',
    shortLabel: 'Revisão',
    icon: FileCheck2,
    tone: 'border-sky-200 bg-sky-50 text-sky-800',
    dot: 'bg-sky-500',
  },
  em_protocolo: {
    label: 'Em protocolo',
    shortLabel: 'Protocolo',
    icon: ClipboardCheck,
    tone: 'border-violet-200 bg-violet-50 text-violet-800',
    dot: 'bg-violet-500',
  },
  finalizada: {
    label: 'Finalizada',
    shortLabel: 'Finalizadas',
    icon: CheckCircle2,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  cancelada: {
    label: 'Cancelada',
    shortLabel: 'Canceladas',
    icon: CircleDashed,
    tone: 'border-slate-200 bg-slate-50 text-slate-600',
    dot: 'bg-slate-400',
  },
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

function FunnelCard({ stage, value }: { stage: MarketingPautaStage; value: number }) {
  const meta = STAGES[stage]
  const Icon = meta.icon
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl border ${meta.tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-2xl font-black tabular-nums text-slate-950">{value}</span>
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{meta.shortLabel}</p>
    </article>
  )
}

function PersonAvatar({
  person,
  name,
  size = 'lg',
}: {
  person?: MarketingPerson
  name: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  return (
    <Avatar
      src={person?.avatarUrl ?? null}
      email={person?.email ?? null}
      fullName={name ?? 'Responsável não sincronizado'}
      size={size}
      className="ring-2 ring-white"
    />
  )
}

export function MarketingPautasPanel({
  pautas,
  people,
  range,
  isLoading,
  error,
  onRetry,
}: {
  pautas: MarketingPauta[]
  people: MarketingPerson[]
  range: InstagramPeriodRange
  isLoading: boolean
  error: unknown
  onRetry: () => Promise<unknown>
}) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<'all' | MarketingPautaStage>('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const scoped = useMemo(() => marketingPautasInRange(pautas, range), [pautas, range])
  const summary = useMemo(() => summarizeMarketingPautas(pautas, range), [pautas, range])
  const ranking = useMemo(() => rankMarketingPautaDeliveries(pautas, range), [pautas, range])
  const peopleByName = useMemo(
    () => new Map(people.map((person) => [normalizeName(person.name), person])),
    [people],
  )
  const areas = useMemo(
    () => [...new Set(scoped.map((pauta) => pauta.area))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [scoped],
  )
  const filtered = useMemo(() => {
    const query = normalizeName(search)
    return scoped.filter((pauta) => {
      if (stageFilter !== 'all' && pauta.stage !== stageFilter) return false
      if (areaFilter !== 'all' && pauta.area !== areaFilter) return false
      if (!query) return true
      return normalizeName(`${pauta.responsavel ?? ''} ${pauta.review?.responsavel ?? ''} ${pauta.area}`).includes(query)
    })
  }, [areaFilter, scoped, search, stageFilter])

  if (isLoading) {
    return (
      <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center text-sm font-medium text-slate-500">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-teal-700" />
          Carregando pautas do SIOE…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-rose-600" />
        <p className="mt-3 font-bold text-rose-900">Não foi possível carregar as pautas.</p>
        <p className="mt-1 text-sm text-rose-700">Os dados do Instagram continuam disponíveis normalmente.</p>
        <Button variant="outline" className="mt-4" onClick={() => void onRetry()}>
          <RotateCcw className="h-4 w-4" /> Tentar novamente
        </Button>
      </div>
    )
  }

  const maxDelivered = ranking[0]?.delivered ?? 0

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-300">Produção do escritório</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-black tracking-tight tabular-nums">{summary.delivered}</span>
              <span className="text-sm text-slate-300">de {summary.target.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pautas</span>
            </div>
            <p className="mt-2 max-w-xl text-sm text-slate-400">A entrega conta quando o advogado conclui a tarefa principal. Revisão e protocolo permanecem visíveis até o fechamento do fluxo.</p>
          </div>
          <div className="min-w-56">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>Meta 10/mês</span>
              <span>{Math.round(summary.progressPct)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-teal-400" style={{ width: `${summary.progressPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FunnelCard stage="aguardando_envio" value={summary.stages.aguardando_envio} />
        <FunnelCard stage="em_revisao" value={summary.stages.em_revisao} />
        <FunnelCard stage="em_protocolo" value={summary.stages.em_protocolo} />
        <FunnelCard stage="finalizada" value={summary.stages.finalizada} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <div><p className="text-lg font-black text-rose-900">{summary.overdue}</p><p className="text-xs font-medium text-rose-700">etapas atrasadas</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <CalendarClock className="h-5 w-5 text-amber-700" />
          <div><p className="text-lg font-black text-amber-900">{summary.dueSoon}</p><p className="text-xs font-medium text-amber-700">vencem nos próximos 7 dias</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
          <UserRoundX className="h-5 w-5 text-slate-600" />
          <div><p className="text-lg font-black text-slate-900">{summary.missingAssignee}</p><p className="text-xs font-medium text-slate-600">sem responsável sincronizado</p></div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.75fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quem mais entregou</CardTitle>
            <p className="text-xs text-slate-500">Pautas principais concluídas no período</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.slice(0, 8).map((row, index) => {
              const person = peopleByName.get(normalizeName(row.name))
              return (
                <div key={row.name} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <span className="w-4 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                  <PersonAvatar person={person} name={row.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                      <span className="text-xs font-black tabular-nums text-slate-900">{row.delivered}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${maxDelivered ? row.delivered / maxDelivered * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
            {!ranking.length && <p className="py-10 text-center text-sm text-slate-500">Nenhuma pauta entregue neste período.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="gap-4 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Acompanhamento das pautas</CardTitle>
                <p className="mt-1 text-xs text-slate-500">{filtered.length} de {scoped.length} pautas no recorte</p>
              </div>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Fonte: SIOE</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="Buscar pauta por responsável ou área"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar responsável ou área"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <select aria-label="Filtrar pautas por etapa" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as 'all' | MarketingPautaStage)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500">
                <option value="all">Todas as etapas</option>
                {Object.entries(STAGES).filter(([value]) => value !== 'cancelada').map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
              <select aria-label="Filtrar pautas por área" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500">
                <option value="all">Todas as áreas</option>
                {areas.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {filtered.map((pauta) => {
                const meta = STAGES[pauta.stage]
                const person = pauta.responsavel ? peopleByName.get(normalizeName(pauta.responsavel)) : undefined
                const reviewer = pauta.review?.responsavel
                  ? peopleByName.get(normalizeName(pauta.review.responsavel))
                  : undefined
                const timing = getMarketingPautaTiming(pauta)
                return (
                  <article key={pauta.id} className="grid gap-4 px-4 py-4 transition hover:bg-slate-50/70 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,.62fr)_minmax(0,1fr)] sm:items-center sm:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <PersonAvatar person={person} name={pauta.responsavel} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${pauta.responsavel ? 'text-slate-900' : 'text-amber-800'}`}>{pauta.responsavel ?? 'Responsável não sincronizado'}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{pauta.area} · CI {pauta.id}</p>
                        {pauta.review?.responsavel && (
                          <div className="mt-2 flex min-w-0 items-center gap-2 border-l-2 border-sky-100 pl-2">
                            <PersonAvatar person={reviewer} name={pauta.review.responsavel} size="sm" />
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Revisor</p>
                              <p className="truncate text-[11px] font-medium text-slate-600">{pauta.review.responsavel}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${meta.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
                      </span>
                    </div>
                    <div className="space-y-1.5 sm:text-right">
                      {timing.stageElapsed && (
                        <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 sm:justify-end">
                          <Clock3 className="h-3 w-3" />{timing.stageElapsed}
                        </p>
                      )}
                      <p className={`text-xs font-bold tabular-nums ${pauta.isLate ? 'text-rose-700' : 'text-slate-700'}`}>{timing.currentDeadline}</p>
                      {timing.authorDelivery && (
                        <p className={`text-[11px] tabular-nums ${timing.authorDelivery.includes('atraso') ? 'text-amber-700' : 'text-emerald-700'}`}>{timing.authorDelivery}</p>
                      )}
                      {!timing.authorDelivery && pauta.stage !== 'finalizada' && (
                        <p className="text-[11px] text-slate-400">Ainda não entregue</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
            {!filtered.length && (
              <div className="grid min-h-48 place-items-center px-6 text-center">
                <div><ClipboardCheck className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-600">Nenhuma pauta encontrada com estes filtros.</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
