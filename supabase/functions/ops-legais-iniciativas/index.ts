import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * KPIs Iniciativas Estratégicas — fonte FORJAI (projetos + tarefas).
 * Secrets: FORJAI_SUPABASE_URL, FORJAI_SUPABASE_SERVICE_ROLE_KEY (nunca no browser).
 *
 * Meta anual 24. Melhorias = project_type process_improvement; demais = Projetos.
 * Entrega = estágio counts_as_delivery (completed / production).
 */

const META_ANUAL = 24
const TZ = 'America/Sao_Paulo'
const DEFAULT_FORJAI_URL = 'https://rhdnurwwwylgfrxevdlv.supabase.co'
const FORJAI_APP_URL = 'https://forjai.vercel.app'

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

type StageRow = {
  id: string
  slug: string
  name: string
  counts_as_delivery: boolean | null
  is_terminal: boolean | null
}

type ProjectRow = {
  id: string
  name: string
  slug: string | null
  project_type: string | null
  completed_at: string | null
  production_date: string | null
  owner_user_id: string | null
  stage_id: string | null
  archived_at: string | null
}

type TaskRow = {
  id: string
  project_id: string
  parent_task_id: string | null
  name: string
  status_id: string | null
  completed_at: string | null
  estimate_minutes: number | null
}

type StatusRow = { id: string; slug: string; name: string; is_done: boolean | null }
type ProfileRow = { id: string; full_name: string | null; email: string | null }
type AssigneeRow = { task_id: string; user_id: string }
type TimeRow = { project_id: string | null; duration_seconds: number | null }

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
  concluido: boolean
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

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 10)
}

function inInclusive(iso: string | null, inicio: string, fim: string): boolean {
  if (!iso) return false
  return iso >= inicio && iso <= fim
}

function inPeriod(iso: string | null, inicio: string, fim: string): boolean {
  if (!iso) return false
  return iso >= inicio && iso < fim
}

function tipoProjeto(projectType: string | null): 'Projetos' | 'Melhorias' {
  return projectType === 'process_improvement' ? 'Melhorias' : 'Projetos'
}

function projectUrl(slug: string | null, id: string): string {
  if (slug) return `${FORJAI_APP_URL}/projects/${slug}`
  return `${FORJAI_APP_URL}/pipeline`
}

