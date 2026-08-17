#!/usr/bin/env node
/**
 * Cadastra vínculos SIOE → ORQESTRAI em official_photo_system_links.
 * external_user_id = colaboradores.id (SIOE)
 * user_id = hr_employees.user_id (ORQESTRAI)
 *
 *   node scripts/seed-official-photo-links.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true })

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Variável de ambiente ausente: ${name}`)
    process.exit(1)
  }
  return value
}

const sioe = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
const orqestrai = createClient(
  requireEnv('ORQESTRAI_SUPABASE_URL'),
  requireEnv('ORQESTRAI_SERVICE_ROLE_KEY'),
)

const { data: colaboradores, error: colabErr } = await sioe
  .from('colaboradores')
  .select('id, orqestrai_employee_id, email, full_name')
  .not('orqestrai_employee_id', 'is', null)
if (colabErr) throw colabErr

const employeeIds = [...new Set((colaboradores ?? []).map((row) => row.orqestrai_employee_id))]
const { data: employees, error: empErr } = await orqestrai
  .from('hr_employees')
  .select('id, user_id')
  .in('id', employeeIds)
if (empErr) throw empErr

const userByEmployee = new Map((employees ?? []).map((row) => [row.id, row.user_id]))
const { data: consumer, error: consumerErr } = await orqestrai
  .from('official_photo_api_consumers')
  .select('id')
  .eq('slug', 'sioe')
  .single()
if (consumerErr) throw consumerErr

const rows = []
for (const colab of colaboradores ?? []) {
  const userId = userByEmployee.get(colab.orqestrai_employee_id)
  if (!userId) {
    console.warn(`Sem user_id ORQESTRAI: ${colab.full_name} (${colab.email})`)
    continue
  }
  rows.push({
    consumer_id: consumer.id,
    external_user_id: colab.id,
    user_id: userId,
  })
}

const { error: upsertErr } = await orqestrai
  .from('official_photo_system_links')
  .upsert(rows, { onConflict: 'consumer_id,external_user_id' })
if (upsertErr) throw upsertErr

console.log(`Vínculos sioe gravados: ${rows.length}`)
