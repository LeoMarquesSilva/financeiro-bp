import { useEffect, useState } from 'react'
import { Smile, Award, Trophy } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/lib/AuthContext'
import { useEficienciaOverview } from '../hooks/useEficiencia'
import { useEficienciaAccess } from '../hooks/useEficienciaAccess'
import {
  visibleEficienciaTabs,
  type EficienciaTabDef,
  type EficienciaTabId,
} from '../config/eficienciaTabs'
import { isSemanaFiltro, type MesFiltroEficiencia } from '../constants'
import { toPriMaiuscula } from '../utils/textFormat'
import { EficienciaHeader } from '../components/EficienciaHeader'
import { IndicadoresResultadoActions } from '../components/IndicadoresResultadoActions'
import { MesFilterButtons } from '../components/MesFilterButtons'
import { OverviewTab } from '../components/OverviewTab'
import { SlaVistagemTab } from '../components/SlaVistagemTab'
import { SlaProtocoloTab } from '../components/SlaProtocoloTab'
import { EficienciaProtocoloTab } from '../components/EficienciaProtocoloTab'
import { AgendamentoTab } from '../components/AgendamentoTab'
import { TreinamentosTab } from '../components/TreinamentosTab'
import { TurnoverTab } from '../components/TurnoverTab'
import { GestaoPdiTab } from '../components/GestaoPdiTab'
import { ReceitaBrutaTab } from '../components/ReceitaBrutaTab'
import { InadimplenciaTab } from '../components/InadimplenciaTab'
import { EficienciaPlaceholderTab } from '../components/EficienciaPlaceholderTab'

/** Ano padrão da tela (sempre o corrente). 2025 fica disponível só para comparativo anual. */
const ANO_PADRAO = 2026
const ANOS_COMPARATIVO = [2026, 2025] as const

/** Faixas à direita do Overview (SLA…Desenvolvimento / Retenção…Êxito). */
const ROW1_AFTER_OVERVIEW = 6

function EficienciaTabPanel({
  tab,
  ano,
  mesFiltro,
}: {
  tab: EficienciaTabId
  ano: number
  mesFiltro: MesFiltroEficiencia
}) {
  switch (tab) {
    case 'overview':
      return null
    case 'sla-protocolo':
      return <SlaProtocoloTab ano={ano} mesFiltro={mesFiltro} />
    case 'eficiencia-protocolo':
      return <EficienciaProtocoloTab ano={ano} mesFiltro={mesFiltro} />
    case 'sla-ciencia-agendamentos':
      return <AgendamentoTab ano={ano} mesFiltro={mesFiltro} />
    case 'sla-vistagem-risco':
      return <SlaVistagemTab ano={ano} risco mesFiltro={mesFiltro} />
    case 'sla-vistagem-normal':
      return <SlaVistagemTab ano={ano} risco={false} mesFiltro={mesFiltro} />
    case 'desenvolvimento-equipe':
      return <TreinamentosTab ano={ano} mesFiltro={mesFiltro} />
    case 'retencao-talentos':
      return <TurnoverTab ano={ano} mesFiltro={mesFiltro} />
    case 'gestao-pdi':
      return <GestaoPdiTab ano={ano} mesFiltro={mesFiltro} />
    case 'nps':
      return (
        <EficienciaPlaceholderTab title="NPS" icon={Smile} meta="Meta 85%" hint="Sem dado no Overview (BI)." />
      )
    case 'receita-bruta':
      return <ReceitaBrutaTab ano={ano} mesFiltro={mesFiltro} />
    case 'inadimplencia':
      return <InadimplenciaTab ano={ano} mesFiltro={mesFiltro} />
    case 'reputacao':
      return (
        <EficienciaPlaceholderTab
          title="Reputação"
          icon={Award}
          meta="Meta x"
          hint="Sem dado no Overview (BI)."
        />
      )
    case 'exito':
      return (
        <EficienciaPlaceholderTab
          title="Êxito"
          icon={Trophy}
          meta="Meta x"
          hint="Sem dado no Overview (BI)."
        />
      )
    default:
      return null
  }
}

function TabTrigger({ tab }: { tab: EficienciaTabDef }) {
  const Icon = tab.icon
  return (
    <TabsTrigger key={tab.id} value={tab.id} className="whitespace-nowrap">
      <Icon className="h-4 w-4" />
      {toPriMaiuscula(tab.label)}
    </TabsTrigger>
  )
}

export function EficienciaPage() {
  const { loading: authLoading } = useAuth()
  const access = useEficienciaAccess()
  const [ano, setAno] = useState(ANO_PADRAO)
  const [tab, setTab] = useState<EficienciaTabId>('overview')
  const [areaOverview, setAreaOverview] = useState<string | null>(null)
  const [mesFiltro, setMesFiltro] = useState<MesFiltroEficiencia>(null)

  // Overview: coordenador vê consolidado (Todas as áreas), sem slicer.
  const areaOverviewData = access.canFilterAreas ? areaOverview : null
  const tabsVisiveis = visibleEficienciaTabs(areaOverviewData)
  const { data: overview, loading: loadingOverview } = useEficienciaOverview(
    ano,
    areaOverviewData,
  )

  // Jurídico não usa filtro de semana — limpa se vier de outro contexto.
  useEffect(() => {
    if (isSemanaFiltro(mesFiltro)) setMesFiltro(null)
  }, [mesFiltro])

  const overviewTab = tabsVisiveis.find((t) => t.id === 'overview')
  const demais = tabsVisiveis.filter((t) => t.id !== 'overview')
  const row1 = demais.slice(0, ROW1_AFTER_OVERVIEW)
  const row2 = demais.slice(ROW1_AFTER_OVERVIEW)

  const handleAreaChange = (area: string | null) => {
    if (!access.canFilterAreas) return
    setAreaOverview(area)
  }

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
      <EficienciaHeader
        ano={ano}
        anos={[...ANOS_COMPARATIVO]}
        onAnoChange={setAno}
        ultimaAtualizacao={overview?.ultimaAtualizacao}
      />

      {access.canUseIndicadoresAdmin ? <IndicadoresResultadoActions ano={ano} /> : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as EficienciaTabId)}>
        <div className="flex justify-center overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto flex-row items-stretch gap-0.5 p-1">
            {/* Overview centralizado na altura das duas linhas (print). */}
            {overviewTab ? (
              <div className="flex shrink-0 items-center self-stretch pr-0.5">
                <TabTrigger tab={overviewTab} />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-nowrap justify-start gap-0.5">
                {row1.map((t) => (
                  <TabTrigger key={t.id} tab={t} />
                ))}
              </div>
              <div className="flex flex-nowrap justify-start gap-0.5">
                {row2.map((t) => (
                  <TabTrigger key={t.id} tab={t} />
                ))}
              </div>
            </div>
          </TabsList>
        </div>

        <div className="mt-6">
          <MesFilterButtons value={mesFiltro} onChange={setMesFiltro} showSemanas={false} />
        </div>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab
            ano={ano}
            data={overview}
            loading={loadingOverview}
            area={areaOverviewData}
            onAreaChange={handleAreaChange}
            mesFiltro={mesFiltro}
            showAreaFilter={access.canFilterAreas}
            allowTodasAreas={access.canFilterAreas}
          />
        </TabsContent>

        {tabsVisiveis
          .filter((t) => t.id !== 'overview')
          .map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-5">
              <EficienciaTabPanel tab={id} ano={ano} mesFiltro={mesFiltro} />
            </TabsContent>
          ))}
      </Tabs>
    </div>
  )
}
