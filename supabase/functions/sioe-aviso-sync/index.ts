import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Aviso no WhatsApp do grupo da automação VIOS (notify-error.js, instância RESPONSUM - BP).
 * - modo resultado: a carga do SharePoint acabou (atualizou ou falhou).
 * - modo disparar: o pg_cron pede a carga no GitHub. O agendamento do Actions atrasa.
 * - modo checar: o pg_cron confirma se a janela das 8h17, 12h17, 14h17 ou 17h17
 *   passou sem registro. Se passou, avisa que não atualizou.
 */

/** Mesmo destino de notify-error.js (EVOLUTION_NOTIFY_GROUP + instância RESPONSUM - BP). */
const GRUPO = '120363410106016262@g.us'
const INSTANCIA_AVISO = 'RESPONSUM - BP'
const RESPONSAVEIS = ['5517991863161', '553592366669', '553588754584']
const SLOTS_BRT = [8, 12, 14, 17]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function bearerToken(req: Request): string {
  const header = req.headers.get('Authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

/** O gateway já validou a assinatura. Aqui só distinguimos a service role da chave pública. */
function isServiceRoleJwt(token: string): boolean {
  try {
    const part = token.split('.')[1]
    if (!part) return false
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json).role === 'service_role'
  } catch {
    return false
  }
}

function formatarQuando(valor: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor))
}

/** Início da hora do slot em Brasília, se o relógio está na janela de conferência (:40+). */
function janelaAtual(now = new Date()): Date | null {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const hour = get('hour')
  const minute = get('minute')
  if (!SLOTS_BRT.includes(hour) || minute < 40) return null
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), hour + 3, 0, 0))
}

interface FonteResultado {
  fonte?: string
  upserted?: number
  errors?: number
  erro?: string
}

