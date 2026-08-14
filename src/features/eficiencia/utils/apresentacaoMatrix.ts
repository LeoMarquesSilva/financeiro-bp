import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_AREA_OPS_LEGAIS,
  EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL,
  EFICIENCIA_META_AGENDAMENTO,
  EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_PDI,
  EFICIENCIA_META_SLA_PROTOCOLO,
  EFICIENCIA_META_VISTAGEM,
  MESES_EFICIENCIA_ARQUIVO,
  MES_INICIO_RESULTADO,
  isAgendamentoVistagemIndisponivelPorArea,
  isMesesFiltro,
  mesFimResultado,
  mesFimYtdFechado,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import type { EficienciaOverview } from '../types/eficiencia.types'
import { acumuladoGestaoPdi } from './gestaoPdiCalc'
import { atingiuMetaKpi } from './overviewKpiMeta'

/** Colunas da slide (ordem do PPT). */
export const APRESENTACAO_COLUNAS = [
  { key: 'Reestruturação', label: 'Reestruturação' },
  { key: 'Cível', label: 'Cível' },
  { key: 'Recuperação de Crédito', label: 'Recuperação de Crédito' },
  { key: 'Trabalhista', label: 'Trabalhista' },
  { key: 'Contratos', label: 'Societário e Contratos' },
  { key: EFICIENCIA_AREA_OPS_LEGAIS, label: 'Operações Legais' },
  { key: '__consolidado__', label: 'Bismarchi | Pires', consolidado: true },
] as const

export type ApresentacaoColunaKey = (typeof APRESENTACAO_COLUNAS)[number]['key']

export type ApresentacaoKpiId =
  | 'sla_protocolo'
  | 'eficiencia_protocolo'
  | 'sla_ciencia'
  | 'sla_vistagem_risco'
  | 'sla_vistagem_normal'
  | 'nps'
  | 'gestao_pdi'
  | 'desenvolvimento'
  | 'retencao'
  | 'crescimento_receita'
  | 'indice_inadimplencia'

export type ApresentacaoSecaoId =
  | 'eficiencia_operacional'
  | 'satisfacao_cliente'
  | 'desenvolver_equipe'
  | 'resultado_financeiro'

/** Bloco 1–8: jurídico, financeiro, composição, big numbers, controladoria, iniciativas, marketing, financeiro ops. */
export type ApresentacaoBlocoId =
  | 'juridico'
  | 'juridico_unificado'
  | 'financeiro'
  | 'composicao'
  | 'bignumber'
  | 'controladoria'
  | 'lideranca'
  | 'iniciativas'
  | 'marketing'
  | 'financeiro_ops'
  | 'programa_bonus'

export const APRESENTACAO_BLOCOS: {
  id: ApresentacaoBlocoId
  label: string
  secoes: ApresentacaoSecaoId[]
  /** Sem grade por área (layout próprio). */
  semGradeAreas?: boolean
}[] = [
  {
    id: 'juridico',
    label: 'Bloco 1 — Operacional',
    secoes: ['eficiencia_operacional', 'satisfacao_cliente', 'desenvolver_equipe'],
  },
  {
    id: 'juridico_unificado',
    label: 'Bloco 2 — Jurídico Unificado',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'lideranca',
    label: 'Bloco 3 — Liderança',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'financeiro',
    label: 'Bloco 4 — Financeiro',
    secoes: ['resultado_financeiro'],
  },
  {
    id: 'composicao',
    label: 'Bloco 5 — Composição',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'bignumber',
    label: 'Bloco 6 — Big Numbers',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'controladoria',
    label: 'Bloco 7 — Controladoria',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'iniciativas',
    label: 'Bloco 8 — Iniciativas',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'marketing',
    label: 'Bloco 9 — Marketing',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'financeiro_ops',
    label: 'Bloco 10 — Financeiro Ops',
    secoes: [],
    semGradeAreas: true,
  },
  {
    id: 'programa_bonus',
    label: 'Bloco 11 — Programa de Bônus',
    secoes: [],
    semGradeAreas: true,
  },
]

/**
 * Coluna da apresentação → chave de área meta da Receita.
 * `undefined` = consolidado; `null` = sem KPI financeiro (ex.: Ops Legais).
 */
