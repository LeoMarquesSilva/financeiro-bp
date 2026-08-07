/**
 * Cria contas Auth (senha 123456) para os coordenadores de Eficiência.
 * Uso: node scripts/provision-coordenadores-auth.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true })

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAILS = [
  'ana.tavares@bpplaw.com.br',
  'carolineabdalla@bpplaw.com.br',
  'mariaponce@bismarchipires.com.br',
  'ligia@bismarchipires.com.br',
  'lavinia.ferraz@bismarchipires.com.br',
  'henrique.nascimento@bismarchipires.com.br',
  'caroline.thome@bpplaw.com.br',
]

const DEFAULT_PASSWORD = '123456'

async function main() {
  const { data: members, error } = await sb
    .from('team_members')
    .select('email, full_name, avatar_url, role')
    .in('email', EMAILS)

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  let created = 0
  let exists = 0
  let errors = 0

  for (const m of members ?? []) {
    const { error: err } = await sb.auth.admin.createUser({
      email: m.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: m.full_name,
        avatar_url: m.avatar_url,
      },
    })

    if (err) {
      if (/already|registered/i.test(err.message)) {
        console.log(`  ⏩ ${m.email} — já existe`)
        exists++
      } else {
        console.error(`  ❌ ${m.email} — ${err.message}`)
        errors++
      }
      continue
    }

    console.log(`  ✅ ${m.email} — conta criada`)
    created++
    await sb
      .from('team_members')
      .update({ password_changed: false, updated_at: new Date().toISOString() })
      .eq('email', m.email)
  }

  console.log(`\nResumo: ${created} criados, ${exists} já existiam, ${errors} erros`)
  console.log(`Senha padrão: ${DEFAULT_PASSWORD}`)
}

main()
