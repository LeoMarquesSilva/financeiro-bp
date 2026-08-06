import { useState } from 'react'
import { Smile, Award, Trophy } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useEficienciaOverview } from '../hooks/useEficiencia'
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

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 4 }, (_, i) => ANO_ATUAL - i)

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
  const [ano, setAno] = useState(ANO_ATUAL)
  const [tab, setTab] = useState<EficienciaTabId>('overview')
  const [areaOverview, setAreaOverview] = useState<string | null>(null)
  const [mesFiltro, setMesFiltro] = useState<MesFiltroEficiencia>(null)
  const { data: overview, loading: loadingOverview } = useEficienciaOverview(ano, areaOverview)

  return (
    <div className="space-y-6">
      <EficienciaHeader
        ano={ano}
        anos={ANOS}
        onAnoChange={setAno}
        ultimaAtualizacao={overview?.ultimaAtualizacao}
      />

      <IndicadoresResultadoActions ano={ano} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as EficienciaTabId)}>
        <div className="flex justify-center">
          <TabsList className="flex-wrap">
            {EFICIENCIA_TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id}>
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <MesFilterButtons value={mesFiltro} onChange={setMesFiltro} />
        </div>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab
            ano={ano}
            data={overview}
            loading={loadingOverview}
            area={areaOverview}
            onAreaChange={setAreaOverview}
            mesFiltro={mesFiltro}
          />
        </TabsContent>

        {EFICIENCIA_TABS.filter((t) => t.id !== 'overview').map(({ id }) => (
          <TabsContent key={id} value={id} className="mt-5">
            <EficienciaTabPanel tab={id} ano={ano} mesFiltro={mesFiltro} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
