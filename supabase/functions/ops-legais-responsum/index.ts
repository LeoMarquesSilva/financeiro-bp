import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Agrega KPIs Responsum para a aba Ops Legais → Tarefas (tickets, NPS, ranking).
 * Lê app_c009c0e4f1_tickets no projeto RESPONSUM (service role) — nunca no browser.
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

type Ticket = {
  id: string
  status: string | null
  service_score: number | string | null
  assigned_to_name: string | null
  title: string | null
  created_at: string | null
  resolved_at: string | null
}

function isSlaFatal(title: string | null | undefined): boolean {
  return (title ?? '').toLocaleUpperCase('pt-BR').includes('EVIDÊNCIA SLA FATAL')
}

function scoreNum(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function inPeriod(iso: string | null, inicio: string, fim: string): boolean {
  if (!iso) return false
  const d = iso.slice(0, 10)
  return d >= inicio && d < fim
}

async function fetchAllTickets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
): Promise<Ticket[]> {
  const pageSize = 1000
  const out: Ticket[] = []
  let from = 0
  while (true) {
    const { data, error } = await client
      .from('app_c009c0e4f1_tickets')
      .select('id,status,service_score,assigned_to_name,title,created_at,resolved_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as Ticket[]
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

  try {
    const RESPONSUM_URL =
      Deno.env.get('RESPONSUM_SUPABASE_URL')?.trim() ||
      Deno.env.get('SUPABASE_URL_RESPONSUM')?.trim()
    const RESPONSUM_KEY =
      Deno.env.get('RESPONSUM_SERVICE_ROLE_KEY')?.trim() ||
      Deno.env.get('SUPABASE_RESPONSUM_SERVICE_ROLE_KEY')?.trim()

    if (!RESPONSUM_URL || !RESPONSUM_KEY) {
      return jsonResponse({ error: 'RESPONSUM não configurada (secrets ausentes).' }, 500)
    }

    let inicio = `${new Date().getUTCFullYear()}-01-01`
    let fim = `${new Date().getUTCFullYear() + 1}-01-01`
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as {
        inicio?: string
        fim?: string
      }
      if (body.inicio) inicio = body.inicio.slice(0, 10)
      if (body.fim) fim = body.fim.slice(0, 10)
    }

    const responsum = createClient(RESPONSUM_URL, RESPONSUM_KEY)
    const all = await fetchAllTickets(responsum)
    const noPeriodo = all.filter((t) => inPeriod(t.created_at, inicio, fim))

    const total = noPeriodo.length
    const emAtendimento = noPeriodo.filter(
      (t) => t.status === 'open' || t.status === 'in_progress',
    ).length
    const resolvidos = noPeriodo.filter((t) => t.status === 'resolved').length
    const taxa = total > 0 ? (resolvidos / total) * 100 : 0

    const scores = noPeriodo
      .map((t) => scoreNum(t.service_score))
      .filter((n): n is number => n != null)
    const promotores = scores.filter((s) => s >= 9).length
    const neutros = scores.filter((s) => s >= 7 && s <= 8).length
    const detratores = scores.filter((s) => s <= 6).length
    const totalNps = promotores + neutros + detratores
    const nps =
      totalNps === 0 ? 0 : Math.round(((promotores - detratores) / totalNps) * 100)
    const media =
      scores.length === 0
        ? 0
        : scores.reduce((a, b) => a + b, 0) / scores.length
    const excelente = scores.filter((s) => s >= 9).length
    const bom = scores.filter((s) => s >= 7 && s <= 8).length
    const regular = scores.filter((s) => s >= 5 && s <= 6).length
    const ruim = scores.filter((s) => s <= 4).length

    const zona =
      nps >= 75
        ? 'Zona de Excelência'
        : nps >= 50
          ? 'Zona de Qualidade'
          : nps >= 0
            ? 'Zona de Aperfeiçoamento'
            : 'Zona Crítica'

    // Concluídos no período (pessoas + bucket SLA Fatal)
    const concluidosMap = new Map<string, number>()
    let concluidosSlaFatal = 0
    for (const t of noPeriodo) {
      if (t.status !== 'resolved') continue
      if (isSlaFatal(t.title)) {
        concluidosSlaFatal += 1
        continue
      }
      const nome = (t.assigned_to_name ?? '').trim()
      if (!nome) continue
      concluidosMap.set(nome, (concluidosMap.get(nome) || 0) + 1)
    }
    const concluidos = [
      ...(concluidosSlaFatal > 0
        ? [
            {
              nome: 'Aguardando Evidências (Jurídico)',
              qtd: concluidosSlaFatal,
              is_sla_fatal: true,
            },
          ]
        : []),
      ...[...concluidosMap.entries()]
        .map(([nome, qtd]) => ({ nome, qtd, is_sla_fatal: false }))
        .sort((a, b) => b.qtd - a.qtd),
    ]

    // Pendentes: sem filtro de período
    type PendItem = {
      nome: string
      qtd_aberto: number
      qtd_andamento: number
      is_sla_fatal: boolean
      tickets: Array<{ title: string; status: string; created_at: string | null }>
      pessoas_sla?: Array<{
        nome: string
        qtd: number
        tickets: Array<{ title: string; status: string; created_at: string | null }>
      }>
    }

    const pendMap = new Map<string, PendItem>()
    const slaFatalTickets: Array<{
      title: string
      status: string
      created_at: string | null
      assigned: string
    }> = []

    for (const t of all) {
      if (t.status !== 'open' && t.status !== 'in_progress') continue
      const title = t.title ?? ''
      if (isSlaFatal(title)) {
        slaFatalTickets.push({
          title: title.replace(/\[EVIDÊNCIA SLA FATAL\]\s*/i, ''),
          status: t.status ?? 'open',
          created_at: t.created_at,
          assigned: (t.assigned_to_name ?? '').trim() || '—',
        })
        continue
      }
      const nome = (t.assigned_to_name ?? '').trim()
      if (!nome) continue
      let row = pendMap.get(nome)
      if (!row) {
        row = {
          nome,
          qtd_aberto: 0,
          qtd_andamento: 0,
          is_sla_fatal: false,
          tickets: [],
        }
        pendMap.set(nome, row)
      }
      if (t.status === 'open') row.qtd_aberto += 1
      else row.qtd_andamento += 1
      row.tickets.push({
        title,
        status: t.status ?? 'open',
        created_at: t.created_at,
      })
    }

    const pendentes: PendItem[] = []
    if (slaFatalTickets.length > 0) {
      const byPerson = new Map<string, typeof slaFatalTickets>()
      for (const t of slaFatalTickets) {
        const list = byPerson.get(t.assigned) ?? []
        list.push(t)
        byPerson.set(t.assigned, list)
      }
      pendentes.push({
        nome: 'Aguardando Evidências (Jurídico)',
        qtd_aberto: slaFatalTickets.filter((t) => t.status === 'open').length,
        qtd_andamento: slaFatalTickets.filter((t) => t.status === 'in_progress').length,
        is_sla_fatal: true,
        tickets: [],
        pessoas_sla: [...byPerson.entries()]
          .map(([nome, tickets]) => ({
            nome,
            qtd: tickets.length,
            tickets: tickets.map((t) => ({
              title: t.title,
              status: t.status,
              created_at: t.created_at,
            })),
          }))
          .sort((a, b) => b.qtd - a.qtd),
      })
    }
    pendentes.push(
      ...[...pendMap.values()].sort(
        (a, b) => b.qtd_aberto + b.qtd_andamento - (a.qtd_aberto + a.qtd_andamento),
      ),
    )

    return jsonResponse({
      periodo: { inicio, fim },
      tickets: {
        total,
        em_atendimento: emAtendimento,
        resolvidos,
        taxa_resolucao: Math.round(taxa * 100) / 100,
      },
      nps: {
        nps,
        zona,
        promotores,
        neutros,
        detratores,
        total_avaliacoes: totalNps,
        media_score: Math.round(media * 10) / 10,
        excelente,
        bom,
        regular,
        ruim,
      },
      concluidos,
      pendentes,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonResponse({ error: msg }, 500)
  }
})
