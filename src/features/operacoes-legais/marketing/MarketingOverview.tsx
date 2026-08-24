import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  Eye,
  Images,
  Minus,
  Sparkles,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/shared/components/Avatar'
import {
  compareInstagramPeriods,
  computeMarketingGoals,
  computePostEngagementRate,
  groupPostsByDay,
  groupPostsByFormat,
  groupPostsByMonth,
  rankAreasByPostVolume,
  rankPeopleByPostVolume,
} from './instagramAnalytics'
import { compareMarketingPautaPeriods, computeMarketingPautaGoal } from './marketingPautas'
import { MarketingAreaIcon } from './MarketingAreaIcon'
import {
  MarketingFormatChart,
  MarketingPerformanceTrendChart,
} from './MarketingCharts'
import type { MarketingPerson } from './instagramService'
import type {
  InstagramAccountStats,
  InstagramPeriodRange,
  InstagramPost,
  InstagramStory,
  MarketingPauta,
} from './types'

const number = (value: number) => new Intl.NumberFormat('pt-BR').format(Math.round(value))
const compact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const postCountLabel = (value: number) => `${value} ${value === 1 ? 'post' : 'posts'}`

function compactPersonName(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name
}

function periodDays(range: InstagramPeriodRange) {
  if (!range.from || !range.to) return Number.POSITIVE_INFINITY
  return Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime() + 1) / 86_400_000))
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400">Sem base anterior</span>
  if (Math.abs(value) < 0.01) {
    return <span className="inline-flex items-center gap-1 text-slate-500"><Minus className="h-3 w-3" /> Estável</span>
  }
  const positive = value > 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={positive ? 'inline-flex items-center gap-1 text-emerald-700' : 'inline-flex items-center gap-1 text-rose-700'}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  )
}

function GoalMetric({
  label,
  value,
  target,
  cadence,
  delta,
  icon: Icon,
  format,
}: {
  label: string
  value: number
  target: number
  cadence: string
  delta: number | null
  icon: typeof Eye
  format: (value: number) => string
}) {
  const progress = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <article className="relative min-w-0 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 tabular-nums">{format(value)}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-700 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-500">Meta {cadence}: {format(target)}</span>
        <Delta value={delta} />
      </div>
    </article>
  )
}

function RankingBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-teal-600" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

