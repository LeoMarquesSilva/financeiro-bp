import { useEffect, useState } from 'react'
import { Smile, Award, Trophy } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/lib/AuthContext'
import { useEficienciaOverview } from '../hooks/useEficiencia'
import { useEficienciaAccess } from '../hooks/useEficienciaAccess'
import { EFICIENCIA_TABS, type EficienciaTabId } from '../config/eficienciaTabs'
import type { MesFiltroEficiencia } from '../constants'
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

export function EficienciaPage() {
  const { loading: authLoading } = useAuth()
  const access = useEficienciaAccess()
  const [ano, setAno] = useState(ANO_PADRAO)
  const [tab, setTab] = useState<EficienciaTabId>('overview')
  const [areaOverview, setAreaOverview] = useState<string | null>(null)
  const [mesFiltro, setMesFiltro] = useState<MesFiltroEficiencia>(null)

  const areaEfetiva = access.canFilterAreas ? areaOverview : access.lockedArea
  const { data: overview, loading: loadingOverview } = useEficienciaOverview(ano, areaEfetiva)

  const visibleTabs = access.canSeeAllTabs
    ? EFICIENCIA_TABS
    : EFICIENCIA_TABS.filter((t) => t.id === 'overview')

  // Coordenador: trava na área dele e no Overview.
  useEffect(() => {
    if (!access.canSeeAllTabs && tab !== 'overview') {
      setTab('overview')
    }
  }, [access.canSeeAllTabs, tab])

  useEffect(() => {
    if (authLoading) return
    if (!access.canFilterAreas) {
      setAreaOverview(access.lockedArea)
    }
  }, [authLoading, access.canFilterAreas, access.lockedArea])

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

      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (!access.canSeeAllTabs && v !== 'overview') return
          setTab(v as EficienciaTabId)
        }}
      >
        {access.canSeeAllTabs ? (
          <div className="flex justify-center">
            <TabsList className="flex-wrap">
              {visibleTabs.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id}>
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        ) : null}

        <div className={access.canSeeAllTabs ? 'mt-6' : 'mt-0'}>
          <MesFilterButtons value={mesFiltro} onChange={setMesFiltro} />
        </div>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab
            ano={ano}
            data={overview}
            loading={loadingOverview}
            area={areaEfetiva}
            onAreaChange={handleAreaChange}
            mesFiltro={mesFiltro}
            allowedAreas={
              access.canFilterAreas ? null : access.lockedArea ? [access.lockedArea] : []
            }
            allowTodasAreas={access.canFilterAreas}
          />
        </TabsContent>

        {access.canSeeAllTabs
          ? EFICIENCIA_TABS.filter((t) => t.id !== 'overview').map(({ id }) => (
              <TabsContent key={id} value={id} className="mt-5">
                <EficienciaTabPanel tab={id} ano={ano} mesFiltro={mesFiltro} />
              </TabsContent>
            ))
          : null}
      </Tabs>
    </div>
  )
}
