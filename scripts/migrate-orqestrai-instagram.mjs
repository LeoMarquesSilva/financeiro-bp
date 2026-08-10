import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
loadEnv({ path: path.join(root, '.env'), override: false, quiet: true })

const sourceEnvPath = process.env.ORQESTRA_ENV_FILE
  ? path.resolve(process.env.ORQESTRA_ENV_FILE)
  : path.resolve(root, '..', 'marketing-system', '.env')

const sourceValues = {}
loadEnv({ path: sourceEnvPath, processEnv: sourceValues, override: true, quiet: true })

const sourceUrl = sourceValues.NEXT_PUBLIC_SUPABASE_URL
const sourceKey = sourceValues.SUPABASE_SERVICE_ROLE_KEY
const targetUrl = process.env.VITE_SUPABASE_URL
const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const execute = process.argv.includes('--execute')

if (!sourceUrl || !sourceKey) throw new Error(`Credenciais do ORQESTRAI ausentes em ${sourceEnvPath}`)
if (!targetUrl || !targetKey) throw new Error('VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env atual')

const source = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } })
const target = createClient(targetUrl, targetKey, { auth: { persistSession: false } })

async function fetchAll(client, table, select = '*') {
  const output = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(select).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    output.push(...(data ?? []))
    if ((data ?? []).length < 1000) return output
  }
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

async function buildPersonMap() {
  const [sourceUsers, targetPeople] = await Promise.all([
    fetchAll(source, 'users', 'id,name,email'),
    fetchAll(target, 'colaboradores', 'id,full_name,email'),
  ])
  const byEmail = new Map(targetPeople.filter((p) => p.email).map((p) => [String(p.email).toLowerCase(), p.id]))
  const byName = new Map(targetPeople.map((p) => [normalizeName(p.full_name), p.id]))
  return new Map(sourceUsers.map((user) => [
    user.id,
    byEmail.get(String(user.email ?? '').toLowerCase()) ?? byName.get(normalizeName(user.name)) ?? null,
  ]))
}

function mapPost(row, personMap) {
  const solicitantes = Array.isArray(row.solicitantes)
    ? row.solicitantes.map((person) => ({ ...person, id: personMap.get(person.id) ?? person.id }))
    : []
  const mappedLegacyId = row.solicitante_id ? personMap.get(row.solicitante_id) ?? null : null
  return {
    id: row.id,
    ig_media_id: row.ig_media_id,
    caption: row.caption,
    media_type: row.media_type,
    media_product_type: row.media_product_type ?? null,
    media_url: row.media_url,
    thumbnail_url: row.thumbnail_url,
    permalink: row.permalink,
    published_at: row.published_at,
    area: row.area,
    areas: row.areas?.length ? row.areas : row.area ? [row.area] : [],
    solicitante_id: mappedLegacyId,
    solicitante: row.solicitante,
    solicitantes,
    skip_participants: Boolean(row.skip_participants),
    tags: row.tags ?? [],
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    reach: row.reach ?? 0,
    views: row.views ?? 0,
    saves: row.saves ?? 0,
    shares: row.shares ?? 0,
    total_interactions: row.total_interactions ?? 0,
    follows: row.follows ?? 0,
    profile_visits: row.profile_visits ?? 0,
    reposts: row.reposts ?? 0,
    profile_activity: row.profile_activity ?? 0,
    link_clicks: row.link_clicks ?? 0,
    reels_avg_watch_time: row.reels_avg_watch_time ?? 0,
    reels_total_watch_time: row.reels_total_watch_time ?? 0,
    synced_at: row.synced_at,
    created_at: row.created_at,
  }
}

async function upsertBatches(table, rows, onConflict = 'id') {
  if (!execute || rows.length === 0) return
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await target.from(table).upsert(rows.slice(offset, offset + 500), { onConflict })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

const personMap = await buildPersonMap()
const [posts, stats, stories, insights, demographics, goalRow] = await Promise.all([
  fetchAll(source, 'instagram_posts'),
  fetchAll(source, 'instagram_account_stats'),
  fetchAll(source, 'instagram_stories'),
  fetchAll(source, 'instagram_account_insights'),
  fetchAll(source, 'instagram_demographics'),
  source.from('app_settings').select('value').eq('key', 'instagram_monthly_goal').maybeSingle(),
])

const mapped = {
  posts: posts.map((row) => mapPost(row, personMap)),
  stats,
  stories: stories.map(({
    first_synced_at: firstSyncedAt,
    last_synced_at: lastSyncedAt,
    created_at: _createdAt,
    ...row
  }) => ({
    ...row,
    synced_at: lastSyncedAt ?? firstSyncedAt ?? new Date().toISOString(),
  })),
  insights: insights.map(({ created_at: _createdAt, updated_at, ...row }) => ({
    ...row,
    fetched_at: updated_at ?? new Date().toISOString(),
  })),
  demographics: demographics.map(({ snapshot_date: _snapshotDate, updated_at, ...row }) => ({
    ...row,
    fetched_at: updated_at ?? new Date().toISOString(),
  })),
}

console.log(JSON.stringify({
  mode: execute ? 'execute' : 'dry-run',
  sourceEnv: sourceEnvPath,
  counts: Object.fromEntries(Object.entries(mapped).map(([key, rows]) => [key, rows.length])),
  mappedPeople: [...personMap.values()].filter(Boolean).length,
}, null, 2))

await upsertBatches('instagram_posts', mapped.posts)
await upsertBatches('instagram_account_stats', mapped.stats)
await upsertBatches('instagram_stories', mapped.stories)
await upsertBatches('instagram_account_insights', mapped.insights)
await upsertBatches('instagram_demographics', mapped.demographics)

if (execute) {
  const monthlyGoal = Number(goalRow.data?.value) || 12
  const { error } = await target.from('instagram_settings').upsert(
    { key: 'monthly_post_goal', value: monthlyGoal, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) throw error
  console.log('Migração do Instagram concluída com sucesso.')
}
