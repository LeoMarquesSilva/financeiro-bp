import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface EmailItem {
  parcela_id: string
  pessoa_id?: string | null
  email: string
  assunto: string
  corpo: string
}

interface Payload {
  itens: EmailItem[]
  created_by?: string | null
}

async function getGraphToken(tenant: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(`Token Graph falhou: ${JSON.stringify(data)}`)
  }
  return data.access_token as string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const MS_TENANT_ID = Deno.env.get('MS_TENANT_ID')
  const MS_CLIENT_ID = Deno.env.get('MS_CLIENT_ID')
  const MS_CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET')
  const MS_SENDER = Deno.env.get('MS_SENDER')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_SENDER) {
    return jsonResponse({ error: 'Microsoft Graph não configurado (secrets ausentes).' }, 500)
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido.' }, 400)
  }

  const itens = Array.isArray(payload.itens) ? payload.itens : []
  if (itens.length === 0) {
    return jsonResponse({ error: 'Nenhum item para enviar.' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let token: string
  try {
    token = await getGraphToken(MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET)
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const results: Array<{ parcela_id: string; ok: boolean; erro?: string }> = []

  for (const item of itens) {
    const destino = (item.email ?? '').trim()
    if (!destino || !emailRegex.test(destino)) {
      await supabase.from('cobranca_eventos').insert({
        parcela_id: item.parcela_id,
        pessoa_id: item.pessoa_id ?? null,
        canal: 'email',
        status: 'erro',
        destino: destino || null,
        mensagem: item.corpo,
        erro: 'E-mail inválido ou ausente',
        created_by: payload.created_by ?? null,
      })
      results.push({ parcela_id: item.parcela_id, ok: false, erro: 'E-mail inválido' })
      continue
    }

    try {
      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER)}/sendMail`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              subject: item.assunto,
              body: { contentType: 'Text', content: item.corpo },
              toRecipients: [{ emailAddress: { address: destino } }],
            },
            saveToSentItems: true,
          }),
        },
      )

      if (!resp.ok && resp.status !== 202) {
        const data = await resp.json().catch(() => ({}))
        const erro = JSON.stringify(data)
        await supabase.from('cobranca_eventos').insert({
          parcela_id: item.parcela_id,
          pessoa_id: item.pessoa_id ?? null,
          canal: 'email',
          status: 'erro',
          destino,
          mensagem: item.corpo,
          erro: erro.slice(0, 1000),
          created_by: payload.created_by ?? null,
        })
        results.push({ parcela_id: item.parcela_id, ok: false, erro })
        continue
      }

      await supabase.from('cobranca_eventos').insert({
        parcela_id: item.parcela_id,
        pessoa_id: item.pessoa_id ?? null,
        canal: 'email',
        status: 'enviado',
        destino,
        mensagem: item.corpo,
        created_by: payload.created_by ?? null,
      })
      results.push({ parcela_id: item.parcela_id, ok: true })
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e)
      await supabase.from('cobranca_eventos').insert({
        parcela_id: item.parcela_id,
        pessoa_id: item.pessoa_id ?? null,
        canal: 'email',
        status: 'erro',
        destino,
        mensagem: item.corpo,
        erro: erro.slice(0, 1000),
        created_by: payload.created_by ?? null,
      })
      results.push({ parcela_id: item.parcela_id, ok: false, erro })
    }
  }

  const enviados = results.filter((r) => r.ok).length
  return jsonResponse({ enviados, total: results.length, results })
})
