import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Cria conta Auth (senha padrão 123456) quando ainda não existe.
 * Reset de senha fica na RPC admin_reset_password_padrao (sem edge).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_PASSWORD = '123456'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Payload {
  email?: string
  full_name?: string | null
  avatar_url?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: 'Missing Supabase env' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: caller },
    error: callerErr,
  } = await callerClient.auth.getUser()
  if (callerErr || !caller?.email) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: adminRow, error: adminErr } = await adminClient
    .from('team_members')
    .select('id, role, is_active')
    .ilike('email', caller.email)
    .maybeSingle()

  if (adminErr || !adminRow || adminRow.role !== 'admin' || adminRow.is_active === false) {
    return jsonResponse({ error: 'Apenas administradores podem gerenciar acesso' }, 403)
  }

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400)
  }

  const email = (payload.email ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'E-mail inválido' }, 400)
  }

  // Já existe?
  const { data: existingId, error: idErr } = await callerClient.rpc('admin_get_auth_user_id', {
    p_email: email,
  })
  if (idErr) {
    return jsonResponse({ error: idErr.message }, 500)
  }
  if (existingId) {
    return jsonResponse({
      ok: true,
      action: 'exists',
      user_id: existingId,
    })
  }

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: payload.full_name ?? undefined,
      avatar_url: payload.avatar_url ?? undefined,
    },
  })

  if (createErr) {
    const msg = createErr.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered')) {
      return jsonResponse({ ok: true, action: 'exists' })
    }
    return jsonResponse({ error: createErr.message }, 500)
  }

  await adminClient
    .from('team_members')
    .update({ password_changed: false, updated_at: new Date().toISOString() })
    .ilike('email', email)

  return jsonResponse({
    ok: true,
    action: 'created',
    user_id: created.user?.id,
    default_password: DEFAULT_PASSWORD,
  })
})
