import {
  Bookmark,
  Eye,
  Heart,
  Images,
  MousePointerClick,
  Send,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  computePostEngagementRate,
  groupPostsByFormat,
  groupPostsByMonth,
  summarizeInstagram,
} from './instagramAnalytics'
import { MarketingFormatChart, MarketingTrendChart } from './MarketingCharts'
import type { InstagramAccountStats, InstagramPost, InstagramStory } from './types'

const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
const compact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'teal',
}: {
  label: string
  value: string
  detail: string
  icon: typeof Eye
  tone?: 'teal' | 'blue' | 'amber' | 'rose'
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700 ring-teal-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  }
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
            <p className="mt-1 truncate text-xs text-slate-500" title={detail}>{detail}</p>
          </div>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
export function MarketingOverview({
  posts,
  account,
  stories,
  monthlyGoal,
}: {
  posts: InstagramPost[]
  account: InstagramAccountStats | null
  stories: InstagramStory[]
  monthlyGoal: number
}) {
  const summary = summarizeInstagram(posts)
  const monthly = groupPostsByMonth(posts)
  const formats = groupPostsByFormat(posts)
  const topPosts = [...posts]
    .sort((a, b) => computePostEngagementRate(b) - computePostEngagementRate(a))
    .slice(0, 5)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthPosts = posts.filter((post) => post.published_at?.startsWith(currentMonth)).length
  const goalPct = Math.min(100, (monthPosts / Math.max(monthlyGoal, 1)) * 100)
  const storySummary = stories.reduce(
    (acc, story) => ({
      reach: acc.reach + story.reach,
      views: acc.views + story.views,
      interactions: acc.interactions + story.total_interactions,
    }),
    { reach: 0, views: 0, interactions: 0 },
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Seguidores" value={compact(account?.followers_count ?? 0)} detail={`@${account?.username ?? 'bismarchipires'}`} icon={Users} />
        <Kpi label="Alcance" value={compact(summary.reach)} detail={`${number(summary.posts)} publicações no período`} icon={Eye} tone="blue" />
        <Kpi label="Visualizações" value={compact(summary.views)} detail="Feed, Reels e vídeos" icon={TrendingUp} tone="blue" />
        <Kpi label="Interações" value={compact(summary.interactions)} detail={`${summary.engagementRate.toFixed(2).replace('.', ',')}% de engajamento`} icon={Heart} tone="rose" />
        <Kpi label="Salvamentos" value={number(summary.saves)} detail="Intenção e valor percebido" icon={Bookmark} tone="amber" />
        <Kpi label="Compartilhamentos" value={number(summary.shares)} detail="Distribuição orgânica" icon={Send} tone="amber" />
        <Kpi label="Seguidores ganhos" value={number(summary.follows)} detail="Atribuídos às publicações" icon={UserPlus} />
        <Kpi label="Visitas ao perfil" value={number(summary.profileVisits)} detail="Geradas pelas publicações" icon={MousePointerClick} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução mensal</CardTitle>
            <p className="text-xs text-slate-500">Alcance, visualizações e interações das publicações</p>
          </CardHeader>
          <CardContent>
            <MarketingTrendChart data={monthly} />
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ritmo de publicação</CardTitle>
            <p className="text-xs text-slate-500">Meta mensal configurada no Marketing</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-4xl font-black tabular-nums text-slate-900">{monthPosts}</p>
                <p className="text-xs text-slate-500">de {monthlyGoal} publicações</p>
              </div>
              <Badge className="bg-teal-700 hover:bg-teal-700">{goalPct.toFixed(0)}%</Badge>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-400 transition-all" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
              <div><p className="text-lg font-bold text-slate-900">{stories.length}</p><p className="text-[11px] text-slate-500">Stories salvos</p></div>
              <div><p className="text-lg font-bold text-slate-900">{compact(storySummary.reach)}</p><p className="text-[11px] text-slate-500">Alcance stories</p></div>
              <div><p className="text-lg font-bold text-slate-900">{compact(storySummary.views)}</p><p className="text-[11px] text-slate-500">Views stories</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance por formato</CardTitle>
            <p className="text-xs text-slate-500">Volume e taxa de engajamento por superfície</p>
          </CardHeader>
          <CardContent>
            <MarketingFormatChart data={formats} />
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Images className="h-4 w-4 text-teal-700" /> Melhores publicações</CardTitle>
            <p className="text-xs text-slate-500">Ordenadas pela taxa de engajamento por alcance</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {topPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Nenhuma publicação no período.</p>
            ) : topPosts.map((post, index) => (
              <a key={post.id} href={post.permalink ?? undefined} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 transition hover:border-teal-200 hover:bg-teal-50/30">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">{index + 1}</span>
                {post.thumbnail_url || post.media_url ? (
                  <img src={post.thumbnail_url ?? post.media_url ?? ''} alt="" className="h-11 w-11 rounded-lg object-cover" loading="lazy" />
                ) : <div className="h-11 w-11 rounded-lg bg-slate-100" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{post.caption?.split('\n')[0] || 'Sem legenda'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{number(post.reach)} alcance · {number(post.total_interactions)} interações</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-teal-700">{computePostEngagementRate(post).toFixed(2)}%</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
