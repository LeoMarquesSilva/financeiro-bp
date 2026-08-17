import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Proxy server-side das fotos oficiais do ORQESTRAI.
 * A chave `OFFICIAL_PHOTOS_API_KEY` nunca sai desta função.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_PHOTOS_URL =
  'https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export type OfficialPhoto = {
  externalUserId: string | null
  userId: string
  name: string
  email: string | null
  photoUrl: string | null
  source: 'selected' | 'legacy_avatar' | 'none'
  version: string
  updatedAt: string
}

type Payload = {
  externalUserIds?: string[]
  emails?: string[]
}

function uniqueTrimmed(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= limit) break
  }
  return out
}

function apiHeaders(apiKey: string, json = false): HeadersInit {
  return {
    'x-api-key': apiKey,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
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
  if (!supabaseUrl || !anonKey) {
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
  if (callerErr || !caller) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const apiKey = Deno.env.get('OFFICIAL_PHOTOS_API_KEY')?.trim()
  const base = (
    Deno.env.get('ORQESTRAI_PHOTOS_URL')?.trim() || DEFAULT_PHOTOS_URL
  ).replace(/\/+$/, '')

  if (!apiKey) {
    return jsonResponse({ unavailable: true, error: 'OFFICIAL_PHOTOS_API_KEY não configurada.' }, 503)
  }

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return jsonResponse({ error: 'Body inválido.' }, 400)
  }

  const externalUserIds = uniqueTrimmed(payload.externalUserIds, 100)
  const emails = uniqueTrimmed(payload.emails, 20)
  if (externalUserIds.length === 0 && emails.length === 0) {
    return jsonResponse({ data: [], notFound: [] })
  }

  const photos: OfficialPhoto[] = []
  const notFound: string[] = []

  if (externalUserIds.length > 0) {
    try {
      const response = await fetch(`${base}/v1/photos/batch`, {
        method: 'POST',
        headers: apiHeaders(apiKey, true),
        body: JSON.stringify({ externalUserIds }),
      })
      if (response.status === 429) {
        return jsonResponse({ error: 'Rate limit da API de fotos.' }, 429)
      }
      if (response.ok) {
        const batch = (await response.json()) as { data?: OfficialPhoto[]; notFound?: string[] }
        photos.push(...(batch.data ?? []))
        notFound.push(...(batch.notFound ?? []))
      } else {
        console.error('[official-photos] batch HTTP', response.status)
        notFound.push(...externalUserIds)
      }
    } catch (error) {
      console.error('[official-photos] batch', error instanceof Error ? error.message : error)
      notFound.push(...externalUserIds)
    }
  }

  const emailsToLookup = emails.filter((email) => {
    const normalized = email.trim().toLowerCase()
    return !photos.some((photo) => (photo.email ?? '').trim().toLowerCase() === normalized)
  })

  for (const email of emailsToLookup) {
    try {
      const response = await fetch(`${base}/v1/photos?email=${encodeURIComponent(email)}`, {
        headers: apiHeaders(apiKey),
      })
      if (response.status === 404 || response.status === 409) {
        notFound.push(email)
        continue
      }
      if (!response.ok) {
        console.error('[official-photos] email HTTP', response.status)
        notFound.push(email)
        continue
      }
      const payloadJson = (await response.json()) as { data?: OfficialPhoto }
      if (payloadJson.data) photos.push(payloadJson.data)
      else notFound.push(email)
    } catch (error) {
      console.error('[official-photos] email', error instanceof Error ? error.message : error)
      notFound.push(email)
    }
  }

  return jsonResponse({ data: photos, notFound })
})
