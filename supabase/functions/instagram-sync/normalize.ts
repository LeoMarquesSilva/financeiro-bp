export interface MetaPage {
  id: string
  name?: string
  instagram_business_account?: { id: string }
}
export interface AccountSelector {
  igAccountId?: string | null
  pageId?: string | null
  pageName?: string | null
}

export function selectInstagramAccountId(pages: MetaPage[], selector: AccountSelector): string {
  const linked = pages.filter((page) => page.instagram_business_account?.id)
  if (selector.igAccountId) {
    const match = linked.find((page) => page.instagram_business_account?.id === selector.igAccountId)
    if (!match) throw new Error('Conta Instagram configurada não encontrada no token.')
    return match.instagram_business_account!.id
  }
  if (selector.pageId) {
    const match = linked.find((page) => page.id === selector.pageId)
    if (!match) throw new Error('Página Meta configurada não encontrada ou sem Instagram Business.')
    return match.instagram_business_account!.id
  }
  if (selector.pageName) {
    const needle = selector.pageName.toLocaleLowerCase('pt-BR')
    const match = linked.find((page) => page.name?.toLocaleLowerCase('pt-BR').includes(needle))
    if (match) return match.instagram_business_account!.id
  }
  if (linked.length === 1) return linked[0].instagram_business_account!.id
  if (linked.length === 0) throw new Error('Nenhuma conta Instagram Business vinculada ao token.')
  throw new Error('Várias contas Instagram encontradas; configure META_IG_ACCOUNT_ID ou META_PAGE_ID.')
}

const metric = (metrics: Record<string, number | undefined>, key: string) => Number(metrics[key]) || 0

export function normalizeMediaInsights(
  media: { like_count?: number; comments_count?: number },
  metrics: Record<string, number | undefined>,
) {
  const likes = metric(metrics, 'likes') || Number(media.like_count) || 0
  const comments = metric(metrics, 'comments') || Number(media.comments_count) || 0
  const saves = metric(metrics, 'saved')
  const shares = metric(metrics, 'shares')
  return {
    reach: metric(metrics, 'reach'),
    views: metric(metrics, 'views'),
    saves,
    shares,
    likes,
    comments,
    total_interactions: metric(metrics, 'total_interactions') || likes + comments + saves + shares,
    follows: metric(metrics, 'follows'),
    profile_visits: metric(metrics, 'profile_visits'),
    reposts: metric(metrics, 'reposts'),
    profile_activity: metric(metrics, 'profile_activity'),
    link_clicks: metric(metrics, 'bio_link_clicked'),
    reels_avg_watch_time: metric(metrics, 'ig_reels_avg_watch_time'),
    reels_total_watch_time: metric(metrics, 'ig_reels_video_view_total_time'),
  }
}
