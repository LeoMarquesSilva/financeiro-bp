import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computePostEngagementRate,
  filterPostsByPeriod,
  groupPostsByMonth,
  rankAreas,
  summarizeInstagram,
} from '../src/features/operacoes-legais/marketing/instagramAnalytics.ts'
import { resolveInstagramPeriod } from '../src/features/operacoes-legais/marketing/instagramPeriod.ts'

const posts = [
  {
    id: '1', ig_media_id: 'ig-1', caption: 'A', media_type: 'IMAGE', media_product_type: 'FEED',
    media_url: null, thumbnail_url: null, permalink: null, published_at: '2026-08-05T12:00:00Z',
    area: 'Marketing', areas: ['Marketing'], solicitante_id: null, solicitante: null,
    solicitantes: [], skip_participants: false, tags: [], likes: 80, comments: 10, reach: 1000,
    views: 1400, saves: 5, shares: 5, total_interactions: 100, follows: 3, profile_visits: 15,
    reposts: 1, profile_activity: 18, link_clicks: 2, reels_avg_watch_time: 0,
    reels_total_watch_time: 0, synced_at: '2026-08-05T13:00:00Z', created_at: '2026-08-05T13:00:00Z',
  },
  {
    id: '2', ig_media_id: 'ig-2', caption: 'B', media_type: 'VIDEO', media_product_type: 'REELS',
    media_url: null, thumbnail_url: null, permalink: null, published_at: '2026-07-20T12:00:00Z',
    area: 'Contratos', areas: ['Contratos', 'Marketing'], solicitante_id: null, solicitante: null,
    solicitantes: [], skip_participants: false, tags: [], likes: 30, comments: 5, reach: 500,
    views: 900, saves: 3, shares: 2, total_interactions: 40, follows: 2, profile_visits: 8,
    reposts: 0, profile_activity: 10, link_clicks: 1, reels_avg_watch_time: 4500,
    reels_total_watch_time: 450000, synced_at: '2026-07-20T13:00:00Z', created_at: '2026-07-20T13:00:00Z',
  },
]

test('calcula engajamento por alcance', () => {
  assert.equal(computePostEngagementRate(posts[0]), 10)
  assert.equal(computePostEngagementRate({ ...posts[0], reach: 0 }), 0)
})

test('resume métricas do período sem somar alcance como seguidores', () => {
  const summary = summarizeInstagram(posts)
  assert.equal(summary.posts, 2)
  assert.equal(summary.reach, 1500)
  assert.equal(summary.views, 2300)
  assert.equal(summary.interactions, 140)
  assert.equal(Number(summary.engagementRate.toFixed(2)), 9.33)
  assert.equal(summary.follows, 5)
})

test('filtra intervalo inclusivo e resolve o mês em UTC', () => {
  const august = resolveInstagramPeriod({ kind: 'month', year: 2026, month: 8 })
  assert.deepEqual(august, {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-31T23:59:59.999Z',
  })
  assert.deepEqual(filterPostsByPeriod(posts, august).map((post) => post.id), ['1'])
})

test('resolve intervalo customizado inclusive atravessando dezembro', () => {
  assert.deepEqual(
    resolveInstagramPeriod({ kind: 'custom', from: '2025-12-20', to: '2026-01-05' }),
    { from: '2025-12-20T00:00:00.000Z', to: '2026-01-05T23:59:59.999Z' },
  )
})

test('agrupa volume mensal sem criar posts artificiais', () => {
  const augustPosts = [
    posts[0],
    { ...posts[0], id: '3', ig_media_id: 'ig-3' },
    { ...posts[0], id: '4', ig_media_id: 'ig-4' },
  ]
  const grouped = groupPostsByMonth(augustPosts)
  assert.equal(grouped[0].month, '2026-08')
  assert.equal(grouped[0].posts, 3)
  assert.equal(grouped[0].reach, 3000)
})

test('atribui posts colaborativos a todas as áreas e ordena por engajamento', () => {
  const ranking = rankAreas(posts)
  assert.equal(ranking[0].area, 'Marketing')
  assert.equal(ranking[0].posts, 2)
  assert.equal(ranking.find((row) => row.area === 'Contratos')?.posts, 1)
})

test('indicadores: posts vs meta anual 144 e pautas vs 10/mês no ano', () => {
  const yearPosts = filterPostsByPeriod(
    posts,
    resolveInstagramPeriod({ kind: 'year', year: 2026 }),
  )
  assert.equal(yearPosts.length, 2)
  // Meta posts anual fixa: 2/144 ≈ 1,39%
  assert.equal(Number(((yearPosts.length / 144) * 100).toFixed(2)), 1.39)
  // Meta pautas dinâmica: 12 meses × 10 = 120
  assert.equal(yearPosts.length / (12 * 10), 2 / 120)
  const monthly = groupPostsByMonth(yearPosts)
  assert.equal(monthly.length, 2)
  const avgReach = monthly.reduce((s, m) => s + m.reach, 0) / monthly.length
  assert.equal(avgReach, 750)
})
