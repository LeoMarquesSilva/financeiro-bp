import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileCheck2,
  FolderKanban,
  CalendarCheck2,
  Newspaper,
  GraduationCap,
  UserMinus,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/shared/utils/format'
import {
  filtrarMensalPorMesFiltro,
  isSemanaFiltro,
  rangeSemanaFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import type { RacionalIndicador } from '../types/eficiencia.types'
import {
  useOpsLegaisRg,
  useOpsLegaisTarefas,
  useTreinamentos,
  useTurnover,
} from '../hooks/useEficiencia'
import { eficienciaService } from '../services/eficienciaService'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEficDesvioCard } from './EficienciaEficDesvioCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingChart } from './EficienciaRankingChart'
import { OpsLegaisTarefasRanking } from './OpsLegaisTarefasRanking'
import { OpsLegaisResponsumPanel } from './OpsLegaisResponsumPanel'
import { RacionalSheet } from './RacionalSheet'
import { TreinamentosPessoaCards } from './TreinamentosPessoaCards'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'

const BI_BAR = '#94a3b8'

type SecaoId =
  | 'protocolos'
  | 'publicacoes'
  | 'tarefas'
  | 'cadastro'
  | 'treinamentos'
  | 'turnover'

const SECOES: { id: SecaoId; label: string; icon: typeof FileCheck2 }[] = [
  { id: 'protocolos', label: 'SLA Protocolos', icon: FileCheck2 },
  { id: 'publicacoes', label: 'SLA Publicações', icon: Newspaper },
  { id: 'tarefas', label: 'Tarefas', icon: CalendarCheck2 },
  { id: 'cadastro', label: 'Cadastro', icon: FolderKanban },
  { id: 'treinamentos', label: 'Treinamentos', icon: GraduationCap },
  { id: 'turnover', label: 'Turnover', icon: UserMinus },
]

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

function formatMeses(m: number | null): string {
  if (m == null) return '—'
  const anos = Math.floor(m / 12)
  const meses = m % 12
  if (anos === 0) return `${meses}m`
  return `${anos}a ${meses}m`
}

