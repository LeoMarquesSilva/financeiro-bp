export interface InstagramSolicitante {
  id: string
  name: string
}
export interface InstagramPost {
  id: string
  ig_media_id: string
  caption: string | null
  media_type: string | null
  media_product_type: string | null
  media_url: string | null
  thumbnail_url: string | null
  permalink: string | null
  published_at: string | null
  area: string | null
  areas: string[]
  solicitante_id: string | null
  solicitante: string | null
  solicitantes: InstagramSolicitante[]
  skip_participants: boolean
  tags: string[]
  likes: number
  comments: number
  reach: number
  views: number
  saves: number
  shares: number
  total_interactions: number
  follows: number
  profile_visits: number
  reposts: number
  profile_activity: number
  link_clicks: number
  reels_avg_watch_time: number
  reels_total_watch_time: number
  synced_at: string
  created_at: string
}

export interface InstagramAccountStats {
  id: string
  username: string
  followers_count: number
  media_count: number
  profile_picture_url: string | null
  biography: string | null
  website: string | null
  follows_count: number | null
  name: string | null
  fetched_at: string
}

export interface InstagramAccountInsight {
  id: string
  date: string
  reach: number
  views: number
  accounts_engaged: number
  total_interactions: number
  likes: number
  comments: number
  saves: number
  shares: number
  replies: number
  follows: number
  unfollows: number
  profile_links_taps: number
}

export interface InstagramDemographic {
  id: string
  kind: 'followers' | 'engaged' | 'reached'
  breakdown: 'age' | 'gender' | 'city' | 'country'
  label: string
  value: number
  fetched_at: string
}

export interface InstagramStory {
  id: string
  ig_story_id: string
  media_type: string | null
  media_url: string | null
  thumbnail_url: string | null
  permalink: string | null
  published_at: string | null
  reach: number
  views: number
  replies: number
  shares: number
  total_interactions: number
  follows: number
  profile_visits: number
  nav_taps_forward: number
  nav_taps_back: number
  nav_exits: number
  nav_swipe_forward: number
  synced_at: string
}

export interface InstagramPeriodRange {
  from: string | null
  to: string | null
}

export type InstagramPeriodFilter =
  | { kind: 'all' }
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'custom'; from: string; to: string }

export interface InstagramSummary {
  posts: number
  reach: number
  views: number
  interactions: number
  engagementRate: number
  follows: number
  profileVisits: number
  saves: number
  shares: number
}

export interface InstagramAreaRank extends InstagramSummary {
  area: string
}

export interface InstagramDashboardData {
  posts: InstagramPost[]
  accountStats: InstagramAccountStats | null
  accountHistory: InstagramAccountStats[]
  accountInsights: InstagramAccountInsight[]
  demographics: InstagramDemographic[]
  stories: InstagramStory[]
  monthlyGoal: number
}
