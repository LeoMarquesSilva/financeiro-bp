import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Abre chamado de "Reportar Erro" do SIOE na RESPONSUM.
 *
 * Categoria: manutencao_em_sistemas (frente LexNextLab via tag da categoria)
 * Subcategoria: sioe
 *
 * Screenshot: sobe no bucket RESPONSUM `attachments/tickets/{ticket_id}/`
 * (mesmo padrão da UI do RESPONSUM) + backup no SIOE `error-reports`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const CATEGORY_KEY = 'manutencao_em_sistemas'
/** Manutenção em Sistemas — há outra subcategoria `sioe` em outra categoria. */
const CATEGORY_ID = '49d8f44b-8f11-4bdd-9d13-7418c522884e'
const SUBCATEGORY_KEY = 'sioe'
const SUBCATEGORY_ID = 'bfa3eec3-32f6-406d-af0c-4b8853b74209'
const SIOE_BUCKET = 'error-reports'
const RESPONSUM_ATTACHMENTS_BUCKET = 'attachments'
const MAX_SCREENSHOT_CHARS = 3_500_000
const MAX_ANEXO_CHARS = 8_000_000

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '(url inválida)'
  }
}

interface Payload {
  title?: string
  description?: string
  route?: string | null
  indicador?: string | null
  modulo?: string | null
  ano?: number | null
  mes?: number | number[] | string | null
  area?: string | null
  screenshot_base64?: string | null
  client_logs?: string | null
  user_agent?: string | null
  error_message?: string | null
  error_stack?: string | null
  anexos?: Array<{
    filename?: string
    content_base64?: string
    content_type?: string
  }> | null
}

function stripDataUrlPrefix(b64: string): { mime: string; data: string } {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(b64.trim())
  if (m) return { mime: m[1] || 'image/png', data: m[2] }
  return { mime: 'image/png', data: b64.trim() }
}

