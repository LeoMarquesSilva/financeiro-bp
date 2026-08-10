import type {
  InstagramAreaRank,
  InstagramPeriodRange,
  InstagramPost,
  InstagramSummary,
} from './types'

const n = (value: number | null | undefined) => Number(value) || 0

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
