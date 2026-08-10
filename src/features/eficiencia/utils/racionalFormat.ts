import { EFICIENCIA_TZ } from '../constants'
import { stripJsonArrayDecorators } from './textFormat'

/** BI DePara Cadastro: vazio ou SEM ADESÃO = OK; demais = Inconsistência. */
export function isOpsLegaisCadastroDeParaOk(adesao: unknown): boolean {
  const v = String(adesao ?? '').trim()
  if (!v) return true
  return v.toLocaleUpperCase('pt-BR') === 'SEM ADESÃO'
}

export function formatRacionalCell(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleString('pt-BR', {
          timeZone: EFICIENCIA_TZ,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00`)
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleDateString('pt-BR', { timeZone: EFICIENCIA_TZ })
  }
  if (typeof value === 'string' && (value.includes('[') || value.includes('"'))) {
    const cleaned = stripJsonArrayDecorators(value)
    if (cleaned !== value.trim()) return cleaned
  }
  return String(value)
}

export function isVistadoD1Sim(value: unknown): boolean {
  const s = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  return s === 'sim' || s === 'true'
}

/** Contagem Sim/Não alinhada ao KPI e ao resumo do racional. */
export function countVistagemD1(linhas: Array<Record<string, unknown>>): {
  sim: number
  nao: number
} {
  let sim = 0
  let nao = 0
  for (const row of linhas) {
    if (isVistadoD1Sim(row.vistado_d1)) sim += 1
    else nao += 1
  }
  return { sim, nao }
}

export function isRacionalLinhaForaMeta(
  indicador: string,
  row: Record<string, unknown>,
): boolean {
  switch (indicador) {
    case 'sla_protocolo':
      return row.excludente === 'Excludente'
    case 'eficiencia_protocolo':
      return String(row.status_inconsistencia ?? '').toUpperCase().includes('INCONSIST')
    case 'ops_legais_sla_protocolo':
      return String(row.eficiencia_sla ?? '').trim() === 'PROTOCOLADO NO FATAL'
    case 'ops_legais_eficiencia_protocolo':
      return Boolean(String(row.inconsistencia_controladoria ?? '').trim())
    case 'ops_legais_pub_analise':
    case 'ops_legais_pub_agendamento':
      return (
        String(row.eficiencia ?? '').trim() === 'DESVIO' ||
        Boolean(String(row.inconsistencias_tipo ?? '').trim()) ||
        Boolean(String(row.inconsistencia_subtipo ?? '').trim())
      )
    case 'ops_legais_cadastro':
      return !isOpsLegaisCadastroDeParaOk(row.adesao_indicador)
    case 'sla_ciencia_agendamentos':
      return String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')
    case 'sla_vistagem_risco':
    case 'sla_vistagem_normal':
      return !isVistadoD1Sim(row.vistado_d1)
    default:
      return false
  }
}

export function racionalLinhaForaMetaTitle(indicador: string): string | undefined {
  switch (indicador) {
    case 'sla_protocolo':
      return 'Excludente — não entra na % do KPI'
    case 'eficiencia_protocolo':
      return 'Inconsistência — fora da meta'
    case 'ops_legais_sla_protocolo':
      return 'PROTOCOLADO NO FATAL — fora do SLA PROTOCOLO'
    case 'ops_legais_eficiencia_protocolo':
      return 'Inconsistência Controladoria — fora da meta'
    case 'ops_legais_pub_analise':
    case 'ops_legais_pub_agendamento':
      return 'DESVIO — fora da eficiência de publicação'
    case 'ops_legais_cadastro':
      return 'Inconsistência — fora da conformidade de cadastro'
    case 'sla_ciencia_agendamentos':
      return 'Fora do prazo — fora da meta'
    case 'sla_vistagem_risco':
    case 'sla_vistagem_normal':
      return 'Não vistado D+1 — fora da meta'
    default:
      return undefined
  }
}

export function formatRacionalResumoLabel(resumo: {
  qtd_d1?: number
  qtd_fatal?: number
  qtd_excludente?: number
  qtd_eficiencia?: number
  qtd_inconsistencia?: number
  qtd_vistado_sim?: number
  qtd_vistado_nao?: number
  qtd_total?: number
}): string | null {
  if (resumo.qtd_d1 != null && resumo.qtd_fatal != null) {
    const partes = [
      `${resumo.qtd_d1} protocolo${resumo.qtd_d1 === 1 ? '' : 's'} em D-1`,
      `${resumo.qtd_fatal} protocolo${resumo.qtd_fatal === 1 ? '' : 's'} em FATAL`,
    ]
    if (resumo.qtd_excludente != null) {
      partes.push(
        `${resumo.qtd_excludente} excludente${resumo.qtd_excludente === 1 ? '' : 's'} (fora da %)`,
      )
    }
    return `Total: ${partes.join(' · ')}`
  }

  // Ops Legais RG — SLA PROTOCOLO (D1 vs PROTOCOLADO NO FATAL)
  if (resumo.qtd_d1 != null && resumo.qtd_total != null && resumo.qtd_fatal == null) {
    const fatal = resumo.qtd_total - resumo.qtd_d1
    return `Total: ${resumo.qtd_d1} D1 · ${fatal} PROTOCOLADO NO FATAL · ${resumo.qtd_total} protocolo${resumo.qtd_total === 1 ? '' : 's'}`
  }

  // Escopo FATAL não-excludente (gráficos Justificativa / Responsáveis)
  if (resumo.qtd_fatal != null && resumo.qtd_d1 == null) {
    return `Total: ${resumo.qtd_fatal} FATAL não-excludente${resumo.qtd_fatal === 1 ? '' : 's'}`
  }

  if (resumo.qtd_inconsistencia != null && resumo.qtd_eficiencia != null) {
    const total = resumo.qtd_total ?? resumo.qtd_inconsistencia + resumo.qtd_eficiencia
    return `Total: ${resumo.qtd_eficiencia} eficiência · ${resumo.qtd_inconsistencia} fora da meta · ${total} registro${total === 1 ? '' : 's'}`
  }

  if (resumo.qtd_vistado_sim != null && resumo.qtd_vistado_nao != null) {
    const total = resumo.qtd_total ?? resumo.qtd_vistado_sim + resumo.qtd_vistado_nao
    return `Total: ${resumo.qtd_vistado_sim} Sim · ${resumo.qtd_vistado_nao} Não · ${total} publicação${total === 1 ? '' : 'ões'}`
  }

  return null
}
