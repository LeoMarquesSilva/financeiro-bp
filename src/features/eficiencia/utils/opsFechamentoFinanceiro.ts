/**
 * Fechamento financeiro mensal (Ops Legais / Financeiro).
 *
 * Competência = mês anterior ao mês da data limite (fechamento de jun/26 → prazos em jul/26).
 * KPI na tarefa final; as demais precisam estar concluídas para validar a entrega.
 */

import {
  OPS_FECHAMENTO_AUTOMACAO_ANO_CORTE,
  OPS_FECHAMENTO_AUTOMACAO_MES_INICIO,
  OPS_FECHAMENTO_HISTORICO_MANUAL,
  OPS_LEGAIS_FECHAMENTO_TAREFA_KPI,
  OPS_LEGAIS_FECHAMENTO_TAREFAS,
} from '../constants'
import type { OpsLegaisFechamentoMesRow } from '../types/eficiencia.types'

export type FechamentoStatusPrazo = 'Dentro do prazo' | 'Fora do prazo' | 'Pendente'

function isoDate(value: unknown): string {
  return String(value ?? '').slice(0, 10)
}

function parseIsoDate(value: unknown): Date | null {
  const iso = isoDate(value)
  if (!iso || iso.length < 10) return null
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Mês de competência (1–12) a partir da data limite do ciclo. */
export function fechamentoCompetenciaMes(dataLimite: unknown): number | null {
  const limite = parseIsoDate(dataLimite)
  if (!limite) return null
  const ref = new Date(limite.getFullYear(), limite.getMonth() - 1, 1)
  return ref.getMonth() + 1
}

/** Ano de competência a partir da data limite do ciclo. */
export function fechamentoCompetenciaAno(dataLimite: unknown): number | null {
  const limite = parseIsoDate(dataLimite)
  if (!limite) return null
  const ref = new Date(limite.getFullYear(), limite.getMonth() - 1, 1)
  return ref.getFullYear()
}

/** Chave do ciclo (mês das datas limite) para agrupar as 9 tarefas. */
export function fechamentoCicloKey(dataLimite: unknown): string | null {
  const iso = isoDate(dataLimite)
  if (!iso || iso.length < 7) return null
  return iso.slice(0, 7)
}

export function fechamentoEtapaOrdem(tarefa: unknown): number {
  const nome = String(tarefa ?? '').trim()
  const idx = OPS_LEGAIS_FECHAMENTO_TAREFAS.indexOf(
    nome as (typeof OPS_LEGAIS_FECHAMENTO_TAREFAS)[number],
  )
  return idx >= 0 ? idx + 1 : 99
}

export function fechamentoDentroPrazoTarefa(
  dataConclusao: unknown,
  dataLimite: unknown,
): boolean {
  const conclusao = isoDate(dataConclusao)
  const limite = isoDate(dataLimite)
  if (!conclusao || !limite) return false
  return conclusao <= limite
}

export function fechamentoStatusLabel(
  dataConclusao: unknown,
  dataLimite: unknown,
): FechamentoStatusPrazo {
  if (!isoDate(dataConclusao)) return 'Pendente'
  return fechamentoDentroPrazoTarefa(dataConclusao, dataLimite)
    ? 'Dentro do prazo'
    : 'Fora do prazo'
}

export function fechamentoTarefaEhKpi(tarefa: unknown): boolean {
  return String(tarefa ?? '').trim() === OPS_LEGAIS_FECHAMENTO_TAREFA_KPI
}

type FechamentoLinha = {
  tarefa?: unknown
  data_conclusao?: unknown
  data_limite?: unknown
}

/** KPI do ciclo: somente a tarefa final no prazo (demais etapas = racional). */
export function fechamentoCicloDentroPrazo(linhas: FechamentoLinha[]): boolean {
  const kpi = linhas.find((row) => fechamentoTarefaEhKpi(row.tarefa))
  if (!kpi || !isoDate(kpi.data_conclusao)) return false
  return fechamentoDentroPrazoTarefa(kpi.data_conclusao, kpi.data_limite)
}

export function fechamentoStatusCicloLabel(linhas: FechamentoLinha[]): string {
  const kpi = linhas.find((row) => fechamentoTarefaEhKpi(row.tarefa))
  if (!kpi) return 'KPI ausente'
  if (!isoDate(kpi.data_conclusao)) return 'Pendente'
  return fechamentoDentroPrazoTarefa(kpi.data_conclusao, kpi.data_limite)
    ? 'Dentro do prazo (KPI)'
    : 'Fora do prazo (KPI)'
}

/** true quando o mês usa RPC/VIOS (set/26 em diante no ano de corte). */
export function fechamentoMesUsaAutomacao(ano: number, mes: number): boolean {
  if (ano > OPS_FECHAMENTO_AUTOMACAO_ANO_CORTE) return true
  if (ano < OPS_FECHAMENTO_AUTOMACAO_ANO_CORTE) return false
  return mes >= OPS_FECHAMENTO_AUTOMACAO_MES_INICIO
}

export function fechamentoPctManual(ano: number, mes: number): number | null {
  const pct = OPS_FECHAMENTO_HISTORICO_MANUAL[ano]?.[mes]
  return pct == null ? null : pct
}

function fechamentoRowFromPct(mes: number, pct: number): OpsLegaisFechamentoMesRow {
  const dentro = pct >= 100 ? 1 : 0
  return {
    mes,
    total_fechamentos: 1,
    qtd_dentro_prazo: dentro,
    qtd_fora_prazo: dentro === 1 ? 0 : 1,
    pct_fechamento: pct,
  }
}

/** Mescla histórico manual (jun–ago/26) com série automática (set/26+). */
export function mergeOpsFechamentoMensal(
  ano: number,
  rpcRows: OpsLegaisFechamentoMesRow[],
): OpsLegaisFechamentoMesRow[] {
  const byMes = new Map<number, OpsLegaisFechamentoMesRow>()

  for (const row of rpcRows) {
    if (fechamentoMesUsaAutomacao(ano, row.mes)) {
      byMes.set(row.mes, row)
    }
  }

  const manualAno = OPS_FECHAMENTO_HISTORICO_MANUAL[ano]
  if (manualAno) {
    for (const [mesStr, pct] of Object.entries(manualAno)) {
      const mes = Number(mesStr)
      if (!fechamentoMesUsaAutomacao(ano, mes) && pct != null) {
        byMes.set(mes, fechamentoRowFromPct(mes, pct))
      }
    }
  }

  return [...byMes.values()].sort((a, b) => a.mes - b.mes)
}
