#!/usr/bin/env node
/**
 * Sync de colaboradores: ORQESTRAI (hr_employees) -> financeiro-bp (SIOE, tabela colaboradores).
 * Também compara com a RESPONSUM (app_c009c0e4f1_users) só para diagnóstico — nenhum dado é
 * alterado nos sistemas de origem (ORQESTRAI/RESPONSUM), apenas lido.
 *
 * Fonte de verdade: ORQESTRAI.hr_employees (nome, e-mail, área, cargo, status, admissão/desligamento).
 * Área e cargo são normalizados para o padrão já usado no módulo Eficiência/RESPONSUM
 * (ver AREA_ORQESTRAI_TO_CANONICA / AREA_CANONICA_TO_RESPONSUM abaixo).
 *
 * Match entre sistemas: pelo local-part do e-mail (antes do "@"), não pelo e-mail completo —
 * o escritório trocou de domínio (bpplaw.com.br -> bismarchipires.com.br) e os dois sistemas
 * têm cadastros com domínios diferentes para a mesma pessoa.
 *
 * Divergências gravadas em colaboradores_divergencias (só leitura/alerta, ver ui-divergencias):
 *  - sem_conta_responsum: colaborador ativo no ORQESTRAI sem conta ativa correspondente na RESPONSUM
 *  - sem_registro_orqestrai: usuário ativo na RESPONSUM sem colaborador ativo correspondente no ORQESTRAI
 *  - area_diferente: e-mail (local-part) bate, mas a área não corresponde ao de-para esperado
 *  - status_diferente: e-mail (local-part) bate, mas um está ativo e o outro inativo
 *
 * Uso:
 *   node scripts/sync-colaboradores.mjs
 *
 * Agendamento: .github/workflows/sync-colaboradores.yml (todo dia 07:00, Brasília).
 *
 * Requer no .env / GitHub Actions secrets:
 *   VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY           (destino: SIOE — financeiro-bp)
 *   ORQESTRAI_SUPABASE_URL / ORQESTRAI_SERVICE_ROLE_KEY     (origem: colaboradores)
 *     ou SUPABASE_ACCESS_TOKEN (Management API no projeto ORQESTRAI)
 *   RESPONSUM_SUPABASE_URL / RESPONSUM_SERVICE_ROLE_KEY     (opcional — só diagnóstico)
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

const ORQESTRAI_REF = 'qwihfvagemzlyypeohpc'

const sioe = createClient(
  requireEnv('VITE_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
)

const orqestraiUrl = process.env.ORQESTRAI_SUPABASE_URL
const orqestraiKey = process.env.ORQESTRAI_SERVICE_ROLE_KEY
const orqestrai =
  orqestraiUrl && orqestraiKey ? createClient(orqestraiUrl, orqestraiKey) : null

const responsumUrl = process.env.RESPONSUM_SUPABASE_URL
const responsumKey = process.env.RESPONSUM_SERVICE_ROLE_KEY
const responsum =
  responsumUrl && responsumKey ? createClient(responsumUrl, responsumKey) : null

function managementApiToken() {
  const raw = process.env.SUPABASE_ACCESS_TOKEN
  if (!raw) {
    throw new Error(
      'Informe ORQESTRAI_SUPABASE_URL + ORQESTRAI_SERVICE_ROLE_KEY ou SUPABASE_ACCESS_TOKEN'
    )
  }
  const token = raw.trim()
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN está vazio após trim')
  }
  if (/[^\x20-\x7E]/.test(token)) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN tem caractere inválido (não ASCII). Regrave o secret sem output extra do dotenv.'
    )
  }
  return token
}

async function managementQuery(sql) {
  const token = managementApiToken()
  const res = await fetch(`https://api.supabase.com/v1/projects/${ORQESTRAI_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ORQESTRAI query failed: ${res.status} ${text.slice(0, 400)}`)
  const data = JSON.parse(text)
  return Array.isArray(data) ? data : (data?.value ?? [])
}

async function fetchAll(client, table, columns) {
  const { data, error } = await client.from(table).select(columns)
  if (error) throw new Error(`Erro ao ler ${table}: ${error.message}`)
  return data ?? []
}

async function fetchOrqestraiTable(table, columns) {
  if (orqestrai) return fetchAll(orqestrai, table, columns)
  console.log(`  (ORQESTRAI via Management API: ${table})`)
  return managementQuery(`SELECT ${columns} FROM ${table}`)
}

/**
 * ORQESTRAI (hr_employees.department) -> nome canônico usado no módulo Eficiência.
 * Áreas não listadas aqui mantêm o mesmo nome (ex.: Trabalhista, Cível, Tributário,
 * Operações Legais, Recuperação de Crédito).
 */
