#!/usr/bin/env node
/**
 * Sync de férias: ORQESTRAI (vacation_periods + vacation_leaves) → SIOE.colaboradores_ferias.
 * Não altera o ORQESTRAI. Credenciais só no servidor/script.
 *
 *   node scripts/sync-orqestrai-ferias.mjs
 *
 * Requer:
 *   VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   ORQESTRAI_SUPABASE_URL / ORQESTRAI_SERVICE_ROLE_KEY
 *   — ou SUPABASE_ACCESS_TOKEN (Management API no ref ORQESTRAI)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true })

const ORQESTRAI_REF = 'qwihfvagemzlyypeohpc'
const SIOE_URL = process.env.VITE_SUPABASE_URL
const SIOE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ORQ_URL = process.env.ORQESTRAI_SUPABASE_URL
const ORQ_KEY = process.env.ORQESTRAI_SERVICE_ROLE_KEY
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

const SNAPSHOT_SQL = `
WITH gozados_periodo AS (
  SELECT
    p.employee_id,
    p.entitled_days,
    COALESCE(SUM(l.days) FILTER (WHERE COALESCE(l.kind, 'ferias') = 'ferias'), 0) AS gozados
  FROM vacation_periods p
  LEFT JOIN vacation_leaves l
    ON l.employee_id = p.employee_id
   AND COALESCE(l.kind, 'ferias') = 'ferias'
   AND l.start_date <= p.concessive_end
   AND l.end_date >= p.concessive_start
  WHERE p.concessive_end >= CURRENT_DATE
  GROUP BY p.employee_id, p.id, p.entitled_days
),
saldo AS (
  SELECT employee_id, SUM(GREATEST(entitled_days - gozados, 0))::integer AS saldo_dias
  FROM gozados_periodo
  GROUP BY employee_id
),
gozados_ano AS (
  SELECT employee_id, COALESCE(SUM(days), 0)::integer AS gozados_ano
  FROM vacation_leaves
  WHERE COALESCE(kind, 'ferias') = 'ferias'
    AND EXTRACT(YEAR FROM start_date)::integer = EXTRACT(YEAR FROM CURRENT_DATE)::integer
  GROUP BY employee_id
),
atual AS (
  SELECT DISTINCT ON (employee_id)
    employee_id, start_date AS ferias_inicio, end_date AS ferias_fim
  FROM vacation_leaves
  WHERE COALESCE(kind, 'ferias') = 'ferias'
    AND CURRENT_DATE BETWEEN start_date AND end_date
  ORDER BY employee_id, start_date
),
proxima AS (
  SELECT DISTINCT ON (employee_id)
    employee_id, start_date AS proximo_inicio, end_date AS proximo_fim
  FROM vacation_leaves
  WHERE COALESCE(kind, 'ferias') = 'ferias'
    AND start_date > CURRENT_DATE
  ORDER BY employee_id, start_date
)
SELECT
  e.id AS orqestrai_employee_id,
  e.full_name,
  COALESCE(e.vacation_exempt, false) AS vacation_exempt,
  COALESCE(s.saldo_dias, 0) AS saldo_dias,
  COALESCE(g.gozados_ano, 0) AS gozados_ano,
  (a.employee_id IS NOT NULL) AS em_ferias,
  a.ferias_inicio,
  a.ferias_fim,
  p.proximo_inicio,
  p.proximo_fim
FROM hr_employees e
LEFT JOIN saldo s ON s.employee_id = e.id
LEFT JOIN gozados_ano g ON g.employee_id = e.id
LEFT JOIN atual a ON a.employee_id = e.id
LEFT JOIN proxima p ON p.employee_id = e.id
WHERE e.is_active
`

function nomeChave(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

async function managementQuery(query) {
  if (!ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN ausente')
  const res = await fetch(`https://api.supabase.com/v1/projects/${ORQESTRAI_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ORQESTRAI query failed: ${res.status} ${text.slice(0, 400)}`)
  const data = JSON.parse(text)
  return Array.isArray(data) ? data : (data?.value ?? [])
}

async function fetchSnapshot() {
  if (ORQ_URL && ORQ_KEY) {
    const orq = createClient(ORQ_URL, ORQ_KEY)
    const { data, error } = await orq.rpc('exec_sql', { query: SNAPSHOT_SQL })
    if (!error && Array.isArray(data)) return data
  }
  console.log('Lendo férias no ORQESTRAI via Management API...')
  return managementQuery(SNAPSHOT_SQL)
}

async function main() {
  if (!SIOE_URL || !SIOE_KEY) {
    throw new Error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes')
  }
  const rows = await fetchSnapshot()
  const now = new Date().toISOString()
  const payload = rows.map((r) => ({
    orqestrai_employee_id: r.orqestrai_employee_id,
    full_name: r.full_name,
    nome_chave: nomeChave(r.full_name),
    vacation_exempt: Boolean(r.vacation_exempt),
    saldo_dias: Number(r.saldo_dias) || 0,
    gozados_ano: Number(r.gozados_ano) || 0,
    em_ferias: Boolean(r.em_ferias),
    ferias_inicio: r.ferias_inicio ?? null,
    ferias_fim: r.ferias_fim ?? null,
    proximo_inicio: r.proximo_inicio ?? null,
    proximo_fim: r.proximo_fim ?? null,
    synced_at: now,
  }))

  const sioe = createClient(SIOE_URL, SIOE_KEY)
  const { error } = await sioe.from('colaboradores_ferias').upsert(payload, {
    onConflict: 'orqestrai_employee_id',
  })
  if (error) throw new Error(`Erro ao gravar colaboradores_ferias: ${error.message}`)
  console.log(`[sync-ferias] upserted=${payload.length}`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
