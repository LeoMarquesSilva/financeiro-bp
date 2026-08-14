import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_AGENDAMENTO,
  EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_PDI,
  EFICIENCIA_META_RECEITA_BRUTA,
  EFICIENCIA_META_SLA_PROTOCOLO,
  EFICIENCIA_META_VISTAGEM,
  MESES_EFICIENCIA_ARQUIVO,
  type MesFiltroEficiencia,
} from '../constants'
import type { EficienciaOverview } from '../types/eficiencia.types'
import { cellApresentacaoKpi } from './apresentacaoMatrix'
import {
  cellApresentacaoCrescimentoReceita,
  cellApresentacaoIndiceInadimplencia,
  type ApresentacaoFinanceiroBundle,
} from './apresentacaoFinanceiro'
import { atingiuMetaKpi } from './overviewKpiMeta'

export type BonusDirecao = 'maior' | 'menor'

export type BonusIndicadorId =
  | 'receita'
  | 'inadimplencia'
  | 'sla_protocolo'
  | 'eficiencia_protocolo'
  | 'sla_ciencia'
  | 'sla_risco'
  | 'sla_comum'
  | 'retencao'
  | 'pdi'
  | 'desenvolvimento'
  | 'nps'
  | 'avaliacao_competencia'
  | 'reputacao'
  | 'exito'

export type BonusIndicadorRow = {
  id: BonusIndicadorId
  label: string
  meta: number
  resultado: number | null
  direcao: BonusDirecao
  peso: number
  contribuicao: number
  bateu: boolean | null
  /** Indicador fixo (sem fonte no SIOE) — valores do print. */
  fixo?: boolean
}

export type ApresentacaoBonusData = {
  periodoLabel: string
  mesInicio: number
  mesFim: number
  ano: number
  receitaPct: number | null
  /** Liberação de bônus: receita ≥ 95% da meta. */
  portaAberta: boolean
  notaPonderada: number
  indicadores: BonusIndicadorRow[]
  pesoTotal: number
  /** null = em branco (porta fechada). */
  bonusLabel: string | null
  parcelas: 1 | 2
  parcelaDatasLabel: string | null
}

/** Pesos do Programa de Bônus (soma 100%). */
export const BONUS_PESOS: Record<BonusIndicadorId, number> = {
  receita: 40,
  inadimplencia: 10,
  sla_protocolo: 3,
  eficiencia_protocolo: 3,
  sla_ciencia: 3,
  sla_risco: 3,
  sla_comum: 3,
  retencao: 5,
  pdi: 5,
  desenvolvimento: 5,
  nps: 10,
  avaliacao_competencia: 5,
  reputacao: 2.5,
  exito: 2.5,
}

/** Indicadores sem fonte no SIOE — sempre “bateu” (valores do print / combinado). */
const BONUS_FIXOS: BonusIndicadorRow[] = [
  {
    id: 'nps',
    label: 'NPS',
    meta: 85,
    resultado: 100,
    direcao: 'maior',
    /** Peso do programa = 10%; contribuição fixa pedida = 5%. */
    peso: BONUS_PESOS.nps,
    contribuicao: 5,
    bateu: true,
    fixo: true,
  },
  {
    id: 'avaliacao_competencia',
    label: 'Avaliação de Competência',
    meta: 5,
    resultado: 100,
    direcao: 'maior',
    peso: BONUS_PESOS.avaliacao_competencia,
    contribuicao: BONUS_PESOS.avaliacao_competencia,
    bateu: true,
    fixo: true,
  },
  {
    id: 'reputacao',
    label: 'Reputação',
    meta: 0,
    resultado: 100,
    direcao: 'maior',
    peso: BONUS_PESOS.reputacao,
    contribuicao: BONUS_PESOS.reputacao,
    bateu: true,
    fixo: true,
  },
  {
    id: 'exito',
    label: 'Êxito',
    meta: 0,
    resultado: 100,
    direcao: 'maior',
    peso: BONUS_PESOS.exito,
    contribuicao: BONUS_PESOS.exito,
    bateu: true,
    fixo: true,
  },
]

export const BONUS_GATILHO_RECEITA_PCT = 95

export function mesesRangeBonus(mesInicio: number, mesFim: number): number[] {
  const a = Math.min(mesInicio, mesFim)
  const b = Math.max(mesInicio, mesFim)
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

export function labelPeriodoBonus(mesInicio: number, mesFim: number, ano: number): string {
  const a = Math.min(mesInicio, mesFim)
  const b = Math.max(mesInicio, mesFim)
  const nome = (m: number) => {
    const raw = MESES_EFICIENCIA_ARQUIVO[m - 1] ?? String(m)
    const s = raw.toLocaleLowerCase('pt-BR')
    return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1)
  }
  if (a === b) return `${nome(a)}/${String(ano).slice(2)}`
  return `${nome(a)}–${nome(b)}/${String(ano).slice(2)}`
}

