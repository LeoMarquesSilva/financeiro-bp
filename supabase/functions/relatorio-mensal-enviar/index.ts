import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildDigestEmail, variantesParaDestinatario } from '../_shared/relatorioMensal/buildEmail.ts'
import {
  fetchRelatorioDados,
  horaConfigMatches,
  type RelatorioDestinatario,
  type RelatorioMensalConfig,
} from '../_shared/relatorioMensal/fetchData.ts'
import { resolverPeriodoGestaoVista } from '../_shared/relatorioMensal/periodoGestaoVista.ts'
import { getGraphToken, sendGraphMail } from '../_shared/relatorioMensal/graphMail.ts'
import { parseSecoesConfig } from '../_shared/relatorioMensal/constants.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Payload = {
  modo?: 'cron' | 'manual' | 'teste'
  ano?: number
  mes?: number
  email_teste?: string
  area_key?: string | null
  destinatario_id?: string
}

function isServiceRoleRequest(req: Request): boolean {
  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return false
  const token = authorization.slice(7)
  const parts = token.split('.')
  if (parts.length < 2) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

async function assertAdminOrCron(
  req: Request,
  admin: ReturnType<typeof createClient>,
  anonKey: string,
): Promise<{ ok: true; cron: boolean; service: boolean; userEmail?: string } | { ok: false; response: Response }> {
  const cronSecret = Deno.env.get('RELATORIO_MENSAL_CRON_SECRET')?.trim()
  const cronAuthorized = Boolean(cronSecret && req.headers.get('x-cron-secret') === cronSecret)
  if (cronAuthorized) return { ok: true, cron: true, service: false }

  if (isServiceRoleRequest(req)) {
    return { ok: true, cron: false, service: true }
  }

  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization) return { ok: false, response: json({ error: 'Não autenticado.' }, 401) }

  const caller = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user?.email) return { ok: false, response: json({ error: 'Não autenticado.' }, 401) }

  const { data: member } = await admin
    .from('team_members')
    .select('role, is_active')
    .ilike('email', user.email)
    .maybeSingle()

  if (member?.is_active === false || member?.role !== 'admin') {
    return { ok: false, response: json({ error: 'Apenas administradores podem enviar o relatório.' }, 403) }
  }

  return { ok: true, cron: false, service: false, userEmail: user.email }
}

