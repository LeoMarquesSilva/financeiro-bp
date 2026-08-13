import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * KPIs Iniciativas Estratégicas (BI Ops Legais / ClickUp list 901110394818).
 * Token: secret CLICKUP_API_TOKEN (nunca no browser).
 *
 * PARTE1: KPIs topo (meta 24, projetos/melhorias, horas).
 * PARTE2: painel Projetos Realizados (Concluídos / Semana passada / Em andamento).
 */

const LIST_ID = '901110394818'
const META_ANUAL = 24
const TZ = 'America/Sao_Paulo'

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

type ClickUpAssignee = {
  username?: string | null
  email?: string | null
  initials?: string | null
}
type ClickUpTask = {
  id: string
  name?: string
  parent?: string | null
  status?: { status?: string } | string
  tags?: Array<{ name?: string }>
  assignees?: ClickUpAssignee[]
  time_estimate?: number | null
  date_created?: string | number | null
  date_updated?: string | number | null
  date_closed?: string | number | null
  date_done?: string | number | null
  url?: string | null
  creator?: { username?: string | null; email?: string | null } | null
}

type SubtarefaOut = {
  id: string
  nome: string
  responsavel: string
  data: string | null
  status: string
}

type ProjetoOut = {
  id: string
  nome: string
  url: string | null
  tipo: string
  extensao: string
  responsavel: string
  data: string | null
  subtarefas: SubtarefaOut[]
  total_sub: number
  sub_concluidas: number
}

type ItemSemanaOut = {
  id: string
  nome: string
  url: string | null
  tipo: 'Projeto' | 'Subtarefa'
  pai_titulo: string
  responsavel: string
  data: string | null
}

function statusName(t: ClickUpTask): string {
  if (typeof t.status === 'string') return t.status
  return t.status?.status ?? ''
}

function normStatus(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/** Status de conclusão no ClickUp (lista Ops Legais / BI). */
function isConcluidoStatus(t: ClickUpTask): boolean {
  const n = normStatus(statusName(t))
  return (
    n === 'concluido' ||
    n === 'complete' ||
    n === 'completed' ||
    n === 'closed' ||
    n === 'done' ||
    n === 'fechado' ||
    n === 'fechados'
  )
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function msToIsoDate(ms: string | number | null | undefined): string | null {
  if (ms == null || ms === '') return null
  const n = typeof ms === 'number' ? ms : Number(ms)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(n))
}

/** Finalizacao BI: done → closed → updated → created. */
function taskDate(t: ClickUpTask): string | null {
  return (
    msToIsoDate(t.date_done) ??
    msToIsoDate(t.date_closed) ??
    msToIsoDate(t.date_updated) ??
    msToIsoDate(t.date_created)
  )
}

function inPeriod(iso: string | null, inicio: string, fim: string): boolean {
  if (!iso) return false
  return iso >= inicio && iso < fim
}

function inInclusive(iso: string | null, inicio: string, fim: string): boolean {
  if (!iso) return false
  return iso >= inicio && iso <= fim
}

function hasTag(t: ClickUpTask, tag: string): boolean {
  const target = normStatus(tag)
  return (t.tags ?? []).some((x) => normStatus(x.name ?? '') === target)
}

function tagNames(t: ClickUpTask): string[] {
  return (t.tags ?? []).map((x) => x.name ?? '').filter(Boolean)
}

/** Tipo = Projetos/Melhorias; Extensão = demais tags (ex.: cross áreas). */
function classifyTags(tags: string[]): { tipo: string; extensao: string } {
  let tipo = ''
  const extensao: string[] = []
  for (const raw of tags) {
    const n = normStatus(raw)
    if (n === 'projetos') {
      if (!tipo) tipo = 'Projetos'
    } else if (n === 'melhorias') {
      if (!tipo) tipo = 'Melhorias'
    } else {
      extensao.push(raw)
    }
  }
  return { tipo, extensao: extensao.join(', ') }
}

function assigneeLabel(a: ClickUpAssignee): string {
  return (a.username || a.email || a.initials || '').trim()
}

function responsaveis(t: ClickUpTask): string {
  const names = (t.assignees ?? []).map(assigneeLabel).filter(Boolean)
  if (names.length) return [...new Set(names)].join(', ')
  const creator = t.creator
  if (creator) {
    const c = (creator.username || creator.email || '').trim()
    if (c) return c
  }
  return ''
}

function todayBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000-03:00`)
  d.setTime(d.getTime() + days * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** WEEKDAY(date, 2): Mon=1 … Sun=7. */
function weekdayMon1(iso: string): number {
  const utcDay = new Date(`${iso}T12:00:00.000-03:00`).getUTCDay()
  return utcDay === 0 ? 7 : utcDay
}

/** Segunda da semana passada → hoje (DAX KPI_HTML_PROJETOS_PARTE2). */
function rangeSemanaPassada(): { inicio: string; fim: string } {
  const hoje = todayBrazil()
  const dia = weekdayMon1(hoje)
  const inicioSemanaAtual = addDaysIso(hoje, -(dia - 1))
  const inicioSemanaPassada = addDaysIso(inicioSemanaAtual, -7)
  return { inicio: inicioSemanaPassada, fim: hoje }
}

async function fetchAllTasks(token: string): Promise<ClickUpTask[]> {
  const out: ClickUpTask[] = []
  let page = 0
  for (;;) {
    const url =
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task` +
      `?subtasks=true&include_closed=true&page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ClickUp ${res.status}: ${text.slice(0, 400)}`)
    }
    const json = (await res.json()) as { tasks?: ClickUpTask[]; last_page?: boolean }
    out.push(...(json.tasks ?? []))
    if (json.last_page === true || !(json.tasks?.length)) break
    page += 1
    if (page > 50) break
  }
  return out
}

