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

    const fullDescription = description

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

    type ChatAttachment = { url: string; name: string; size: number; type: string }
    const chatAttachments: ChatAttachment[] = []

    async function uploadChatFile(
      bytes: Uint8Array,
      displayName: string,
      contentType: string,
    ): Promise<string | null> {
      const safeName = displayName.replace(/[^\w.\- ()]+/g, '_').slice(0, 120)
      const storageName = `${Date.now()}-${safeName}`
      const responsumPath = `tickets/${criado.id}/${storageName}`
      const { error: upErr } = await responsum.storage
        .from(RESPONSUM_ATTACHMENTS_BUCKET)
        .upload(responsumPath, bytes, { contentType, upsert: false })
      if (upErr) return null
      const { data: pub } = responsum.storage
        .from(RESPONSUM_ATTACHMENTS_BUCKET)
        .getPublicUrl(responsumPath)
      chatAttachments.push({
        url: pub.publicUrl,
        name: safeName,
        size: bytes.length,
        type: contentType,
      })
      return pub.publicUrl
    }

    let screenshotUrl: string | null = null
    if (screenshotBytes) {
      screenshotUrl = await uploadChatFile(
        screenshotBytes,
        'sioe-screenshot.png',
        'image/png',
      )
      if (!screenshotUrl) {
        return jsonResponse(
          {
            error: `Ticket criado (${criado.id}), mas falhou o upload do screenshot.`,
            ticket_id: criado.id,
          },
          500,
        )
      }
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
      const contentType = anexo.content_type || ''
      // Só Excel do racional (print vai separado como screenshot).
      const isXlsx =
        contentType.includes('spreadsheet') ||
        contentType.includes('excel') ||
        /\.xlsx$/i.test(filename)
      if (!raw || !filename || !isXlsx) continue
      if (raw.length > MAX_ANEXO_CHARS) continue
      try {
        const { mime, data } = stripDataUrlPrefix(raw)
        const bytes = decodeBase64(data)
        await uploadChatFile(
          bytes,
          filename,
          contentType || mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
      } catch {
        // anexo opcional — não derruba o ticket
      }
    }

    if (chatAttachments.length > 0) {
      const { error: chatErr } = await responsum.from('app_c009c0e4f1_chat_messages').insert({
        ticket_id: criado.id,
        user_id: responsumUser.id,
        user_name: responsumUser.name,
        user_role: 'user',
        message: 'Evidências do SIOE (screenshot e racional).',
        attachments: chatAttachments,
        read: false,
      })
      if (chatErr) {
        return jsonResponse(
          {
            error: `Ticket criado (${criado.id}), mas falhou a mensagem do chat com anexos: ${chatErr.message}`,
            ticket_id: criado.id,
            screenshot_url: screenshotUrl,
          },
          500,
        )
      }
    }

    return jsonResponse({
      ok: true,
      ticket_id: criado.id,
      screenshot_url: screenshotUrl,
      anexos: chatAttachments.map((a) => a.name),
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
