import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  FileCheck2,
  ClipboardCheck,
  CalendarCheck2,
  ShieldAlert,
  ShieldCheck,
  GraduationCap,
  UserMinus,
  Target,
  Smile,
  TrendingUp,
  AlertTriangle,
  Award,
  Trophy,
  Scale,
} from 'lucide-react'
import { EFICIENCIA_AREA_OPS_LEGAIS } from '../constants'

/** IDs das abas de detalhe — mesma ordem das linhas do Overview (após Overview). */
export type EficienciaTabId =
  | 'overview'
  | 'ops-legais-rg'
  | 'sla-protocolo'
  | 'eficiencia-protocolo'
  | 'sla-ciencia-agendamentos'
  | 'sla-vistagem-risco'
  | 'sla-vistagem-normal'
  | 'desenvolvimento-equipe'
  | 'retencao-talentos'
  | 'gestao-pdi'
  | 'nps'
  | 'receita-bruta'
  | 'inadimplencia'
  | 'reputacao'
  | 'exito'

export type EficienciaTabDef = {
  id: EficienciaTabId
  label: string
  icon: LucideIcon
}

/** Ordem canônica = Overview KPI_HTML (BI) + abas de detalhe correspondentes. */
export const EFICIENCIA_TABS: EficienciaTabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'ops-legais-rg', label: 'Ops Legais (RG)', icon: Scale },
  { id: 'sla-protocolo', label: 'SLA Protocolo', icon: FileCheck2 },
  { id: 'eficiencia-protocolo', label: 'Eficiência Protocolo', icon: ClipboardCheck },
  { id: 'sla-ciencia-agendamentos', label: 'SLA Ciência Agendamentos', icon: CalendarCheck2 },
  { id: 'sla-vistagem-risco', label: 'SLA Vistagem Risco', icon: ShieldAlert },
  { id: 'sla-vistagem-normal', label: 'SLA Vistagem Normal', icon: ShieldCheck },
  { id: 'desenvolvimento-equipe', label: 'Desenvolvimento Equipe', icon: GraduationCap },
  { id: 'retencao-talentos', label: 'Retenção de Talentos', icon: UserMinus },
  { id: 'gestao-pdi', label: 'Gestão de PDI', icon: Target },
  { id: 'nps', label: 'NPS', icon: Smile },
  { id: 'receita-bruta', label: 'Receita Bruta', icon: TrendingUp },
  { id: 'inadimplencia', label: 'Índice de Inadimplência', icon: AlertTriangle },
  { id: 'reputacao', label: 'Reputação', icon: Award },
  { id: 'exito', label: 'Êxito', icon: Trophy },
]

/** Visível no consolidado (Todas) e no slicer Operações Legais; oculta nas demais áreas. */
export function isOpsLegaisRgTabVisible(area: string | null): boolean {
  return area == null || area === EFICIENCIA_AREA_OPS_LEGAIS
}

/** Abas visíveis conforme área efetiva do dashboard. */
export function visibleEficienciaTabs(area: string | null): EficienciaTabDef[] {
  return EFICIENCIA_TABS.filter(
    (t) => t.id !== 'ops-legais-rg' || isOpsLegaisRgTabVisible(area),
  )
}
