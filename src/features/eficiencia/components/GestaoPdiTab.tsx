import { useState } from 'react'
import { Download, Loader2, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/shared/components/Avatar'
import { formatPercent } from '@/shared/utils/format'
import { Button } from '@/components/ui/button'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import {
  EFICIENCIA_META_PDI,
  filtrarMensalPorMesFiltro,
  filtroEfetivoGestaoAVista,
  MESES_EFICIENCIA,
  type MesFiltroEficiencia,
} from '../constants'
import { useGestaoPdi } from '../hooks/useEficiencia'
import { useEvolucaoPorResponsavel } from '../hooks/useEvolucaoPorResponsavel'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { acumuladoGestaoPdi } from '../utils/gestaoPdiCalc'
import { exportGestaoPdiDesviosExcel } from '../utils/gestaoPdiExport'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { filtrarPorResponsavel } from '../utils/responsavelMatch'
import { toPriMaiuscula } from '../utils/textFormat'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { RacionalSheet } from './RacionalSheet'
import type { HeatCell } from './OverviewKpiHeatRow'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
  /**
   * Trava a área (ex.: Operações Legais) e esconde o slicer —
   * reaproveita a mesma base do módulo jurídico.
   */
  areaFixa?: string
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function GestaoPdiTab({
  ano,
  mesFiltro,
  areaFixa,
  responsavel = null,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const { area: areaSlicer, setArea, allowedAreas, allowTodas } =
    useEficienciaAreaFilter()
  const area = areaFixa ?? areaSlicer
  const [exportando, setExportando] = useState(false)
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { mensal, detalhe, loading } = useGestaoPdi(ano, mesFiltro, area)
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const detalheFiltrado = filtrarPorResponsavel(detalhe, (d) => d.colaborador, responsavel)
  const {
    chartData: evolucaoResp,
    acumulado: acumResp,
    loading: loadingEvol,
  } = useEvolucaoPorResponsavel('gestao_pdi', ano, area, responsavel, mesFiltro)
  const acumulado = acumuladoGestaoPdi(mensal, mesFiltro, ano)
  const acumuladoGestaoVista = acumuladoGestaoPdi(
    mensal,
    filtroEfetivoGestaoAVista(ano),
    ano,
  )

  const aptas = responsavel
    ? acumResp.ok
    : mensalFiltrado.reduce((s, m) => s + m.aptas, 0)
  const desvios = responsavel
    ? Math.max(0, acumResp.total - acumResp.ok)
    : mensalFiltrado.reduce((s, m) => s + m.desvios, 0)
  const desviosLista = detalheFiltrado.filter((d) => !d.apta)
  const pctPeriodo = responsavel
    ? acumResp.pct
    : acumulado.value
  const resultadoRacional: HeatCell | null =
    pctPeriodo != null ? { value: pctPeriodo, label: formatPercent(pctPeriodo) } : null
  const chartData = responsavel
    ? evolucaoResp.map((p) => ({ ...p, meta: EFICIENCIA_META_PDI }))
    : mensalFiltrado
        .filter((m) => m.pct_aptas != null)
        .map((m) => ({ mes: m.mes, valor: m.pct_aptas!, meta: EFICIENCIA_META_PDI }))
  const loadingPeriodo = loading || Boolean(responsavel && loadingEvol)

  const handleExportarExcel = async () => {
    if (desviosLista.length === 0) return
    setExportando(true)
    try {
      await exportGestaoPdiDesviosExcel(desviosLista, {
        ano,
        areaLabel: area,
      })
      toast.success('Excel baixado')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível gerar o Excel'
      toast.error(message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-5">
      <EficienciaDetailFilters
        ano={ano}
        mesFiltro={mesFiltro}
        area={areaSlicer}
        onAreaChange={setArea}
        allowedAreas={allowedAreas}
        allowTodas={allowTodas}
        showArea={areaFixa == null}
        responsavel={responsavel}
        onResponsavelChange={onResponsavelChange ?? (() => undefined)}
        responsavelEnabled={responsavelEnabled}
        responsavelHintDisabled={responsavelHintDisabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <EficienciaKpiCard
          title="Gestão de PDI Gestão a Vista"
          value={
            acumuladoGestaoVista.value != null
              ? formatPercent(acumuladoGestaoVista.value)
              : '—'
          }
          hint="Aptas ÷ elegíveis (prog.+evid.+1:1) · jun→hoje"
          icon={Target}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Gestão de PDI no período selecionado"
          value={pctPeriodo != null ? formatPercent(pctPeriodo) : '—'}
          hint="Aptas ÷ elegíveis (prog.+evid.+1:1) · meses filtrados"
          meta="Meta 100%"
          atingiuMeta={pctPeriodo != null ? pctPeriodo >= 100 : null}
          icon={Target}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loadingPeriodo}
        />
        <EficienciaKpiCard
          title="Aptas"
          value={String(aptas)}
          hint="Progresso alterou + evidência Sim + 1:1 ≥ 1"
          icon={Target}
          accentClass="bg-slate-100 text-slate-700"
          loading={loadingPeriodo}
        />
        <EficienciaKpiCard
          title="Desvios"
          value={String(desvios)}
          hint="Faltou ao menos 1 dos 3 requisitos"
          icon={Target}
          accentClass="bg-rose-100 text-rose-700"
          loading={loadingPeriodo}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Gestão de PDI"
        subtitle={
          responsavel
            ? `% aptas · ${responsavel}`
            : 'Junho = 100% (baseline). Julho+ = % aptas (3 requisitos).'
        }
        data={chartData}
        color="#059669"
        metaFixa={EFICIENCIA_META_PDI}
        onRacionalClick={() => setRacionalAberto(true)}
      />

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <h2 className="text-center text-sm font-semibold text-slate-900">
            {toPriMaiuscula('Desvios no período selecionado')}
            {!loading && desviosLista.length > 0 ? (
              <span className="ml-2 font-normal text-slate-400">({desviosLista.length})</span>
            ) : null}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading || exportando || desviosLista.length === 0}
            onClick={() => void handleExportarExcel()}
          >
            {exportando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Excel
          </Button>
        </div>
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ) : desviosLista.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhum desvio no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="w-14 px-2 py-2 text-left font-medium">
                    {toPriMaiuscula('Mês')}
                  </th>
                  <th className="min-w-[10rem] px-2 py-2 text-left font-medium">
                    {toPriMaiuscula('Colaborador')}
                  </th>
                  <th className="min-w-[7rem] px-2 py-2 text-left font-medium">
                    {toPriMaiuscula('Área')}
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    {toPriMaiuscula('Progresso anterior')}
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    {toPriMaiuscula('Progresso')}
                  </th>
                  <th className="px-2 py-2 text-center font-medium">
                    {toPriMaiuscula('Evidências')}
                  </th>
                  <th className="w-12 px-2 py-2 text-center font-medium">1:1</th>
                  <th className="min-w-[14rem] px-2 py-2 text-left font-medium">
                    {toPriMaiuscula('Desvio Critério de Apuração')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {desviosLista.map((d) => {
                  const nome = resolvePessoaDisplayNome(
                    d.colaborador,
                    teamMembers,
                    avatarCatalog,
                  )
                  const avatarUrl = resolvePessoaAvatarUrl(
                    d.colaborador,
                    teamMembers,
                    avatarCatalog,
                  )
                  return (
                    <tr key={`${d.mes}-${d.colaborador}`} className="text-slate-700">
                      <td className="px-2 py-2 align-middle text-left tabular-nums">
                        {MESES_EFICIENCIA[d.mes - 1]}
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={avatarUrl}
                            fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                            fullName={nome}
                            size="sm"
                            className="h-8 w-8 shrink-0 text-[10px]"
                          />
                          <span className="font-medium text-slate-900">{nome}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle text-left">{d.area ?? '—'}</td>
                      <td className="px-2 py-2 align-middle text-right tabular-nums">
                        {d.progresso_anterior != null
                          ? formatPercent(d.progresso_anterior)
                          : '—'}
                      </td>
                      <td className="px-2 py-2 align-middle text-right tabular-nums">
                        {d.progresso != null ? formatPercent(d.progresso) : '—'}
                      </td>
                      <td className="px-2 py-2 align-middle text-center">
                        {d.evidencias_execucao ?? '—'}
                      </td>
                      <td className="px-2 py-2 align-middle text-center tabular-nums">
                        {d.one_a_one != null ? d.one_a_one : '—'}
                      </td>
                      <td className="max-w-md whitespace-pre-line px-2 py-2 align-middle text-left text-xs text-slate-600">
                        {d.desvio_criterio_apuracao?.trim() || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RacionalSheet
        indicador={racionalAberto ? 'gestao_pdi' : null}
        titulo="Gestão de PDI"
        ano={ano}
        mes={mesFiltro}
        area={area}
        responsavel={responsavel}
        resultado={resultadoRacional}
        metaAcumulado={EFICIENCIA_META_PDI}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
