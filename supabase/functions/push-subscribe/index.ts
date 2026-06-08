import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function userCanReceivePush(
  service: ReturnType<typeof createClient>,
  email: string,
): Promise<boolean> {
  const { data } = await service
    .from('team_members')
    .select('role, is_active')
    .eq('email', email)
    .maybeSingle()
  if (!data || data.is_active === false) return false
  return data.role === 'admin' || data.role === 'financeiro'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError || !user?.email || !user.id) return json({ error: 'unauthorized' }, 401)

  const allowed = await userCanReceivePush(service, user.email)
  if (!allowed) return json({ error: 'forbidden' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  if (body.action === 'unsubscribe') {
    const endpoint = String(body.endpoint ?? '')
    if (!endpoint) return json({ error: 'endpoint required' }, 400)
    await service
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
    return json({ ok: true })
  }

  const endpoint = String(body.endpoint ?? '')
  const p256dh = String(body.p256dh ?? '')
  const auth = String(body.auth ?? '')
  if (!endpoint || !p256dh || !auth) {
    return json({ error: 'endpoint, p256dh and auth required' }, 400)
  }

  const { error } = await service.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' },
  )

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
