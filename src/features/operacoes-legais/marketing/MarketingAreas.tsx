import { useMemo, useState } from 'react'
import { Building2, Eye, Heart, Images, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { computePostEngagementRate, rankAreas, summarizeInstagram } from './instagramAnalytics'
import type { InstagramPost } from './types'

const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value)

function belongsTo(post: InstagramPost, area: string) {
  return (post.areas?.length ? post.areas : post.area ? [post.area] : ['Sem área']).includes(area)
}
export function MarketingAreas({ posts }: { posts: InstagramPost[] }) {
  const ranking = useMemo(() => rankAreas(posts), [posts])
  const [selected, setSelected] = useState<string>('all')
  const selectedPosts = selected === 'all' ? posts : posts.filter((post) => belongsTo(post, selected))
  const summary = summarizeInstagram(selectedPosts)
  const topPosts = [...selectedPosts]
    .sort((a, b) => computePostEngagementRate(b) - computePostEngagementRate(a))
    .slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><p className="text-sm font-semibold text-slate-900">Recorte por área</p><p className="text-xs text-slate-500">Posts colaborativos participam de todas as áreas vinculadas.</p></div>
        <select value={selected} onChange={(event) => setSelected(event.target.value)} className="h-9 min-w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500">
          <option value="all">Todas as áreas</option>
          {ranking.map((row) => <option key={row.area} value={row.area}>{row.area}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Publicações', value: number(summary.posts), icon: Images, color: 'text-teal-700 bg-teal-50' },
          { label: 'Alcance', value: number(summary.reach), icon: Eye, color: 'text-blue-700 bg-blue-50' },
          { label: 'Interações', value: number(summary.interactions), icon: Heart, color: 'text-rose-700 bg-rose-50' },
          { label: 'Engajamento', value: `${summary.engagementRate.toFixed(2)}%`, icon: Trophy, color: 'text-amber-700 bg-amber-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-slate-200/80 shadow-sm"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></span></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-600" /> Ranking por engajamento</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[520px] overflow-y-auto">
              {ranking.map((row, index) => (
                <button key={row.area} type="button" onClick={() => setSelected(row.area)} className={`grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 border-t border-slate-100 px-5 py-3 text-left transition hover:bg-slate-50 ${selected === row.area ? 'bg-teal-50/70' : ''}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${index < 3 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{row.area}</p><p className="text-[11px] text-slate-500">{row.posts} posts · {number(row.reach)} alcance</p></div>
                  <span className="font-bold tabular-nums text-teal-700">{row.engagementRate.toFixed(2)}%</span>
                </button>
              ))}
              {ranking.length === 0 && <p className="py-16 text-center text-sm text-slate-500">Ainda não existem vínculos de área.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-teal-700" /> {selected === 'all' ? 'Destaques do escritório' : selected}</CardTitle><p className="text-xs text-slate-500">Publicações com melhor taxa de engajamento</p></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {topPosts.map((post) => (
              <a key={post.id} href={post.permalink ?? undefined} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
                <div className="flex gap-3 p-3">
                  {post.thumbnail_url || post.media_url ? <img src={post.thumbnail_url ?? post.media_url ?? ''} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" loading="lazy" /> : <div className="h-20 w-20 shrink-0 rounded-lg bg-slate-100" />}
                  <div className="min-w-0"><div className="mb-1 flex flex-wrap gap-1">{(post.areas?.length ? post.areas : post.area ? [post.area] : []).slice(0, 2).map((area) => <Badge key={area} variant="outline" className="h-5 max-w-28 truncate text-[9px]">{area}</Badge>)}</div><p className="line-clamp-2 text-xs font-medium leading-relaxed text-slate-700">{post.caption || 'Sem legenda'}</p><p className="mt-2 text-xs font-bold text-teal-700">{computePostEngagementRate(post).toFixed(2)}% engajamento</p></div>
                </div>
              </a>
            ))}
            {topPosts.length === 0 && <p className="col-span-full py-16 text-center text-sm text-slate-500">Nenhuma publicação neste recorte.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
