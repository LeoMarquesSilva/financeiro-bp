/**
 * Indicadores operacionais do planejamento: as mesmas contas do painel de Eficiência Operacional
 * (Overview) e de Operações Legais, para 2025 × 2026 e a meta 2027.
 * Funções puras (imports com .ts) para rodar com `node --test`.
 */
import type {
  AgendamentoMesRow,
  EficienciaProtocoloMesRow,
  GestaoPdiMesRow,
  OpsLegaisAntecipacaoMesRow,
  OpsLegaisProtocoloMesRow,
  OpsLegaisPublicacoesEficMesRow,
  SlaProtocoloMesRow,
  SlaVistagemMesRow,
  TreinamentosAnualRow,
  TreinamentosMesRow,
  TurnoverAnualRow,
} from '../../eficiencia/types/eficiencia.types.ts'

export type UnidadeIndicador = '%' | 'min' | 'h' | 'pts'

export type IndicadorId =
  | 'sla_protocolo'
  | 'eficiencia_protocolo'
  | 'sla_ciencia_agendamentos'
  | 'sla_vistagem_risco'
  | 'sla_vistagem_normal'
  | 'desenvolvimento_equipe'
  | 'retencao'
  | 'gestao_pdi'
  | 'nps'
  | 'ops_sla_protocolo'
  | 'ops_eficiencia_protocolo'
  | 'ops_publicacoes_analise'
  | 'ops_publicacoes_agendamento'
  | 'ops_cadastro'
  | 'ops_antecipacao'
  | 'horas_timesheet'

export type IndicadorDef = {
  id: IndicadorId
  nome: string
  grupo: 'Jurídico' | 'Operações Legais' | 'Pessoas' | 'Clientes'
  unidade: UnidadeIndicador
  /** Meta atual do SIOE (constantes do painel de Eficiência). */
  metaAtual: number | null
  /** Tem valor por área jurídica. */
  porArea: boolean
  formula: string
}

/** Metas atuais (src/features/eficiencia/constants.ts). Repetidas aqui para rodar sem alias nos testes. */
export const INDICADORES: readonly IndicadorDef[] = [
  { id: 'sla_protocolo', nome: 'SLA Protocolo', grupo: 'Jurídico', unidade: '%', metaAtual: 85, porArea: true, formula: 'Protocolos em D-1 ÷ protocolos do mês' },
  { id: 'eficiencia_protocolo', nome: 'Eficiência Protocolo', grupo: 'Jurídico', unidade: '%', metaAtual: 95, porArea: true, formula: 'Protocolos sem inconsistência ÷ protocolos' },
  { id: 'sla_ciencia_agendamentos', nome: 'SLA Ciência Agendamentos', grupo: 'Jurídico', unidade: '%', metaAtual: 95, porArea: true, formula: 'Ciências dentro do prazo ÷ (dentro + fora)' },
  { id: 'sla_vistagem_risco', nome: 'SLA Vistagem Risco', grupo: 'Jurídico', unidade: '%', metaAtual: 98, porArea: true, formula: 'Publicações de risco vistadas em D-1 ÷ publicações' },
  { id: 'sla_vistagem_normal', nome: 'SLA Vistagem Normal', grupo: 'Jurídico', unidade: '%', metaAtual: 98, porArea: true, formula: 'Publicações comuns vistadas em D-1 ÷ publicações' },
  { id: 'desenvolvimento_equipe', nome: 'Desenvolvimento Equipe (treinamento)', grupo: 'Pessoas', unidade: 'min', metaAtual: 14 * 60, porArea: true, formula: 'Minutos de treinamento lançados por pessoa ativa no ano' },
  { id: 'retencao', nome: 'Retenção de Talentos', grupo: 'Pessoas', unidade: '%', metaAtual: 90, porArea: true, formula: '1 − saídas voluntárias ÷ funcionários ativos' },
  { id: 'gestao_pdi', nome: 'Gestão PDI', grupo: 'Pessoas', unidade: '%', metaAtual: 100, porArea: true, formula: 'Pessoas aptas ÷ pessoas elegíveis' },
  { id: 'nps', nome: 'NPS (clientes)', grupo: 'Clientes', unidade: 'pts', metaAtual: 85, porArea: false, formula: '% promotores − % detratores' },
  { id: 'ops_sla_protocolo', nome: 'Ops Legais — SLA Protocolo', grupo: 'Operações Legais', unidade: '%', metaAtual: 98, porArea: false, formula: 'Protocolos em D-1 ÷ população do SLA' },
  { id: 'ops_eficiencia_protocolo', nome: 'Ops Legais — Eficiência Protocolo', grupo: 'Operações Legais', unidade: '%', metaAtual: 98, porArea: false, formula: 'Sem inconsistência ÷ base da controladoria' },
  { id: 'ops_publicacoes_analise', nome: 'Ops Legais — Publicações (análise)', grupo: 'Operações Legais', unidade: '%', metaAtual: 98, porArea: false, formula: 'Publicações analisadas no prazo ÷ publicações' },
  { id: 'ops_publicacoes_agendamento', nome: 'Ops Legais — Publicações (agendamento)', grupo: 'Operações Legais', unidade: '%', metaAtual: 98, porArea: false, formula: 'Agendamentos no prazo ÷ publicações' },
  { id: 'ops_cadastro', nome: 'Ops Legais — Cadastro', grupo: 'Operações Legais', unidade: '%', metaAtual: 95, porArea: false, formula: 'Cadastros no prazo ÷ (no prazo + fora)' },
  { id: 'ops_antecipacao', nome: 'Ops Legais — Antecipação de faturamento', grupo: 'Operações Legais', unidade: '%', metaAtual: 98, porArea: false, formula: 'Faturáveis antecipados no prazo ÷ faturáveis' },
  { id: 'horas_timesheet', nome: 'Horas lançadas no timesheet', grupo: 'Jurídico', unidade: 'h', metaAtual: null, porArea: true, formula: 'Soma das horas apontadas no VIOS' },
]

