import {
  EFICIENCIA_AMOSTRA_FRACAO,
  EFICIENCIA_EVIDENCIA_POR_JUSTIFICATIVA,
} from '../constants'

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
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : d.toLocaleDateString('pt-BR')
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

/**
 * Amostra estratificada Área × Justificativa (~30%, mín. 1), na ordem da lista.
 * Retorna todos os FATAL excludentes com `naAmostra` marcado.
 */
export function selecionarAmostraExcludentes(rows: FatalExcludenteRow[]): AmostraChamadoItem[] {
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

  return rows.map((row) => {
    const evidencia = evidenciaParaJustificativa(row.justificativa)
    return {
      ...row,
      evidencia,
      textoChamado: buildTextoChamado(row, evidencia),
      naAmostra: amostrados.has(row.ci),
    }
  })
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