Deno.serve(async (req: Request) => {
  try {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !anonKey || !serviceKey) return json({ error: 'Supabase não configurado.' }, 500)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const auth = await assertAdminOrCron(req, admin, anonKey)
  if (!auth.ok) return auth.response

  let payload: Payload = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  const modo: 'cron' | 'manual' | 'teste' = auth.cron
    ? (payload.modo === 'manual' || payload.modo === 'teste' ? payload.modo : 'cron')
    : (payload.modo === 'teste' ? 'teste' : 'manual')

  const { data: cfgRow, error: cfgErr } = await admin
    .from('relatorio_mensal_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (cfgErr) return json({ error: cfgErr.message }, 500)

  const config = (cfgRow ?? {}) as RelatorioMensalConfig & { hora_local?: string; timezone?: string; mes_referencia?: string; secoes?: Record<string, unknown> }
  const secoesConfig = parseSecoesConfig(config.secoes)

  if (modo === 'cron') {
    if (!config.enabled) return json({ skipped: true, reason: 'Envio automático desativado.' })
    const hora = String(config.hora_local ?? '08:00:00').slice(0, 5)
    const tz = config.timezone ?? 'America/Sao_Paulo'
    if (!horaConfigMatches(hora, tz)) {
      return json({ skipped: true, reason: 'Fora do horário configurado.', hora_config: hora })
    }
  }

  const timezone = config.timezone ?? 'America/Sao_Paulo'
  const periodo = resolverPeriodoGestaoVista(timezone, new Date(), {
    ano: payload.ano,
    mes: payload.mes,
  })
  const { ano, mes } = periodo

  const MS_TENANT_ID = Deno.env.get('MS_TENANT_ID')
  const MS_CLIENT_ID = Deno.env.get('MS_CLIENT_ID')
  const MS_CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET')
  const MS_SENDER = Deno.env.get('MS_SENDER')
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_SENDER) {
    return json({ error: 'Microsoft Graph não configurado (secrets ausentes).' }, 500)
  }

  let destinatarios: RelatorioDestinatario[] = []
  if (modo === 'teste') {
    const email = (payload.email_teste ?? auth.userEmail ?? '').trim()
    if (!email) return json({ error: 'E-mail de teste não informado.' }, 400)
    destinatarios = [{
      id: 'teste',
      nome: 'Teste',
      email,
      area_key: payload.area_key ?? null,
      ativo: true,
    }]
  } else if (payload.destinatario_id) {
    const { data: destRow, error: destErr } = await admin
      .from('relatorio_mensal_destinatarios')
      .select('*')
      .eq('id', payload.destinatario_id)
      .eq('ativo', true)
      .maybeSingle()
    if (destErr) return json({ error: destErr.message }, 500)
    if (!destRow) return json({ error: 'Destinatário não encontrado.' }, 404)
    destinatarios = [destRow as RelatorioDestinatario]
  } else {
    const { data: destRows, error: destErr } = await admin
      .from('relatorio_mensal_destinatarios')
      .select('*')
      .eq('ativo', true)
    if (destErr) return json({ error: destErr.message }, 500)
    destinatarios = (destRows ?? []) as RelatorioDestinatario[]
    if (destinatarios.length === 0) {
      return json({ error: 'Nenhum destinatário ativo configurado.' }, 400)
    }
  }

  const allVariantKeys = new Set<string | null>()
  for (const d of destinatarios) {
    for (const v of variantesParaDestinatario(d.area_key)) allVariantKeys.add(v)
  }

  const dadosMap = new Map<string | null, Awaited<ReturnType<typeof fetchRelatorioDados>>>()
  for (const key of allVariantKeys) {
    dadosMap.set(key, await fetchRelatorioDados(admin, ano, mes, key, periodo))
  }

  let token: string
  try {
    token = await getGraphToken(MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const results: Array<{ email: string; ok: boolean; erro?: string }> = []

  for (const dest of destinatarios) {
    const email = dest.email.trim()
    if (!emailRegex.test(email)) {
      await admin.from('relatorio_mensal_log').insert({
        ano,
        mes,
        email,
        status: 'erro',
        erro: 'E-mail inválido',
        trigger: modo,
        destinatario_id: dest.id === 'teste' ? null : dest.id,
      })
      results.push({ email, ok: false, erro: 'E-mail inválido' })
      continue
    }

    const variantKeys = variantesParaDestinatario(dest.area_key)
    const assunto = `SIOE — Gestão à vista · ${String(mes).padStart(2, '0')}/${ano} (${periodo.periodoCurto})${dest.area_key ? ` · ${dest.area_key}` : ''}`
    const corpo = buildDigestEmail(dadosMap, periodo, variantKeys, secoesConfig, dest.area_key)

    try {
      await sendGraphMail(token, MS_SENDER, email, assunto, corpo)
      await admin.from('relatorio_mensal_log').insert({
        ano,
        mes,
        email,
        status: 'sucesso',
        trigger: modo,
        destinatario_id: dest.id === 'teste' ? null : dest.id,
      })
      results.push({ email, ok: true })
    } catch (e) {
      const erro = (e instanceof Error ? e.message : String(e)).slice(0, 1000)
      await admin.from('relatorio_mensal_log').insert({
        ano,
        mes,
        email,
        status: 'erro',
        erro,
        trigger: modo,
        destinatario_id: dest.id === 'teste' ? null : dest.id,
      })
      results.push({ email, ok: false, erro })
    }
  }

  const enviados = results.filter((r) => r.ok).length
  return json({ enviados, total: results.length, ano, mes, results })
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : JSON.stringify(e)
    console.error('relatorio-mensal-enviar', msg)
    return json({ error: msg.slice(0, 2000) }, 500)
  }
})