export function receitaAreaKeyFromColuna(
  colKey: ApresentacaoColunaKey,
): string | null | undefined {
  if (colKey === '__consolidado__') return undefined
  if (colKey === EFICIENCIA_AREA_OPS_LEGAIS) return null
  const map: Partial<Record<ApresentacaoColunaKey, string>> = {
    Reestruturação: 'insolvencia',
    Cível: 'civel',
    'Recuperação de Crédito': 'recuperacao_de_credito',
    Trabalhista: 'trabalhista',
    Contratos: 'contratos',
  }
  return map[colKey] ?? null
}

export type ApresentacaoCell = {
  label: string
  value: number | null
  /** true = verde, false = vermelho, null = neutro/traço */
  atingiu: boolean | null
}

export type ApresentacaoKpiDef = {
  id: ApresentacaoKpiId
  secao: ApresentacaoSecaoId
  title: string
  metaLabel: string
  meta: number
  /** Meta de desenvolvimento: horas (menor = pior vs meta anual). */
  metaAbaixoMelhor?: boolean
}

export const APRESENTACAO_SECOES: {
  id: ApresentacaoSecaoId
  label: string
}[] = [
  { id: 'eficiencia_operacional', label: '1. Eficiência Operacional' },
  { id: 'satisfacao_cliente', label: '2. Satisfação do Cliente' },
  { id: 'desenvolver_equipe', label: '3. Desenvolver e Engajar a Equipe' },
  { id: 'resultado_financeiro', label: '4. Resultado Financeiro' },
]

export const APRESENTACAO_KPIS: ApresentacaoKpiDef[] = [
  {
    id: 'sla_protocolo',
    secao: 'eficiencia_operacional',
    title: 'SLA Protocolo Até 18h',
    metaLabel: `${EFICIENCIA_META_SLA_PROTOCOLO}%`,
    meta: EFICIENCIA_META_SLA_PROTOCOLO,
  },
  {
    id: 'eficiencia_protocolo',
    secao: 'eficiencia_operacional',
    title: 'Eficiência Protocolo',
    metaLabel: `${EFICIENCIA_META_EFICIENCIA_PROTOCOLO}%`,
    meta: EFICIENCIA_META_EFICIENCIA_PROTOCOLO,
  },
  {
    id: 'sla_ciencia',
    secao: 'eficiencia_operacional',
    title: 'SLA de Ciência de Agendamentos',
    metaLabel: `${EFICIENCIA_META_AGENDAMENTO}%`,
    meta: EFICIENCIA_META_AGENDAMENTO,
  },
  {
    id: 'sla_vistagem_risco',
    secao: 'eficiencia_operacional',
    title: 'SLA de Vistagem de Publicações Demandas de Risco *',
    metaLabel: `${EFICIENCIA_META_VISTAGEM}%`,
    meta: EFICIENCIA_META_VISTAGEM,
  },
  {
    id: 'sla_vistagem_normal',
    secao: 'eficiencia_operacional',
    title: 'SLA de Vistagem de Publicações Demandas Comuns *',
    metaLabel: `${EFICIENCIA_META_VISTAGEM}%`,
    meta: EFICIENCIA_META_VISTAGEM,
  },
  {
    id: 'nps',
    secao: 'satisfacao_cliente',
    title: 'NPS',
    metaLabel: '85%',
    meta: 85,
  },
  {
    id: 'gestao_pdi',
    secao: 'desenvolver_equipe',
    title: 'Gestão de PDI',
    metaLabel: `${EFICIENCIA_META_PDI}%`,
    meta: EFICIENCIA_META_PDI,
  },
  {
    id: 'desenvolvimento',
    secao: 'desenvolver_equipe',
    title: 'Desenvolvimento Contínuo de Equipe',
    metaLabel: '—',
    meta: 100,
  },
  {
    id: 'retencao',
    secao: 'desenvolver_equipe',
    title: 'Retenção de Talentos',
    metaLabel: '90%',
    meta: 90,
  },
  {
    id: 'crescimento_receita',
    secao: 'resultado_financeiro',
    title: 'Crescimento de Receita',
    metaLabel: '100%',
    meta: 100,
  },
  {
    id: 'indice_inadimplencia',
    secao: 'resultado_financeiro',
    title: 'Índice de Inadimplência',
    metaLabel: `${EFICIENCIA_META_INDICE_INADIMPLENCIA}%`,
    meta: EFICIENCIA_META_INDICE_INADIMPLENCIA,
  },
]

