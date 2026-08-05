import { useState } from 'react'
import {
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  FileCheck2,
  ClipboardCheck,
  CalendarCheck2,
  GraduationCap,
  UserMinus,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useEficienciaOverview } from '../hooks/useEficiencia'
import { EficienciaHeader } from '../components/EficienciaHeader'
import { IndicadoresResultadoActions } from '../components/IndicadoresResultadoActions'
import { OverviewTab } from '../components/OverviewTab'
import { SlaVistagemTab } from '../components/SlaVistagemTab'
import { SlaProtocoloTab } from '../components/SlaProtocoloTab'
import { EficienciaProtocoloTab } from '../components/EficienciaProtocoloTab'
import { AgendamentoTab } from '../components/AgendamentoTab'
import { TreinamentosTab } from '../components/TreinamentosTab'
import { TurnoverTab } from '../components/TurnoverTab'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: 4 }, (_, i) => ANO_ATUAL - i)

export function EficienciaPage() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [tab, setTab] = useState('overview')
  const [areaOverview, setAreaOverview] = useState<string | null>(null)
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="demanda-risco">
            <ShieldAlert className="h-4 w-4" />
            Demanda de Risco
          </TabsTrigger>
          <TabsTrigger value="demanda-comum">
            <ShieldCheck className="h-4 w-4" />
            Demanda Comum
          </TabsTrigger>
          <TabsTrigger value="sla-protocolo">
            <FileCheck2 className="h-4 w-4" />
            SLA de Protocolo
          </TabsTrigger>
          <TabsTrigger value="eficiencia-protocolo">
            <ClipboardCheck className="h-4 w-4" />
            Eficiência Protocolo
          </TabsTrigger>
          <TabsTrigger value="agendamento">
            <CalendarCheck2 className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
          <TabsTrigger value="treinamentos">
            <GraduationCap className="h-4 w-4" />
            Treinamentos
          </TabsTrigger>
          <TabsTrigger value="turnover">
            <UserMinus className="h-4 w-4" />
            Turnover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab
            ano={ano}
            data={overview}
            loading={loadingOverview}
            area={areaOverview}
            onAreaChange={setAreaOverview}
          />
        </TabsContent>
        <TabsContent value="demanda-risco" className="mt-6">
          <SlaVistagemTab ano={ano} risco={true} />
        </TabsContent>
        <TabsContent value="demanda-comum" className="mt-6">
          <SlaVistagemTab ano={ano} risco={false} />
        </TabsContent>
        <TabsContent value="sla-protocolo" className="mt-6">
          <SlaProtocoloTab ano={ano} />
        </TabsContent>
        <TabsContent value="eficiencia-protocolo" className="mt-6">
          <EficienciaProtocoloTab ano={ano} />
        </TabsContent>
        <TabsContent value="agendamento" className="mt-6">
          <AgendamentoTab ano={ano} />
        </TabsContent>
        <TabsContent value="treinamentos" className="mt-6">
          <TreinamentosTab ano={ano} />
        </TabsContent>
        <TabsContent value="turnover" className="mt-6">
          <TurnoverTab ano={ano} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