export function MarketingOverview({
  posts,
  previousPosts,
  people,
  range,
  comparisonLabel,
  pautas,
  previousRange,
}: {
  posts: InstagramPost[]
  previousPosts: InstagramPost[]
  account: InstagramAccountStats | null
  stories: InstagramStory[]
  people: MarketingPerson[]
  range: InstagramPeriodRange
  comparisonLabel: string
  pautas: MarketingPauta[]
  previousRange: InstagramPeriodRange
}) {
  const comparison = compareInstagramPeriods(posts, previousPosts)
  const pautaComparison = compareMarketingPautaPeriods(pautas, range, previousRange)
  const pautaTarget = computeMarketingPautaGoal(range)
  const datedPosts = posts.filter((post) => post.published_at).map((post) => post.published_at as string).sort()
  const goalRange = range.from || !datedPosts.length
    ? range
    : {
        from: `${datedPosts[0].slice(0, 10)}T00:00:00.000Z`,
        to: `${datedPosts[datedPosts.length - 1].slice(0, 10)}T23:59:59.999Z`,
      }
  const goals = computeMarketingGoals(goalRange)
  const peopleRanking = rankPeopleByPostVolume(posts).slice(0, 6)
  const areaRanking = rankAreasByPostVolume(posts).slice(0, 6)
  const formats = groupPostsByFormat(posts)
  const topFormat = formats[0]
  const byPerson = new Map(people.map((person) => [person.id, person]))
  const topPerson = peopleRanking[0]
  const topPersonProfile = topPerson ? byPerson.get(topPerson.id) : undefined
  const topArea = areaRanking[0]
  const remainingPosts = Math.max(0, Math.ceil(goals.posts.target - comparison.posts.current))
  const maxPeoplePosts = peopleRanking[0]?.posts ?? 0
  const maxAreaPosts = areaRanking[0]?.posts ?? 0
  const days = periodDays(range)
  const trend = days <= 100
    ? groupPostsByDay(posts).map((row) => ({
        ...row,
        label: new Date(`${row.date}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      }))
    : groupPostsByMonth(posts).map((row) => ({
        ...row,
        label: new Date(`${row.month}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      }))
  const reachGoalPerPoint = days <= 100 ? 15_000 / (365.2425 / 12) : 15_000

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Indicadores do período</p>
            <p className="text-xs text-slate-500">Comparação com {comparisonLabel}</p>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-white font-medium text-slate-600">
            {posts.length} publicações analisadas
          </Badge>
        </div>
        <div className="grid divide-y divide-slate-100 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-y-0">
          <GoalMetric
            label="Alcance"
            value={comparison.reach.current}
            target={goals.reach.target}
            cadence="15 mil/mês"
            delta={comparison.reach.changePct}
            icon={Eye}
            format={compact}
          />
          <GoalMetric
            label="Engajamento"
            value={comparison.engagement.current}
            target={goals.engagement.target}
            cadence="anual"
            delta={comparison.engagement.changePct}
            icon={Trophy}
            format={(value) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`}
          />
          <GoalMetric
            label="Postagens"
            value={comparison.posts.current}
            target={goals.posts.target}
            cadence="12/mês"
            delta={comparison.posts.changePct}
            icon={Images}
            format={number}
          />
          <GoalMetric
            label="Pautas"
            value={pautaComparison.current}
            target={pautaTarget}
            cadence="10/mês"
            delta={pautaComparison.changePct}
            icon={ClipboardCheck}
            format={(value) => value.toLocaleString('pt-BR', {
              maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
            })}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tendência de performance</CardTitle>
            <p className="text-xs text-slate-500">Alcance e taxa de engajamento ao longo do período selecionado</p>
          </CardHeader>
          <CardContent>
            {trend.length ? (
              <MarketingPerformanceTrendChart data={trend} reachGoal={reachGoalPerPoint} />
            ) : (
              <div className="grid h-72 place-items-center text-sm text-slate-500">Sem publicações neste período.</div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-teal-700" /> Leitura rápida do período</CardTitle>
                <p className="mt-1 text-xs text-slate-500">O que merece atenção agora</p>
              </div>
              <Badge className="bg-slate-900 text-white hover:bg-slate-900">{postCountLabel(posts.length)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            <article className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Ritmo de postagem</p>
              <p className="mt-1 text-base font-bold text-slate-950">
                {remainingPosts > 0 ? `Faltam ${remainingPosts} para a meta` : 'Meta de postagens atingida'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{number(comparison.posts.current)} de {number(goals.posts.target)} publicações previstas no recorte</p>
            </article>

            <article className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Formato mais usado</p>
                <p className="mt-1 truncate text-base font-bold text-slate-950">{topFormat?.format ?? 'Sem dados'}</p>
                <p className="mt-0.5 text-xs text-slate-500">{topFormat ? `${topFormat.posts} ${topFormat.posts === 1 ? 'publicação' : 'publicações'} · ${topFormat.engagementRate.toFixed(2)}% de engajamento` : 'Nenhuma publicação no período'}</p>
              </div>
              <Images className="h-5 w-5 text-teal-700" aria-hidden />
            </article>

            <article className="grid grid-cols-2 divide-x divide-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3 pr-4">
                {topPerson ? (
                  <Avatar src={topPersonProfile?.avatarUrl} email={topPersonProfile?.email} fullName={topPerson.name} size="lg" className="ring-2 ring-white" />
                ) : (
                  <span className="h-9 w-9 rounded-full bg-slate-100" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Maior participação</p>
                  <p className="truncate text-sm font-bold text-slate-900" title={topPerson?.name}>{topPerson ? compactPersonName(topPerson.name) : 'Sem vínculo'}</p>
                  <p className="text-[11px] text-slate-500">{topPerson ? postCountLabel(topPerson.posts) : 'Sem dados'}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-3 pl-4">
                {topArea ? <MarketingAreaIcon area={topArea.area} /> : <span className="h-9 w-9 rounded-xl bg-slate-100" />}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Área em evidência</p>
                  <p className="truncate text-sm font-bold text-slate-900">{topArea?.area ?? 'Sem vínculo'}</p>
                  <p className="text-[11px] text-slate-500">{topArea ? postCountLabel(topArea.posts) : 'Sem dados'}</p>
                </div>
              </div>
            </article>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><UsersRound className="h-4 w-4 text-teal-700" /> Quem mais faz posts no escritório</CardTitle>
            <p className="text-xs text-slate-500">Pessoas vinculadas às publicações no Orquestrai</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {peopleRanking.map((row, index) => {
              const person = byPerson.get(row.id)
              return (
                <div key={row.id || row.name} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50">
                  <span className="w-5 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                  <Avatar src={person?.avatarUrl} email={person?.email} fullName={row.name} size="lg" className="ring-2 ring-white" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-slate-900">{postCountLabel(row.posts)}</span>
                    </div>
                    <RankingBar value={row.posts} max={maxPeoplePosts} />
                  </div>
                </div>
              )
            })}
            {!peopleRanking.length && <p className="py-12 text-center text-sm text-slate-500">Nenhuma pessoa vinculada neste período.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-teal-700" /> Áreas com mais publicações</CardTitle>
            <p className="text-xs text-slate-500">Posts colaborativos contam em todas as áreas vinculadas</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {areaRanking.map((row, index) => (
              <div key={row.area} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50">
                <MarketingAreaIcon area={row.area} className="h-8 w-8 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-slate-800"><span className="mr-1 text-[10px] text-slate-400">#{index + 1}</span>{row.area}</p>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-900">{postCountLabel(row.posts)}</span>
                  </div>
                  <RankingBar value={row.posts} max={maxAreaPosts} />
                </div>
              </div>
            ))}
            {!areaRanking.length && <p className="py-12 text-center text-sm text-slate-500">Nenhuma área vinculada neste período.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Volume e engajamento por formato</CardTitle></CardHeader>
          <CardContent><MarketingFormatChart data={formats} /></CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Melhores publicações</CardTitle><p className="text-xs text-slate-500">Ordenadas pela taxa de engajamento sobre alcance</p></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {[...posts].sort((a, b) => computePostEngagementRate(b) - computePostEngagementRate(a)).slice(0, 3).map((post) => (
              <a key={post.id} href={post.permalink ?? undefined} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-slate-200 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
                {post.thumbnail_url || post.media_url ? (
                  <img src={post.thumbnail_url ?? post.media_url ?? ''} alt={post.caption?.split('\n')[0] || 'Publicação do Instagram'} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ) : <div className="grid aspect-[4/3] place-items-center bg-slate-100"><Images className="h-6 w-6 text-slate-300" /></div>}
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-medium leading-relaxed text-slate-700">{post.caption || 'Sem legenda'}</p>
                  <p className="mt-2 text-sm font-bold text-teal-700">{computePostEngagementRate(post).toFixed(2)}%</p>
                </div>
              </a>
            ))}
            {!posts.length && <p className="col-span-full py-12 text-center text-sm text-slate-500">Nenhuma publicação neste período.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