function somaRazao(
  numeros: number[],
  denominadores: number[],
): { value: number | null; label: string } {
  const num = numeros.reduce((a, b) => a + b, 0)
  const den = denominadores.reduce((a, b) => a + b, 0)
  if (den === 0) return { value: 0, label: formatPercent(0) }
  const v = (num / den) * 100
  return { value: v, label: formatPercent(v) }
}

function formatMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function formatHorasMeta(min: number): string {
  return `${Math.floor(min / 60)}h`
}

/** Rótulo do período no cabeçalho da slide (ex.: "Julho 2026"). */
export function formatPeriodoReferenciaApresentacao(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): string {
  if (mesFiltro == null) return `Ano ${ano}`
  if (mesFiltro === 'resultado') {
    const fim = mesFimResultado(ano)
    if (fim < MES_INICIO_RESULTADO) return `Resultado ${ano}`
    const ini = MESES_EFICIENCIA_ARQUIVO[MES_INICIO_RESULTADO - 1]
    const fimLabel = MESES_EFICIENCIA_ARQUIVO[fim - 1]
    return fim === MES_INICIO_RESULTADO
      ? `${titleCaseMes(ini!)} ${ano}`
      : `${titleCaseMes(ini!)}–${titleCaseMes(fimLabel!)} ${ano}`
  }
  if (mesFiltro === 'resultado_ytd') {
    const fim = mesFimYtdFechado(ano)
    if (fim < 1) return `Resultado ${ano}`
    const fimLabel = MESES_EFICIENCIA_ARQUIVO[fim - 1]
    return fim === 1
      ? `Janeiro ${ano}`
      : `Janeiro–${titleCaseMes(fimLabel!)} ${ano}`
  }
  if (isMesesFiltro(mesFiltro)) {
    if (mesFiltro.length === 1) {
      const nome = MESES_EFICIENCIA_ARQUIVO[mesFiltro[0]! - 1]
      return `${titleCaseMes(nome!)} ${ano}`
    }
    const nomes = mesFiltro
      .slice()
      .sort((a, b) => a - b)
      .map((m) => titleCaseMes(MESES_EFICIENCIA_ARQUIVO[m - 1]!))
    return `${nomes.join(' + ')} ${ano}`
  }
  return `Ano ${ano}`
}

function titleCaseMes(upper: string): string {
  const s = upper.toLocaleLowerCase('pt-BR')
  return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1)
}

function cellVazio(): ApresentacaoCell {
  return { label: '-', value: null, atingiu: null }
}

/** Sem população no período — exibe 0,00% (não usar para indisponibilidade intencional). */
function cellZeroPct(meta: number): ApresentacaoCell {
  return {
    value: 0,
    label: formatPercent(0),
    atingiu: atingiuMetaKpi(0, meta),
  }
}

function cellZeroHoras(): ApresentacaoCell {
  return { value: 0, label: '0:00h', atingiu: false }
}

function cellPct(value: number | null, meta: number): ApresentacaoCell {
  if (value == null) return cellZeroPct(meta)
  return {
    value,
    label: formatPercent(value),
    atingiu: atingiuMetaKpi(value, meta),
  }
}

/**
 * Extrai o valor de um KPI no período (mesma lógica do Acum. do Overview).
 */
