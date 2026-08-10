import { useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Building2,
  Instagram,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/AuthContext'
import { canManageInstagramMarketing } from './marketingAccess'
import { filterPostsByPeriod } from './instagramAnalytics'
import { resolveInstagramPeriod } from './instagramPeriod'
import { MarketingAreas } from './MarketingAreas'
import { MarketingAudience } from './MarketingAudience'
import { MarketingOverview } from './MarketingOverview'
import { MarketingPosts } from './MarketingPosts'
import { useInstagramMarketing, useInstagramPeople, useSyncInstagram } from './useInstagramMarketing'
import type { InstagramPeriodFilter } from './types'

type Section = 'overview' | 'audience' | 'areas' | 'posts'

function periodFromValue(value: string): InstagramPeriodFilter {
  if (value === 'all') return { kind: 'all' }
  if (/^\d{4}$/.test(value)) return { kind: 'year', year: Number(value) }
  const [year, month] = value.split('-').map(Number)
  return { kind: 'month', year, month }
}
export function MarketingTab() {
  const { role, area } = useAuth()
  const dashboard = useInstagramMarketing()
  const peopleQuery = useInstagramPeople()
  const sync = useSyncInstagram()
  const [section, setSection] = useState<Section>('overview')
  const [periodValue, setPeriodValue] = useState('all')
  const canManage = canManageInstagramMarketing({ role, area, isActive: true })

  const data = dashboard.data
  const periods = useMemo(() => {
    const months = [...new Set((data?.posts ?? []).flatMap((post) => post.published_at ? [post.published_at.slice(0, 7)] : []))]
      .sort((a, b) => b.localeCompare(a))
    const years = [...new Set(months.map((month) => month.slice(0, 4)))]
    return { months, years }
  }, [data?.posts])
  const range = resolveInstagramPeriod(periodFromValue(periodValue))
  const posts = filterPostsByPeriod(data?.posts ?? [], range)
  const stories = (data?.stories ?? []).filter((story) => {
    if (!story.published_at) return false
    return (!range.from || story.published_at >= range.from) && (!range.to || story.published_at <= range.to)
  })
  const accountInsights = (data?.accountInsights ?? []).filter((row) =>
    (!range.from || row.date >= range.from.slice(0, 10)) && (!range.to || row.date <= range.to.slice(0, 10)),
  )
  const accountHistory = (data?.accountHistory ?? []).filter((row) =>
    (!range.from || row.fetched_at >= range.from) && (!range.to || row.fetched_at <= range.to),
  )

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync()
      toast.success(`Instagram atualizado: ${result.synced.posts} posts e ${result.synced.stories} stories.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar o Instagram.')
    }
  }

  if (dashboard.isLoading) {
    return <div className="grid min-h-96 place-items-center rounded-2xl border border-slate-200 bg-white"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-teal-700" /><p className="mt-3 text-sm text-slate-500">Carregando Instagram Insights...</p></div></div>
  }

  if (dashboard.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
        <p className="mt-3 font-semibold text-rose-900">Não foi possível carregar os dados de Marketing.</p>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-rose-700">{dashboard.error instanceof Error ? dashboard.error.message : 'Verifique se a migration foi aplicada no Supabase.'}</p>
        <Button variant="outline" className="mt-4" onClick={() => dashboard.refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  const latestSync = data?.posts.reduce<string | null>((latest, post) => !latest || post.synced_at > latest ? post.synced_at : latest, null)

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(13,148,136,0.16),_transparent_42%),linear-gradient(135deg,#ffffff,#f8fafc)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 via-rose-500 to-amber-400 text-white shadow-md"><Instagram className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-bold text-slate-900">Instagram Insights</h2><p className="text-xs text-slate-500">Performance de @bismarchipires · histórico preservado desde 2025</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} className="h-9 min-w-48 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm">
              <option value="all">Todo o histórico</option>
              {periods.years.map((year) => <option key={year} value={year}>Ano {year}</option>)}
              {periods.months.map((month) => <option key={month} value={month}>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))}</option>)}
            </select>
            {canManage && <Button onClick={handleSync} disabled={sync.isPending} className="bg-teal-700 hover:bg-teal-800">{sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}Sincronizar agora</Button>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-200/70 pt-3 text-[11px] text-slate-500">
          <span>{data?.posts.length ?? 0} publicações armazenadas</span><span>{data?.stories.length ?? 0} stories preservados</span>{latestSync && <span>Última sincronização: {new Date(latestSync).toLocaleString('pt-BR')}</span>}{!canManage && <span className="font-medium text-slate-600">Modo consulta</span>}
        </div>
      </div>

      <Tabs value={section} onValueChange={(value) => setSection(value as Section)}>
        <div className="overflow-x-auto pb-1"><TabsList className="h-auto min-w-max justify-start">
          <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4" />Visão geral</TabsTrigger>
          <TabsTrigger value="audience"><Users className="h-4 w-4" />Conta & audiência</TabsTrigger>
          <TabsTrigger value="areas"><Building2 className="h-4 w-4" />Por área</TabsTrigger>
          <TabsTrigger value="posts"><BarChart3 className="h-4 w-4" />Postagens</TabsTrigger>
        </TabsList></div>
        <TabsContent value="overview" className="mt-5"><MarketingOverview posts={posts} account={data?.accountStats ?? null} stories={stories} monthlyGoal={data?.monthlyGoal ?? 12} /></TabsContent>
        <TabsContent value="audience" className="mt-5"><MarketingAudience insights={accountInsights} demographics={data?.demographics ?? []} accountHistory={accountHistory.length ? accountHistory : data?.accountHistory ?? []} /></TabsContent>
        <TabsContent value="areas" className="mt-5"><MarketingAreas posts={posts} /></TabsContent>
        <TabsContent value="posts" className="mt-5"><MarketingPosts posts={posts} people={peopleQuery.data ?? []} canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  )
}
