import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { GestaoVistaMesRow } from '@/features/receita/types/receita.types'
import {
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  MES_INICIO_RESULTADO,
  filtroEfetivoGestaoAVista,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useInadimplenciaAoVivo, useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import {
  buildOverviewInadimplencia,
  mesesInadimplenciaAoVivo,
} from '../utils/overviewFinanceiroKpis'
import {
  explicarInadimplenciaIndice,
  explicarInadimplenciaSaldo,
  rotuloPeriodoEficiencia,
  TELA_EFICIENCIA_PESSOAS,
  type InadimplenciaFenixCtx,
} from '../fenix/eficienciaPessoasFinanceiroFenix'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { explicarGraficoInadimplencia } from '../fenix/eficienciaGraficosFenix'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { RacionalSheet } from './RacionalSheet'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function InadimplenciaTab({
  ano,
  mesFiltro,
  responsavel,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { data, isLoading } = useOverviewFinanceiroKpis(ano)
  const filtroGav = filtroEfetivoGestaoAVista(ano)
  const { data: aoVivo, isLoading: loadingAoVivo } = useInadimplenciaAoVivo(ano, mesFiltro)
  const { data: aoVivoGestaoVista, isLoading: loadingAoVivoGestaoVista } =
    useInadimplenciaAoVivo(ano, filtroGav)
  const overview = data ? buildOverviewInadimplencia(data.meses, aoVivo) : null
  const overviewGestaoVista = data
    ? buildOverviewInadimplencia(data.meses, aoVivoGestaoVista)
    : null

  const mesesEscopo = (data?.meses ?? []).filter(
    (m: GestaoVistaMesRow) =>
      m.mes >= MES_INICIO_RESULTADO && mesNoFiltro(m.mes, mesFiltro, ano),
  )

  const fenixCtx = (escopo: 'gestao_vista' | 'periodo'): InadimplenciaFenixCtx => ({
    ano,
    escopo,
    meses: mesesInadimplenciaAoVivo(escopo === 'gestao_vista' ? filtroGav : mesFiltro, ano),
    aoVivo: escopo === 'gestao_vista' ? aoVivoGestaoVista : aoVivo,
    periodo: rotuloPeriodoEficiencia(mesFiltro, ano),
  })

  const chartData = mesesEscopo
    .filter((m: GestaoVistaMesRow) => m.inadimplenciaPct != null)
    .map((m: GestaoVistaMesRow) => ({ mes: m.mes, valor: m.inadimplenciaPct! }))

  return (
    <div className="space-y-5">
      <EficienciaDetailFilters
        ano={ano}
        showArea={false}
        responsavel={responsavel ?? null}
        onResponsavelChange={onResponsavelChange ?? (() => undefined)}
        responsavelEnabled={responsavelEnabled ?? false}
        responsavelHintDisabled={responsavelHintDisabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Índice de Inadimplência Gestão a Vista"
          value={
            overviewGestaoVista?.acumulado.value != null
              ? formatPercent(overviewGestaoVista.acumulado.value)
              : '—'
          }
          hint="Saldo ao vivo ÷ previsto · jun→hoje"
          icon={AlertTriangle}
          accentClass="bg-slate-100 text-slate-700"
          loading={isLoading || loadingAoVivoGestaoVista}
          fenix={{
            chave: 'eficiencia.inadimplencia.gestao-vista',
            explicar: () => explicarInadimplenciaIndice(fenixCtx('gestao_vista')),
          }}
        />
        <EficienciaKpiCard
          title="Índice de Inadimplência no período selecionado"
          value={
            overview?.acumulado.value != null
              ? formatPercent(overview.acumulado.value)
              : '—'
          }
          hint="Saldo ao vivo ÷ previsto · meses filtrados"
          icon={AlertTriangle}
          accentClass="bg-amber-100 text-amber-800"
          loading={isLoading || loadingAoVivo}
          fenix={{
            chave: 'eficiencia.inadimplencia.periodo',
            explicar: () => explicarInadimplenciaIndice(fenixCtx('periodo')),
          }}
        />
        <EficienciaKpiCard
          title="Saldo inadimplência (período selecionado)"
          value={
            aoVivo
              ? new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                }).format(aoVivo.valor)
              : '—'
          }
          hint="Saldo ao vivo do período (com baixa de pagamento posterior)"
          icon={AlertTriangle}
          accentClass="bg-slate-100 text-slate-700"
          loading={loadingAoVivo}
          fenix={{
            chave: 'eficiencia.inadimplencia.saldo',
            explicar: () => explicarInadimplenciaSaldo(fenixCtx('periodo')),
          }}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Índice de Inadimplência"
        subtitle="% saldo congelado ÷ previsto (a partir de junho)"
        data={chartData}
        fenix={{
          chave: 'eficiencia.inadimplencia.grafico',
          explicar: (ponto) =>
            explicarGraficoInadimplencia(
              {
                tela: TELA_EFICIENCIA_PESSOAS.inadimplencia,
                ano,
                mesFiltro,
                data: chartData,
                meses: data?.meses ?? [],
              },
              ponto,
            ),
        }}
        color="#d97706"
        onRacionalClick={() => setRacionalAberto(true)}
      />

      <RacionalSheet
        indicador={racionalAberto ? 'indice_inadimplencia' : null}
        titulo="Índice de Inadimplência"
        ano={ano}
        mes={mesFiltro}
        area={null}
        resultado={overview?.acumulado ?? null}
        metaAcumulado={EFICIENCIA_META_INDICE_INADIMPLENCIA}
        metaLabel={`Meta ${EFICIENCIA_META_INDICE_INADIMPLENCIA}%`}
        metaComparacao="maximo"
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
