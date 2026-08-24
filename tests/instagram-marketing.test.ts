import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareInstagramPeriods,
  computeMarketingGoals,
  computePostEngagementRate,
  filterPostsByPeriod,
  getInstagramFormat,
  groupPostsByDay,
  groupPostsByFormat,
  groupPostsByMonth,
  rankAreas,
  rankAreasByPostVolume,
  rankPeopleByPostVolume,
  summarizeInstagram,
} from '../src/features/operacoes-legais/marketing/instagramAnalytics.ts'
import {
  getPreviousInstagramPeriod,
  formatInstagramPeriod,
  resolveInstagramPeriod,
  shiftInstagramPeriod,
} from '../src/features/operacoes-legais/marketing/instagramPeriod.ts'

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

test('formata o mês selecionado sem recuar no fuso de São Paulo', () => {
  assert.equal(
    formatInstagramPeriod({ kind: 'month', year: 2026, month: 8 }),
    'Agosto de 2026',
  )
})

test('resolve intervalo customizado inclusive atravessando dezembro', () => {
  assert.deepEqual(
    resolveInstagramPeriod({ kind: 'custom', from: '2025-12-20', to: '2026-01-05' }),
    { from: '2025-12-20T00:00:00.000Z', to: '2026-01-05T23:59:59.999Z' },
  )
})

test('resolve esta semana e semana anterior de segunda a domingo', () => {
  const now = new Date('2026-08-19T15:00:00.000Z')
  assert.deepEqual(resolveInstagramPeriod({ kind: 'preset', preset: 'this_week' }, now), {
    from: '2026-08-17T00:00:00.000Z',
    to: '2026-08-23T23:59:59.999Z',
  })
  assert.deepEqual(resolveInstagramPeriod({ kind: 'preset', preset: 'last_week' }, now), {
    from: '2026-08-10T00:00:00.000Z',
    to: '2026-08-16T23:59:59.999Z',
  })
})

test('navega meses e calcula o período anterior com a mesma duração', () => {
  assert.deepEqual(shiftInstagramPeriod({ kind: 'month', year: 2026, month: 1 }, -1), {
    kind: 'month', year: 2025, month: 12,
  })
  assert.deepEqual(shiftInstagramPeriod({ kind: 'month', year: 2026, month: 12 }, 1), {
    kind: 'month', year: 2027, month: 1,
  })
  assert.deepEqual(
    shiftInstagramPeriod(
      { kind: 'preset', preset: 'this_month' },
      -1,
      new Date('2026-08-19T15:00:00.000Z'),
    ),
    { kind: 'month', year: 2026, month: 7 },
  )
  assert.deepEqual(
    getPreviousInstagramPeriod({
      from: '2026-08-10T00:00:00.000Z',
      to: '2026-08-16T23:59:59.999Z',
    }),
    {
      from: '2026-08-03T00:00:00.000Z',
      to: '2026-08-09T23:59:59.999Z',
    },
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

test('distingue reels, carrossel e imagem única usando o tipo real da mídia', () => {
  const carousel = { ...posts[0], id: '3', media_type: 'CAROUSEL_ALBUM' }
  assert.equal(getInstagramFormat(posts[0]), 'Imagem única')
  assert.equal(getInstagramFormat(posts[1]), 'Reels')
  assert.equal(getInstagramFormat(carousel), 'Carrossel')
  assert.deepEqual(
    groupPostsByFormat([posts[0], posts[1], carousel]).map((row) => row.format),
    ['Imagem única', 'Reels', 'Carrossel'],
  )
})

test('atribui posts colaborativos a todas as áreas e ordena por engajamento', () => {
  const ranking = rankAreas(posts)
  assert.equal(ranking[0].area, 'Marketing')
  assert.equal(ranking[0].posts, 2)
  assert.equal(ranking.find((row) => row.area === 'Contratos')?.posts, 1)
})

test('agrupa a tendência diária preservando alcance, engajamento e volume', () => {
  const grouped = groupPostsByDay([
    posts[0],
    { ...posts[0], id: '3', ig_media_id: 'ig-3', reach: 500, total_interactions: 25 },
  ])
  assert.deepEqual(grouped, [
    {
      date: '2026-08-05',
      posts: 2,
      reach: 1500,
      views: 2800,
      interactions: 125,
      engagementRate: 125 / 1500 * 100,
      follows: 6,
      profileVisits: 30,
      saves: 10,
      shares: 10,
    },
  ])
})

test('mantém somente alcance, engajamento e postagens com as metas definidas', () => {
  const goals = computeMarketingGoals({
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-31T23:59:59.999Z',
  })
  assert.deepEqual(Object.keys(goals), ['reach', 'engagement', 'posts'])
  assert.equal(goals.reach.target, 15_000)
  assert.equal(goals.engagement.target, 3.5)
  assert.equal(goals.posts.target, 12)
})

test('compara alcance, engajamento e posts com o período anterior', () => {
  const comparison = compareInstagramPeriods([posts[0]], [posts[1]])
  assert.deepEqual(comparison.reach, { current: 1000, previous: 500, changePct: 100 })
  assert.deepEqual(comparison.posts, { current: 1, previous: 1, changePct: 0 })
  assert.deepEqual(comparison.engagement, { current: 10, previous: 8, changePct: 25 })
})

test('ranqueia pessoas e áreas por quantidade de posts sem duplicar vínculos', () => {
  const linkedPosts = [
    {
      ...posts[0],
      solicitantes: [{ id: 'p1', name: 'Ana' }, { id: 'p1', name: 'Ana' }],
    },
    {
      ...posts[1],
      solicitantes: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bruno' }],
    },
  ]
  assert.deepEqual(
    rankPeopleByPostVolume(linkedPosts).map(({ id, name, posts: count }) => ({ id, name, posts: count })),
    [
      { id: 'p1', name: 'Ana', posts: 2 },
      { id: 'p2', name: 'Bruno', posts: 1 },
    ],
  )
  assert.deepEqual(
    rankAreasByPostVolume(linkedPosts).map(({ area, posts: count }) => ({ area, posts: count })),
    [
      { area: 'Marketing', posts: 2 },
      { area: 'Contratos', posts: 1 },
    ],
  )
})
