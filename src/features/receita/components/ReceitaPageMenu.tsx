import {
  BarChart3,
  ChartColumnIncreasing,
  FileSpreadsheet,
  LayoutDashboard,
  PieChart,
  Table2,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { RECEITA_SECTION_IDS, type ReceitaSectionId } from '../utils/receitaNav'

type SectionItem = {
  kind: 'section'
  id: ReceitaSectionId
  label: string
  icon: typeof TrendingUp
}

type ActionItem = {
  kind: 'action'
  key: 'relatorio' | 'rateio'
  label: string
  icon: typeof TrendingUp
}

const SECTION_ITEMS: SectionItem[] = [
  { kind: 'section', id: RECEITA_SECTION_IDS.resumo, label: 'Resumo', icon: LayoutDashboard },
  { kind: 'section', id: RECEITA_SECTION_IDS.gestaoAVista, label: 'Gestão à vista', icon: BarChart3 },
  { kind: 'section', id: RECEITA_SECTION_IDS.inadimplencia, label: 'Inadimplência', icon: TriangleAlert },
  { kind: 'section', id: RECEITA_SECTION_IDS.comparativo, label: 'Comparativo mensal', icon: TrendingUp },
  { kind: 'section', id: RECEITA_SECTION_IDS.detalhamento, label: 'Detalhamento por mês', icon: Table2 },
  {
    kind: 'section',
    id: RECEITA_SECTION_IDS.acumulado,
    label: 'Valores acumulados',
    icon: ChartColumnIncreasing,
  },
]

const ACTION_ITEMS: ActionItem[] = [
  { kind: 'action', key: 'relatorio', label: 'Relatório gerencial', icon: FileSpreadsheet },
  { kind: 'action', key: 'rateio', label: 'Consulta rateio', icon: PieChart },
]

const ITEM_CLASS =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900'

type Props = {
  onNavigateSection: (id: ReceitaSectionId) => void
  onRelatorio: () => void
  onRateio: () => void
}

export function ReceitaPageMenu({ onNavigateSection, onRelatorio, onRateio }: Props) {
  return (
    <nav
      className="flex w-full min-w-0 items-center justify-center gap-0.5 overflow-x-auto px-10 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Seções de Receita"
    >
      <h1 className="sr-only">Receita</h1>
      {SECTION_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            className={ITEM_CLASS}
            onClick={() => onNavigateSection(item.id)}
          >
            <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {item.label}
          </button>
        )
      })}
      <span className="mx-1 hidden h-5 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
      {ACTION_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.key}
            type="button"
            className={ITEM_CLASS}
            onClick={() => {
              if (item.key === 'relatorio') onRelatorio()
              else onRateio()
            }}
          >
            <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
