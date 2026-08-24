import type {
  InstagramPeriodRange,
  MarketingPauta,
  MarketingPautaStage,
  MarketingPautaSummary,
  MarketingTaskRow,
} from './types'

export const MARKETING_PAUTA_TASK = 'MATERIAL MARKETING - REELS/POST/ARTIGO'
const REVIEW_TASK = '2. REVISAR'
const PROTOCOL_TASK = '3. PROTOCOLAR'
const MONTH_DAYS = 365.2425 / 12

function clean(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || null
}

function areaFrom(row: MarketingTaskRow) {
  const value = clean(row.area_conclusao) || clean(row.cliente) || clean(row.grupo_cliente)
  if (!value) return 'Área não informada'
  return value.replace(/^Grupo\s+/i, '').replace(/^Área\s+/i, '').trim()
}

function statusIs(row: MarketingTaskRow | null, status: string) {
  return row?.status.trim().toLocaleLowerCase('pt-BR') === status.toLocaleLowerCase('pt-BR')
}

function stageFor(main: MarketingTaskRow, review: MarketingTaskRow | null, protocol: MarketingTaskRow | null): MarketingPautaStage {
  if (statusIs(main, 'Cancelada')) return 'cancelada'
  if (!statusIs(main, 'Concluída')) return 'aguardando_envio'
  if (review && !statusIs(review, 'Concluída') && !statusIs(review, 'Cancelada')) return 'em_revisao'
  if (protocol && !statusIs(protocol, 'Concluída') && !statusIs(protocol, 'Cancelada')) return 'em_protocolo'
  return 'finalizada'
}

function currentTask(
  stage: MarketingPautaStage,
  main: MarketingTaskRow,
  review: MarketingTaskRow | null,
  protocol: MarketingTaskRow | null,
) {
  if (stage === 'em_revisao') return review
  if (stage === 'em_protocolo') return protocol
  return main
}

function civilDate(value: string | null | undefined) {
  return value?.slice(0, 10) || null
}

