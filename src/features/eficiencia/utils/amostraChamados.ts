import {
  EFICIENCIA_AMOSTRA_FRACAO,
  EFICIENCIA_EVIDENCIA_POR_JUSTIFICATIVA,
  EFICIENCIA_TZ,
} from '../constants'
import { isJustificativaOnboarding } from './onboardingExclusoes'

export type FatalExcludenteRow = {
  ci: string
  area: string
  grupoCliente: string
  tarefa: string
  tarefaPai: string
  nroCnj: string
  responsavel: string
  dataParaConclusao: string | null
  conclusaoCompleta: string | null
  justificativa: string
  atrasoDias: number | null
}

export type AmostraChamadoItem = FatalExcludenteRow & {
  evidencia: string
  textoChamado: string
  naAmostra: boolean
}

export type AmostraEstratoResumo = {
  justificativa: string
  populacao: number
  amostra: number
  pctAmostra: number
}

/** Resultado por item da Edge Function abrir-chamados-evidencia (RESPONSUM). */
export type AbrirChamadosResultadoItem = {
  ci: string
  ok: boolean
  ticket_id?: string
  ja_existia?: boolean
  erro?: string
}

export type AbrirChamadosResultado = {
  criados: number
  ja_existiam: number
  total: number
  resultados: AbrirChamadosResultadoItem[]
}

/** Decisão de auditoria recebida do RESPONSUM (Finalizar → Evidência enviada?). */
export type EvidenciaFatalDecisaoCodigo = 'excludente_mantida' | 'incluido_no_fatal'

export type EvidenciaFatalDecisao = {
  id: string
  ci: string
  ticket_id: string
  evidencia_enviada: boolean
  decisao: EvidenciaFatalDecisaoCodigo
  ano: number | null
  mes: number | null
  decidido_em: string
  decidido_por_id: string | null
  decidido_por_nome: string | null
  category: string | null
  subcategory: string | null
}

function justificativaKey(justificativa: string): string {
  return justificativa.trim().toLocaleUpperCase('pt-BR')
}

export function evidenciaParaJustificativa(justificativa: string): string {
  return (
    EFICIENCIA_EVIDENCIA_POR_JUSTIFICATIVA[justificativaKey(justificativa)] ??
    'Fornecer evidência documental que comprove a justificativa registrada no FATAL.'
  )
}

