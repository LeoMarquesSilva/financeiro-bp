import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { differenceInDays, differenceInMonths } from 'date-fns'
import { UserMinus } from 'lucide-react'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate, formatPercent } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import type { MesFiltroEficiencia } from '../constants'
import { useTurnover } from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { eficienciaService } from '../services/eficienciaService'
import type { ColaboradorFeriasRow } from '../types/eficiencia.types'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { normalizeNomeChave } from '../utils/racionalQuery'
import { filtrarPorResponsavel } from '../utils/responsavelMatch'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { OverviewRacionalButton } from './OverviewKpiHeatRow'
import { RacionalSheet } from './RacionalSheet'
import type { HeatCell } from './OverviewKpiHeatRow'

function dataRefTempoCasa(ano: number, hoje = new Date()): Date {
  if (ano === hoje.getFullYear()) {
    return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0)
  }
  return new Date(ano, 11, 31, 12, 0, 0)
}

function formatTempoCasa(admissao: Date | null, ref: Date): string {
  if (!admissao) return '—'
  const meses = Math.max(0, differenceInMonths(ref, admissao))
  if (meses < 1) {
    return `${Math.max(0, differenceInDays(ref, admissao))}d`
  }
  const anos = Math.floor(meses / 12)
  const mesesRest = meses % 12
  if (anos === 0) return `${mesesRest}m`
  return `${anos}a ${mesesRest}m`
}

function formatMeses(m: number | null): string {
  if (m == null) return '—'
  const anos = Math.floor(m / 12)
  const meses = m % 12
  if (anos === 0) return `${meses}m`
  return `${anos}a ${meses}m`
}

function formatFeriasLinha(f: ColaboradorFeriasRow | undefined): string {
  if (!f) return 'Férias —'
  if (f.vacation_exempt) return 'Férias isento'
  if (f.em_ferias && f.ferias_fim) {
    return `Em férias até ${formatDate(f.ferias_fim)}`
  }
  return `Férias ${f.saldo_dias}d pendentes`
}

