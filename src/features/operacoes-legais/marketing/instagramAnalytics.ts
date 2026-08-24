import type {
  InstagramAreaRank,
  InstagramPersonRank,
  InstagramPeriodRange,
  InstagramPost,
  InstagramSummary,
} from './types'

const n = (value: number | null | undefined) => Number(value) || 0

export const MARKETING_REACH_MONTHLY_GOAL = 15_000
export const MARKETING_ENGAGEMENT_GOAL = 3.5
export const MARKETING_POSTS_MONTHLY_GOAL = 12

export function computePostEngagementRate(post: Pick<InstagramPost, 'reach' | 'total_interactions' | 'likes' | 'comments' | 'saves' | 'shares'>): number {
  const reach = n(post.reach)
  if (reach <= 0) return 0
  const interactions =
    n(post.total_interactions) || n(post.likes) + n(post.comments) + n(post.saves) + n(post.shares)
  return (interactions / reach) * 100
}

export function summarizeInstagram(posts: InstagramPost[]): InstagramSummary {
  const summary = posts.reduce(
    (acc, post) => {
      acc.reach += n(post.reach)
      acc.views += n(post.views)
      acc.interactions +=
        n(post.total_interactions) || n(post.likes) + n(post.comments) + n(post.saves) + n(post.shares)
      acc.follows += n(post.follows)
      acc.profileVisits += n(post.profile_visits)
      acc.saves += n(post.saves)
      acc.shares += n(post.shares)
      return acc
    },
    { posts: posts.length, reach: 0, views: 0, interactions: 0, engagementRate: 0, follows: 0, profileVisits: 0, saves: 0, shares: 0 },
  )
  summary.engagementRate = summary.reach > 0 ? (summary.interactions / summary.reach) * 100 : 0
  return summary
}

export function filterPostsByPeriod(posts: InstagramPost[], range: InstagramPeriodRange): InstagramPost[] {
  return posts.filter((post) => {
    if (!post.published_at) return false
    if (range.from && post.published_at < range.from) return false
    if (range.to && post.published_at > range.to) return false
    return true
  })
}

export function rankAreas(posts: InstagramPost[]): InstagramAreaRank[] {
  const grouped = new Map<string, InstagramPost[]>()
  for (const post of posts) {
    const areas = post.areas?.length ? post.areas : post.area ? [post.area] : ['Sem área']
    for (const area of new Set(areas.map((item) => item.trim()).filter(Boolean))) {
      grouped.set(area, [...(grouped.get(area) ?? []), post])
    }
  }
  return [...grouped.entries()]
    .map(([area, areaPosts]) => ({ area, ...summarizeInstagram(areaPosts) }))
    .sort((a, b) => b.engagementRate - a.engagementRate || b.reach - a.reach || a.area.localeCompare(b.area))
}

export function rankAreasByPostVolume(posts: InstagramPost[]): InstagramAreaRank[] {
  return rankAreas(posts).sort(
    (a, b) => b.posts - a.posts || b.reach - a.reach || a.area.localeCompare(b.area, 'pt-BR'),
  )
}

export function rankPeopleByPostVolume(posts: InstagramPost[]): InstagramPersonRank[] {
  const grouped = new Map<string, { id: string; name: string; posts: InstagramPost[] }>()
  for (const post of posts) {
    const people = post.solicitantes?.length
      ? post.solicitantes
      : post.solicitante
        ? [{ id: post.solicitante_id ?? post.solicitante, name: post.solicitante }]
        : []
    const unique = new Map(people.map((person) => [person.id || person.name, person]))
    for (const person of unique.values()) {
      const key = person.id || person.name.trim().toLocaleLowerCase('pt-BR')
      const current = grouped.get(key) ?? { id: person.id, name: person.name, posts: [] }
      current.posts.push(post)
      grouped.set(key, current)
    }
  }
  return [...grouped.values()]
    .map((person) => ({ id: person.id, name: person.name, ...summarizeInstagram(person.posts) }))
    .sort(
      (a, b) => b.posts - a.posts || b.reach - a.reach || a.name.localeCompare(b.name, 'pt-BR'),
    )
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export function compareInstagramPeriods(currentPosts: InstagramPost[], previousPosts: InstagramPost[]) {
  const current = summarizeInstagram(currentPosts)
  const previous = summarizeInstagram(previousPosts)
  return {
    reach: {
      current: current.reach,
      previous: previous.reach,
      changePct: percentChange(current.reach, previous.reach),
    },
    engagement: {
      current: current.engagementRate,
      previous: previous.engagementRate,
      changePct: percentChange(current.engagementRate, previous.engagementRate),
    },
    posts: {
      current: current.posts,
      previous: previous.posts,
      changePct: percentChange(current.posts, previous.posts),
    },
  }
}

function rangeMonthUnits(range: InstagramPeriodRange): number {
  if (!range.from || !range.to) return 1
  const from = new Date(range.from)
  const to = new Date(range.to)
  const wholeMonths =
    from.getUTCDate() === 1 &&
    from.getUTCHours() === 0 &&
    to.getTime() ===
      new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0, 23, 59, 59, 999)).getTime()
  if (wholeMonths) {
    return Math.max(
      1,
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
        (to.getUTCMonth() - from.getUTCMonth()) +
        1,
    )
  }
  const days = Math.max(1, Math.round((to.getTime() - from.getTime() + 1) / 86_400_000))
  return days / (365.2425 / 12)
}

export function computeMarketingGoals(range: InstagramPeriodRange) {
  const units = rangeMonthUnits(range)
  return {
    reach: { target: MARKETING_REACH_MONTHLY_GOAL * units, cadence: 'monthly' as const },
    engagement: { target: MARKETING_ENGAGEMENT_GOAL, cadence: 'annual' as const },
    posts: { target: MARKETING_POSTS_MONTHLY_GOAL * units, cadence: 'monthly' as const },
  }
}

export function groupPostsByMonth(posts: InstagramPost[]) {
  const grouped = new Map<string, InstagramPost[]>()
  for (const post of posts) {
    if (!post.published_at) continue
    const month = post.published_at.slice(0, 7)
    grouped.set(month, [...(grouped.get(month) ?? []), post])
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthPosts]) => ({ month, ...summarizeInstagram(monthPosts) }))
}

export function groupPostsByDay(posts: InstagramPost[]) {
  const grouped = new Map<string, InstagramPost[]>()
  for (const post of posts) {
    if (!post.published_at) continue
    const date = post.published_at.slice(0, 10)
    grouped.set(date, [...(grouped.get(date) ?? []), post])
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayPosts]) => ({ date, ...summarizeInstagram(dayPosts) }))
}

export function groupPostsByFormat(posts: InstagramPost[]) {
  const grouped = new Map<string, InstagramPost[]>()
  for (const post of posts) {
    const key = post.media_product_type || post.media_type || 'OUTRO'
    grouped.set(key, [...(grouped.get(key) ?? []), post])
  }
  return [...grouped.entries()]
    .map(([format, formatPosts]) => ({ format, ...summarizeInstagram(formatPosts) }))
    .sort((a, b) => b.posts - a.posts)
}
