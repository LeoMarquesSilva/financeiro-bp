import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Abre chamados de "Auditoria de Excludentes/Envio de Evidência" na RESPONSUM a partir dos
 * casos FATAL Excludente sorteados no módulo Eficiência (Resultado Metas Bismarchi Pires).
 *
 * Fluxo:
 *  1. Para cada item recebido, resolve o "titular" da área (coordenador > gerente > sócio)
 *     em public.colaboradores (SIOE, sincronizado do ORQESTRAI — ver sync-colaboradores.mjs)
 *     e usa o responsum_user_id dele como created_by do chamado.
 *  2. Se a área não tiver titular com conta RESPONSUM mapeada, tenta usar `created_by_email`
 *     (usuário logado no financeiro-bp que disparou a ação) como fallback.
 *  3. Evita duplicar chamado já aberto para o mesmo CI (busca por título exato).
 *  4. Insere em app_c009c0e4f1_tickets da RESPONSUM com
 *     category=validacao_de_indicadores / subcategory=auditoria_de_excludentes_envio_de_evidencia,
 *     atribuído ao responsável padrão da subcategoria (hoje: Samuel Willian Silva).
 *
 * Nunca escreve nada no ORQESTRAI — só lê colaboradores (espelho local) e escreve na RESPONSUM.
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

interface CasoExcludente {
  ci: string
  area: string
  responsavel?: string | null
  nroCnj?: string | null
  grupoCliente?: string | null
  textoChamado: string
}

interface Payload {
  itens: CasoExcludente[]
  /** E-mail de quem disparou a ação no financeiro-bp — fallback quando a área não tem titular mapeado na RESPONSUM. */
  created_by_email?: string | null
  /** Override manual por área (configuração do modal Amostra de chamados). */
  titular_por_area?: Record<
    string,
    { responsum_user_id: string; full_name: string; area: string }
  >
}

interface ColaboradorTitular {
  full_name: string
  area: string
  nivel_hierarquico: string
  responsum_user_id: string | null
}

interface ResultadoItem {
  ci: string
  ok: boolean
  ticket_id?: string
  ja_existia?: boolean
  erro?: string
}

const NIVEL_PRIORIDADE: Record<string, number> = { coordenador: 0, gerente: 1, socio: 2 }

