import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { canonicalJid, isValidWhatsappRemoteJid } from '../_shared/whatsappMessageUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Payload {
  remoteJid: string
}

function toBase64(bytes: ArrayBuffer): string {
  const chunkSize = 0x8000
  const u8 = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < u8.length; i += chunkSize) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '')
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
  const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE')

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return jsonResponse({ error: 'Evolution API não configurada.', unavailable: true }, 500)
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido.', unavailable: true }, 400)
  }

  const canonical = canonicalJid(payload.remoteJid ?? '')
  let avatarJid = canonical
  if (!avatarJid.includes('@') && /^\d+$/.test(avatarJid)) {
    avatarJid = `${avatarJid}@s.whatsapp.net`
  }
  if (!isValidWhatsappRemoteJid(avatarJid) || avatarJid.includes('@lid') || avatarJid.endsWith('@g.us')) {
    return jsonResponse({ unavailable: true, reason: 'JID inválido para avatar.' })
  }

  const number = avatarJid.split('@')[0]

  try {
    const profileResp = await fetch(
      `${EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number }),
        signal: AbortSignal.timeout(12000),
      },
    )
    const profileData = await profileResp.json().catch(() => ({}))
    if (!profileResp.ok) {
      return jsonResponse({ unavailable: true, reason: 'Evolution não retornou URL.' })
    }

    const pictureUrl = (profileData?.profilePictureUrl ??
      profileData?.profilePicture ??
      profileData?.url ??
      null) as string | null
    if (!pictureUrl?.trim()) {
      return jsonResponse({ unavailable: true, reason: 'Sem foto de perfil.' })
    }

    const imgResp = await fetch(pictureUrl, { signal: AbortSignal.timeout(12000) })
    if (!imgResp.ok) {
      return jsonResponse({ unavailable: true, reason: `Download ${imgResp.status}` })
    }

    const bytes = await imgResp.arrayBuffer()
    if (!bytes.byteLength) {
      return jsonResponse({ unavailable: true, reason: 'Imagem vazia.' })
    }

    const mimetype = imgResp.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    return jsonResponse({
      base64: toBase64(bytes),
      mimetype,
      unavailable: false,
    })
  } catch (e) {
    return jsonResponse({
      unavailable: true,
      reason: e instanceof Error ? e.message : String(e),
    })
  }
})
