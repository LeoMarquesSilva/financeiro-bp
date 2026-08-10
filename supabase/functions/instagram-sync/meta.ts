import { normalizeMediaInsights, selectInstagramAccountId, type MetaPage } from './normalize.ts'

const GRAPH_VERSION = Deno.env.get('META_GRAPH_API_VERSION')?.trim() || 'v23.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export interface SyncedAccount {
  username: string
  followers_count: number
  media_count: number
  profile_picture_url: string | null
  biography: string | null
  website: string | null
  follows_count: number | null
  name: string | null
}
interface MediaRow {
  id: string
  caption?: string
  media_type?: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
}

interface InsightRow {
  name: string
  values?: Array<{ value: number; end_time?: string }>
  total_value?: {
    value?: number
    breakdowns?: Array<{ results?: Array<{ dimension_values?: string[]; value?: number }> }>
  }
}

function token() {
  const value = Deno.env.get('TOKEN_META_BP')?.trim().replace(/^Bearer\s+/i, '')
  if (!value) throw new Error('TOKEN_META_BP não configurado nos secrets da função.')
  return value
}

async function graphFetch<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(`${GRAPH_BASE}${path}${separator}access_token=${encodeURIComponent(token())}`)
  const body = await response.json()
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Meta Graph API respondeu ${response.status}`)
  }
  return body as T
}

export async function getInstagramAccountId() {
  const configured = Deno.env.get('META_IG_ACCOUNT_ID')?.trim()
  if (configured) return configured
  const response = await graphFetch<{ data?: MetaPage[] }>(
    '/me/accounts?fields=id,name,instagram_business_account',
  )
  return selectInstagramAccountId(response.data ?? [], {
    pageId: Deno.env.get('META_PAGE_ID'),
    pageName: Deno.env.get('META_PAGE_NAME') || 'bismarchi',
  })
}

export async function fetchAccount(accountId: string): Promise<SyncedAccount> {
  const row = await graphFetch<Record<string, unknown>>(
    `/${accountId}?fields=username,name,followers_count,follows_count,media_count,biography,website,profile_picture_url`,
  )
  return {
    username: String(row.username ?? ''),
    followers_count: Number(row.followers_count) || 0,
    media_count: Number(row.media_count) || 0,
    profile_picture_url: row.profile_picture_url ? String(row.profile_picture_url) : null,
    biography: row.biography ? String(row.biography) : null,
    website: row.website ? String(row.website) : null,
    follows_count: row.follows_count == null ? null : Number(row.follows_count) || 0,
    name: row.name ? String(row.name) : null,
  }
}

async function fetchMetricMap(media: MediaRow) {
  const base = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions']
  const metrics = media.media_product_type === 'REELS'
    ? [...base, 'reposts', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time']
    : [...base, 'follows', 'profile_visits', 'reposts']
  let rows: InsightRow[] = []
  try {
    const response = await graphFetch<{ data?: InsightRow[] }>(
      `/${media.id}/insights?metric=${metrics.join(',')}`,
    )
    rows = response.data ?? []
  } catch {
    const response = await graphFetch<{ data?: InsightRow[] }>(
      `/${media.id}/insights?metric=${base.join(',')}`,
    ).catch(() => ({ data: [] }))
    rows = response.data ?? []
  }
  const map: Record<string, number> = {}
  for (const row of rows) map[row.name] = Number(row.values?.[0]?.value ?? row.total_value?.value) || 0
  return map
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      output[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return output
}

export async function fetchPosts(accountId: string, since = '2025-01-01T00:00:00.000Z') {
  const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count'
  const collected: MediaRow[] = []
  let after: string | undefined
  let reachedCutoff = false
  for (let page = 0; page < 100 && !reachedCutoff; page += 1) {
    const afterParam = after ? `&after=${encodeURIComponent(after)}` : ''
    const response = await graphFetch<{
      data?: MediaRow[]
      paging?: { cursors?: { after?: string }; next?: string }
    }>(`/${accountId}/media?fields=${fields}&limit=50${afterParam}`)
    const rows = response.data ?? []
    for (const row of rows) {
      if (row.timestamp && row.timestamp < since) {
        reachedCutoff = true
        break
      }
      collected.push(row)
    }
    after = response.paging?.cursors?.after
    if (!after || !response.paging?.next || rows.length === 0) break
  }
  return mapConcurrent(collected, 6, async (media) => {
    const metrics = await fetchMetricMap(media)
    return {
      ig_media_id: media.id,
      caption: media.caption ?? null,
      media_type: media.media_type ?? null,
      media_product_type: media.media_product_type ?? null,
      media_url: media.media_url ?? null,
      thumbnail_url: media.thumbnail_url ?? null,
      permalink: media.permalink ?? null,
      published_at: media.timestamp ?? null,
      ...normalizeMediaInsights(media, metrics),
      synced_at: new Date().toISOString(),
    }
  })
}

async function storyInsights(storyId: string) {
  const metrics = ['reach', 'views', 'replies', 'shares', 'total_interactions', 'follows', 'profile_visits']
  const response = await graphFetch<{ data?: InsightRow[] }>(
    `/${storyId}/insights?metric=${metrics.join(',')}`,
  ).catch(() => ({ data: [] }))
  const map: Record<string, number> = {}
  for (const row of response.data ?? []) map[row.name] = Number(row.values?.[0]?.value ?? row.total_value?.value) || 0
  try {
    const nav = await graphFetch<{ data?: InsightRow[] }>(
      `/${storyId}/insights?metric=navigation&breakdown=story_navigation_action_type`,
    )
    for (const item of nav.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []) {
      map[String(item.dimension_values?.[0] ?? '').toLowerCase()] = Number(item.value) || 0
    }
  } catch {
    // Métricas de navegação podem estar indisponíveis para stories com pouca audiência.
  }
  return map
}

export async function fetchStories(accountId: string) {
  const response = await graphFetch<{ data?: MediaRow[] }>(
    `/${accountId}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp,permalink&limit=50`,
  )
  return mapConcurrent(response.data ?? [], 5, async (story) => {
    const metrics = await storyInsights(story.id)
    return {
      ig_story_id: story.id,
      media_type: story.media_type ?? null,
      media_url: story.media_url ?? null,
      thumbnail_url: story.thumbnail_url ?? null,
      permalink: story.permalink ?? null,
      published_at: story.timestamp ?? null,
      reach: metrics.reach ?? 0,
      views: metrics.views ?? 0,
      replies: metrics.replies ?? 0,
      shares: metrics.shares ?? 0,
      total_interactions: metrics.total_interactions ?? 0,
      follows: metrics.follows ?? 0,
      profile_visits: metrics.profile_visits ?? 0,
      nav_taps_forward: metrics.tap_forward ?? 0,
      nav_taps_back: metrics.tap_back ?? 0,
      nav_exits: metrics.tap_exit ?? 0,
      nav_swipe_forward: metrics.swipe_forward ?? 0,
      synced_at: new Date().toISOString(),
    }
  })
}

export async function fetchAccountInsights(accountId: string) {
  const since = Math.floor((Date.now() - 89 * 86400000) / 1000)
  const until = Math.floor(Date.now() / 1000)
  const metrics = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'saves', 'shares', 'profile_links_taps']
  const byDate = new Map<string, Record<string, number | string>>()
  for (const metric of metrics) {
    const response = await graphFetch<{ data?: InsightRow[] }>(
      `/${accountId}/insights?metric=${metric}&period=day&metric_type=time_series&since=${since}&until=${until}`,
    ).catch(() => ({ data: [] }))
    for (const value of response.data?.[0]?.values ?? []) {
      const date = String(value.end_time ?? '').slice(0, 10)
      if (!date) continue
      const row = byDate.get(date) ?? { date }
      row[metric] = Number(value.value) || 0
      byDate.set(date, row)
    }
  }
  return [...byDate.values()].map((row) => ({
    date: row.date,
    reach: row.reach ?? 0,
    views: row.views ?? 0,
    accounts_engaged: row.accounts_engaged ?? 0,
    total_interactions: row.total_interactions ?? 0,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    saves: row.saves ?? 0,
    shares: row.shares ?? 0,
    profile_links_taps: row.profile_links_taps ?? 0,
    fetched_at: new Date().toISOString(),
  }))
}

export async function fetchDemographics(accountId: string) {
  const output: Array<{ kind: string; breakdown: string; label: string; value: number; fetched_at: string }> = []
  for (const breakdown of ['age', 'gender', 'country', 'city']) {
    const response = await graphFetch<{ data?: InsightRow[] }>(
      `/${accountId}/insights?metric=follower_demographics&period=lifetime&timeframe=this_month&breakdown=${breakdown}&metric_type=total_value`,
    ).catch(() => ({ data: [] }))
    for (const item of response.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []) {
      const label = item.dimension_values?.at(-1)
      if (!label) continue
      output.push({
        kind: 'followers', breakdown, label, value: Number(item.value) || 0,
        fetched_at: new Date().toISOString(),
      })
    }
  }
  return output
}
