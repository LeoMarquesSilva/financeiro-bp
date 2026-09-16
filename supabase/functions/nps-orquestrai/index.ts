import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Lê o NPS de clientes no ORQESTRAI (Meus Clientes) para o painel de indicadores.
 * A service role do ORQESTRAI nunca sai desta função.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const DEFAULT_ORQESTRAI_URL = 'https://qwihfvagemzlyypeohpc.supabase.co'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type CampaignRow = {
  id: string
  name: string
  status: 'draft' | 'active' | 'closed'
  starts_at: string | null
}

type ScoreRow = {
  score_recommend: number
  score_availability: number
  score_communication: number
  score_innovation: number
  score_technical: number
}

function classifyNpsScore(score: number): 'promoter' | 'passive' | 'detractor' {
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}

function computeNpsSummary(scores: number[]) {
  const total = scores.length
  if (total === 0) {
    return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: null as number | null }
  }
  let promoters = 0
  let passives = 0
  let detractors = 0
  for (const score of scores) {
    const bucket = classifyNpsScore(score)
    if (bucket === 'promoter') promoters += 1
    else if (bucket === 'passive') passives += 1
    else detractors += 1
  }
  return {
    total,
    promoters,
    passives,
    detractors,
    nps: Math.round(((promoters - detractors) / total) * 100),
  }
}

function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null
  const sum = scores.reduce((acc, n) => acc + n, 0)
  return Math.round((sum / scores.length) * 10) / 10
}

function pickCampaignForYear(campaigns: CampaignRow[], ano: number): CampaignRow | null {
  const yearStr = String(ano)
  const matching = campaigns.filter((campaign) => {
    if (campaign.name.includes(yearStr)) return true
    if (!campaign.starts_at) return false
    return new Date(campaign.starts_at).getUTCFullYear() === ano
  })
  return matching.find((c) => c.status === 'active') ?? matching[0] ?? null
}

async function fetchAllScores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  campaignId: string,
): Promise<ScoreRow[]> {
  const pageSize = 1000
  const out: ScoreRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await client
      .from('nps_responses')
      .select(
        'score_recommend, score_availability, score_communication, score_innovation, score_technical',
      )
      .eq('campaign_id', campaignId)
      .range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as ScoreRow[]
    out.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const orqUrl =
      Deno.env.get('ORQESTRAI_SUPABASE_URL')?.trim() || DEFAULT_ORQESTRAI_URL
    const orqKey = Deno.env.get('ORQESTRAI_SERVICE_ROLE_KEY')?.trim()
    if (!orqKey) {
      return jsonResponse(
        { unavailable: true, error: 'ORQESTRAI_SERVICE_ROLE_KEY não configurada.' },
        503,
      )
    }

    const nowYear = new Date().getUTCFullYear()
    let ano = nowYear
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { ano?: number }
      if (Number.isInteger(body.ano) && Number(body.ano) >= 2000) {
        ano = Number(body.ano)
      }
    } else {
      const url = new URL(req.url)
      const raw = Number(url.searchParams.get('ano'))
      if (Number.isInteger(raw) && raw >= 2000) ano = raw
    }

    const orqestrai = createClient(orqUrl, orqKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: campaignRows, error: campaignError } = await orqestrai
      .from('nps_campaigns')
      .select('id, name, status, starts_at')
      .order('created_at', { ascending: false })
    if (campaignError) throw campaignError

    const campaign = pickCampaignForYear((campaignRows ?? []) as CampaignRow[], ano)
    if (!campaign) {
      return jsonResponse({
        nps: null,
        total: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
        campaignId: null,
        campaignName: null,
        campaignStatus: null,
        dimensions: {
          recommend: null,
          availability: null,
          communication: null,
          innovation: null,
          technical: null,
        },
      })
    }

    const responses = await fetchAllScores(orqestrai, campaign.id)
    const summary = computeNpsSummary(responses.map((r) => Number(r.score_recommend)))

    return jsonResponse({
      ...summary,
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      dimensions: {
        recommend: averageScore(responses.map((r) => Number(r.score_recommend))),
        availability: averageScore(responses.map((r) => Number(r.score_availability))),
        communication: averageScore(responses.map((r) => Number(r.score_communication))),
        innovation: averageScore(responses.map((r) => Number(r.score_innovation))),
        technical: averageScore(responses.map((r) => Number(r.score_technical))),
      },
    })
  } catch (error) {
    console.error('[nps-orquestrai]', error instanceof Error ? error.message : error)
    return jsonResponse({ error: 'Falha ao consultar NPS no ORQESTRAI.' }, 500)
  }
})
