import { useState } from 'react'
import { Download, Loader2, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/shared/components/Avatar'
import { formatPercent } from '@/shared/utils/format'
import { Button } from '@/components/ui/button'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import {
  filtrarMensalPorMesFiltro,
  MESES_EFICIENCIA,
  type MesFiltroEficiencia,
} from '../constants'
import { useGestaoPdi } from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { acumuladoGestaoPdi } from '../utils/gestaoPdiCalc'
import { exportGestaoPdiDesviosExcel } from '../utils/gestaoPdiExport'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { AreaFilterButtons } from './AreaFilterButtons'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

export function GestaoPdiTab({ ano, mesFiltro }: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [exportando, setExportando] = useState(false)
  const { mensal, detalhe, loading } = useGestaoPdi(ano, mesFiltro, area)
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()
  const mensalFiltrado = filtrarMensalPorMesFiltro(mensal, mesFiltro, ano)
  const acumulado = acumuladoGestaoPdi(mensal, mesFiltro, ano)

  const elegiveis = mensalFiltrado.reduce((s, m) => s + m.elegiveis, 0)
  const aptas = mensalFiltrado.reduce((s, m) => s + m.aptas, 0)
  const desvios = mensalFiltrado.reduce((s, m) => s + m.desvios, 0)
  const desviosLista = detalhe.filter((d) => !d.apta)

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
      <AreaFilterButtons
        value={area}
        onChange={setArea}
        allowedAreas={allowedAreas}
        allowTodas={allowTodas}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Gestão de PDI no período"
          value={acumulado.value != null ? formatPercent(acumulado.value) : '—'}
          hint={
            elegiveis > 0
              ? `${aptas} aptas de ${elegiveis} elegíveis`
              : 'Sem elegíveis no período'
          }
          meta="Meta 100%"
          atingiuMeta={acumulado.value != null ? acumulado.value >= 100 : null}
          icon={Target}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Aptas"
          value={String(aptas)}
          hint="Progresso alterou + evidência Sim + 1:1 ≥ 1"
          icon={Target}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Desvios"
          value={String(desvios)}
          hint="Faltou ao menos 1 dos 3 requisitos"
          icon={Target}
          accentClass="bg-rose-100 text-rose-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Gestão de PDI"
        subtitle="Junho = 100% (baseline). Julho+ = % aptas (3 requisitos)."
        data={mensalFiltrado
          .filter((m) => m.pct_aptas != null)
          .map((m) => ({ mes: m.mes, valor: m.pct_aptas!, meta: 100 }))}
        color="#059669"
      />

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <h2 className="text-center text-sm font-semibold text-slate-900">
            Desvios no período
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
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="px-2 py-2 font-medium">Mês</th>
                  <th className="px-2 py-2 font-medium">Colaborador</th>
                  <th className="px-2 py-2 font-medium">Área</th>
                  <th className="px-2 py-2 font-medium">Progresso anterior</th>
                  <th className="px-2 py-2 font-medium">Progresso</th>
                  <th className="px-2 py-2 font-medium">Evidências de Execução</th>
                  <th className="px-2 py-2 font-medium">1:1</th>
                  <th className="min-w-[14rem] px-2 py-2 font-medium">
                    Desvio Critério de Puração
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
                      <td className="px-2 py-2 align-middle">{MESES_EFICIENCIA[d.mes - 1]}</td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex items-center justify-center gap-2">
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
                      <td className="px-2 py-2 align-middle">{d.area ?? '—'}</td>
                      <td className="px-2 py-2 align-middle tabular-nums">
                        {d.progresso_anterior != null
                          ? formatPercent(d.progresso_anterior)
                          : '—'}
                      </td>
                      <td className="px-2 py-2 align-middle tabular-nums">
                        {d.progresso != null ? formatPercent(d.progresso) : '—'}
                      </td>
                      <td className="px-2 py-2 align-middle">{d.evidencias_execucao ?? '—'}</td>
                      <td className="px-2 py-2 align-middle tabular-nums">
                        {d.one_a_one != null ? d.one_a_one : '—'}
                      </td>
                      <td className="max-w-md whitespace-pre-line px-2 py-2 align-middle text-xs text-slate-600">
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
    </div>
  )
}
