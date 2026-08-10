import { useState } from 'react'
import {
  CalendarCheck2,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  Instagram,
  LayoutDashboard,
  Lightbulb,
  Newspaper,
  RefreshCcw,
  Target,
  UserMinus,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GestaoPdiTab } from '@/features/eficiencia/components/GestaoPdiTab'
import { MesFilterButtons } from '@/features/eficiencia/components/MesFilterButtons'
import { OperacoesLegaisOverviewTab } from '@/features/eficiencia/components/OperacoesLegaisOverviewTab'
import { OperacoesLegaisRgTab } from '@/features/eficiencia/components/OperacoesLegaisRgTab'
import { OpsLegaisFinanceiroTab } from '@/features/eficiencia/components/OpsLegaisFinanceiroTab'
import { OpsLegaisIniciativasTab } from '@/features/eficiencia/components/OpsLegaisIniciativasTab'
import { useEficienciaOverview } from '@/features/eficiencia/hooks/useEficiencia'
import {
  EFICIENCIA_AREA_OPS_LEGAIS,
  type MesFiltroEficiencia,
} from '@/features/eficiencia/constants'
import type { UltimaAtualizacaoRow } from '@/features/eficiencia/types/eficiencia.types'
import { toPriMaiuscula } from '@/features/eficiencia/utils/textFormat'
import { formatDateTime } from '@/shared/utils/format'
import { MarketingTab } from '@/features/operacoes-legais/marketing/MarketingTab'

const ANO_PADRAO = 2026
const ANOS_COMPARATIVO = [2026, 2025] as const

/** Faixas à direita do Overview (linha 1 / linha 2), como no Jurídico. */
const ROW1_AFTER_OVERVIEW = 5

const BTN =
  'inline-flex h-8 min-w-[4.5rem] items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

type TabId =
  | 'overview'
  | 'protocolos'
  | 'publicacoes'
  | 'cadastro'
  | 'treinamentos'
  | 'turnover'
  | 'gestao-pdi'
  | 'tarefas'
  | 'financeiro'
  | 'marketing'
  | 'iniciativas'

type TabDef = { id: TabId; label: string; icon: typeof LayoutDashboard }

/**
 * Ordem alinhada ao Overview Ops Legais; extras (Tarefas/Financeiro/Marketing)
 * antes de Iniciativas Estratégicas (última aba).
 */
const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'protocolos', label: 'SLA Protocolo', icon: FileCheck2 },
  { id: 'publicacoes', label: 'Eficiência Publicações', icon: Newspaper },
  { id: 'cadastro', label: 'Eficiência no Cadastro', icon: FolderKanban },
  { id: 'treinamentos', label: 'Desenvolvimento Contínuo', icon: GraduationCap },
  { id: 'turnover', label: 'Retenção de Talentos', icon: UserMinus },
  { id: 'gestao-pdi', label: 'Gestão de PDI', icon: Target },
  { id: 'tarefas', label: 'Tarefas', icon: CalendarCheck2 },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'marketing', label: 'Marketing', icon: Instagram },
  { id: 'iniciativas', label: 'Iniciativas Estratégicas', icon: Lightbulb },
]

function OpsLegaisTabTrigger({ tab }: { tab: TabDef }) {
  const Icon = tab.icon
  return (
    <TabsTrigger value={tab.id} className="whitespace-nowrap">
      <Icon className="h-4 w-4" />
      {toPriMaiuscula(tab.label)}
    </TabsTrigger>
  )
}

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

  const overviewTab = TABS.find((t) => t.id === 'overview')
  const demais = TABS.filter((t) => t.id !== 'overview')
  const row1 = demais.slice(0, ROW1_AFTER_OVERVIEW)
  const row2 = demais.slice(ROW1_AFTER_OVERVIEW)

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
      <header className="flex flex-wrap items-center justify-end gap-4">
        {tab !== 'marketing' && (
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
        )}
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabId)
          setMesFiltro(null)
        }}
      >
        <div className="flex justify-center overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto flex-row items-stretch gap-0.5 p-1">
            {overviewTab ? (
              <div className="flex shrink-0 items-center self-stretch pr-0.5">
                <OpsLegaisTabTrigger tab={overviewTab} />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-nowrap justify-start gap-0.5">
                {row1.map((t) => (
                  <OpsLegaisTabTrigger key={t.id} tab={t} />
                ))}
              </div>
              <div className="flex flex-nowrap justify-start gap-0.5">
                {row2.map((t) => (
                  <OpsLegaisTabTrigger key={t.id} tab={t} />
                ))}
              </div>
            </div>
          </TabsList>
        </div>

        {tab !== 'marketing' && (
          <div className="mt-6">
            <MesFilterButtons
              value={mesFiltro}
              onChange={setMesFiltro}
              showResultado={false}
            />
          </div>
        )}

        <TabsContent value="overview" className="mt-5">
          <OperacoesLegaisOverviewTab ano={ano} mesFiltro={mesFiltro} />
        </TabsContent>

        <TabsContent value="gestao-pdi" className="mt-5">
          <GestaoPdiTab
            ano={ano}
            mesFiltro={mesFiltro}
            areaFixa={EFICIENCIA_AREA_OPS_LEGAIS}
          />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-5">
          <OpsLegaisFinanceiroTab ano={ano} mesFiltro={mesFiltro} />
        </TabsContent>

        <TabsContent value="iniciativas" className="mt-5">
          <OpsLegaisIniciativasTab ano={ano} mesFiltro={mesFiltro} />
        </TabsContent>

        <TabsContent value="marketing" className="mt-5">
          <MarketingTab />
        </TabsContent>

        {(
          [
            'protocolos',
            'publicacoes',
            'cadastro',
            'treinamentos',
            'turnover',
            'tarefas',
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