export type ValorIndicador = {
  mensal: (number | null)[]
  /** Acumulado do ano (YTD nos meses com dado). */
  acumulado: number | null
}

export const VALOR_VAZIO: ValorIndicador = { mensal: Array.from({ length: 12 }, () => null), acumulado: null }

function razao(num: number, den: number): number | null {
  return den > 0 ? (num / den) * 100 : null
}

function porRazao<T extends { mes: number }>(
  rows: readonly T[],
  numerador: (r: T) => number,
  denominador: (r: T) => number,
): ValorIndicador {
  const mensal: (number | null)[] = Array.from({ length: 12 }, () => null)
  let n = 0
  let d = 0
  for (const r of rows) {
    const i = r.mes - 1
    if (i < 0 || i > 11) continue
    const nu = Number(numerador(r)) || 0
    const de = Number(denominador(r)) || 0
    mensal[i] = razao(nu, de)
    n += nu
    d += de
  }
  return { mensal, acumulado: razao(n, d) }
}

export type DadosJuridico = {
  slaProtocolo: readonly SlaProtocoloMesRow[]
  eficienciaProtocolo: readonly EficienciaProtocoloMesRow[]
  agendamento: readonly AgendamentoMesRow[]
  slaVistagemRisco: readonly SlaVistagemMesRow[]
  slaVistagemComum: readonly SlaVistagemMesRow[]
  treinamentos: TreinamentosAnualRow | null
  treinamentosMensal: readonly TreinamentosMesRow[]
  turnover: TurnoverAnualRow | null
  gestaoPdiMensal: readonly GestaoPdiMesRow[]
}

export type DadosOpsLegais = {
  protocolo: readonly OpsLegaisProtocoloMesRow[]
  publicacoesAnalise: readonly OpsLegaisPublicacoesEficMesRow[]
  publicacoesAgendamento: readonly OpsLegaisPublicacoesEficMesRow[]
  cadastro: readonly AgendamentoMesRow[]
  antecipacao: readonly OpsLegaisAntecipacaoMesRow[]
}