function decodeBase64(data: string): Uint8Array {
  const bin = atob(data)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function buildEvidencias(payload: Payload, screenshotUrl: string | null): string[] {
  const evidencias: string[] = []
  if (screenshotUrl) {
    evidencias.push(`![Screenshot do SIOE](${screenshotUrl})`)
    evidencias.push(`Screenshot: ${screenshotUrl}`)
  }
  if (payload.route) evidencias.push(`Rota: ${payload.route}`)
  if (payload.modulo) evidencias.push(`Módulo: ${payload.modulo}`)
  if (payload.indicador) evidencias.push(`Indicador: ${payload.indicador}`)
  if (payload.area) evidencias.push(`Área: ${payload.area}`)
  if (payload.ano != null) evidencias.push(`Ano: ${payload.ano}`)
  if (payload.mes != null) {
    const mesTxt = Array.isArray(payload.mes) ? payload.mes.join(', ') : String(payload.mes)
    evidencias.push(`Mês filtro: ${mesTxt}`)
  }
  if (payload.user_agent) evidencias.push(`User-Agent: ${payload.user_agent}`)
  if (payload.error_message) evidencias.push(`Erro: ${payload.error_message}`)
  if (payload.error_stack) evidencias.push(`Stack:\n${payload.error_stack}`)
  if (payload.client_logs) evidencias.push(`Logs do cliente:\n${payload.client_logs}`)
  return evidencias
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RESPONSUM_URL = Deno.env.get('RESPONSUM_SUPABASE_URL')?.trim()
    const RESPONSUM_SERVICE_ROLE = Deno.env.get('RESPONSUM_SERVICE_ROLE_KEY')?.trim()

    if (!RESPONSUM_URL || !RESPONSUM_SERVICE_ROLE) {
      return jsonResponse({ error: 'RESPONSUM não configurada (secrets ausentes).' }, 500)
    }
    if (!/^https:\/\//i.test(RESPONSUM_URL)) {
      return jsonResponse(
        {
          error: `RESPONSUM_SUPABASE_URL inválida (host=${hostOf(RESPONSUM_URL)}).`,
        },
        500,
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser()
    if (callerErr || !caller?.email) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    let payload: Payload
    try {
      payload = (await req.json()) as Payload
    } catch {
      return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const title = (payload.title ?? '').trim()
    const description = (payload.description ?? '').trim()
    if (!title) return jsonResponse({ error: 'Título obrigatório.' }, 400)
    if (!description) return jsonResponse({ error: 'Descrição obrigatória.' }, 400)

    const sioe = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const responsum = createClient(RESPONSUM_URL, RESPONSUM_SERVICE_ROLE)

    const { data: responsumUser, error: userErr } = await responsum
      .from('app_c009c0e4f1_users')
      .select('id, name, department')
      .ilike('email', caller.email.trim())
      .limit(1)
      .maybeSingle()
    if (userErr) {
      return jsonResponse(
        {
          error: `Falha ao consultar RESPONSUM (users): ${userErr.message}`,
          responsum_host: hostOf(RESPONSUM_URL),
        },
        500,
      )
    }
    if (!responsumUser?.id) {
      return jsonResponse(
        {
          error: `Usuário ${caller.email} sem conta na RESPONSUM. Cadastre o e-mail em app_c009c0e4f1_users.`,
        },
        400,
      )
    }

    const { data: subcategoria, error: subcatError } = await responsum
      .from('app_c009c0e4f1_subcategories')
      .select('default_assigned_to, default_assigned_to_name')
      .eq('id', SUBCATEGORY_ID)
      .eq('category_id', CATEGORY_ID)
      .eq('key', SUBCATEGORY_KEY)
      .maybeSingle()
    if (subcatError) {
      return jsonResponse(
        {
          error: `Falha ao consultar RESPONSUM (subcategories): ${subcatError.message}`,
          responsum_host: hostOf(RESPONSUM_URL),
        },
        500,
      )
    }

    let screenshotBytes: Uint8Array | null = null
    const rawShot = payload.screenshot_base64?.trim()
    if (rawShot) {
      if (rawShot.length > MAX_SCREENSHOT_CHARS) {
        return jsonResponse({ error: 'Screenshot muito grande (máx. ~2,5 MB).' }, 400)
      }
      try {
        const { mime, data } = stripDataUrlPrefix(rawShot)
        if (!mime.includes('png') && !mime.includes('jpeg') && !mime.includes('jpg')) {
          return jsonResponse({ error: 'Screenshot deve ser PNG ou JPEG.' }, 400)
        }
        screenshotBytes = decodeBase64(data)
      } catch (e) {
        return jsonResponse(
          { error: `Screenshot inválido: ${e instanceof Error ? e.message : String(e)}` },
          400,
        )
      }
    }

    const fullDescription = [
      description,
      '',
      '---',
      '## Evidências (SIOE)',
      ...buildEvidencias(payload, null),
      screenshotBytes ? 'Screenshot: (anexo do chamado)' : null,
      '',
      `Reportado por: ${responsumUser.name} <${caller.email}>`,
      `Categoria: Manutenção em Sistemas / Subcategoria: SIOE (frente LexNextLab)`,
    ]
      .filter((line): line is string => line != null)
      .join('\n')

    const { data: criado, error: insertError } = await responsum
      .from('app_c009c0e4f1_tickets')
      .insert({
        title: title.slice(0, 240),
        description: fullDescription,
        category: CATEGORY_KEY,
        subcategory: SUBCATEGORY_KEY,
        priority: 'high',
        created_by: responsumUser.id,
        created_by_name: responsumUser.name,
        created_by_department: responsumUser.department ?? payload.area ?? 'LexNextLab',
        assigned_to: subcategoria?.default_assigned_to ?? null,
        assigned_to_name: subcategoria?.default_assigned_to_name ?? null,
      })
      .select('id')
      .single()

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500)
    }

    let screenshotUrl: string | null = null
    const uploadedNames: string[] = []
    if (screenshotBytes) {
      const fileName = `${Date.now()}-sioe-screenshot.png`
      const responsumPath = `tickets/${criado.id}/${fileName}`

      const { error: attachErr } = await responsum.storage
        .from(RESPONSUM_ATTACHMENTS_BUCKET)
        .upload(responsumPath, screenshotBytes, {
          contentType: 'image/png',
          upsert: false,
        })
      if (attachErr) {
        return jsonResponse(
          {
            error: `Ticket criado (${criado.id}), mas falhou o anexo: ${attachErr.message}`,
            ticket_id: criado.id,
          },
          500,
        )
      }
      uploadedNames.push(fileName)

      const { data: pubResponsum } = responsum.storage
        .from(RESPONSUM_ATTACHMENTS_BUCKET)
        .getPublicUrl(responsumPath)
      screenshotUrl = pubResponsum.publicUrl

      // Backup no SIOE (não bloqueia o fluxo se falhar).
      const now = new Date()
      const yyyy = now.getUTCFullYear()
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
      const sioePath = `${yyyy}/${mm}/${criado.id}.png`
      await sioe.storage.from(SIOE_BUCKET).upload(sioePath, screenshotBytes, {
        contentType: 'image/png',
        upsert: true,
      })
    }

    const anexos = Array.isArray(payload.anexos) ? payload.anexos : []
    for (const anexo of anexos.slice(0, 5)) {
      const raw = anexo.content_base64?.trim()
      const filename = (anexo.filename ?? 'anexo.bin').replace(/[^\w.\-]+/g, '_').slice(0, 120)
      if (!raw || !filename) continue
      if (raw.length > MAX_ANEXO_CHARS) continue
      try {
        const { mime, data } = stripDataUrlPrefix(raw)
        const bytes = decodeBase64(data)
        const path = `tickets/${criado.id}/${Date.now()}-${filename}`
        const { error: upErr } = await responsum.storage
          .from(RESPONSUM_ATTACHMENTS_BUCKET)
          .upload(path, bytes, {
            contentType: anexo.content_type || mime || 'application/octet-stream',
            upsert: false,
          })
        if (!upErr) uploadedNames.push(filename)
      } catch {
        // anexo opcional — não derruba o ticket
      }
    }

    if (screenshotUrl || uploadedNames.length > 0) {
      const anexosLinha =
        uploadedNames.length > 0 ? `Anexos: ${uploadedNames.join(', ')}` : null
      const descriptionComPrint = [
        description,
        '',
        '---',
        '## Evidências (SIOE)',
        ...buildEvidencias(payload, screenshotUrl),
        anexosLinha,
        '',
        `Reportado por: ${responsumUser.name} <${caller.email}>`,
        `Categoria: Manutenção em Sistemas / Subcategoria: SIOE (frente LexNextLab)`,
      ]
        .filter((line): line is string => line != null)
        .join('\n')

      await responsum
        .from('app_c009c0e4f1_tickets')
        .update({ description: descriptionComPrint })
        .eq('id', criado.id)
    }

    return jsonResponse({
      ok: true,
      ticket_id: criado.id,
      screenshot_url: screenshotUrl,
      anexos: uploadedNames,
      assigned_to_name: subcategoria?.default_assigned_to_name ?? null,
    })
  } catch (e) {
    return jsonResponse(
      {
        error: e instanceof Error ? e.message : String(e),
        hint: 'Verifique RESPONSUM_SUPABASE_URL / RESPONSUM_SERVICE_ROLE_KEY e buckets attachments/error-reports.',
      },
      500,
    )
  }
})