function rowFromValue(
  id: BonusIndicadorId,
  label: string,
  meta: number,
  resultado: number | null,
  direcao: BonusDirecao,
): BonusIndicadorRow {
  const peso = BONUS_PESOS[id]
  const comparacao = direcao === 'menor' ? 'maximo' : 'minimo'
  const bateu = atingiuMetaKpi(resultado, meta, comparacao)
  /** Como no print: bateu → contribuição = peso; senão 0. */
  const contribuicao = bateu ? peso : 0
  return {
    id,
    label,
    meta,
    resultado,
    direcao,
    peso,
    contribuicao,
    bateu,
  }
}

/**
 * Monta o Programa de Bônus consolidado no período (visão escritório).
 * NPS sem série no overview → resultado null.
 */
export function buildApresentacaoBonus(
  overview: EficienciaOverview | null | undefined,
  financeiro: ApresentacaoFinanceiroBundle | null | undefined,
  ano: number,
  mesInicio: number,
  mesFim: number,
): ApresentacaoBonusData {
  const meses = mesesRangeBonus(mesInicio, mesFim)
  const mesFiltro: MesFiltroEficiencia = meses
  const periodoLabel = labelPeriodoBonus(mesInicio, mesFim, ano)

  const receitaCell = cellApresentacaoCrescimentoReceita(
    '__consolidado__',
    financeiro,
    mesFiltro,
    ano,
  )
  const inadCell = cellApresentacaoIndiceInadimplencia(
    '__consolidado__',
    financeiro,
    mesFiltro,
    ano,
  )

  const kpi = (id: Parameters<typeof cellApresentacaoKpi>[0]) =>
    cellApresentacaoKpi(id, overview, '__consolidado__', mesFiltro, ano)

  const dinamicos: BonusIndicadorRow[] = [
    rowFromValue(
      'receita',
      'Receita',
      EFICIENCIA_META_RECEITA_BRUTA,
      receitaCell.value,
      'maior',
    ),
    rowFromValue(
      'inadimplencia',
      'Inadimplência',
      EFICIENCIA_META_INDICE_INADIMPLENCIA,
      inadCell.value,
      'menor',
    ),
    rowFromValue(
      'sla_protocolo',
      'SLA Protocolo',
      EFICIENCIA_META_SLA_PROTOCOLO,
      kpi('sla_protocolo').value,
      'maior',
    ),
    rowFromValue(
      'eficiencia_protocolo',
      'Eficiência Protocolo',
      EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
      kpi('eficiencia_protocolo').value,
      'maior',
    ),
    rowFromValue(
      'sla_ciencia',
      'SLA Ciência',
      EFICIENCIA_META_AGENDAMENTO,
      kpi('sla_ciencia').value,
      'maior',
    ),
    rowFromValue(
      'sla_risco',
      'SLA Risco',
      EFICIENCIA_META_VISTAGEM,
      kpi('sla_vistagem_risco').value,
      'maior',
    ),
    rowFromValue(
      'sla_comum',
      'SLA Comum',
      EFICIENCIA_META_VISTAGEM,
      kpi('sla_vistagem_normal').value,
      'maior',
    ),
    rowFromValue(
      'retencao',
      'Retenção',
      overview?.turnover?.meta_pct_retencao_minima ?? 90,
      kpi('retencao').value,
      'maior',
    ),
    rowFromValue('pdi', 'PDI', EFICIENCIA_META_PDI, kpi('gestao_pdi').value, 'maior'),
    rowFromValue(
      'desenvolvimento',
      'Desenvolvimento',
      100,
      kpi('desenvolvimento').value,
      'maior',
    ),
  ]

  const indicadores = [...dinamicos, ...BONUS_FIXOS]
  const notaPonderada =
    Math.round(indicadores.reduce((s, r) => s + r.contribuicao, 0) * 100) / 100
  const pesoTotal = Math.round(indicadores.reduce((s, r) => s + r.peso, 0) * 10) / 10

  const receitaPct = receitaCell.value
  const portaAberta =
    receitaPct != null && receitaPct >= BONUS_GATILHO_RECEITA_PCT

  const bateuMetaReceita =
    receitaPct != null && receitaPct >= EFICIENCIA_META_RECEITA_BRUTA

  let bonusLabel: string | null = null
  if (portaAberta) {
    bonusLabel = bateuMetaReceita ? '1 salário' : '½ salário'
  }

  const parcelas: 1 | 2 = bateuMetaReceita ? 1 : 2
  const parcelaDatasLabel =
    parcelas === 2
      ? `1ª 18/12/${ano} | 2ª 18/01/${ano + 1}`
      : `Pagamento único · 18/12/${ano}`

  return {
    periodoLabel,
    mesInicio: Math.min(mesInicio, mesFim),
    mesFim: Math.max(mesInicio, mesFim),
    ano,
    receitaPct,
    portaAberta,
    notaPonderada,
    indicadores,
    pesoTotal,
    bonusLabel,
    parcelas,
    parcelaDatasLabel,
  }
}

export function formatBonusPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatPercent(value)
}
