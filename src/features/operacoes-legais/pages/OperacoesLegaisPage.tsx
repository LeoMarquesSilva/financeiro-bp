import { useState } from 'react'
import {
  Briefcase,
  CalendarCheck2,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Newspaper,
  RefreshCcw,
  UserMinus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MesFilterButtons } from '@/features/eficiencia/components/MesFilterButtons'
import { OperacoesLegaisOverviewTab } from '@/features/eficiencia/components/OperacoesLegaisOverviewTab'
import { OperacoesLegaisRgTab } from '@/features/eficiencia/components/OperacoesLegaisRgTab'
import { useEficienciaOverview } from '@/features/eficiencia/hooks/useEficiencia'
import type { MesFiltroEficiencia } from '@/features/eficiencia/constants'
import type { UltimaAtualizacaoRow } from '@/features/eficiencia/types/eficiencia.types'
import { toPriMaiuscula } from '@/features/eficiencia/utils/textFormat'
import { formatDateTime } from '@/shared/utils/format'

const ANO_PADRAO = 2026
const ANOS_COMPARATIVO = [2026, 2025] as const

const BTN =
  'inline-flex h-8 min-w-[4.5rem] items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

type TabId =
  | 'overview'
  | 'protocolos'
  | 'publicacoes'
  | 'tarefas'
  | 'cadastro'
  | 'treinamentos'
  | 'turnover'

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'protocolos', label: 'SLA Protocolos', icon: FileCheck2 },
  { id: 'publicacoes', label: 'SLA Publicações', icon: Newspaper },
  { id: 'tarefas', label: 'Tarefas', icon: CalendarCheck2 },
  { id: 'cadastro', label: 'Cadastro', icon: FolderKanban },
  { id: 'treinamentos', label: 'Treinamentos', icon: GraduationCap },
  { id: 'turnover', label: 'Turnover', icon: UserMinus },
]

export function OperacoesLegaisPage() {
  const { loading: authLoading } = useAuth()
  const [ano, setAno] = useState(ANO_PADRAO)
  const [tab, setTab] = useState<TabId>('overview')
  const [mesFiltro, setMesFiltro] = useState<MesFiltroEficiencia>(null)
  const { data: overview } = useEficienciaOverview(ano, null)

  const atualizacoes: UltimaAtualizacaoRow[] = overview?.ultimaAtualizacao ?? []
  const maisRecente = atualizacoes.length
    ? atualizacoes.reduce((a, b) => (a.executado_em > b.executado_em ? a : b))
    : null

  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 max-w-md animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Briefcase className="h-6 w-6 text-slate-600" />
            Operações Legais
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Dashboard BI Operações Legais — overview, protocolos, publicações, tarefas, cadastro,
            treinamentos e turnover
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {maisRecente && (
            <span
              className="flex items-center gap-1.5 text-xs text-slate-400"
              title={`Fonte: ${maisRecente.fonte}`}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Atualizado em {formatDateTime(maisRecente.executado_em)}
            </span>
          )}
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="Ano de referência"
            title="Use 2025 apenas para comparativo anual"
          >
            {ANOS_COMPARATIVO.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAno(a)}
                className={cn(BTN, ano === a ? BTN_ON : BTN_OFF)}
                aria-pressed={ano === a}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <div className="flex justify-center overflow-x-auto pb-1">
          <TabsList className="h-auto flex-nowrap justify-start">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="whitespace-nowrap">
                <Icon className="h-4 w-4" />
                {toPriMaiuscula(label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <MesFilterButtons value={mesFiltro} onChange={setMesFiltro} />
        </div>

        <TabsContent value="overview" className="mt-5">
          <OperacoesLegaisOverviewTab ano={ano} mesFiltro={mesFiltro} />
        </TabsContent>

        {(
          [
            'protocolos',
            'publicacoes',
            'tarefas',
            'cadastro',
            'treinamentos',
            'turnover',
          ] as const
        ).map((id) => (
          <TabsContent key={id} value={id} className="mt-5">
            <OperacoesLegaisRgTab ano={ano} mesFiltro={mesFiltro} secao={id} hideSecaoNav />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