function profileName(p: ProfileRow | undefined): string {
  return (p?.full_name || p?.email || '').trim()
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

function weekdayMon1(iso: string): number {
  const utcDay = new Date(`${iso}T12:00:00.000-03:00`).getUTCDay()
  return utcDay === 0 ? 7 : utcDay
}

function rangeSemanaPassada(): { inicio: string; fim: string } {
  const hoje = todayBrazil()
  const dia = weekdayMon1(hoje)
  const inicioSemanaAtual = addDaysIso(hoje, -(dia - 1))
  const inicioSemanaPassada = addDaysIso(inicioSemanaAtual, -7)
  return { inicio: inicioSemanaPassada, fim: hoje }
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

function deliveryDate(p: ProjectRow, stage: StageRow | undefined): string | null {
  return isoDate(p.completed_at) ?? (stage?.counts_as_delivery ? isoDate(p.production_date) : null)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const forjaiUrl =
      Deno.env.get('FORJAI_SUPABASE_URL')?.trim() || DEFAULT_FORJAI_URL
    const forjaiKey = Deno.env.get('FORJAI_SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!forjaiKey) {
      return jsonResponse(
        { error: 'FORJAI não configurado (secret FORJAI_SUPABASE_SERVICE_ROLE_KEY).' },
        500,
      )
    }

    let ano = new Date().getFullYear()
    let inicio = `${ano}-01-01`
    let fim = `${ano + 1}-01-01`
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as {
        ano?: number
        inicio?: string
        fim?: string
      }
      if (body.ano && Number.isFinite(body.ano)) {
        ano = Number(body.ano)
        inicio = `${ano}-01-01`
        fim = `${ano + 1}-01-01`
      }
      if (body.inicio) inicio = body.inicio.slice(0, 10)
      if (body.fim) fim = body.fim.slice(0, 10)
    }

    const forjai = createClient(forjaiUrl, forjaiKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const [
      { data: stages, error: stagesErr },
      { data: projects, error: projectsErr },
      { data: tasks, error: tasksErr },
      { data: statuses, error: statusesErr },
      { data: profiles, error: profilesErr },
      { data: assignees, error: assigneesErr },
      { data: times, error: timesErr },
    ] = await Promise.all([
      forjai.from('project_stages').select('id,slug,name,counts_as_delivery,is_terminal'),
      forjai
        .from('projects')
        .select(
          'id,name,slug,project_type,completed_at,production_date,owner_user_id,stage_id,archived_at',
        )
        .is('archived_at', null),
      forjai
        .from('tasks')
        .select('id,project_id,parent_task_id,name,status_id,completed_at,estimate_minutes'),
      forjai.from('task_statuses').select('id,slug,name,is_done'),
      forjai.from('profiles').select('id,full_name,email'),
      forjai.from('task_assignees').select('task_id,user_id'),
      forjai.from('time_entries').select('project_id,duration_seconds'),
    ])

    const firstErr =
      stagesErr ?? projectsErr ?? tasksErr ?? statusesErr ?? profilesErr ?? assigneesErr ?? timesErr
    if (firstErr) throw new Error(firstErr.message)

    const stageById = new Map((stages as StageRow[] ?? []).map((s) => [s.id, s]))
    const statusById = new Map((statuses as StatusRow[] ?? []).map((s) => [s.id, s]))
    const profileById = new Map((profiles as ProfileRow[] ?? []).map((p) => [p.id, p]))
    const hoursByProject = new Map<string, number>()
    for (const te of (times as TimeRow[] ?? [])) {
      if (!te.project_id) continue
      hoursByProject.set(
        te.project_id,
        (hoursByProject.get(te.project_id) ?? 0) + (Number(te.duration_seconds) || 0) / 3600,
      )
    }

    const tasksByProject = new Map<string, TaskRow[]>()
    for (const t of (tasks as TaskRow[] ?? [])) {
      const arr = tasksByProject.get(t.project_id) ?? []
      arr.push(t)
      tasksByProject.set(t.project_id, arr)
    }

    const assigneesByTask = new Map<string, string[]>()
    for (const a of (assignees as AssigneeRow[] ?? [])) {
      const name = profileName(profileById.get(a.user_id))
      if (!name) continue
      const arr = assigneesByTask.get(a.task_id) ?? []
      arr.push(name)
      assigneesByTask.set(a.task_id, arr)
    }

    const allProjects = (projects as ProjectRow[] ?? []).filter((p) => !p.archived_at)
    const isDelivery = (p: ProjectRow) =>
      Boolean(stageById.get(p.stage_id ?? '')?.counts_as_delivery)

    const entreguesPeriodo = allProjects.filter((p) => {
      if (!isDelivery(p)) return false
      const data = deliveryDate(p, stageById.get(p.stage_id ?? ''))
      return inPeriod(data, inicio, fim)
    })

    const projetosFinalizados = entreguesPeriodo.filter((p) => tipoProjeto(p.project_type) === 'Projetos').length
    const melhoriasFinalizadas = entreguesPeriodo.filter((p) => tipoProjeto(p.project_type) === 'Melhorias').length
    const projetosConcluidos = entreguesPeriodo.length

    const horasGanhas = entreguesPeriodo.reduce((s, p) => {
      const tracked = hoursByProject.get(p.id) ?? 0
      if (tracked > 0) return s + tracked
      const mins = (tasksByProject.get(p.id) ?? []).reduce(
        (acc, t) => acc + (Number(t.estimate_minutes) || 0),
        0,
      )
      return s + mins / 60
    }, 0)

    const diasUteis = horasGanhas / 8
    const diasUteisMensal = diasUteis / 12
    const pctProgresso = META_ANUAL > 0 ? projetosConcluidos / META_ANUAL : 0
    const semana = rangeSemanaPassada()

    const ownerName = (p: ProjectRow) => profileName(profileById.get(p.owner_user_id ?? ''))

    const mapTaskStatus = (t: TaskRow): string => {
      const slug = statusById.get(t.status_id ?? '')?.slug ?? ''
      if (slug === 'done') return 'concluido'
      if (slug === 'in-progress') return 'in progress'
      if (slug === 'todo') return 'backlog'
      return slug
    }
    const taskDone = (t: TaskRow) => {
      const st = statusById.get(t.status_id ?? '')
      return Boolean(st?.is_done && st.slug !== 'cancelled')
    }

    const buildProjeto = (p: ProjectRow, concluido: boolean): ProjetoOut => {
      const subs = (tasksByProject.get(p.id) ?? []).filter((t) => !t.parent_task_id)
      const subtarefas: SubtarefaOut[] = subs.map((t) => ({
        id: t.id,
        nome: t.name,
        responsavel: (assigneesByTask.get(t.id) ?? []).join(', '),
        data: isoDate(t.completed_at),
        status: mapTaskStatus(t),
      }))
      const subOk = subtarefas.filter((s) => {
        const raw = (tasksByProject.get(p.id) ?? []).find((t) => t.id === s.id)
        return raw ? taskDone(raw) : false
      }).length
      return {
        id: p.id,
        nome: p.name,
        url: projectUrl(p.slug, p.id),
        tipo: tipoProjeto(p.project_type),
        extensao: p.project_type ?? '',
        responsavel: ownerName(p),
        data: deliveryDate(p, stageById.get(p.stage_id ?? '')),
        concluido,
        subtarefas,
        total_sub: subtarefas.length,
        sub_concluidas: subOk,
      }
    }

    const concluidosPainel = entreguesPeriodo
      .map((p) => buildProjeto(p, true))
      .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

    const andamento = allProjects.filter((p) => {
      const slug = stageById.get(p.stage_id ?? '')?.slug ?? ''
      return slug === 'development' || slug === 'production'
    })

    const andamentoPainel = andamento
      .map((p) => buildProjeto(p, false))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    const tarefasSemana = (tasks as TaskRow[] ?? []).filter((t) => {
      if (!taskDone(t)) return false
      return inInclusive(isoDate(t.completed_at), semana.inicio, semana.fim)
    })

    const projetosSemana = allProjects.filter((p) =>
      inInclusive(deliveryDate(p, stageById.get(p.stage_id ?? '')), semana.inicio, semana.fim) &&
      isDelivery(p),
    )

    const projetoById = new Map(allProjects.map((p) => [p.id, p]))
    const itensSemana: ItemSemanaOut[] = [
      ...projetosSemana.map((p) => ({
        id: p.id,
        nome: p.name,
        url: projectUrl(p.slug, p.id),
        tipo: 'Projeto' as const,
        pai_titulo: '',
        responsavel: ownerName(p),
        data: deliveryDate(p, stageById.get(p.stage_id ?? '')),
      })),
      ...tarefasSemana.map((t) => {
        const pai = projetoById.get(t.project_id)
        return {
          id: t.id,
          nome: t.name,
          url: pai ? projectUrl(pai.slug, pai.id) : FORJAI_APP_URL + '/pipeline',
          tipo: 'Subtarefa' as const,
          pai_titulo: pai?.name ?? '',
          responsavel: (assigneesByTask.get(t.id) ?? []).join(', '),
          data: isoDate(t.completed_at),
        }
      }),
    ].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

    const semanaPorTarefa = projetosSemana
      .map((p) => buildProjeto(p, true))
      .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

    const tarefasSobEmAndamento = andamento.reduce(
      (s, p) => s + (tasksByProject.get(p.id) ?? []).length,
      0,
    )

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
      itens: entreguesPeriodo
        .map((p) => ({
          id: p.id,
          nome: p.name,
          url: projectUrl(p.slug, p.id),
          tags: [tipoProjeto(p.project_type)],
          horas: Math.round((hoursByProject.get(p.id) ?? 0) * 100) / 100,
          data: deliveryDate(p, stageById.get(p.stage_id ?? '')),
        }))
        .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '')),
      painel: {
        projetos_em_andamento: andamento.length,
        tarefas_sob_em_andamento: tarefasSobEmAndamento,
        subtarefas_concluidas_periodo: tarefasSemana.length,
        semana_inicio: semana.inicio,
        semana_fim: semana.fim,
        concluidos: concluidosPainel,
        semana: itensSemana,
        semana_por_tarefa: semanaPorTarefa,
        andamento: andamentoPainel,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ops-legais-iniciativas]', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
