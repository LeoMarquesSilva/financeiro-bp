import { supabase } from '@/lib/supabaseClient'
import type {
  InstagramAccountInsight,
  InstagramAccountStats,
  InstagramDashboardData,
  InstagramDemographic,
  InstagramPost,
  InstagramSolicitante,
  InstagramStory,
  MarketingTaskRow,
} from './types'

type MarketingPerson = InstagramSolicitante & {
  email: string | null
  area: string
  isActive: boolean
  avatarUrl: string | null
}

async function fetchAll<T>(table: string, orderColumn: string, ascending = false): Promise<T[]> {
  const output: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table as never)
      .select('*')
      .order(orderColumn, { ascending })
      .range(from, from + size - 1)
    if (error) throw error
    const rows = (data ?? []) as unknown as T[]
    output.push(...rows)
    if (rows.length < size) return output
  }
}

function normalizePost(post: InstagramPost): InstagramPost {
  return {
    ...post,
    areas: Array.isArray(post.areas) ? post.areas : post.area ? [post.area] : [],
    solicitantes: Array.isArray(post.solicitantes) ? post.solicitantes : [],
    tags: Array.isArray(post.tags) ? post.tags : [],
  }
}

export const instagramService = {
  async getDashboard(): Promise<InstagramDashboardData> {
    const [posts, accountHistory, accountInsights, demographics, stories, settings] =
      await Promise.all([
        fetchAll<InstagramPost>('instagram_posts', 'published_at'),
        fetchAll<InstagramAccountStats>('instagram_account_stats', 'fetched_at', true),
        fetchAll<InstagramAccountInsight>('instagram_account_insights', 'date', true),
        fetchAll<InstagramDemographic>('instagram_demographics', 'value'),
        fetchAll<InstagramStory>('instagram_stories', 'published_at'),
        supabase
          .from('instagram_settings' as never)
          .select('value')
          .eq('key', 'monthly_post_goal')
          .maybeSingle(),
      ])
    const settingsRow = settings.data as unknown as { value?: unknown } | null
    return {
      posts: posts.map(normalizePost),
      accountHistory,
      accountStats: accountHistory[accountHistory.length - 1] ?? null,
      accountInsights,
      demographics,
      stories,
      monthlyGoal: Math.max(1, Number(settingsRow?.value) || 12),
    }
  },

  async listPeople(): Promise<MarketingPerson[]> {
    const { data, error } = await supabase
      .from('colaboradores' as never)
      .select('id, full_name, email, area, is_active, avatar_url')
      .order('full_name')
    if (error) throw error
    return ((data ?? []) as unknown as Array<{
      id: string
      full_name: string
      email: string | null
      area: string
      is_active: boolean
      avatar_url: string | null
    }>).map((person) => ({
      id: person.id,
      name: person.full_name,
      email: person.email,
      area: person.area,
      isActive: person.is_active,
      avatarUrl: person.avatar_url,
    }))
  },

  async listMarketingTasks(): Promise<MarketingTaskRow[]> {
    const output: MarketingTaskRow[] = []
    const size = 1000
    const marketingTask = 'MATERIAL MARKETING - REELS/POST/ARTIGO'
    for (let from = 0; ; from += size) {
      const { data, error } = await supabase
        .from('sp_tarefas_historico' as never)
        .select('ci, ci_processo, grupo_cliente, cliente, tarefa, tarefa_pai, status, responsavel, usuario_conclusao, data_conclusao, data_para_conclusao, area_conclusao')
        .or(`tarefa.eq.${marketingTask},tarefa_pai.eq.${marketingTask}`)
        .order('ci', { ascending: true })
        .range(from, from + size - 1)
      if (error) throw error
      const rows = (data ?? []) as unknown as MarketingTaskRow[]
      output.push(...rows)
      if (rows.length < size) return output
    }
  },

  async sync(since = '2025-01-01T00:00:00.000Z') {
    const { data, error } = await supabase.functions.invoke('instagram-sync', {
      body: { action: 'sync', since },
    })
    if (error) throw error
    if (data?.error) throw new Error(String(data.error))
    return data as { synced: { posts: number; stories: number; insights: number; demographics: number } }
  },

  async updatePostLinks(
    postId: string,
    areas: string[],
    solicitantes: InstagramSolicitante[],
    skipParticipants: boolean,
  ) {
    const { data, error } = await supabase.rpc('update_instagram_post_links' as never, {
      p_post_id: postId,
      p_areas: areas,
      p_solicitantes: solicitantes,
      p_skip_participants: skipParticipants,
    } as never)
    if (error) throw error
    return normalizePost(data as unknown as InstagramPost)
  },
}

export type { MarketingPerson }