function progressColor(pct: number): string {
  if (pct >= 1) return '#059669'
  if (pct >= 0.75) return '#0284C7'
  if (pct >= 0.5) return '#EAB308'
  return '#B91C1C'
}

function formatHoras(horas: number): string {
  const h = Math.floor(horas)
  const m = Math.round((horas - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function isTopLevel(t: ClickUpTask): boolean {
  return t.parent == null || t.parent === ''
}

function parentId(t: ClickUpTask): string | null {
  if (t.parent == null || t.parent === '') return null
  return String(t.parent)
}

function dedupeById(tasks: ClickUpTask[]): ClickUpTask[] {
  const byId = new Map<string, ClickUpTask>()
  for (const t of tasks) byId.set(t.id, t)
  return [...byId.values()]
}

function mapSubtarefa(t: ClickUpTask): SubtarefaOut {
  return {
    id: t.id,
    nome: t.name ?? '',
    responsavel: responsaveis(t),
    data: taskDate(t),
    // UI filtra por 'concluido' — normaliza aliases do ClickUp
    status: isConcluidoStatus(t) ? 'concluido' : normStatus(statusName(t)),
  }
}

function buildProjeto(t: ClickUpTask, children: ClickUpTask[]): ProjetoOut {
  const { tipo, extensao } = classifyTags(tagNames(t))
  const subs = dedupeById(children)
    .map(mapSubtarefa)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  let responsavel = responsaveis(t)
  if (!responsavel) {
    responsavel = [...new Set(subs.map((s) => s.responsavel).filter(Boolean))].join(', ')
  }
  const dataSubs = subs.reduce<string | null>((acc, s) => maxIso(acc, s.data), null)
  return {
    id: t.id,
    nome: t.name ?? '',
    url: t.url ?? null,
    tipo,
    extensao,
    responsavel,
    data: maxIso(taskDate(t), dataSubs),
    subtarefas: subs,
    total_sub: subs.length,
    sub_concluidas: subs.filter((s) => s.status === 'concluido').length,
  }
}

/**
 * Agrupa pelo título da TAREFA (não da subtarefa).
 * - Folha concluída → linha = pai (tarefa), com todas as subtarefas concluídas.
 * - Item com filhos concluído no período → linha própria (não sobe para o projeto).
 */
function buildPainelPorTarefa(
  all: ClickUpTask[],
  byId: Map<string, ClickUpTask>,
  childrenOf: Map<string, ClickUpTask[]>,
  inicio: string,
  fim: string,
  inclusive: boolean,
): ProjetoOut[] {
  const inRange = (iso: string | null) =>
    inclusive ? inInclusive(iso, inicio, fim) : inPeriod(iso, inicio, fim)

  const tarefaIds = new Set<string>()

  for (const t of all) {
    if (!isConcluidoStatus(t) || !inRange(taskDate(t))) continue
    const hasChildren = (childrenOf.get(t.id) ?? []).length > 0
    if (hasChildren) {
      tarefaIds.add(t.id)
      continue
    }
    const p = parentId(t)
    if (p) {
      tarefaIds.add(p)
    } else {
      tarefaIds.add(t.id)
    }
  }

  const out: ProjetoOut[] = []
  for (const tarefaId of tarefaIds) {
    const tarefa = byId.get(tarefaId)
    if (!tarefa) continue

    const todasSubsConcluidas = dedupeById(childrenOf.get(tarefaId) ?? []).filter(
      isConcluidoStatus,
    )

    let tagsSource = tarefa
    let walk: ClickUpTask | undefined = tarefa
    const seen = new Set<string>()
    while (walk) {
      const pid = parentId(walk)
      if (!pid || seen.has(pid)) break
      seen.add(pid)
      const parent = byId.get(pid)
      if (!parent) break
      tagsSource = parent
      walk = parent
    }
    const { tipo, extensao } = classifyTags(tagNames(tagsSource))
    const projeto = buildProjeto(tarefa, todasSubsConcluidas)
    if (!projeto.tipo && tipo) projeto.tipo = tipo
    if (!projeto.extensao && extensao) projeto.extensao = extensao
    out.push(projeto)
  }

  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const token = Deno.env.get('CLICKUP_API_TOKEN')?.trim()
    if (!token) {
      return jsonResponse(
        { error: 'CLICKUP_API_TOKEN ausente. Configure o secret no Supabase.' },
        500,
      )
    }

    const year = new Date().getUTCFullYear()
    let inicio = `${year}-01-01`
    let fim = `${year + 1}-01-01`
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as {
        inicio?: string
        fim?: string
      }
      if (body.inicio) inicio = body.inicio.slice(0, 10)
      if (body.fim) fim = body.fim.slice(0, 10)
    }

    const all = dedupeById(await fetchAllTasks(token))
    const byId = new Map(all.map((t) => [t.id, t]))
    const childrenOf = new Map<string, ClickUpTask[]>()
    for (const t of all) {
      const p = parentId(t)
      if (!p) continue
      const arr = childrenOf.get(p) ?? []
      arr.push(t)
      childrenOf.set(p, arr)
    }

    const topLevel = all.filter(isTopLevel)
    const concluidosPeriodo = topLevel.filter((t) => {
      return isConcluidoStatus(t) && inPeriod(taskDate(t), inicio, fim)
    })

    /** Meta anual = só tarefas com tag Projetos ou Melhorias (não conta “Outro”). */
    const contaNaMeta = (t: ClickUpTask) => hasTag(t, 'Projetos') || hasTag(t, 'Melhorias')
    const unicos = concluidosPeriodo.filter(contaNaMeta)
    const projetosConcluidos = unicos.length
    const projetosFinalizados = unicos.filter((t) => hasTag(t, 'Projetos')).length
    const melhoriasFinalizadas = unicos.filter((t) => hasTag(t, 'Melhorias')).length

    const msTotal = unicos.reduce((s, t) => s + (Number(t.time_estimate) || 0), 0)
    const horasGanhas = msTotal / 3_600_000
    const diasUteis = horasGanhas / 8
    const diasUteisMensal = diasUteis / 12
    const pctProgresso = META_ANUAL > 0 ? projetosConcluidos / META_ANUAL : 0

    const semana = rangeSemanaPassada()

    const emAndamento = topLevel.filter((t) => {
      const n = normStatus(statusName(t))
      return n === 'in progress' || n === 'em andamento'
    })
    const idsAndamento = new Set(emAndamento.map((t) => t.id))
    let tarefasSobEmAndamento = 0
    for (const id of idsAndamento) {
      tarefasSobEmAndamento += (childrenOf.get(id) ?? []).length
    }

    const subtarefasConcluidasPeriodo = all.filter((t) => {
      const p = parentId(t)
      if (!p) return false
      return isConcluidoStatus(t) && inInclusive(taskDate(t), semana.inicio, semana.fim)
    }).length

    // Painel: agrega pela TAREFA (pai); só Projetos/Melhorias entram no racional da meta
    const concluidosPainel = buildPainelPorTarefa(
      all,
      byId,
      childrenOf,
      inicio,
      fim,
      false,
    ).filter((p) => p.tipo === 'Projetos' || p.tipo === 'Melhorias')

    const semanaAgrupada = buildPainelPorTarefa(
      all,
      byId,
      childrenOf,
      semana.inicio,
      semana.fim,
      true,
    )

    // Compat: lista plana da semana (opcional) — UI usa agrupado em `concluidos`-like
    const itensSemana: ItemSemanaOut[] = semanaAgrupada.flatMap((p) => {
      if (p.subtarefas.length === 0) {
        return [
          {
            id: p.id,
            nome: p.nome,
            url: p.url,
            tipo: 'Projeto' as const,
            pai_titulo: '',
            responsavel: p.responsavel,
            data: p.data,
          },
        ]
      }
      return p.subtarefas.map((s) => ({
        id: s.id,
        nome: s.nome,
        url: null,
        tipo: 'Subtarefa' as const,
        pai_titulo: p.nome,
        responsavel: s.responsavel,
        data: s.data,
      }))
    })

    const andamentoPainel: ProjetoOut[] = emAndamento
      .map((t) => {
        const subs = dedupeById(childrenOf.get(t.id) ?? [])
        return buildProjeto(t, subs)
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    return jsonResponse({
      meta_anual: META_ANUAL,
      projetos_concluidos: projetosConcluidos,
      projetos_finalizados: projetosFinalizados,
      melhorias_finalizadas: melhoriasFinalizadas,
      pct_progresso: Math.round(pctProgresso * 10000) / 100,
      pct_contribuicao_projetos:
        projetosConcluidos > 0
          ? Math.round((projetosFinalizados / projetosConcluidos) * 10000) / 100
          : 0,
      pct_contribuicao_melhorias:
        projetosConcluidos > 0
          ? Math.round((melhoriasFinalizadas / projetosConcluidos) * 10000) / 100
          : 0,
      horas_ganhas: Math.round(horasGanhas * 100) / 100,
      horas_formatadas: formatHoras(horasGanhas),
      dias_uteis: Math.round(diasUteis * 10) / 10,
      dias_uteis_mensal: Math.round(diasUteisMensal * 10) / 10,
      cor_progresso: progressColor(pctProgresso),
      inicio,
      fim,
      itens: unicos
        .map((t) => ({
          id: t.id,
          nome: t.name ?? '',
          url: t.url ?? null,
          tags: tagNames(t),
          horas: Math.round(((Number(t.time_estimate) || 0) / 3_600_000) * 100) / 100,
          data: taskDate(t),
        }))
        .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '')),
      painel: {
        projetos_em_andamento: emAndamento.length,
        tarefas_sob_em_andamento: tarefasSobEmAndamento,
        subtarefas_concluidas_periodo: subtarefasConcluidasPeriodo,
        semana_inicio: semana.inicio,
        semana_fim: semana.fim,
        concluidos: concluidosPainel,
        semana: itensSemana,
        semana_por_tarefa: semanaAgrupada,
        andamento: andamentoPainel,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ops-legais-iniciativas]', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