export function OperacoesLegaisRgTab({ ano, mesFiltro }: Props) {
  const [secao, setSecao] = useState<SecaoId>('protocolos')
  const [racionalAberto, setRacionalAberto] = useState<RacionalIndicador | null>(null)
  const {
    protocoloMensal,
    cadastroMensal,
    cadastroRanking,
    publicacoesAnalise,
    publicacoesAgendamento,
    loading,
  } = useOpsLegaisRg(ano, mesFiltro)

  const {
    ranking: tarefasRanking,
    responsum,
    loading: loadingTarefas,
    error: errorTarefas,
  } = useOpsLegaisTarefas(ano, mesFiltro, secao === 'tarefas')

  // BI Ops Legais: por ora sem filtro de área (igual às páginas do PBIX sem slicer ativo).
  const { anual: treinAnual, porPessoa, itens, loading: loadingTreino } = useTreinamentos(ano, null)
  const { anual: turnAnual, desligamentos, top5, loading: loadingTurn } = useTurnover(ano, null)
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  const semanaAtiva = isSemanaFiltro(mesFiltro)
  const semanaLabel = semanaAtiva ? rangeSemanaFiltro(mesFiltro).label : null

  const protFiltrado = filtrarMensalPorMesFiltro(protocoloMensal, mesFiltro, ano)
  const cadFiltrado = filtrarMensalPorMesFiltro(cadastroMensal, mesFiltro, ano)
  const pubAnaliseFiltrado = filtrarMensalPorMesFiltro(publicacoesAnalise, mesFiltro, ano)
  const pubAgendaFiltrado = filtrarMensalPorMesFiltro(publicacoesAgendamento, mesFiltro, ano)

  const { data: resumosSemana, isLoading: loadingSemana } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-rg-semana', ano, mesFiltro],
    enabled: semanaAtiva,
    queryFn: async () => {
      const [sla, efi, analise, agenda] = await Promise.all([
        eficienciaService.fetchRacionalResumoOnly('ops_legais_sla_protocolo', ano, null, mesFiltro),
        eficienciaService.fetchRacionalResumoOnly(
          'ops_legais_eficiencia_protocolo',
          ano,
          null,
          mesFiltro,
        ),
        eficienciaService.fetchRacionalResumoOnly('ops_legais_pub_analise', ano, null, mesFiltro),
        eficienciaService.fetchRacionalResumoOnly(
          'ops_legais_pub_agendamento',
          ano,
          null,
          mesFiltro,
        ),
      ])
      return { sla, efi, analise, agenda }
    },
  })

  const protTotais = useMemo(() => {
    if (semanaAtiva && resumosSemana) {
      const qtdD1 = resumosSemana.sla?.qtd_d1 ?? 0
      const total = resumosSemana.sla?.qtd_total ?? 0
      const qtdFatal = Math.max(0, total - qtdD1)
      const semInc = resumosSemana.efi?.qtd_eficiencia ?? 0
      const efiBase = resumosSemana.efi?.qtd_total ?? semInc + (resumosSemana.efi?.qtd_inconsistencia ?? 0)
      return {
        total,
        qtdD1,
        qtdFatal,
        pctD1: total > 0 ? (qtdD1 / total) * 100 : 0,
        semInc,
        efiBase,
        pctInc: efiBase > 0 ? (semInc / efiBase) * 100 : 0,
        comInc: resumosSemana.efi?.qtd_inconsistencia ?? 0,
      }
    }
    const total = protFiltrado.reduce((s, m) => s + m.total, 0)
    const qtdD1 = protFiltrado.reduce((s, m) => s + (m.qtd_d1 ?? 0), 0)
    const qtdFatal = protFiltrado.reduce((s, m) => s + (m.qtd_protocolado_fatal ?? 0), 0)
    const efiBase = protFiltrado.reduce((s, m) => s + (m.total_eficiencia ?? 0), 0)
    const semInc = protFiltrado.reduce((s, m) => s + m.sem_inconsistencia, 0)
    return {
      total,
      qtdD1,
      qtdFatal,
      pctD1: total > 0 ? (qtdD1 / total) * 100 : 0,
      semInc,
      efiBase,
      pctInc: efiBase > 0 ? (semInc / efiBase) * 100 : 0,
      comInc: Math.max(0, efiBase - semInc),
    }
  }, [protFiltrado, semanaAtiva, resumosSemana])

  const pubAnaliseTotais = useMemo(() => {
    if (semanaAtiva && resumosSemana) {
      return {
        ok: resumosSemana.analise?.qtd_eficiencia ?? 0,
        nok: resumosSemana.analise?.qtd_inconsistencia ?? 0,
        pct: (() => {
          const ok = resumosSemana.analise?.qtd_eficiencia ?? 0
          const nok = resumosSemana.analise?.qtd_inconsistencia ?? 0
          const t = ok + nok
          return t > 0 ? (ok / t) * 100 : 0
        })(),
      }
    }
    const ok = pubAnaliseFiltrado.reduce((s, m) => s + (m.qtd_eficiencia ?? 0), 0)
    const nok = pubAnaliseFiltrado.reduce((s, m) => s + (m.qtd_desvio ?? 0), 0)
    const t = ok + nok
    return { ok, nok, pct: t > 0 ? (ok / t) * 100 : 0 }
  }, [pubAnaliseFiltrado, semanaAtiva, resumosSemana])

  const pubAgendaTotais = useMemo(() => {
    if (semanaAtiva && resumosSemana) {
      const ok = resumosSemana.agenda?.qtd_eficiencia ?? 0
      const nok = resumosSemana.agenda?.qtd_inconsistencia ?? 0
      const t = ok + nok
      return { ok, nok, pct: t > 0 ? (ok / t) * 100 : 0 }
    }
    const ok = pubAgendaFiltrado.reduce((s, m) => s + (m.qtd_eficiencia ?? 0), 0)
    const nok = pubAgendaFiltrado.reduce((s, m) => s + (m.qtd_desvio ?? 0), 0)
    const t = ok + nok
    return { ok, nok, pct: t > 0 ? (ok / t) * 100 : 0 }
  }, [pubAgendaFiltrado, semanaAtiva, resumosSemana])

  const cadTotais = useMemo(() => {
    const dentro = cadFiltrado.reduce((s, m) => s + m.dentro_prazo, 0)
    const fora = cadFiltrado.reduce((s, m) => s + m.fora_prazo, 0)
    const tot = dentro + fora
    return { dentro, fora, tot, pct: tot > 0 ? (dentro / tot) * 100 : null }
  }, [cadFiltrado])

  const rankingFatalCad = useMemo(
    () =>
      cadastroRanking
        .filter((r) => (r.fora_prazo ?? 0) > 0)
        .map((r) => ({
          usuario: r.usuario,
          qtd_fatal: r.fora_prazo ?? 0,
          pct_do_total: r.pct_do_total,
        })),
    [cadastroRanking],
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        <p className="flex items-start gap-2 font-semibold">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Nova visualização — BI Operações Legais (RG)
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
          Espelho do PBIX Ops Legais: <span className="font-medium">sem filtro de área</span> por
          enquanto (mesma base das páginas do BI). Não altera o consolidado. Fase 1: Protocolos,
          Publicações, Tarefas/Cadastro, Treinamentos e Turnover.
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        {SECOES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSecao(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all',
              secao === id
                ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
            aria-pressed={secao === id}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {secao === 'protocolos' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                SLA PROTOCOLO
              </h3>
              <EficienciaEficDesvioCard
                okLabel="D1"
                nokLabel="PROTOCOLADO NO FATAL"
                qtdOk={protTotais.qtdD1}
                qtdNok={protTotais.qtdFatal}
                loading={loading || (semanaAtiva && loadingSemana)}
              />
              <EficienciaEvolucaoChart
                title="SLA PROTOCOLO"
                data={
                  semanaAtiva
                    ? [
                        {
                          mes: 1,
                          valor: protTotais.pctD1,
                          label: semanaLabel ?? 'Semana',
                        },
                      ]
                    : protFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_d1 ?? 0),
                      }))
                }
                color="#7c3aed"
                onRacionalClick={() => setRacionalAberto('ops_legais_sla_protocolo')}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Eficiência Protocolo
              </h3>
              <EficienciaEficDesvioCard
                okLabel="Eficiência"
                nokLabel="Inconsistência"
                qtdOk={protTotais.semInc}
                qtdNok={protTotais.comInc}
                loading={loading || (semanaAtiva && loadingSemana)}
              />
              <EficienciaEvolucaoChart
                title="Eficiência Protocolo"
                data={
                  semanaAtiva
                    ? [
                        {
                          mes: 1,
                          valor: protTotais.pctInc,
                          label: semanaLabel ?? 'Semana',
                        },
                      ]
                    : protFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_sem_inconsistencia),
                      }))
                }
                color="#059669"
                onRacionalClick={() => setRacionalAberto('ops_legais_eficiencia_protocolo')}
              />
            </div>
          </div>
        </div>
      )}

      {secao === 'publicacoes' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                ANÁLISE DE PUBLICAÇÃO
              </h3>
              <EficienciaEficDesvioCard
                okLabel="Eficiência de Publicação"
                nokLabel="Desvio"
                qtdOk={pubAnaliseTotais.ok}
                qtdNok={pubAnaliseTotais.nok}
                loading={loading || (semanaAtiva && loadingSemana)}
              />
              <EficienciaEvolucaoChart
                title="ANÁLISE DE PUBLICAÇÃO"
                data={
                  semanaAtiva
                    ? [
                        {
                          mes: 1,
                          valor: pubAnaliseTotais.pct,
                          label: semanaLabel ?? 'Semana',
                        },
                      ]
                    : pubAnaliseFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_eficiencia ?? 0),
                      }))
                }
                color="#0891b2"
                onRacionalClick={() => setRacionalAberto('ops_legais_pub_analise')}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                AGENDAMENTO DE PUBLICAÇÃO
              </h3>
              <EficienciaEficDesvioCard
                okLabel="Eficiência de Publicação"
                nokLabel="Desvio"
                qtdOk={pubAgendaTotais.ok}
                qtdNok={pubAgendaTotais.nok}
                loading={loading || (semanaAtiva && loadingSemana)}
              />
              <EficienciaEvolucaoChart
                title="AGENDAMENTO DE PUBLICAÇÃO"
                data={
                  semanaAtiva
                    ? [
                        {
                          mes: 1,
                          valor: pubAgendaTotais.pct,
                          label: semanaLabel ?? 'Semana',
                        },
                      ]
                    : pubAgendaFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_eficiencia ?? 0),
                      }))
                }
                color="#0e7490"
                onRacionalClick={() => setRacionalAberto('ops_legais_pub_agendamento')}
              />
            </div>
          </div>
        </div>
      )}

      {secao === 'tarefas' && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ranking de atividades
            </h3>
            <OpsLegaisTarefasRanking rows={tarefasRanking} loading={loadingTarefas} />
          </section>
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Responsum
            </h3>
            <OpsLegaisResponsumPanel
              data={responsum}
              loading={loadingTarefas}
              error={errorTarefas}
            />
          </section>
        </div>
      )}

      {secao === 'cadastro' && (
        <div className="space-y-5">
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Tarefas alinhadas ao BI CADASTRO (Abertura/Encerramento): Cadastro de Pasta/Cliente,
            Atualização de Cadastro, Ciência da Abertura e Verificar Encerramento — % D+1 via
            fatal_sem18_d1.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <EficienciaKpiCard
              title="Eficiência Cadastro D+1"
              value={cadTotais.pct != null ? formatPercent(cadTotais.pct) : '—'}
              hint={
                cadTotais.tot > 0
                  ? `${cadTotais.dentro} de ${cadTotais.tot} dentro do prazo`
                  : 'Sem tarefas no período'
              }
              icon={FolderKanban}
              accentClass="bg-indigo-100 text-indigo-700"
              loading={loading}
            />
            <EficienciaKpiCard
              title="Dentro do prazo"
              value={String(cadTotais.dentro)}
              icon={FolderKanban}
              accentClass="bg-emerald-100 text-emerald-700"
              loading={loading}
            />
            <EficienciaKpiCard
              title="Fora do prazo"
              value={String(cadTotais.fora)}
              icon={FolderKanban}
              accentClass="bg-rose-100 text-rose-700"
              loading={loading}
            />
          </div>
          <EficienciaEvolucaoChart
            title="Cadastro / Abertura / Encerramento"
            subtitle="Proxy do KPI_HTML_EFIC_CADASTRO · sem filtro de área"
            data={cadFiltrado.map((m) => ({
              mes: m.mes,
              valor: Number(m.pct_dentro_prazo),
            }))}
            color="#4f46e5"
          />
          <EficienciaRankingChart
            title="Fora do prazo por responsável"
            rows={rankingFatalCad}
            labelKey="usuario"
            valueKey="qtd_fatal"
            valueLabel="Qtd fora"
            color={BI_BAR}
            loading={loading}
            biStyle
            showAvatars
          />
        </div>
      )}

      {secao === 'treinamentos' && (
        <div className="space-y-5">
          <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <GraduationCap className="h-4 w-4" aria-hidden />
              Desenvolvimento (sem filtro de área)
            </div>
            {loadingTreino ? (
              <div className="mt-4 h-28 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <p
                className={`mt-3 text-center text-4xl font-bold tabular-nums ${
                  (treinAnual?.pct_atingimento ?? 0) < 100 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {treinAnual ? formatPercent(treinAnual.pct_atingimento) : '—'}
              </p>
            )}
          </section>
          <TreinamentosPessoaCards
            porPessoa={porPessoa}
            itens={itens}
            loading={loadingTreino}
          />
        </div>
      )}

      {secao === 'turnover' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <EficienciaKpiCard
              title="Retenção"
              value={turnAnual ? formatPercent(turnAnual.pct_retencao) : '—'}
              meta={
                turnAnual
                  ? `mín. ${formatPercent(turnAnual.meta_pct_retencao_minima)}`
                  : undefined
              }
              atingiuMeta={
                turnAnual
                  ? turnAnual.pct_retencao >= turnAnual.meta_pct_retencao_minima
                  : null
              }
              icon={UserMinus}
              accentClass="bg-teal-100 text-teal-700"
              loading={loadingTurn}
            />
            <EficienciaKpiCard
              title="Ativos"
              value={turnAnual ? String(turnAnual.funcionarios_ativos) : '—'}
              icon={UserMinus}
              accentClass="bg-slate-100 text-slate-700"
              loading={loadingTurn}
            />
            <EficienciaKpiCard
              title="Saídas voluntárias"
              value={turnAnual ? String(turnAnual.saidas_voluntarias) : '—'}
              icon={UserMinus}
              accentClass="bg-rose-100 text-rose-700"
              loading={loadingTurn}
            />
          </div>

          <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Top tempo de casa</h2>
            {loadingTurn ? (
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ) : top5.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Sem dados.</p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {top5.map((p) => {
                  const nome = resolvePessoaDisplayNome(p.nome, teamMembers, avatarCatalog)
                  const avatarUrl = resolvePessoaAvatarUrl(p.nome, teamMembers, avatarCatalog)
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
                          <p className="text-xs text-slate-400">{p.cargo ?? '—'}</p>
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                        {formatMeses(p.meses_casa)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Desligamentos no ano</h2>
            {loadingTurn ? (
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ) : desligamentos.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Nenhum desligamento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">Nome</th>
                      <th className="py-2 pr-3 font-medium">Tipo</th>
                      <th className="py-2 pr-3 font-medium">Desligamento</th>
                      <th className="py-2 pr-3 text-right font-medium">Tempo de casa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {desligamentos.map((d, i) => {
                      const nome = resolvePessoaDisplayNome(d.nome, teamMembers, avatarCatalog)
                      return (
                        <tr key={i} className="text-slate-700">
                          <td className="py-2 pr-3 font-medium text-slate-900">{nome}</td>
                          <td className="py-2 pr-3">{d.tipo_desligamento ?? '—'}</td>
                          <td className="py-2 pr-3">{formatDate(d.desligamento)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatMeses(d.meses_casa)}
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
      )}

      <RacionalSheet
        indicador={racionalAberto}
        titulo={
          racionalAberto === 'ops_legais_sla_protocolo'
            ? 'SLA PROTOCOLO'
            : racionalAberto === 'ops_legais_eficiencia_protocolo'
              ? 'Eficiência Protocolo'
              : racionalAberto === 'ops_legais_pub_analise'
                ? 'ANÁLISE DE PUBLICAÇÃO'
                : racionalAberto === 'ops_legais_pub_agendamento'
                  ? 'AGENDAMENTO DE PUBLICAÇÃO'
                  : ''
        }
        ano={ano}
        mes={mesFiltro}
        area={null}
        onClose={() => setRacionalAberto(null)}
      />
    </div>
  )
}