export function valoresJuridico(d: DadosJuridico): Partial<Record<IndicadorId, ValorIndicador>> {
  const treinoMensal: (number | null)[] = Array.from({ length: 12 }, () => null)
  for (const r of d.treinamentosMensal) {
    if (r.mes >= 1 && r.mes <= 12) treinoMensal[r.mes - 1] = Number(r.minutos_lancados) || 0
  }
  const pessoas = Number(d.treinamentos?.pessoas_ativas) || 0
  const minutos = Number(d.treinamentos?.minutos_lancados) || 0
  return {
    sla_protocolo: porRazao(d.slaProtocolo, (r) => r.qtd_d1, (r) => r.qtd_total),
    eficiencia_protocolo: porRazao(d.eficienciaProtocolo, (r) => r.sem_inconsistencia, (r) => r.total),
    sla_ciencia_agendamentos: porRazao(d.agendamento, (r) => r.dentro_prazo, (r) => r.dentro_prazo + r.fora_prazo),
    sla_vistagem_risco: porRazao(d.slaVistagemRisco, (r) => r.vistado_d1, (r) => r.total),
    sla_vistagem_normal: porRazao(d.slaVistagemComum, (r) => r.vistado_d1, (r) => r.total),
    desenvolvimento_equipe: {
      mensal: treinoMensal,
      // Minutos por pessoa ativa no ano (a meta é 14h por pessoa).
      acumulado: pessoas > 0 ? minutos / pessoas : null,
    },
    retencao: {
      mensal: Array.from({ length: 12 }, () => null),
      acumulado: d.turnover ? Number(d.turnover.pct_retencao) : null,
    },
    gestao_pdi: porRazao(d.gestaoPdiMensal, (r) => r.aptas, (r) => r.elegiveis),
  }
}

export function valoresOpsLegais(d: DadosOpsLegais): Partial<Record<IndicadorId, ValorIndicador>> {
  return {
    ops_sla_protocolo: porRazao(d.protocolo, (r) => r.qtd_d1, (r) => r.total),
    ops_eficiencia_protocolo: porRazao(d.protocolo, (r) => r.sem_inconsistencia, (r) => r.total_eficiencia ?? r.total),
    ops_publicacoes_analise: porRazao(d.publicacoesAnalise, (r) => r.qtd_eficiencia, (r) => r.total),
    ops_publicacoes_agendamento: porRazao(d.publicacoesAgendamento, (r) => r.qtd_eficiencia, (r) => r.total),
    ops_cadastro: porRazao(d.cadastro, (r) => r.dentro_prazo, (r) => r.dentro_prazo + r.fora_prazo),
    ops_antecipacao: porRazao(d.antecipacao, (r) => r.qtd_dentro_prazo, (r) => r.total_faturavel),
  }
}

export function valorHoras(porMes: readonly number[]): ValorIndicador {
  const mensal = porMes.map((v) => (v > 0 ? v : null))
  const total = porMes.reduce((s, v) => s + v, 0)
  return { mensal, acumulado: total > 0 ? total : null }
}

export function valorNps(nps: number | null | undefined): ValorIndicador {
  return { mensal: Array.from({ length: 12 }, () => null), acumulado: nps == null ? null : Number(nps) }
}

/** Quanto falta (meta − atual), no sentido "quanto maior, melhor". */
export function quantoFalta(meta: number | null, atual: number | null): number | null {
  if (meta == null || atual == null) return null
  return meta - atual
}

/** Meta efetiva da área: própria, senão a do escritório. */
export function metaEfetivaArea(
  premissa: { escritorio: number | null; areas: Record<string, number | null> } | undefined,
  area: string,
): number | null {
  if (!premissa) return null
  const propria = premissa.areas[area]
  return propria != null ? propria : premissa.escritorio
}

export function formatarIndicador(v: number | null, unidade: UnidadeIndicador): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (unidade === '%') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  if (unidade === 'min') {
    const h = Math.floor(v / 60)
    const m = Math.round(v - h * 60)
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  }
  if (unidade === 'h') return `${Math.round(v).toLocaleString('pt-BR')} h`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** Linhas para `planejamento_metas_operacionais_oficiais`. */
export function linhasMetasOperacionais(
  operacionais: Record<string, { escritorio: number | null; areas: Record<string, number | null> }>,
) {
  const linhas: { indicador: string; area_key: string | null; meta: number; unidade: string }[] = []
  for (const def of INDICADORES) {
    const p = operacionais[def.id]
    if (!p) continue
    if (p.escritorio != null) linhas.push({ indicador: def.id, area_key: null, meta: p.escritorio, unidade: def.unidade })
    for (const [area, meta] of Object.entries(p.areas)) {
      if (meta != null) linhas.push({ indicador: def.id, area_key: area, meta, unidade: def.unidade })
    }
  }
  return linhas
}
