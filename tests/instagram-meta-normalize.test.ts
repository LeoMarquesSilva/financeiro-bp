import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMediaInsights, selectInstagramAccountId } from '../supabase/functions/instagram-sync/normalize.ts'
import { readFile } from 'node:fs/promises'

test('normaliza métricas ausentes com fallback de curtidas e comentários', () => {
  const result = normalizeMediaInsights(
    { like_count: 12, comments_count: 3 },
    { reach: 100, views: 150, saved: 4, shares: 2 },
  )
  assert.equal(result.likes, 12)
  assert.equal(result.comments, 3)
  assert.equal(result.total_interactions, 21)
  assert.equal(result.saves, 4)
})

test('seleciona conta configurada e rejeita ambiguidade', () => {
  const pages = [
    { id: 'p1', name: 'Bismarchi', instagram_business_account: { id: 'ig1' } },
    { id: 'p2', name: 'Outra', instagram_business_account: { id: 'ig2' } },
  ]
  assert.equal(selectInstagramAccountId(pages, { igAccountId: 'ig2' }), 'ig2')
  assert.equal(selectInstagramAccountId(pages, { pageName: 'bismarchi' }), 'ig1')
  assert.throws(() => selectInstagramAccountId(pages, {}), /Várias contas/)
})

test('migration cria tabelas, RLS, permissão e RPC de vínculo', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/20260810183134_operacoes_legais_marketing_instagram.sql', import.meta.url),
    'utf8',
  )
  for (const fragment of [
    'CREATE TABLE public.instagram_posts',
    'CREATE TABLE public.instagram_account_stats',
    'CREATE TABLE public.instagram_stories',
    'CREATE TABLE public.instagram_account_insights',
    'CREATE TABLE public.instagram_demographics',
    'current_user_can_manage_marketing',
    'update_instagram_post_links',
    'ENABLE ROW LEVEL SECURITY',
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
})
