import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  UserCheck,
} from 'lucide-react'
import type { GrupoResumoRow } from '../services/escritorioService'
import { GRUPO_SEM_NOME } from '../services/escritorioService'

export type MetricaFinanceiraEscritorio =
  | 'a_vencer'
  | 'em_atraso'
  | 'em_atraso_ativos'
  | 'em_aberto'
  | 'pago'

export interface MetricaFinanceiraConfig {
  id: MetricaFinanceiraEscritorio
  slug: string
  label: string
  subtitle?: string
  icon: LucideIcon
  cardClassName: string
  labelClassName: string
  valueClassName: string
  countClassName: string
  subtitleClassName?: string
}

export const METRICAS_FINANCEIRAS: MetricaFinanceiraConfig[] = [
  {
    id: 'a_vencer',
    slug: 'a-vencer',
    label: 'A vencer',
    icon: CalendarClock,
    cardClassName: 'border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-50',
    labelClassName: 'text-amber-700',
    valueClassName: 'text-amber-900',
    countClassName: 'text-amber-600',
  },
  {
    id: 'em_atraso',
    slug: 'em-atraso',
    label: 'Em atraso',
    icon: AlertTriangle,
    cardClassName: 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50',
    labelClassName: 'text-red-700',
    valueClassName: 'text-red-900',
    countClassName: 'text-red-600',
  },
  {
    id: 'em_atraso_ativos',
    slug: 'em-atraso-ativos',
    label: 'Em atraso (ativos)',
    subtitle: 'Sem inativos e sem grupo',
    icon: UserCheck,
    cardClassName: 'border-rose-200 bg-rose-50/50 hover:border-rose-300 hover:bg-rose-50',
    labelClassName: 'text-rose-700',
    valueClassName: 'text-rose-900',
    countClassName: 'text-rose-600',
    subtitleClassName: 'text-rose-500',
  },
  {
    id: 'em_aberto',
    slug: 'em-aberto',
    label: 'Em aberto (total)',
    icon: CircleDollarSign,
    cardClassName: 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50',
    labelClassName: 'text-slate-600',
    valueClassName: 'text-slate-900',
    countClassName: 'text-slate-500',
  },
  {
    id: 'pago',
    slug: 'pago',
    label: 'Pago',
    icon: Banknote,
    cardClassName: 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50',
    labelClassName: 'text-emerald-700',
    valueClassName: 'text-emerald-900',
    countClassName: 'text-emerald-600',
  },
]

const METRICA_BY_SLUG = new Map(METRICAS_FINANCEIRAS.map((m) => [m.slug, m]))
const METRICA_BY_ID = new Map(METRICAS_FINANCEIRAS.map((m) => [m.id, m]))

export function getMetricaBySlug(slug: string | undefined): MetricaFinanceiraConfig | null {
  if (!slug) return null
  return METRICA_BY_SLUG.get(slug) ?? null
}

export function getMetricaById(id: MetricaFinanceiraEscritorio): MetricaFinanceiraConfig {
  return METRICA_BY_ID.get(id)!
}

export function valorMetricaGrupo(r: GrupoResumoRow, metrica: MetricaFinanceiraEscritorio): number {
  switch (metrica) {
    case 'a_vencer':
      return r.valor_aberto - r.valor_em_atraso
    case 'em_atraso':
      return r.valor_em_atraso
    case 'em_atraso_ativos':
      return r.valor_em_atraso_ativos
    case 'em_aberto':
      return r.valor_aberto
    case 'pago':
      return r.valor_pago
  }
}

export function nomeGrupoExibicao(grupoCliente: string): string {
  return grupoCliente === '' ? GRUPO_SEM_NOME : grupoCliente
}

export interface TotaisFinanceirosEscritorio {
  aVencer: number
  emAtraso: number
  emAtrasoAtivos: number
  emAberto: number
  pago: number
  countAVencer: number
  countAtraso: number
  countAtrasoAtivos: number
  countAberto: number
  countPago: number
}

export function valorTotalMetrica(totais: TotaisFinanceirosEscritorio, metrica: MetricaFinanceiraEscritorio): number {
  switch (metrica) {
    case 'a_vencer':
      return totais.aVencer
    case 'em_atraso':
      return totais.emAtraso
    case 'em_atraso_ativos':
      return totais.emAtrasoAtivos
    case 'em_aberto':
      return totais.emAberto
    case 'pago':
      return totais.pago
  }
}

export function countGruposMetrica(totais: TotaisFinanceirosEscritorio, metrica: MetricaFinanceiraEscritorio): number {
  switch (metrica) {
    case 'a_vencer':
      return totais.countAVencer
    case 'em_atraso':
      return totais.countAtraso
    case 'em_atraso_ativos':
      return totais.countAtrasoAtivos
    case 'em_aberto':
      return totais.countAberto
    case 'pago':
      return totais.countPago
  }
}
