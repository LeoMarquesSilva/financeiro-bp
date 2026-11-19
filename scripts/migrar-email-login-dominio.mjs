#!/usr/bin/env node
/**
 * Troca o e-mail de login do SIOE (auth.users + team_members) de @bpplaw.com.br para
 * @bismarchipires.com.br, para quem já está com o domínio novo no RH (tabela colaboradores).
 *
 * Por que os dois juntos: o login resolve o perfil por team_members.email = e-mail da sessão
 * (AuthContext) e as políticas RLS comparam team_members.email com o e-mail do JWT. Se só um
 * mudar, a pessoa entra sem perfil/permissões.
 *
 * O usuário Auth mantém o mesmo id e a mesma senha; só o e-mail muda. Depois da troca, a
 * pessoa precisa entrar com o e-mail novo (o antigo deixa de funcionar) e quem estiver logado
 * deve sair e entrar de novo.
 *
 * Seleção: team_members com e-mail @bpplaw.com.br cujo colaborador vinculado (FK ou mesmo
 * local-part) está com o mesmo local-part em @bismarchipires.com.br. Pula quem já tem conta
 * Auth ou team_member no e-mail novo (conflito — resolver à mão).
 *
 * Uso:
 *   node scripts/migrar-email-login-dominio.mjs            (simulação: só mostra o que faria)
 *   node scripts/migrar-email-login-dominio.mjs --aplicar  (grava)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true, quiet: true })

const DOMINIO_ANTIGO = 'bpplaw.com.br'
const DOMINIO_NOVO = 'bismarchipires.com.br'
const APLICAR = process.argv.includes('--aplicar')

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const norm = (email) => (email ?? '').trim().toLowerCase()
const localPart = (email) => norm(email).split('@')[0]
const dominio = (email) => norm(email).split('@')[1] ?? ''

async function listarAuthUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Erro ao listar auth.users: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===' : '=== SIMULAÇÃO (nada é gravado; use --aplicar) ===')

  const [{ data: membros, error: tmErr }, { data: colaboradores, error: coErr }, authUsers] =
    await Promise.all([
      sb.from('team_members').select('id, full_name, email, colaborador_id'),
      sb.from('colaboradores').select('id, email'),
      listarAuthUsers(),
    ])
  if (tmErr) throw new Error(`Erro ao ler team_members: ${tmErr.message}`)
  if (coErr) throw new Error(`Erro ao ler colaboradores: ${coErr.message}`)

  const colabPorId = new Map(colaboradores.map((c) => [c.id, c]))
  const colabPorLocal = new Map(colaboradores.map((c) => [localPart(c.email), c]))
  const authPorEmail = new Map(authUsers.map((u) => [norm(u.email), u]))
  const membroPorEmail = new Map(membros.map((m) => [norm(m.email), m]))

  const candidatos = []
  for (const m of membros) {
    if (dominio(m.email) !== DOMINIO_ANTIGO) continue
    const colab = colabPorId.get(m.colaborador_id) ?? colabPorLocal.get(localPart(m.email))
    const novo = `${localPart(m.email)}@${DOMINIO_NOVO}`
    if (norm(colab?.email) !== novo) {
      console.log(`- pula ${m.full_name} (${m.email}): RH não está em ${novo} (RH: ${colab?.email ?? 'sem vínculo'})`)
      continue
    }
    candidatos.push({ membro: m, antigo: norm(m.email), novo })
  }

  let ok = 0
  let falhas = 0
  for (const { membro, antigo, novo } of candidatos) {
    const authAntigo = authPorEmail.get(antigo)
    if (authPorEmail.has(novo) || membroPorEmail.has(novo)) {
      console.log(`! CONFLITO ${membro.full_name}: já existe conta Auth ou team_member em ${novo} — pulado`)
      falhas++
      continue
    }
    const ultimoLogin = authAntigo?.last_sign_in_at?.slice(0, 10) ?? 'nunca'
    console.log(
      `${APLICAR ? '→' : '•'} ${membro.full_name}: ${antigo} -> ${novo}` +
        ` (conta Auth: ${authAntigo ? `sim, último login ${ultimoLogin}` : 'não tem'})`,
    )
    if (!APLICAR) continue

    if (authAntigo) {
      const { error } = await sb.auth.admin.updateUserById(authAntigo.id, {
        email: novo,
        email_confirm: true,
      })
      if (error) {
        console.error(`  ERRO no Auth: ${error.message} — nada alterado para esta pessoa`)
        falhas++
        continue
      }
    }

    const { error: tmUpdErr } = await sb.from('team_members').update({ email: novo }).eq('id', membro.id)
    if (tmUpdErr) {
      console.error(`  ERRO em team_members: ${tmUpdErr.message} — revertendo o Auth`)
      if (authAntigo) {
        const { error: revErr } = await sb.auth.admin.updateUserById(authAntigo.id, {
          email: antigo,
          email_confirm: true,
        })
        if (revErr) console.error(`  ERRO ao reverter o Auth (${antigo}): ${revErr.message}`)
      }
      falhas++
      continue
    }

    if (authAntigo) {
      const { data: conf } = await sb.auth.admin.getUserById(authAntigo.id)
      if (norm(conf?.user?.email) !== novo) {
        console.error(`  ATENÇÃO: Auth ficou com ${conf?.user?.email ?? '?'} em vez de ${novo}`)
        falhas++
        continue
      }
    }
    ok++
  }

  console.log(
    `\n${candidatos.length} candidato(s)` +
      (APLICAR ? ` · ${ok} trocado(s) · ${falhas} com problema` : ` · ${falhas} com conflito`),
  )
  if (falhas > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
