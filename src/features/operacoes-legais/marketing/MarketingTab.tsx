import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ClipboardList,
  FileImage,
  Instagram,
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
import {
  getPreviousInstagramPeriod,
  resolveInstagramPeriod,
} from './instagramPeriod'
import { MarketingAudience } from './MarketingAudience'
import { MarketingOverview } from './MarketingOverview'
import { MarketingPeriodPicker } from './MarketingPeriodPicker'
import { MarketingPosts } from './MarketingPosts'
import { MarketingPautasPanel } from './MarketingPautasPanel'
import { buildMarketingPautas } from './marketingPautas'
import {
  useInstagramMarketing,
  useInstagramPeople,
  useMarketingPautas,
  useSyncInstagram,
} from './useInstagramMarketing'
import type { InstagramAccountStats, InstagramPeriodFilter, InstagramPeriodRange } from './types'

type Section = 'performance' | 'audience' | 'posts' | 'pautas'

function currentMonthFilter(): InstagramPeriodFilter {
  const now = new Date()
  return { kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1 }
}

function within(value: string | null, range: InstagramPeriodRange) {
  if (!value) return false
  return (!range.from || value >= range.from) && (!range.to || value <= range.to)
}

function rangeLabel(range: InstagramPeriodRange) {
  if (!range.from || !range.to) return 'o período anterior'
  const format = (value: string) =>
    new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${format(range.from)} a ${format(range.to)}`
}

function AccountAvatar({ account }: { account: InstagramAccountStats | null }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [account?.profile_picture_url])
  const showImage = Boolean(account?.profile_picture_url) && !failed
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm ring-4 ring-white">
      {showImage ? (
        <img
          src={account?.profile_picture_url ?? ''}
          alt={`Foto do perfil @${account?.username ?? 'bismarchipires'}`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Instagram className="h-6 w-6" />
      )}
    </span>
  )
}

export function MarketingTab() {
  const { role, area } = useAuth()
  const dashboard = useInstagramMarketing()
  const peopleQuery = useInstagramPeople()
  const pautasQuery = useMarketingPautas()
  const sync = useSyncInstagram()
  const [section, setSection] = useState<Section>('performance')
  const [period, setPeriod] = useState<InstagramPeriodFilter>(currentMonthFilter)
  const canManage = canManageInstagramMarketing({ role, area, isActive: true })

  const data = dashboard.data
  const availableYears = useMemo(() => {
    const years = new Set(
      (data?.posts ?? []).flatMap((post) =>
        post.published_at ? [Number(post.published_at.slice(0, 4))] : [],
      ),
    )
    years.add(new Date().getFullYear())
    return [...years].filter(Number.isFinite).sort((a, b) => b - a)
  }, [data?.posts])
  const range = useMemo(() => resolveInstagramPeriod(period), [period])
  const previousRange = useMemo(() => getPreviousInstagramPeriod(range), [range])
  const posts = filterPostsByPeriod(data?.posts ?? [], range)
  const previousPosts = previousRange.from
    ? filterPostsByPeriod(data?.posts ?? [], previousRange)
    : []
  const stories = (data?.stories ?? []).filter((story) => within(story.published_at, range))
  const accountInsights = (data?.accountInsights ?? []).filter((row) =>
    within(`${row.date}T12:00:00.000Z`, range),
  )
  const accountHistory = (data?.accountHistory ?? []).filter((row) => within(row.fetched_at, range))
  const pautas = useMemo(() => buildMarketingPautas(pautasQuery.data ?? []), [pautasQuery.data])

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync()
      toast.success(`Instagram atualizado: ${result.synced.posts} posts e ${result.synced.stories} stories.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar o Instagram.')
    }
  }

  if (dashboard.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    )
  }

  if (dashboard.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
        <p className="mt-3 font-semibold text-rose-900">Não foi possível carregar os dados de Marketing.</p>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-rose-700">
          {dashboard.error instanceof Error ? dashboard.error.message : 'Verifique se a migration foi aplicada no Supabase.'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => dashboard.refetch()}>Tentar novamente</Button>
      </div>
    )
  }

  const account = data?.accountStats ?? null
  const latestSync = data?.posts.reduce<string | null>(
    (latest, post) => !latest || post.synced_at > latest ? post.synced_at : latest,
    null,
  )

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 pb-5 pt-4 shadow-sm sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <AccountAvatar account={account} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-black tracking-tight text-slate-950">
                  {account?.name || 'Bismarchi Pires'}
                </h2>
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                  Instagram
                </span>
              </div>
              <p className="mt-0.5 text-sm font-medium text-slate-500">@{account?.username ?? 'bismarchipires'}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span><strong className="font-bold text-slate-800">{(account?.followers_count ?? 0).toLocaleString('pt-BR')}</strong> seguidores</span>
                <span><strong className="font-bold text-slate-800">{(data?.posts.length ?? 0).toLocaleString('pt-BR')}</strong> posts salvos</span>
                <span><strong className="font-bold text-slate-800">{(data?.stories.length ?? 0).toLocaleString('pt-BR')}</strong> stories</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {latestSync && (
              <span className="text-[11px] text-slate-400">
                Atualizado em {new Date(latestSync).toLocaleString('pt-BR')}
              </span>
            )}
            {canManage && (
              <Button
                onClick={handleSync}
                disabled={sync.isPending}
                variant="outline"
                className="h-9 rounded-xl border-slate-200 bg-white font-semibold"
              >
                {sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Sincronizar
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <MarketingPeriodPicker value={period} onChange={setPeriod} availableYears={availableYears} />
          <span className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Comparando com <strong className="font-semibold text-slate-700">{rangeLabel(previousRange)}</strong>
          </span>
        </div>
      </header>

      <Tabs value={section} onValueChange={(value) => setSection(value as Section)}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start rounded-xl bg-slate-100 p-1">
            <TabsTrigger value="performance"><Activity className="h-4 w-4" />Desempenho</TabsTrigger>
            <TabsTrigger value="audience"><Users className="h-4 w-4" />Conta & audiência</TabsTrigger>
            <TabsTrigger value="posts"><FileImage className="h-4 w-4" />Postagens</TabsTrigger>
            <TabsTrigger value="pautas"><ClipboardList className="h-4 w-4" />Pautas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="performance" className="mt-5">
          <MarketingOverview
            posts={posts}
            previousPosts={previousPosts}
            account={account}
            stories={stories}
            people={peopleQuery.data ?? []}
            range={range}
            comparisonLabel={rangeLabel(previousRange)}
            pautas={pautas}
            previousRange={previousRange}
          />
        </TabsContent>
        <TabsContent value="audience" className="mt-5">
          <MarketingAudience
            insights={accountInsights}
            demographics={data?.demographics ?? []}
            accountHistory={accountHistory.length ? accountHistory : data?.accountHistory ?? []}
          />
        </TabsContent>
        <TabsContent value="posts" className="mt-5">
          <MarketingPosts posts={posts} people={peopleQuery.data ?? []} canManage={canManage} />
        </TabsContent>
        <TabsContent value="pautas" className="mt-5">
          <MarketingPautasPanel
            pautas={pautas}
            people={peopleQuery.data ?? []}
            range={range}
            isLoading={pautasQuery.isLoading}
            error={pautasQuery.error}
            onRetry={() => pautasQuery.refetch()}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