export function cellApresentacaoKpi(
  kpi: ApresentacaoKpiId,
  data: EficienciaOverview | null | undefined,
  areaKey: ApresentacaoColunaKey,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
  metaOverride?: number,
): ApresentacaoCell {
  if (!data) return cellVazio()

  const areaCanon =
    areaKey === '__consolidado__' ? null : (areaKey as string)
  const opsOuIndisp = isAgendamentoVistagemIndisponivelPorArea(areaCanon)
  const filterMensal = <T extends { mes: number }>(rows: T[]) =>
    rows.filter((r) => mesNoFiltro(r.mes, mesFiltro, ano))

  switch (kpi) {
    case 'sla_protocolo': {
      // Ops Legais: KPI de área não aplica na grade (fica `-`).
      if (opsOuIndisp) return cellVazio()
      const rows = filterMensal(data.slaProtocolo)
      const { value } = somaRazao(
        rows.map((r) => r.qtd_d1),
        rows.map((r) => r.qtd_total),
      )
      const metas = rows.map((r) => r.meta).filter((m): m is number => m != null)
      const meta =
        metas.length > 0 ? Math.min(...metas) : EFICIENCIA_META_SLA_PROTOCOLO
      return cellPct(value, metaOverride ?? meta)
    }
    case 'eficiencia_protocolo': {
      if (opsOuIndisp) return cellVazio()
      const rows = filterMensal(data.eficienciaProtocolo)
      const { value } = somaRazao(
        rows.map((r) => r.sem_inconsistencia),
        rows.map((r) => r.total),
      )
      return cellPct(value, metaOverride ?? EFICIENCIA_META_EFICIENCIA_PROTOCOLO)
    }
    case 'sla_ciencia': {
      if (opsOuIndisp) return cellVazio()
      const rows = filterMensal(data.agendamento)
      const { value } = somaRazao(
        rows.map((r) => r.dentro_prazo),
        rows.map((r) => r.dentro_prazo + r.fora_prazo),
      )
      return cellPct(value, metaOverride ?? EFICIENCIA_META_AGENDAMENTO)
    }
    case 'sla_vistagem_risco': {
      if (opsOuIndisp) return cellVazio()
      const rows = filterMensal(data.slaVistagemRisco)
      const { value } = somaRazao(
        rows.map((r) => r.vistado_d1),
        rows.map((r) => r.total),
      )
      return cellPct(value, metaOverride ?? EFICIENCIA_META_VISTAGEM)
    }
    case 'sla_vistagem_normal': {
      if (
        opsOuIndisp ||
        areaCanon === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL
      ) {
        return cellVazio()
      }
      const rows = filterMensal(data.slaVistagemComum)
      const { value } = somaRazao(
        rows.map((r) => r.vistado_d1),
        rows.map((r) => r.total),
      )
      return cellPct(value, metaOverride ?? EFICIENCIA_META_VISTAGEM)
    }
    case 'nps':
      return cellVazio()
    case 'gestao_pdi': {
      const meta = metaOverride ?? EFICIENCIA_META_PDI
      const cell = acumuladoGestaoPdi(data.gestaoPdiMensal ?? [], mesFiltro, ano)
      // Rec. Crédito sem PDI no período permanece `-` (único vazio intencional da seção).
      if (cell.value == null && areaCanon === 'Recuperação de Crédito') {
        return cellVazio()
      }
      return cellPct(cell.value, meta)
    }
    case 'desenvolvimento': {
      // Indicador anual: sempre o acumulado do ano (pessoas × 14h), independente do filtro de mês.
      if (!data.treinamentos) return cellZeroHoras()
      const minutos = data.treinamentos.minutos_lancados
      const pct = data.treinamentos.pct_atingimento
      return {
        value: pct ?? 0,
        label: `${formatMinutos(minutos)}h`,
        atingiu: atingiuMetaKpi(pct ?? 0, 100),
      }
    }
    case 'retencao': {
      // Indicador anual: retenção do ano (não filtra por mês).
      const meta = data.turnover?.meta_pct_retencao_minima ?? 90
      if (!data.turnover) return cellZeroPct(metaOverride ?? meta)
      return cellPct(data.turnover.pct_retencao, metaOverride ?? meta)
    }
    default:
      return cellVazio()
  }
}

/** Meta dinâmica de desenvolvimento (ex.: "588h*") a partir do consolidado. */
export function metaDesenvolvimentoApresentacao(
  consolidado: EficienciaOverview | null | undefined,
): string {
  const min = consolidado?.treinamentos?.meta_minutos
  if (min == null || min <= 0) return '—'
  return `${formatHorasMeta(min)}*`
}

export function rodapeDesenvolvimentoApresentacao(
  consolidado: EficienciaOverview | null | undefined,
): string | null {
  const t = consolidado?.treinamentos
  if (!t || t.pessoas_ativas <= 0) return null
  return `* Desenvolvimento contínuo de Equipe, meta de 14hrs/ano proporcional à admissão (dia > 15 → mês seguinte). Calculado em cima de ${t.pessoas_ativas} pessoas ativas elegíveis.`
}

export function areaKeyFromColuna(col: (typeof APRESENTACAO_COLUNAS)[number]): string | null {
  return col.key === '__consolidado__' ? null : col.key
}