function montarTexto(atualizou: boolean, fontes: FonteResultado[], quando: Date, ultima?: string | null): string {
  const hora = formatarQuando(quando)
  if (atualizou) {
    const total = fontes.length
    const comErro = fontes.filter((f) => (f.errors ?? 0) > 0 || f.erro)
    if (comErro.length === 0) {
      return [
        '✅ *SIOE — Atualização*',
        '',
        `🕐 ${hora}`,
        `*Eficiência (SharePoint)* atualizou.`,
        `${total} ${total === 1 ? 'fonte' : 'fontes'}, 0 erros.`,
      ].join('\n')
    }
    const linhas = comErro
      .slice(0, 8)
      .map((f) => `• ${f.fonte ?? 'fonte'}: ${(f.erro ?? 'erro').slice(0, 180)}`)
    return [
      '⚠️ *SIOE — Atualização*',
      '',
      `🕐 ${hora}`,
      '*Eficiência (SharePoint)* atualizou com erro.',
      ...linhas,
    ].join('\n')
  }

  const falhas = fontes.filter((f) => (f.errors ?? 0) > 0 || f.erro)
  const detalhes = falhas
    .slice(0, 6)
    .map((f) => `• ${f.fonte ?? 'fonte'}: ${(f.erro ?? 'erro').slice(0, 180)}`)
  const linhas = [
    '🚨 *SIOE — Atualização*',
    '',
    '❌ *Eficiência (SharePoint)* não atualizou.',
    `🕐 ${hora}`,
  ]
  if (ultima) linhas.push(`Última carga: ${formatarQuando(ultima)}.`)
  if (detalhes.length) {
    linhas.push('', '⚠️ *Detalhes:*', ...detalhes)
  }
  linhas.push('', '📢 *Responsáveis:*', RESPONSAVEIS.map((n) => `@${n}`).join(' '))
  return linhas.join('\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '')
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
  const evolutionInstance = INSTANCIA_AVISO
  if (!supabaseUrl || !serviceKey || !evolutionUrl || !evolutionKey || !evolutionInstance) {
    return json({ error: 'Secrets ausentes.' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = bearerToken(req)
  const serviceOk = token === serviceKey || isServiceRoleJwt(token)
  const headerSecret = req.headers.get('x-cron-secret')?.trim() ?? ''
  const { data: cfg } = await admin.from('sioe_aviso_config').select('cron_secret').eq('id', 1).maybeSingle()
  const cronOk = Boolean(headerSecret && cfg?.cron_secret && headerSecret === cfg.cron_secret)
  if (!serviceOk && !cronOk) return json({ error: 'Não autorizado.' }, 401)

  let body: { modo?: string; atualizou?: boolean; fontes?: FonteResultado[] } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido.' }, 400)
  }

  const modo = body.modo === 'checar' ? 'checar' : body.modo === 'disparar' ? 'disparar' : 'resultado'
  if (modo === 'resultado' && !serviceOk) return json({ error: 'Não autorizado.' }, 403)

  if (modo === 'disparar') {
    const desde = new Date(Date.now() - 40 * 60 * 1000).toISOString()
    const { data: recente } = await admin
      .from('sharepoint_sync_log')
      .select('executado_em')
      .gte('executado_em', desde)
      .limit(1)
    if (recente && recente.length > 0) return json({ ok: true, disparado: false, motivo: 'ja atualizou' })

    const githubToken = Deno.env.get('GITHUB_DISPATCH_TOKEN')?.trim()
    if (!githubToken) return json({ error: 'Token do GitHub ausente.' }, 500)
    const disparo = await fetch(
      'https://api.github.com/repos/LeoMarquesSilva/financeiro-bp/actions/workflows/sync-sharepoint.yml/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: AbortSignal.timeout(20000),
      },
    )
    if (!disparo.ok) {
      const detalhe = (await disparo.text()).slice(0, 300)
      return json({ error: 'Falha ao disparar a carga.', detalhe }, 502)
    }
    return json({ ok: true, disparado: true })
  }

  let atualizou = Boolean(body.atualizou)
  let fontes = Array.isArray(body.fontes) ? body.fontes : []
  let ultima: string | null = null

  if (modo === 'checar') {
    const inicio = janelaAtual()
    if (!inicio) return json({ ok: true, enviado: false, motivo: 'fora da janela' })
    const { data: recente } = await admin
      .from('sharepoint_sync_log')
      .select('executado_em')
      .gte('executado_em', inicio.toISOString())
      .limit(1)
    if (recente && recente.length > 0) return json({ ok: true, enviado: false, motivo: 'ja atualizou' })
    const { data: ultimo } = await admin
      .from('sharepoint_sync_log')
      .select('executado_em')
      .order('executado_em', { ascending: false })
      .limit(1)
    ultima = (ultimo?.[0]?.executado_em as string | undefined) ?? null
    atualizou = false
    fontes = []
  }

  const mencionar = !atualizou
  const texto = montarTexto(atualizou, fontes, new Date(), ultima)
  const mentioned = mencionar ? RESPONSAVEIS.map((n) => `${n}@s.whatsapp.net`) : undefined

  const resp = await fetch(`${evolutionUrl}/message/sendText/${encodeURIComponent(evolutionInstance)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
    body: JSON.stringify({
      number: GRUPO,
      text: texto,
      delay: 1200,
      linkPreview: false,
      ...(mentioned ? { mentioned } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) return json({ error: 'Falha ao enviar WhatsApp.', detalhe: data }, 502)

  const messageId = (data?.key?.id as string | undefined) ?? null
  const now = new Date().toISOString()
  if (messageId) {
    await admin.from('whatsapp_mensagens').upsert(
      {
        instance: evolutionInstance,
        remote_jid: GRUPO,
        message_id: messageId,
        from_me: true,
        tipo: 'conversation',
        conteudo: texto,
        timestamp: now,
        raw: data,
        status: 'PENDING',
      },
      { onConflict: 'message_id', ignoreDuplicates: false },
    )
    await admin.from('whatsapp_chats').upsert(
      {
        remote_jid: GRUPO,
        instance: evolutionInstance,
        last_message_at: now,
        last_message_preview: texto.slice(0, 120),
        updated_at: now,
      },
      { onConflict: 'remote_jid' },
    )
  }

  return json({ ok: true, enviado: true })
})
