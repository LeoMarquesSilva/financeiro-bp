import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  fetchAccount,
  fetchAccountInsights,
  fetchDemographics,
  fetchPosts,
  fetchStories,
  getInstagramAccountId,
} from './meta.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !anonKey || !serviceKey) return json({ error: 'Supabase não configurado.' }, 500)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const cronSecret = Deno.env.get('INSTAGRAM_SYNC_CRON_SECRET')?.trim()
  const cronAuthorized = Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)

  if (!cronAuthorized) {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Não autenticado.' }, 401)
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user?.email) return json({ error: 'Não autenticado.' }, 401)
    const { data: member } = await admin
      .from('team_members')
      .select('role, area, is_active')
      .ilike('email', user.email)
      .maybeSingle()
    const canManage = member?.is_active !== false && (
      member?.role === 'admin' || String(member?.area ?? '').trim().toLocaleLowerCase('pt-BR') === 'marketing'
    )
    if (!canManage) return json({ error: 'Apenas administradores e Marketing podem sincronizar.' }, 403)
  }

  try {
    const body = await request.json().catch(() => ({})) as { since?: string }
    const accountId = await getInstagramAccountId()
    const [account, posts, stories, insights, demographics] = await Promise.all([
      fetchAccount(accountId),
      fetchPosts(accountId, body.since || '2025-01-01T00:00:00.000Z'),
      fetchStories(accountId),
      fetchAccountInsights(accountId),
      fetchDemographics(accountId),
    ])

    const operations = [
      admin.from('instagram_account_stats').insert(account),
      posts.length ? admin.from('instagram_posts').upsert(posts, { onConflict: 'ig_media_id' }) : Promise.resolve({ error: null }),
      stories.length ? admin.from('instagram_stories').upsert(stories, { onConflict: 'ig_story_id' }) : Promise.resolve({ error: null }),
      insights.length ? admin.from('instagram_account_insights').upsert(insights, { onConflict: 'date' }) : Promise.resolve({ error: null }),
    ]
    const results = await Promise.all(operations)
    const operationError = results.find((result) => result.error)?.error
    if (operationError) throw operationError

    if (demographics.length) {
      const { error: deleteError } = await admin.from('instagram_demographics').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (deleteError) throw deleteError
      const { error: demographicsError } = await admin.from('instagram_demographics').insert(demographics)
      if (demographicsError) throw demographicsError
    }

    return json({
      ok: true,
      account: account.username,
      synced: { posts: posts.length, stories: stories.length, insights: insights.length, demographics: demographics.length },
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
