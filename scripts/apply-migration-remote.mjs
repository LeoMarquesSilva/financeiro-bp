#!/usr/bin/env node
/**
 * Aplica um arquivo SQL de migration no Supabase remoto via Management API.
 * Uso: node scripts/apply-migration-remote.mjs supabase/migrations/xxx.sql
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const file = process.argv[2]
if (!file) {
  console.error('Uso: node scripts/apply-migration-remote.mjs <arquivo.sql>')
  process.exit(1)
}

const sql = fs.readFileSync(path.resolve(file), 'utf8')
const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1]

if (!token || !ref) {
  console.error('Faltam SUPABASE_ACCESS_TOKEN ou VITE_SUPABASE_URL no .env')
  process.exit(1)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const body = await res.text()
if (!res.ok) {
  console.error('Erro ao aplicar migration:', res.status, body)
  process.exit(1)
}

console.log('Migration aplicada:', file)
if (body && body !== '[]') console.log(body)