function parseDate(value: string | null | undefined): Date | null {
  if (value == null || !String(value).trim()) return null
  const raw = String(value).trim()
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Atraso em dias (fração), conclusão − prazo. */
export function calcularAtrasoDias(
  dataParaConclusao: string | null | undefined,
  conclusaoCompleta: string | null | undefined,
): number | null {
  const prazo = parseDate(dataParaConclusao)
  const conclusao = parseDate(conclusaoCompleta)
  if (!prazo || !conclusao) return null
  return (conclusao.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24)
}

function formatDateBr(value: string | null, withTime: boolean): string {
  const d = parseDate(value)
  if (!d) return '—'
  return withTime
    ? d.toLocaleString('pt-BR', {
        timeZone: EFICIENCIA_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : d.toLocaleDateString('pt-BR', { timeZone: EFICIENCIA_TZ })
}

export function buildTextoChamado(row: FatalExcludenteRow, evidencia: string): string {
  const atraso =
    row.atrasoDias == null
      ? '—'
      : `${row.atrasoDias.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} dia(s)`

  return [
    `[EVIDÊNCIA SLA FATAL] Protocolo ${row.nroCnj || '—'} – CI ${row.ci} – ${row.grupoCliente || '—'}`,
    `Área: ${row.area || '—'}`,
    `Processo (CNJ): ${row.nroCnj || '—'}`,
    `Grupo Cliente: ${row.grupoCliente || '—'}`,
    `Tarefa: ${row.tarefa || '—'} (${row.tarefaPai || '—'})`,
    `Responsável pela conclusão: ${row.responsavel || '—'}`,
    `Prazo (data para conclusão): ${formatDateBr(row.dataParaConclusao, false)}`,
    `Conclusão efetiva: ${formatDateBr(row.conclusaoCompleta, true)}`,
    `Atraso: ${atraso}`,
    `Classificação SLA: FATAL`,
    `Justificativa registrada: ${row.justificativa || '—'}`,
    `Evidência solicitada: ${evidencia}`,
    `Prazo para resposta: 5 dias úteis.`,
  ].join('\n')
}

function tamanhoAmostraEstrato(populacao: number): number {
  if (populacao <= 0) return 0
  return Math.max(1, Math.round(populacao * EFICIENCIA_AMOSTRA_FRACAO))
}

export type AmostraPersistida = {
  ci: string
  naAmostra: boolean
  snapshot: FatalExcludenteRow | null
}

export type AmostraParaPersistir = {
  ci: string
  naAmostra: boolean
  snapshot: FatalExcludenteRow
}

/**
 * Amostra estratificada Área × Justificativa (~30%, mín. 1), na ordem da lista.
 * Onboarding / transição de carteira fica de fora (não pede evidência).
 * Retorna os FATAL excludentes elegíveis com `naAmostra` marcado.
 */
export function selecionarAmostraExcludentes(rows: FatalExcludenteRow[]): AmostraChamadoItem[] {
  return selecionarAmostraExcludentesIncremental(rows, new Set(), new Set())
}

function cisAmostradosNovos(rows: FatalExcludenteRow[]): Set<string> {
  const grupos = new Map<string, FatalExcludenteRow[]>()
  for (const row of rows) {
    const key = `${row.area}\u0000${justificativaKey(row.justificativa)}`
    const list = grupos.get(key)
    if (list) list.push(row)
    else grupos.set(key, [row])
  }
  const amostrados = new Set<string>()
  for (const list of grupos.values()) {
    const n = tamanhoAmostraEstrato(list.length)
    for (let i = 0; i < n && i < list.length; i++) {
      amostrados.add(list[i]!.ci)
    }
  }
  return amostrados
}

/**
 * Travas da amostra por competência.
 * - Persistida: CI já considerado (sorteado ou não) não entra em novo sorteio.
 * - Sem persistência + chamados no RESPONSUM: congela a população atual e mantém
 *   só os CIs com ticket (não resorteia o restante).
 * - Sem persistência e sem ticket: primeira amostra (~30%).
 */
export function resolverEstadoAmostra(opts: {
  persistidos: AmostraPersistida[]
  ticketCis: ReadonlySet<string>
  currentCis: ReadonlySet<string>
}): { lockedCis: Set<string>; seenCis: Set<string> } {
  const { persistidos, ticketCis, currentCis } = opts

  if (persistidos.length === 0) {
    const lockedCis = new Set<string>()
    for (const ci of ticketCis) {
      if (currentCis.has(ci)) lockedCis.add(ci)
    }
    if (lockedCis.size > 0) {
      return { lockedCis, seenCis: new Set(currentCis) }
    }
    return { lockedCis: new Set(), seenCis: new Set() }
  }

  const seenCis = new Set(persistidos.map((p) => p.ci))
  const lockedCis = new Set<string>()
  for (const p of persistidos) {
    if (p.naAmostra) lockedCis.add(p.ci)
  }
  for (const ci of ticketCis) {
    if (currentCis.has(ci) || seenCis.has(ci)) lockedCis.add(ci)
  }
  return { lockedCis, seenCis }
}

export function mesclarLinhasComSnapshot(
  rows: FatalExcludenteRow[],
  persistidos: AmostraPersistida[],
  lockedCis: ReadonlySet<string>,
): FatalExcludenteRow[] {
  const byCi = new Map(rows.map((row) => [row.ci, row]))
  for (const p of persistidos) {
    if (!lockedCis.has(p.ci) || byCi.has(p.ci) || !p.snapshot) continue
    byCi.set(p.ci, { ...p.snapshot, ci: p.ci })
  }
  return [...byCi.values()]
}

/**
 * Não resorteia o que já foi considerado.
 * Só sorteia ~30% entre itens **novos** (CI fora de `seenCis`).
 * CI travado permanece na amostra mesmo com justificativa de onboarding.
 */
export function selecionarAmostraExcludentesIncremental(
  rows: FatalExcludenteRow[],
  lockedCis: ReadonlySet<string>,
  seenCis: ReadonlySet<string>,
): AmostraChamadoItem[] {
  const novos = rows.filter(
    (row) => !seenCis.has(row.ci) && !isJustificativaOnboarding(row.justificativa),
  )
  const sorteioNovos = cisAmostradosNovos(novos)

  const visiveis = rows.filter(
    (row) => lockedCis.has(row.ci) || !isJustificativaOnboarding(row.justificativa),
  )

  return visiveis.map((row) => {
    const evidencia = evidenciaParaJustificativa(row.justificativa)
    return {
      ...row,
      evidencia,
      textoChamado: buildTextoChamado(row, evidencia),
      naAmostra: lockedCis.has(row.ci) || sorteioNovos.has(row.ci),
    }
  })
}

export function computarAmostraExcludentes(
  rows: FatalExcludenteRow[],
  persistidos: AmostraPersistida[],
  ticketCis: ReadonlySet<string>,
): { detalhes: AmostraChamadoItem[]; paraPersistir: AmostraParaPersistir[] } {
  const currentCis = new Set(rows.map((row) => row.ci))
  const { lockedCis, seenCis } = resolverEstadoAmostra({ persistidos, ticketCis, currentCis })
  const merged = mesclarLinhasComSnapshot(rows, persistidos, lockedCis)
  const detalhes = selecionarAmostraExcludentesIncremental(merged, lockedCis, seenCis)
  const amostraSet = new Set(detalhes.filter((d) => d.naAmostra).map((d) => d.ci))
  const paraPersistir = merged.map((row) => ({
    ci: row.ci,
    naAmostra: amostraSet.has(row.ci),
    snapshot: row,
  }))
  return { detalhes, paraPersistir }
}

export function parseCiFromChamadoTitle(title: string | null | undefined): string | null {
  const m = String(title ?? '').match(/\bCI\s+(\d+)\b/i)
  return m?.[1] ?? null
}

export function snapshotFromJson(ci: string, raw: unknown): FatalExcludenteRow | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    ci,
    area: String(o.area ?? ''),
    grupoCliente: String(o.grupoCliente ?? ''),
    tarefa: String(o.tarefa ?? ''),
    tarefaPai: String(o.tarefaPai ?? ''),
    nroCnj: String(o.nroCnj ?? ''),
    responsavel: String(o.responsavel ?? ''),
    dataParaConclusao:
      o.dataParaConclusao == null || o.dataParaConclusao === ''
        ? null
        : String(o.dataParaConclusao),
    conclusaoCompleta:
      o.conclusaoCompleta == null || o.conclusaoCompleta === ''
        ? null
        : String(o.conclusaoCompleta),
    justificativa: String(o.justificativa ?? ''),
    atrasoDias:
      typeof o.atrasoDias === 'number' && Number.isFinite(o.atrasoDias) ? o.atrasoDias : null,
  }
}

/** Resumo por justificativa (população × amostra) — aba Metodologia. */
export function buildResumoAmostra(itens: AmostraChamadoItem[]): AmostraEstratoResumo[] {
  const map = new Map<string, { populacao: number; amostra: number; label: string }>()
  for (const item of itens) {
    const key = justificativaKey(item.justificativa)
    const cur = map.get(key) ?? { populacao: 0, amostra: 0, label: item.justificativa }
    cur.populacao += 1
    if (item.naAmostra) cur.amostra += 1
    map.set(key, cur)
  }

  const rows = [...map.values()]
    .map((r) => ({
      justificativa: r.label,
      populacao: r.populacao,
      amostra: r.amostra,
      pctAmostra: r.populacao > 0 ? r.amostra / r.populacao : 0,
    }))
    .sort((a, b) => b.populacao - a.populacao)

  const totPop = rows.reduce((s, r) => s + r.populacao, 0)
  const totAmo = rows.reduce((s, r) => s + r.amostra, 0)
  if (totPop > 0) {
    rows.push({
      justificativa: 'TOTAL',
      populacao: totPop,
      amostra: totAmo,
      pctAmostra: totAmo / totPop,
    })
  }
  return rows
}

export function mapSlaRowToFatalExcludente(
  row: Record<string, unknown>,
): FatalExcludenteRow | null {
  if (row.fatal_apos18 !== 'FATAL') return null
  if (row.excludente !== 'Excludente') return null
  const ci = String(row.ci ?? '').trim()
  if (!ci) return null
  const dataParaConclusao =
    row.data_para_conclusao == null ? null : String(row.data_para_conclusao)
  const conclusaoCompleta =
    row.conclusao_completa == null ? null : String(row.conclusao_completa)
  return {
    ci,
    area: String(row.area_conclusao ?? ''),
    grupoCliente: String(row.grupo_cliente ?? ''),
    tarefa: String(row.tarefa ?? ''),
    tarefaPai: String(row.tarefa_pai ?? ''),
    nroCnj: String(row.nro_cnj ?? ''),
    responsavel: String(row.usuario_conclusao ?? ''),
    dataParaConclusao,
    conclusaoCompleta,
    justificativa: String(row.justificativa_fatal ?? ''),
    atrasoDias: calcularAtrasoDias(dataParaConclusao, conclusaoCompleta),
  }
}