function primeiraLinha(texto: string): string {
  return texto.split('\n')[0]?.trim() || texto.trim()
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '(url inválida)'
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RESPONSUM_URL = Deno.env.get('RESPONSUM_SUPABASE_URL')?.trim()
    const RESPONSUM_SERVICE_ROLE = Deno.env.get('RESPONSUM_SERVICE_ROLE_KEY')?.trim()

    if (!RESPONSUM_URL || !RESPONSUM_SERVICE_ROLE) {
      return jsonResponse({ error: 'RESPONSUM não configurada (secrets ausentes).' }, 500)
    }

    if (!/^https:\/\//i.test(RESPONSUM_URL)) {
      return jsonResponse(
        {
          error: `RESPONSUM_SUPABASE_URL inválida (host=${hostOf(RESPONSUM_URL)}). Use a URL https://…supabase.co do projeto RESPONSUM.`,
        },
        500,
      )
    }

    let payload: Payload
    try {
      payload = await req.json()
    } catch {
      return jsonResponse({ error: 'Body inválido.' }, 400)
    }

    const itens = Array.isArray(payload.itens) ? payload.itens : []
    if (itens.length === 0) {
      return jsonResponse({ error: 'Nenhum item para abrir chamado.' }, 400)
    }

    const sioe = createClient(SUPABASE_URL, SERVICE_ROLE)
    const responsum = createClient(RESPONSUM_URL, RESPONSUM_SERVICE_ROLE)

    // Titular (coordenador > gerente > sócio) por área, resolvido uma única vez.
    const areas = [...new Set(itens.map((i) => i.area).filter(Boolean))]
    const { data: colaboradoresAreas, error: colaboradoresError } = await sioe
      .from('colaboradores')
      .select('full_name, area, nivel_hierarquico, responsum_user_id')
      .in('area', areas)
      .eq('is_active', true)
      .in('nivel_hierarquico', ['coordenador', 'gerente', 'socio'])
    if (colaboradoresError) {
      return jsonResponse(
        { error: `Erro ao buscar titulares em colaboradores: ${colaboradoresError.message}` },
        500,
      )
    }

    const titularPorArea = new Map<string, ColaboradorTitular>()
    for (const c of (colaboradoresAreas ?? []) as ColaboradorTitular[]) {
      const atual = titularPorArea.get(c.area)
      const prioridadeAtual = atual ? (NIVEL_PRIORIDADE[atual.nivel_hierarquico] ?? 99) : 99
      const prioridadeNova = NIVEL_PRIORIDADE[c.nivel_hierarquico] ?? 99
      if (!atual || prioridadeNova < prioridadeAtual) titularPorArea.set(c.area, c)
    }

    // Fallback: usuário RESPONSUM correspondente a quem disparou a ação no financeiro-bp.
    let fallbackUser: { id: string; name: string; department: string | null } | null = null
    if (payload.created_by_email) {
      const { data: fallback, error: fallbackError } = await responsum
        .from('app_c009c0e4f1_users')
        .select('id, name, department')
        .ilike('email', payload.created_by_email.trim())
        .limit(1)
        .maybeSingle()
      if (fallbackError) {
        return jsonResponse(
          {
            error: `Falha ao consultar RESPONSUM (users): ${fallbackError.message}`,
            responsum_host: hostOf(RESPONSUM_URL),
          },
          500,
        )
      }
      if (fallback) fallbackUser = fallback
    }

    // Responsável padrão da subcategoria (hoje: Samuel Willian Silva) — resolvido dinamicamente
    // para não ficar preso a um id fixo caso troque na RESPONSUM.
    const { data: subcategoria, error: subcatError } = await responsum
      .from('app_c009c0e4f1_subcategories')
      .select('default_assigned_to, default_assigned_to_name')
      .eq('key', 'auditoria_de_excludentes_envio_de_evidencia')
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

    const resultados: ResultadoItem[] = []

    for (const item of itens) {
      const override = payload.titular_por_area?.[item.area]
      const titularAuto = titularPorArea.get(item.area)
      const titular = override
        ? {
            full_name: override.full_name,
            area: override.area,
            responsum_user_id: override.responsum_user_id,
            nivel_hierarquico: 'override',
          }
        : titularAuto
      const createdById = titular?.responsum_user_id ?? fallbackUser?.id ?? null
      const createdByName = titular?.full_name ?? fallbackUser?.name ?? null
      const createdByDepartment = titular?.area ?? fallbackUser?.department ?? item.area ?? null

      if (!createdById || !createdByName) {
        resultados.push({
          ci: item.ci,
          ok: false,
          erro: `Nenhum titular da área "${item.area}" com conta RESPONSUM mapeada (ver Colaboradores > Divergências) e nenhum fallback informado.`,
        })
        continue
      }

      const title = primeiraLinha(item.textoChamado)

      try {
        const { data: existente, error: existenteError } = await responsum
          .from('app_c009c0e4f1_tickets')
          .select('id')
          .eq('subcategory', 'auditoria_de_excludentes_envio_de_evidencia')
          .eq('title', title)
          .limit(1)
          .maybeSingle()
        if (existenteError) throw new Error(existenteError.message)

        if (existente) {
          resultados.push({ ci: item.ci, ok: true, ticket_id: existente.id, ja_existia: true })
          continue
        }

        const { data: criado, error: insertError } = await responsum
          .from('app_c009c0e4f1_tickets')
          .insert({
            title,
            description: item.textoChamado,
            category: 'validacao_de_indicadores',
            subcategory: 'auditoria_de_excludentes_envio_de_evidencia',
            priority: 'high',
            created_by: createdById,
            created_by_name: createdByName,
            created_by_department: createdByDepartment,
            assigned_to: subcategoria?.default_assigned_to ?? null,
            assigned_to_name: subcategoria?.default_assigned_to_name ?? null,
          })
          .select('id')
          .single()

        if (insertError) throw new Error(insertError.message)
        resultados.push({ ci: item.ci, ok: true, ticket_id: criado.id })
      } catch (e) {
        resultados.push({ ci: item.ci, ok: false, erro: e instanceof Error ? e.message : String(e) })
      }
    }

    const criados = resultados.filter((r) => r.ok && !r.ja_existia).length
    const jaExistiam = resultados.filter((r) => r.ja_existia).length
    return jsonResponse({ criados, ja_existiam: jaExistiam, total: resultados.length, resultados })
  } catch (e) {
    return jsonResponse(
      {
        error: e instanceof Error ? e.message : String(e),
        hint: 'Verifique se RESPONSUM_SUPABASE_URL e RESPONSUM_SERVICE_ROLE_KEY apontam para o projeto RESPONSUM (não o SIOE).',
      },
      500,
    )
  }
})