const AREA_ORQESTRAI_TO_CANONICA = {
  'Insolvência': 'Reestruturação',
  /** Comercial não existe no escritório — Leonardo/Marketing sob Operações Legais. */
  'Comercial': 'Marketing',
}

/**
 * Área canônica -> nome do departamento na RESPONSUM (app_c009c0e4f1_departments).
 * Áreas não listadas aqui mantêm o mesmo nome na RESPONSUM. Braços administrativos
 * sob Operações Legais (Marketing, Financeiro, Facilities, R.H., Limpeza, Sócio)
 * caem em "Geral" na RESPONSUM.
 */
const AREA_CANONICA_TO_RESPONSUM = {
  'Contratos': 'Societário e Contratos',
  'Distressed Deals': 'Distressed Deals - Special Situations',
  'Financeiro': 'Geral',
  'Facilities': 'Geral',
  'R.H.': 'Geral',
  'Limpeza': 'Geral',
  'Marketing': 'Geral',
  'Comercial': 'Geral',
  'Sócio': 'Geral',
}

function areaOrqestraiToCanonica(areaOrqestrai) {
  const trimmed = (areaOrqestrai ?? '').trim()
  return AREA_ORQESTRAI_TO_CANONICA[trimmed] ?? trimmed
}

function areaCanonicaToResponsum(areaCanonica) {
  return AREA_CANONICA_TO_RESPONSUM[areaCanonica] ?? areaCanonica
}

/** Cargo (hr_employees.position) -> nível hierárquico. Ordem de checagem importa. */
function cargoToNivelHierarquico(cargo) {
  const c = (cargo ?? '').toLocaleUpperCase('pt-BR')
  if (c.includes('SÓCIO') || c.includes('SOCIO')) return 'socio'
  if (c.includes('GERENTE')) return 'gerente'
  if (c.includes('COORDENADOR')) return 'coordenador'
  return 'colaborador'
}

/**
 * Sócios fundadores — donos do escritório. No ORQESTRAI às vezes entram como
 * inativos (não são “folha” típica); no SIOE devem permanecer ativos como sócio.
 * Chave = local-part do e-mail.
 */
const SOCIOS_FUNDADORES_FORCE_ACTIVE = new Set(['gustavo', 'ricardo'])

function forceActiveSocioFundador(email, isActiveFromOrqestrai) {
  const key = emailMatchKey(email)
  if (key && SOCIOS_FUNDADORES_FORCE_ACTIVE.has(key)) return true
  return Boolean(isActiveFromOrqestrai)
}

function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase() || null
}

/**
 * Domínios de e-mail do próprio escritório (histórico + atual). Contas da RESPONSUM fora
 * desses domínios são terceiros (ex.: TI terceirizada @uticomputadores.com) ou contas de
 * teste/excluídas — nunca devem casar com um colaborador do ORQESTRAI nem virar divergência
 * "sem_registro_orqestrai" (ruído: nunca existirão no RH por definição).
 */
const INTERNAL_EMAIL_DOMAINS = new Set(['bpplaw.com.br', 'bismarchipires.com.br'])

function isInternalEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) return false
  return INTERNAL_EMAIL_DOMAINS.has(normalized.split('@')[1])
}

/**
 * Chave de match entre ORQESTRAI e RESPONSUM: o escritório trocou de domínio de e-mail
 * (bpplaw.com.br -> bismarchipires.com.br) e nem todo cadastro foi atualizado nos dois
 * sistemas ao mesmo tempo. Por isso o match usa o local-part (antes do "@"), não o
 * e-mail completo — evita falso-positivo de "sem_conta_responsum" só por domínio diferente.
 */