function todayUtc(now: Date) {
  return now.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T12:00:00Z`)
  const end = new Date(`${to}T12:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function daysText(days: number) {
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

function isDateInRange(value: string | null, range: InstagramPeriodRange) {
  const date = civilDate(value)
  if (!date) return false
  const from = civilDate(range.from)
  const to = civilDate(range.to)
  return (!from || date >= from) && (!to || date <= to)
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export function buildMarketingPautas(
  rows: MarketingTaskRow[],
  now = new Date(),
): MarketingPauta[] {
  const byProcess = new Map<string, MarketingTaskRow[]>()
  for (const row of rows) {
    const key = String(row.ci_processo ?? `sem-processo-${row.ci}`)
    const processRows = byProcess.get(key) ?? []
    processRows.push(row)
    byProcess.set(key, processRows)
  }

  const pautas: MarketingPauta[] = []
  for (const processRows of byProcess.values()) {
    const ordered = [...processRows].sort((a, b) => a.ci - b.ci)
    for (let index = 0; index < ordered.length; index += 1) {
      const main = ordered[index]
      if (main.tarefa.trim() !== MARKETING_PAUTA_TASK || clean(main.tarefa_pai)) continue

      const children: MarketingTaskRow[] = []
      for (let cursor = index + 1; cursor < ordered.length; cursor += 1) {
        const candidate = ordered[cursor]
        if (candidate.tarefa.trim() === MARKETING_PAUTA_TASK && !clean(candidate.tarefa_pai)) break
        if (candidate.tarefa_pai?.trim() === MARKETING_PAUTA_TASK) children.push(candidate)
      }
      const review = children.find((row) => row.tarefa.trim() === REVIEW_TASK) ?? null
      const protocol = children.find((row) => row.tarefa.trim() === PROTOCOL_TASK) ?? null
      const stage = stageFor(main, review, protocol)
      const activeTask = currentTask(stage, main, review, protocol)
      const currentDueDate = civilDate(activeTask?.data_para_conclusao)

      pautas.push({
        id: main.ci,
        processId: main.ci_processo,
        responsavel: clean(main.responsavel) || clean(main.usuario_conclusao),
        area: areaFrom(main),
        stage,
        dueDate: civilDate(main.data_para_conclusao),
        completedAt: civilDate(main.data_conclusao),
        currentDueDate,
        isLate: !['finalizada', 'cancelada'].includes(stage)
          && Boolean(currentDueDate && currentDueDate < todayUtc(now)),
        main,
        review,
        protocol,
      })
    }
  }
  return pautas.sort((a, b) => a.id - b.id)
}

export function getMarketingPautaTiming(pauta: MarketingPauta, now = new Date()) {
  const today = todayUtc(now)
  const stageConfig = {
    aguardando_envio: { subject: 'Envio', late: 'atrasado' },
    em_revisao: { subject: 'Revisão', late: 'atrasada' },
    em_protocolo: { subject: 'Protocolo', late: 'atrasado' },
  } as const

  let stageElapsed: string | null = null
  if (pauta.stage === 'em_revisao' && pauta.completedAt) {
    const elapsed = Math.max(0, daysBetween(pauta.completedAt, today))
    stageElapsed = elapsed === 0 ? 'Em revisão desde hoje' : `Em revisão há ${daysText(elapsed)}`
  } else if (pauta.stage === 'em_protocolo' && pauta.review?.data_conclusao) {
    const elapsed = Math.max(0, daysBetween(civilDate(pauta.review.data_conclusao)!, today))
    stageElapsed = elapsed === 0 ? 'Em protocolo desde hoje' : `Em protocolo há ${daysText(elapsed)}`
  }

  let currentDeadline: string
  if (pauta.stage === 'finalizada') {
    currentDeadline = pauta.completedAt ? `Fluxo concluído em ${pauta.completedAt.split('-').reverse().join('/')}` : 'Fluxo concluído'
  } else if (pauta.stage === 'cancelada') {
    currentDeadline = 'Pauta cancelada'
  } else if (!pauta.currentDueDate) {
    currentDeadline = 'Prazo da etapa não informado'
  } else {
    const config = stageConfig[pauta.stage]
    const delta = daysBetween(pauta.currentDueDate, today)
    if (delta > 0) currentDeadline = `${config.subject} ${config.late} há ${daysText(delta)}`
    else if (delta === 0) currentDeadline = `${config.subject} vence hoje`
    else currentDeadline = `${config.subject} vence em ${daysText(Math.abs(delta))}`
  }

  let authorDelivery: string | null = null
  if (pauta.completedAt && pauta.dueDate) {
    const delta = daysBetween(pauta.dueDate, pauta.completedAt)
    if (delta > 0) authorDelivery = `Envio entregue com ${daysText(delta)} de atraso`
    else if (delta === 0) authorDelivery = 'Envio entregue no prazo'
    else authorDelivery = `Envio entregue ${daysText(Math.abs(delta))} antes do prazo`
  }

  return { stageElapsed, currentDeadline, authorDelivery }
}

export function computeMarketingPautaGoal(range: InstagramPeriodRange): number {
  const fromText = civilDate(range.from)
  const toText = civilDate(range.to)
  if (!fromText || !toText) return 10
  const from = new Date(`${fromText}T12:00:00Z`)
  const to = new Date(`${toText}T12:00:00Z`)
  if (to < from) return 0

  const lastDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate()
  if (from.getUTCDate() === 1 && to.getUTCDate() === lastDay) {
    const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12
      + to.getUTCMonth() - from.getUTCMonth() + 1
    return months * 10
  }

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  return Math.round((days / MONTH_DAYS) * 100) / 10
}

export function summarizeMarketingPautas(
  pautas: MarketingPauta[],
  range: InstagramPeriodRange,
  now = new Date(),
): MarketingPautaSummary {
  const delivered = pautas.filter((pauta) => pauta.stage !== 'cancelada' && isDateInRange(pauta.completedAt, range)).length
  const scoped = pautas.filter((pauta) => isDateInRange(pauta.dueDate, range))
  const target = computeMarketingPautaGoal(range)
  const stages: Record<MarketingPautaStage, number> = {
    aguardando_envio: 0,
    em_revisao: 0,
    em_protocolo: 0,
    finalizada: 0,
    cancelada: 0,
  }
  for (const pauta of scoped) stages[pauta.stage] += 1

  const today = todayUtc(now)
  const dueSoonLimit = new Date(`${today}T12:00:00Z`)
  dueSoonLimit.setUTCDate(dueSoonLimit.getUTCDate() + 7)
  const dueSoonDate = todayUtc(dueSoonLimit)
  const active = scoped.filter((pauta) => !['finalizada', 'cancelada'].includes(pauta.stage))

  return {
    delivered,
    target,
    progressPct: target > 0 ? Math.min(100, (delivered / target) * 100) : 0,
    cancelled: stages.cancelada,
    overdue: active.filter((pauta) => pauta.currentDueDate && pauta.currentDueDate < today).length,
    dueSoon: active.filter((pauta) => pauta.currentDueDate && pauta.currentDueDate >= today && pauta.currentDueDate <= dueSoonDate).length,
    missingAssignee: active.filter((pauta) => !pauta.responsavel).length,
    stages,
  }
}

export function compareMarketingPautaPeriods(
  pautas: MarketingPauta[],
  currentRange: InstagramPeriodRange,
  previousRange: InstagramPeriodRange,
) {
  const deliveredIn = (range: InstagramPeriodRange) => pautas.filter(
    (pauta) => pauta.stage !== 'cancelada' && isDateInRange(pauta.completedAt, range),
  ).length
  const current = deliveredIn(currentRange)
  const previous = deliveredIn(previousRange)
  return { current, previous, changePct: pctChange(current, previous) }
}

export function rankMarketingPautaDeliveries(
  pautas: MarketingPauta[],
  range: InstagramPeriodRange,
) {
  const grouped = new Map<string, number>()
  for (const pauta of pautas) {
    if (!pauta.responsavel || pauta.stage === 'cancelada' || !isDateInRange(pauta.completedAt, range)) continue
    grouped.set(pauta.responsavel, (grouped.get(pauta.responsavel) ?? 0) + 1)
  }
  return [...grouped.entries()]
    .map(([name, delivered]) => ({ name, delivered }))
    .sort((a, b) => b.delivered - a.delivered || a.name.localeCompare(b.name, 'pt-BR'))
}

export function marketingPautasInRange(pautas: MarketingPauta[], range: InstagramPeriodRange) {
  return pautas.filter((pauta) => pauta.stage !== 'cancelada'
    && (isDateInRange(pauta.dueDate, range) || isDateInRange(pauta.completedAt, range)))
}
