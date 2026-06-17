import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { canonicalJid, mapStatus } from '../_shared/whatsappMessageUtils.ts'
import { normalizePhone } from '../_shared/phoneNormalize.ts'

// Presença ("digitando") antes de enviar + pausa entre destinatários:
// disparo em lote sem espaçamento é o padrão que o WhatsApp marca como spam.
const SEND_DELAY_MS = 1200
const ENTRE_ENVIOS_MS = 1500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function fetchEvolution(url: string, init: RequestInit, ms = 20000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
}

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

interface CobrancaItem {
  parcela_id: string
  pessoa_id?: string | null
  number: string
  mensagem: string
}

interface Payload {
  itens: CobrancaItem[]
  created_by?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '')
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
  const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return jsonResponse({ error: 'Evolution API não configurada (secrets ausentes).' }, 500)
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
  const results: Array<{ parcela_id: string; ok: boolean; erro?: string }> = []

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    // Espaça os envios (menos o primeiro) para evitar bloqueio anti-spam.
    if (i > 0) await sleep(ENTRE_ENVIOS_MS)
    const numero = normalizePhone(item.number)
    if (!numero) {
      await supabase.from('cobranca_eventos').insert({
        parcela_id: item.parcela_id,
        pessoa_id: item.pessoa_id ?? null,
        canal: 'whatsapp',
        status: 'erro',
        destino: item.number ?? null,
        mensagem: item.mensagem,
        erro: 'Telefone inválido ou ausente',
        created_by: payload.created_by ?? null,
      })
      results.push({ parcela_id: item.parcela_id, ok: false, erro: 'Telefone inválido' })
      continue
    }

    try {
      const resp = await fetchEvolution(
        `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            number: numero,
            text: item.mensagem,
            delay: SEND_DELAY_MS,
            linkPreview: true,
          }),
        },
      )
      const data = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        const erro = typeof data === 'object' ? JSON.stringify(data) : String(data)
        await supabase.from('cobranca_eventos').insert({
          parcela_id: item.parcela_id,
          pessoa_id: item.pessoa_id ?? null,
          canal: 'whatsapp',
          status: 'erro',
          destino: numero,
          mensagem: item.mensagem,
          erro: erro.slice(0, 1000),
          created_by: payload.created_by ?? null,
        })
        results.push({ parcela_id: item.parcela_id, ok: false, erro })
        continue
      }

      const providerId = data?.key?.id ?? data?.messageId ?? null
      const remoteJid = canonicalJid(data?.key?.remoteJid ?? `${numero}@s.whatsapp.net`)
      const now = new Date().toISOString()

      await supabase.from('whatsapp_mensagens').upsert(
        {
          instance: EVOLUTION_INSTANCE,
          remote_jid: remoteJid,
          message_id: providerId,
          from_me: true,
          tipo: 'conversation',
          conteudo: item.mensagem,
          timestamp: now,
          raw: data,
          status: mapStatus(data?.status) ?? 'PENDING',
        },
        { onConflict: 'message_id', ignoreDuplicates: false },
      )
      await supabase.from('whatsapp_chats').upsert(
        {
          remote_jid: remoteJid,
          instance: EVOLUTION_INSTANCE,
          categoria: 'COBRANCA',
          last_message_at: now,
          last_message_preview: item.mensagem.slice(0, 120),
          updated_at: now,
        },
        { onConflict: 'remote_jid' },
      )

      await supabase.from('cobranca_eventos').insert({
        parcela_id: item.parcela_id,
        pessoa_id: item.pessoa_id ?? null,
        canal: 'whatsapp',
        status: 'enviado',
        destino: numero,
        mensagem: item.mensagem,
        provider_message_id: providerId,
        created_by: payload.created_by ?? null,
      })
      results.push({ parcela_id: item.parcela_id, ok: true })
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e)
      await supabase.from('cobranca_eventos').insert({
        parcela_id: item.parcela_id,
        pessoa_id: item.pessoa_id ?? null,
        canal: 'whatsapp',
        status: 'erro',
        destino: numero,
        mensagem: item.mensagem,
        erro: erro.slice(0, 1000),
        created_by: payload.created_by ?? null,
      })
      results.push({ parcela_id: item.parcela_id, ok: false, erro })
    }
  }

  const enviados = results.filter((r) => r.ok).length
  return jsonResponse({ enviados, total: results.length, results })
})