type Props = {
  ano: number
  /** Indicador anual: Resultado = ano todo (mesma regra do Overview). */
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function TurnoverTab({
  ano,
  mesFiltro,
  responsavel = null,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { anual, desligamentos, loading } = useTurnover(ano, area)
  const { data: ativosData, isLoading: loadingAtivos } = useQuery({
    queryKey: ['eficiencia', 'turnover-ativos', ano, area],
    queryFn: () => eficienciaService.fetchTurnoverAtivosAreaDetalhe(ano, area),
  })
  const { data: feriasData } = useQuery({
    queryKey: ['eficiencia', 'colaboradores-ferias'],
    queryFn: () => eficienciaService.fetchColaboradoresFerias(),
    staleTime: 5 * 60 * 1000,
  })
  const feriasPorNome = useMemo(() => {
    const map = new Map<string, ColaboradorFeriasRow>()
    for (const row of feriasData ?? []) {
      map.set(normalizeNomeChave(row.full_name), row)
      map.set(normalizeNomeChave(row.nome_chave), row)
    }
    return map
  }, [feriasData])
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()
  const mesRacional: MesFiltroEficiencia =
    mesFiltro === 'resultado' ? null : mesFiltro
  const desligamentosFiltrados = filtrarPorResponsavel(
    area ? desligamentos.filter((d) => d.area === area) : desligamentos,
    (d) => d.nome,
    responsavel,
  )
  const ativosComTempo = useMemo(() => {
    const ref = dataRefTempoCasa(ano)
    return (ativosData ?? []).map((p) => {
      const adm = p.admissao ? new Date(`${String(p.admissao).slice(0, 10)}T12:00:00`) : null
      const valido = adm && !Number.isNaN(adm.getTime()) ? adm : null
      return {
        nome: p.nome,
        area: p.area,
        cargo: p.cargo,
        tempoLabel: formatTempoCasa(valido, ref),
        diasCasa: valido ? Math.max(0, differenceInDays(ref, valido)) : 0,
      }
    })
  }, [ativosData, ano])
  const ativosFiltrados = filtrarPorResponsavel(
    [...ativosComTempo].sort((a, b) => b.diasCasa - a.diasCasa),
    (p) => p.nome,
    responsavel,
  )

  const resultadoRacional: HeatCell | null = anual
    ? { value: anual.pct_retencao, label: formatPercent(anual.pct_retencao) }
    : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <EficienciaDetailFilters
            ano={ano}
            mesFiltro={mesFiltro}
            area={area}
            onAreaChange={setArea}
            allowedAreas={allowedAreas}
            allowTodas={allowTodas}
            responsavel={responsavel}
            onResponsavelChange={onResponsavelChange ?? (() => undefined)}
            responsavelEnabled={responsavelEnabled}
            responsavelHintDisabled={responsavelHintDisabled}
          />
        </div>
        <OverviewRacionalButton onClick={() => setRacionalAberto(true)} className="w-auto" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Retenção de talentos"
          value={anual ? formatPercent(anual.pct_retencao) : '—'}
          meta={anual ? `mín. ${formatPercent(anual.meta_pct_retencao_minima)}` : undefined}
          atingiuMeta={anual ? anual.pct_retencao >= anual.meta_pct_retencao_minima : null}
          icon={UserMinus}
          accentClass="bg-teal-100 text-teal-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Funcionários ativos"
          value={anual ? String(anual.funcionarios_ativos) : '—'}
          icon={UserMinus}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Saídas voluntárias no ano"
          value={anual ? String(anual.saidas_voluntarias) : '—'}
          icon={UserMinus}
          accentClass="bg-rose-100 text-rose-700"
          loading={loading}
        />
      </div>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          {area ? 'Ativos da área' : 'Colaboradores ativos'}
          {!loadingAtivos && ativosFiltrados.length > 0 ? (
            <span className="ml-1.5 font-normal text-slate-400">· {ativosFiltrados.length}</span>
          ) : null}
        </h2>
        {loadingAtivos ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ) : ativosFiltrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sem dados de colaboradores ativos.</p>
        ) : (
          <ul className="max-h-[480px] divide-y divide-slate-50 overflow-y-auto">
            {ativosFiltrados.map((p) => {
              const nome = resolvePessoaDisplayNome(p.nome, teamMembers, avatarCatalog)
              const avatarUrl = resolvePessoaAvatarUrl(p.nome, teamMembers, avatarCatalog)
              const ferias = feriasPorNome.get(normalizeNomeChave(p.nome))
              return (
                <li key={p.nome} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      src={avatarUrl}
                      fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                      fullName={nome}
                      size="md"
                      className="h-9 w-9 shrink-0 text-xs"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{nome}</p>
                      <p className="text-xs text-slate-400">
                        {p.cargo ?? '—'} · {p.area ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-slate-700">
                      {p.tempoLabel}
                    </p>
                    <p
                      className={
                        ferias?.em_ferias
                          ? 'text-[11px] font-medium text-amber-700'
                          : 'text-[11px] tabular-nums text-slate-400'
                      }
                    >
                      {formatFeriasLinha(ferias)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Desligamentos no ano</h2>
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ) : desligamentosFiltrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhum desligamento no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Nome</th>
                  <th className="py-2 pr-3 font-medium">Área</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Desligamento</th>
                  <th className="py-2 pr-3 text-right font-medium">Tempo de casa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {desligamentosFiltrados.map((d, i) => {
                  const nome = resolvePessoaDisplayNome(d.nome, teamMembers, avatarCatalog)
                  const avatarUrl = resolvePessoaAvatarUrl(d.nome, teamMembers, avatarCatalog)
                  return (
                    <tr key={i} className="text-slate-700">
                      <td className="py-2 pr-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            src={avatarUrl}
                            fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                            fullName={nome}
                            size="sm"
                            className="h-8 w-8 shrink-0 text-[10px]"
                          />
                          <span className="truncate font-medium text-slate-900">{nome}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3">{d.area ?? '—'}</td>
                      <td className="py-2 pr-3">{d.tipo_desligamento ?? '—'}</td>
                      <td className="py-2 pr-3">{formatDate(d.desligamento)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMeses(d.meses_casa)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RacionalSheet
        indicador={racionalAberto ? 'retencao_talentos' : null}
        titulo="Retenção de Talentos"
        ano={ano}
        mes={mesRacional}
        area={area}
        responsavel={responsavel}
        resultado={resultadoRacional}
        metaAcumulado={anual?.meta_pct_retencao_minima ?? 90}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