function emailMatchKey(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  return normalized.split('@')[0]
}

async function main() {
  console.log('Lendo hr_employees do ORQESTRAI...')
  const hrEmployees = await fetchOrqestraiTable(
    'hr_employees',
    'id, full_name, email, department, position, is_active, admission_date, termination_date, vios_ci'
  )
  console.log(`  ${hrEmployees.length} colaboradores encontrados.`)

  console.log('Lendo fotos do ORQESTRAI (users + perfis NFC)...')
  const [orqUsers, orqProfiles] = await Promise.all([
    fetchOrqestraiTable(
      'users',
      'id, email, avatar_url, photo_onedrive_url, is_active',
    ),
    fetchOrqestraiTable('professional_profiles', 'user_id, photo_url'),
  ])
  const photoByUserId = new Map()
  for (const p of orqProfiles) {
    if (p.user_id && p.photo_url) photoByUserId.set(p.user_id, String(p.photo_url).trim())
  }
  const orqPhotoByKey = new Map()
  for (const u of orqUsers) {
    if (!isInternalEmail(u.email)) continue
    const key = emailMatchKey(u.email)
    if (!key) continue
    const avatar = [u.avatar_url, u.photo_onedrive_url, photoByUserId.get(u.id)]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find(Boolean) || null
    const prev = orqPhotoByKey.get(key)
    if (!prev || (!prev.avatar_url && avatar)) {
      orqPhotoByKey.set(key, { avatar_url: avatar })
    }
  }
  console.log(`  ${orqPhotoByKey.size} e-mails com foto resolvida no ORQESTRAI.`)

  let responsumUsers = []
  if (responsum) {
    console.log('Lendo app_c009c0e4f1_users da RESPONSUM (só para comparação)...')
    responsumUsers = await fetchAll(
      responsum,
      'app_c009c0e4f1_users',
      'id, name, email, department, is_active, avatar_url'
    )
    console.log(`  ${responsumUsers.length} usuários encontrados.`)
  } else {
    console.warn(
      'RESPONSUM_SUPABASE_URL / RESPONSUM_SERVICE_ROLE_KEY ausentes — sync segue sem diagnóstico de divergências.'
    )
  }

  const responsumByKey = new Map()
  for (const u of responsumUsers) {
    if (!isInternalEmail(u.email)) continue
    const key = emailMatchKey(u.email)
    if (key) responsumByKey.set(key, u)
  }

  const rows = []
  const divergencias = []
  const orqestraiKeys = new Set()

  for (const emp of hrEmployees) {
    const key = emailMatchKey(emp.email)
    if (key) orqestraiKeys.add(key)

    const isSocioFundador = key != null && SOCIOS_FUNDADORES_FORCE_ACTIVE.has(key)
    const areaCanonica = isSocioFundador ? 'Sócio' : areaOrqestraiToCanonica(emp.department)
    const nivelHierarquico = isSocioFundador ? 'socio' : cargoToNivelHierarquico(emp.position)
    const isActive = forceActiveSocioFundador(emp.email, emp.is_active)
    const responsumMatch = key ? responsumByKey.get(key) : undefined

    rows.push({
      orqestrai_employee_id: emp.id,
      full_name: emp.full_name,
      email: emp.email,
      area: areaCanonica,
      area_orqestrai: isSocioFundador ? 'Sócio' : emp.department,
      cargo: isSocioFundador ? 'Sócio' : emp.position,
      nivel_hierarquico: nivelHierarquico,
      is_active: isActive,
      admission_date: emp.admission_date,
      termination_date: isActive ? null : emp.termination_date,
      vios_ci: emp.vios_ci,
      responsum_user_id: responsumMatch?.id ?? null,
      responsum_email: responsumMatch?.email ?? null,
      // Preferência: módulo de fotos / perfil NFC do ORQESTRAI → RESPONSUM
      avatar_url:
        (key ? orqPhotoByKey.get(key)?.avatar_url : null) ||
        responsumMatch?.avatar_url ||
        null,
      synced_at: new Date().toISOString(),
    })

    if (!responsum) continue

    if (!responsumMatch) {
      // Só vale reportar "falta conta" para quem está ativo hoje — ex-funcionário sem
      // conta na RESPONSUM não é uma pendência.
      if (isActive) {
        divergencias.push({
          tipo: 'sem_conta_responsum',
          full_name: emp.full_name,
          email: emp.email,
          detalhe: `Ativo no ORQESTRAI (${areaCanonica}) sem conta correspondente na RESPONSUM.`,
        })
      }
      continue
    }

    // Status precisa ser checado nos dois sentidos: colaborador desligado com conta ainda
    // ativa na RESPONSUM é tão relevante quanto colaborador ativo sem conta ativa lá.
    if (isActive !== (responsumMatch.is_active !== false)) {
      divergencias.push({
        tipo: 'status_diferente',
        full_name: emp.full_name,
        email: emp.email,
        detalhe: isActive
          ? 'Ativo no ORQESTRAI, mas a conta na RESPONSUM está inativa.'
          : 'Inativo/desligado no ORQESTRAI, mas a conta na RESPONSUM continua ativa.',
      })
    }

    if (!isActive) continue // área só é comparada para quem está ativo em algum dos dois lados

    const areaResponsumEsperada = areaCanonicaToResponsum(areaCanonica)
    if (
      responsumMatch.department &&
      areaResponsumEsperada &&
      responsumMatch.department.trim() !== areaResponsumEsperada.trim()
    ) {
      divergencias.push({
        tipo: 'area_diferente',
        full_name: emp.full_name,
        email: emp.email,
        detalhe: `ORQESTRAI: ${emp.department} (esperado "${areaResponsumEsperada}" na RESPONSUM) · RESPONSUM: ${responsumMatch.department}`,
      })
    }
  }

  if (responsum) {
    for (const u of responsumUsers) {
      if (u.is_active === false || !isInternalEmail(u.email)) continue
      const key = emailMatchKey(u.email)
      if (!key || orqestraiKeys.has(key)) continue
      divergencias.push({
        tipo: 'sem_registro_orqestrai',
        full_name: u.name,
        email: u.email,
        detalhe: `Conta ativa na RESPONSUM (${u.department ?? 'sem área'}) sem colaborador ativo correspondente no ORQESTRAI.`,
      })
    }
  }

  console.log(`Gravando ${rows.length} colaboradores no financeiro-bp...`)
  const { error: upsertError } = await sioe
    .from('colaboradores')
    .upsert(rows, { onConflict: 'orqestrai_employee_id' })
  if (upsertError) throw new Error(`Erro ao gravar colaboradores: ${upsertError.message}`)

  console.log('Desativando login SIOE de ex-colaboradores...')
  const { error: loginError } = await sioe.rpc('desativar_login_ex_colaboradores')
  if (loginError) {
    console.warn(`Aviso ao desativar login de ex-colaboradores: ${loginError.message}`)
  }

  if (responsum) {
    console.log('Atualizando diagnóstico de divergências (colaboradores_divergencias)...')
    const { error: deleteError } = await sioe
      .from('colaboradores_divergencias')
      .delete()
      .eq('resolvido', false)
    if (deleteError) throw new Error(`Erro ao limpar divergências antigas: ${deleteError.message}`)

    if (divergencias.length > 0) {
      const { error: insertError } = await sioe.from('colaboradores_divergencias').insert(divergencias)
      if (insertError) throw new Error(`Erro ao gravar divergências: ${insertError.message}`)
    }
  }

  const porTipo = divergencias.reduce((acc, d) => {
    acc[d.tipo] = (acc[d.tipo] ?? 0) + 1
    return acc
  }, {})

  console.log('\n=== Resumo ===')
  console.log(`Colaboradores sincronizados: ${rows.length}`)
  console.log(`Divergências encontradas: ${divergencias.length}`)
  for (const [tipo, count] of Object.entries(porTipo)) {
    console.log(`  - ${tipo}: ${count}`)
  }
  if (divergencias.length > 0) {
    console.log('\nDetalhe das divergências:')
    for (const d of divergencias) {
      console.log(`  [${d.tipo}] ${d.full_name} (${d.email ?? 'sem e-mail'}) — ${d.detalhe}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
