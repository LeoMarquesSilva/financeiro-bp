/**
 * Cria usuarios no Supabase Auth para todos os team_members que possuem role.
 *
 * Requisitos:
 *   - SUPABASE_SERVICE_ROLE_KEY no .env (Project Settings > API > service_role)
 *   - VITE_SUPABASE_URL no .env
 *
 * Uso:  node scripts/seed-auth-users.cjs
 */
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltam variáveis de ambiente.\n' +
    'Adicione VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ao .env\n' +
    '(service_role key: Supabase Dashboard > Project Settings > API)'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEFAULT_PASSWORD = 'Bp@2026!'

async function main() {
  const { data: members, error: fetchErr } = await supabase
    .from('team_members')
    .select('id, email, full_name, role, avatar_url')
    .not('role', 'is', null)
    .order('full_name')

  if (fetchErr) {
    console.error('Erro ao buscar team_members:', fetchErr.message)
    process.exit(1)
  }

  console.log(`\nEncontrados ${members.length} membros com role definido.\n`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const member of members) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: member.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: member.full_name,
        avatar_url: member.avatar_url,
      },
    })

    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`  ⏩ ${member.email} (${member.role}) — já existe`)
        skipped++
      } else {
        console.error(`  ❌ ${member.email} — ${error.message}`)
        errors++
      }
    } else {
      console.log(`  ✅ ${member.email} (${member.role}) — criado (id: ${data.user.id})`)
      created++
    }
  }

  console.log(`\nResumo: ${created} criados, ${skipped} já existiam, ${errors} erros.\n`)
  console.log(`Senha padrão para todos: ${DEFAULT_PASSWORD}`)
}

main()
