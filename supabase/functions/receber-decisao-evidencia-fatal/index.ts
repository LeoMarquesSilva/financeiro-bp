import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Recebe do RESPONSUM a decisão do Finalizar em tickets
 * category=validacao_de_indicadores /
 * subcategory=auditoria_de_excludentes_envio_de_evidencia.
 *
 * Payload esperado (POST JSON):
 * {
 *   ticket_id, ci, evidencia_enviada: boolean,
 *   decisao?: "excludente_mantida" | "incluido_no_fatal",
 *   decidido_em?, decidido_por?: { id?, name? },
 *   category?, subcategory?, ano?, mes?
 * }
 *
 * Auth: JWT do SIOE (service_role ou usuário autenticado) — verify_jwt=true.
 * Idempotente por ticket_id (upsert).
 */

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

type DecisaoCodigo = 'excludente_mantida' | 'incluido_no_fatal'

interface Payload {
  ticket_id?: string
  ci?: string
  evidencia_enviada?: boolean
  decisao?: string
  decidido_em?: string
  decidido_por?: { id?: string | null; name?: string | null } | null
  category?: string | null
  subcategory?: string | null
  ano?: number | null
  mes?: number | null
}

function resolveDecisao(p: Payload): DecisaoCodigo | null {
  if (p.decisao === 'excludente_mantida' || p.decisao === 'incluido_no_fatal') {
    return p.decisao
  }
  if (typeof p.evidencia_enviada === 'boolean') {
    return p.evidencia_enviada ? 'excludente_mantida' : 'incluido_no_fatal'
  }
  return null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido. Use POST.' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    let payload: Payload
    try {
      payload = await req.json()
    } catch {
      return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const ticketId = String(payload.ticket_id ?? '').trim()
    const ci = String(payload.ci ?? '').trim()
    const decisao = resolveDecisao(payload)

    if (!ticketId || !isUuid(ticketId)) {
      return jsonResponse({ error: 'ticket_id UUID obrigatório.' }, 400)
    }
    if (!ci) {
      return jsonResponse({ error: 'ci obrigatório.' }, 400)
    }
    if (!decisao) {
      return jsonResponse(
        {
          error:
            'Informe evidencia_enviada (boolean) ou decisao (excludente_mantida | incluido_no_fatal).',
        },
        400,
      )
    }

    const evidenciaEnviada =
      typeof payload.evidencia_enviada === 'boolean'
        ? payload.evidencia_enviada
        : decisao === 'excludente_mantida'

    // Consistência: Sim → mantém excludente; Não → inclui no FATAL
    if (
      (evidenciaEnviada && decisao !== 'excludente_mantida') ||
      (!evidenciaEnviada && decisao !== 'incluido_no_fatal')
    ) {
      return jsonResponse(
        {
          error: 'Inconsistência: evidencia_enviada=true ↔ excludente_mantida; false ↔ incluido_no_fatal.',
        },
        400,
      )
    }

    const ano =
      payload.ano != null && Number.isFinite(Number(payload.ano))
        ? Math.trunc(Number(payload.ano))
        : null
    const mes =
      payload.mes != null && Number.isFinite(Number(payload.mes))
        ? Math.trunc(Number(payload.mes))
        : null
    if (mes != null && (mes < 1 || mes > 12)) {
      return jsonResponse({ error: 'mes deve estar entre 1 e 12.' }, 400)
    }

    const decididoEm = payload.decidido_em ? new Date(payload.decidido_em) : new Date()
    if (Number.isNaN(decididoEm.getTime())) {
      return jsonResponse({ error: 'decidido_em inválido (use ISO8601).' }, 400)
    }

    const decididoPorId = payload.decidido_por?.id?.trim() || null
    if (decididoPorId && !isUuid(decididoPorId)) {
      return jsonResponse({ error: 'decidido_por.id deve ser UUID.' }, 400)
    }

    const row = {
      ci,
      ticket_id: ticketId,
      evidencia_enviada: evidenciaEnviada,
      decisao,
      ano,
      mes,
      decidido_em: decididoEm.toISOString(),
      decidido_por_id: decididoPorId,
      decidido_por_nome: payload.decidido_por?.name?.trim() || null,
      category: payload.category?.trim() || 'validacao_de_indicadores',
      subcategory:
        payload.subcategory?.trim() || 'auditoria_de_excludentes_envio_de_evidencia',
      payload,
      updated_at: new Date().toISOString(),
    }

    const sioe = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data, error } = await sioe
      .from('eficiencia_evidencia_fatal_decisoes')
      .upsert(row, { onConflict: 'ticket_id' })
      .select(
        'id, ci, ticket_id, evidencia_enviada, decisao, ano, mes, decidido_em, decidido_por_nome',
      )
      .single()

    if (error) {
      return jsonResponse({ error: `Falha ao gravar decisão: ${error.message}` }, 500)
    }

    return jsonResponse({
      ok: true,
      decisao: data,
      efeito_kpi:
        data.decisao === 'excludente_mantida'
          ? 'Excludente mantida (fora da % FATAL) — override de KPI ainda não aplicado (fase 1: audit trail).'
          : 'Incluído no FATAL — override de KPI ainda não aplicado (fase 1: audit trail).',
    })
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})
