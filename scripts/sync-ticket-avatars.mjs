#!/usr/bin/env node
/**
 * Espelha usuários + fotos do projeto ticket-bp (app_c009c0e4f1_users)
 * para public.bp_usuarios_avatar no SIOE.
 *
 * Uso: node scripts/sync-ticket-avatars.mjs
 * Requer .env: SUPABASE_ACCESS_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const TICKET_REF = 'jhgbrbarfpvgdaaznldj'
const SIOE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

function normalizeNomeChave(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

async function fetchTicketUsers() {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${TICKET_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          SELECT name, email, avatar_url, COALESCE(is_active, true) AS ativo
          FROM app_c009c0e4f1_users
          WHERE name IS NOT NULL AND trim(name) <> ''
          ORDER BY name
        `,
      }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`ticket-bp query failed: ${res.status} ${text}`)
  const data = JSON.parse(text)
  return Array.isArray(data) ? data : data?.value ?? data
}

async function main() {
  if (!ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN ausente')
  if (!SIOE_URL || !SERVICE_KEY) throw new Error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes')

  console.log('[sync-avatars] lendo ticket-bp…')
  const users = await fetchTicketUsers()
  console.log(`[sync-avatars] ${users.length} usuários`)

  const rows = users
    .map((u) => {
      const nome = String(u.name ?? '').trim()
      const email = u.email ? String(u.email).trim().toLowerCase() : null
      const avatar_url = u.avatar_url ? String(u.avatar_url).trim() : null
      if (!nome) return null
      return {
        nome,
        email,
        avatar_url: avatar_url || null,
        nome_chave: normalizeNomeChave(nome),
        ativo: u.ativo !== false,
        synced_at: new Date().toISOString(),
      }
    })
    .filter(Boolean)

  // Dedupa por e-mail (prioriza quem tem foto); sem e-mail usa nome_chave
  const byKey = new Map()
  for (const r of rows) {
    const key = r.email || `nome:${r.nome_chave}`
    const prev = byKey.get(key)
    if (!prev || (!prev.avatar_url && r.avatar_url)) byKey.set(key, r)
  }
  const deduped = [...byKey.values()]

  const supabase = createClient(SIOE_URL, SERVICE_KEY)
  // replaceAll: limpa e reinsere (catálogo completo)
  const { error: delErr } = await supabase.from('bp_usuarios_avatar').delete().neq('id', '00000000-0000-0000-0000-000000000000')
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
