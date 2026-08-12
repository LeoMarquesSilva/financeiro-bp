#!/usr/bin/env node
/**
 * Espelha colaboradores + fotos para public.bp_usuarios_avatar no SIOE.
 *
 * Fonte principal: ORQESTRAI.users (+ professional_profiles.photo_url / photo_onedrive_url)
 * Fallback: ticket-bp / RESPONSUM (app_c009c0e4f1_users) — só preenche quem ainda não tem foto.
 *
 * Uso: npm run sync:avatars
 * Requer .env:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ORQESTRAI_SUPABASE_URL, ORQESTRAI_SERVICE_ROLE_KEY  (preferencial)
 *   — ou SUPABASE_ACCESS_TOKEN (Management API no ref ORQESTRAI)
 *   SUPABASE_ACCESS_TOKEN (opcional: fallback ticket-bp)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true })

const TICKET_REF = 'jhgbrbarfpvgdaaznldj'
const ORQESTRAI_REF = 'qwihfvagemzlyypeohpc'
const SIOE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const ORQESTRAI_URL =
  process.env.ORQESTRAI_SUPABASE_URL ?? `https://${ORQESTRAI_REF}.supabase.co`
const ORQESTRAI_KEY = process.env.ORQESTRAI_SERVICE_ROLE_KEY

function normalizeNomeChave(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

function normalizeEmail(email) {
  const e = String(email ?? '')
    .trim()
    .toLowerCase()
  return e || null
}

function firstUrl(...candidates) {
  for (const c of candidates) {
    const s = typeof c === 'string' ? c.trim() : ''
    if (s) return s
  }
  return null
}

async function managementQuery(projectRef, query) {
  if (!ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN ausente')
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`${projectRef} query failed: ${res.status} ${text}`)
  const data = JSON.parse(text)
  return Array.isArray(data) ? data : (data?.value ?? data)
}

async function fetchOrqestraiUsers() {
  const sql = `
    SELECT
      u.name,
      lower(nullif(trim(u.email), '')) AS email,
      COALESCE(
        NULLIF(trim(u.avatar_url), ''),
        NULLIF(trim(u.photo_onedrive_url), ''),
        NULLIF(trim(pp.photo_url), '')
      ) AS avatar_url,
      COALESCE(u.is_active, true) AS ativo
    FROM public.users u
    LEFT JOIN public.professional_profiles pp ON pp.user_id = u.id
    WHERE u.name IS NOT NULL AND trim(u.name) <> ''
    ORDER BY u.name
  `

  if (ORQESTRAI_KEY) {
    const client = createClient(ORQESTRAI_URL, ORQESTRAI_KEY)
    const { data: users, error: usersErr } = await client
      .from('users')
      .select('id, name, email, avatar_url, photo_onedrive_url, is_active')
    if (usersErr) throw new Error(`ORQESTRAI users: ${usersErr.message}`)

    const { data: profiles, error: profilesErr } = await client
      .from('professional_profiles')
      .select('user_id, photo_url')
    if (profilesErr) throw new Error(`ORQESTRAI profiles: ${profilesErr.message}`)

    const photoByUser = new Map()
    for (const p of profiles ?? []) {
      if (p.user_id && p.photo_url) photoByUser.set(p.user_id, p.photo_url)
    }

    return (users ?? []).map((u) => ({
      name: u.name,
      email: normalizeEmail(u.email),
      avatar_url: firstUrl(u.avatar_url, u.photo_onedrive_url, photoByUser.get(u.id)),
      ativo: u.is_active !== false,
    }))
  }

  console.log('[sync-avatars] ORQESTRAI_SERVICE_ROLE_KEY ausente — usando Management API')
  return managementQuery(ORQESTRAI_REF, sql)
}

async function fetchTicketUsers() {
  if (!ACCESS_TOKEN) return []
  try {
    return await managementQuery(
      TICKET_REF,
      `
        SELECT name, email, avatar_url, COALESCE(is_active, true) AS ativo
        FROM app_c009c0e4f1_users
        WHERE name IS NOT NULL AND trim(name) <> ''
        ORDER BY name
      `,
    )
  } catch (err) {
    console.warn('[sync-avatars] fallback ticket-bp ignorado:', err.message)
    return []
  }
}

function toRow(u) {
  const nome = String(u.name ?? '').trim()
  if (!nome) return null
  const email = normalizeEmail(u.email)
  return {
    nome,
    email,
    avatar_url: firstUrl(u.avatar_url),
    nome_chave: normalizeNomeChave(nome),
    ativo: u.ativo !== false,
    synced_at: new Date().toISOString(),
  }
}

function mergeRows(primary, fallback) {
  const byKey = new Map()
  const put = (row, preferPhoto) => {
    if (!row) return
    const key = row.email || `nome:${row.nome_chave}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, row)
      return
    }
    if (preferPhoto && !prev.avatar_url && row.avatar_url) {
      byKey.set(key, { ...prev, avatar_url: row.avatar_url, ativo: prev.ativo || row.ativo })
      return
    }
    if (!preferPhoto && !prev.avatar_url && row.avatar_url) {
      byKey.set(key, { ...prev, avatar_url: row.avatar_url })
    }
  }

  for (const u of primary) put(toRow(u), true)
  for (const u of fallback) put(toRow(u), false)
  return [...byKey.values()]
}

async function main() {
  if (!SIOE_URL || !SERVICE_KEY) {
    throw new Error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes')
  }
  if (!ORQESTRAI_KEY && !ACCESS_TOKEN) {
    throw new Error('Informe ORQESTRAI_SERVICE_ROLE_KEY ou SUPABASE_ACCESS_TOKEN')
  }

  console.log('[sync-avatars] lendo ORQESTRAI (users + perfis NFC)…')
  const orqUsers = await fetchOrqestraiUsers()
  console.log(`[sync-avatars] ORQESTRAI: ${orqUsers.length} usuários`)

  console.log('[sync-avatars] lendo ticket-bp (fallback)…')
  const ticketUsers = await fetchTicketUsers()
  console.log(`[sync-avatars] ticket-bp: ${ticketUsers.length} usuários`)

  const deduped = mergeRows(orqUsers, ticketUsers)
  const supabase = createClient(SIOE_URL, SERVICE_KEY)

  const { error: delErr } = await supabase
    .from('bp_usuarios_avatar')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) throw new Error(`delete: ${delErr.message}`)

  const BATCH = 200
  let upserted = 0
  for (let i = 0; i < deduped.length; i += BATCH) {
    const chunk = deduped.slice(i, i + BATCH)
    const { error } = await supabase.from('bp_usuarios_avatar').insert(chunk)
    if (error) throw new Error(`insert lote ${i / BATCH + 1}: ${error.message}`)
    upserted += chunk.length
  }

  const comFoto = deduped.filter((r) => r.avatar_url).length
  console.log(`[sync-avatars] ok: ${upserted} linhas (${comFoto} com foto)`)
}

main().catch((e) => {
  console.error('[sync-avatars] FALHOU:', e.message)
  process.exit(1)
})
