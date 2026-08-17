import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileCheck2,
  FolderKanban,
  CalendarCheck2,
  Newspaper,
  GraduationCap,
  UserMinus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_AREA_OPS_LEGAIS,
  EFICIENCIA_META_OPS_CADASTRO,
  EFICIENCIA_META_OPS_EFICIENCIA,
  EFICIENCIA_META_OPS_PUBLICACOES,
  EFICIENCIA_META_OPS_SLA_PROTOCOLO,
  filtrarMensalPorMesFiltro,
  isDiaFiltro,
  isPeriodoCurtoFiltro,
  isSemanaFiltro,
  mesNoFiltro,
  rangeDiaFiltro,
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
import { OpsLegaisTarefasRanking } from './OpsLegaisTarefasRanking'
import { OpsLegaisResponsumPanel } from './OpsLegaisResponsumPanel'
import { RacionalSheet } from './RacionalSheet'
import { OpsLegaisTreinamentosSection } from './OpsLegaisTreinamentosSection'
import { OpsLegaisInconsistenciasCard } from './OpsLegaisInconsistenciasCard'
import { OverviewRacionalButton } from './OverviewKpiHeatRow'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { totaisOpsCadastroFromResumo } from '../utils/periodoCurtoIndicadorTotais'

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
  /** Controla a seção quando a navegação está na página (tabs). */
  secao?: SecaoId
  hideSecaoNav?: boolean
}

function formatMeses(m: number | null): string {
  if (m == null) return '—'
  const anos = Math.floor(m / 12)
  const meses = m % 12
  if (anos === 0) return `${meses}m`
  return `${anos}a ${meses}m`
}

export function OperacoesLegaisRgTab({
  ano,
  mesFiltro,
  secao: secaoProp,
  hideSecaoNav = false,
}: Props) {
  const [secaoInterna, setSecaoInterna] = useState<SecaoId>('protocolos')
  const secao = secaoProp ?? secaoInterna
  const setSecao = setSecaoInterna
  const [racionalAberto, setRacionalAberto] = useState<RacionalIndicador | null>(null)
  const {
    protocoloMensal,
    cadastroMensal,
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

  const { itens, loading: loadingTreino } = useTreinamentos(ano, EFICIENCIA_AREA_OPS_LEGAIS)
  const { anual: turnAnual, desligamentos, loading: loadingTurn } = useTurnover(
    ano,
    EFICIENCIA_AREA_OPS_LEGAIS,
  )
  const { data: ativosOpsData, isLoading: loadingAtivosOps } = useQuery({
    queryKey: ['eficiencia', 'ops-turnover-ativos-detalhe', ano],
    queryFn: () =>
      eficienciaService.fetchTurnoverAtivosAreaDetalhe(ano, EFICIENCIA_AREA_OPS_LEGAIS),
    enabled: secao === 'treinamentos' || secao === 'turnover',
  })
  const ativosOps: Array<{ nome: string; cargo: string | null; admissao: string | null }> =
    ativosOpsData ?? []
  const loadingAtivosTreino = loadingAtivosOps
  // KPI anual conta só Voluntário; lista segue a mesma regra + área Ops + filtro de mês.
  const desligamentosOps = useMemo(() => {
    return desligamentos
      .filter((d) => d.area === EFICIENCIA_AREA_OPS_LEGAIS)
      .filter((d) => {
        // Não usar includes('volunt'): "Involuntário" também contém "volunt".
        const tipo = String(d.tipo_desligamento ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('pt-BR')
          .trim()
        return tipo === 'voluntario'
      })
      .filter((d) => {
        if (!d.desligamento) return false
        const iso = String(d.desligamento).slice(0, 10)
        const mes = Number(iso.slice(5, 7))
        if (!Number.isFinite(mes) || mes < 1 || mes > 12) return false
        return mesNoFiltro(mes, mesFiltro, ano)
      })
  }, [desligamentos, mesFiltro, ano])
  const ativosOpsComTempo = useMemo(() => {
    const ref = new Date(ano, 11, 31)
    return [...ativosOps].map((p) => {
      const adm = p.admissao ? new Date(`${String(p.admissao).slice(0, 10)}T12:00:00`) : null
      const meses =
        adm && !Number.isNaN(adm.getTime())
          ? (ref.getFullYear() - adm.getFullYear()) * 12 + (ref.getMonth() - adm.getMonth())
          : 0
      return {
        nome: p.nome,
        area: EFICIENCIA_AREA_OPS_LEGAIS,
        cargo: p.cargo,
        admissao: p.admissao,
        meses_casa: Math.max(0, meses),
      }
    })
  }, [ativosOps, ano])
  const top5Ops = useMemo(
    () => [...ativosOpsComTempo].sort((a, b) => b.meses_casa - a.meses_casa).slice(0, 5),
    [ativosOpsComTempo],
  )
  /** Ordem alfabética por nome. */
  const pessoasAtivasOps = useMemo(
    () =>
      [...ativosOpsComTempo].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    [ativosOpsComTempo],
  )
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  const periodoCurtoAtivo = isPeriodoCurtoFiltro(mesFiltro)
  const periodoCurtoLabel = isSemanaFiltro(mesFiltro)
    ? rangeSemanaFiltro(mesFiltro).label
    : isDiaFiltro(mesFiltro)
      ? rangeDiaFiltro(mesFiltro).label
      : null

  const protFiltrado = filtrarMensalPorMesFiltro(protocoloMensal, mesFiltro, ano)
  const cadFiltrado = filtrarMensalPorMesFiltro(cadastroMensal, mesFiltro, ano)
  const pubAnaliseFiltrado = filtrarMensalPorMesFiltro(publicacoesAnalise, mesFiltro, ano)
  const pubAgendaFiltrado = filtrarMensalPorMesFiltro(publicacoesAgendamento, mesFiltro, ano)

  const { data: resumosSemana, isLoading: loadingSemana } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-rg-semana', ano, mesFiltro],
    enabled: periodoCurtoAtivo,
    queryFn: async () => {
      const [sla, efi, analise, agenda, cad] = await Promise.all([
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
        eficienciaService.fetchRacionalResumoOnly('ops_legais_cadastro', ano, null, mesFiltro),
      ])
      return { sla, efi, analise, agenda, cad }
    },
  })

  const protTotais = useMemo(() => {
    if (periodoCurtoAtivo && resumosSemana) {
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
  }, [protFiltrado, periodoCurtoAtivo, resumosSemana])

  const pubAnaliseTotais = useMemo(() => {
    if (periodoCurtoAtivo && resumosSemana) {
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
  }, [pubAnaliseFiltrado, periodoCurtoAtivo, resumosSemana])

  const pubAgendaTotais = useMemo(() => {
    if (periodoCurtoAtivo && resumosSemana) {
      const ok = resumosSemana.agenda?.qtd_eficiencia ?? 0
      const nok = resumosSemana.agenda?.qtd_inconsistencia ?? 0
      const t = ok + nok
      return { ok, nok, pct: t > 0 ? (ok / t) * 100 : 0 }
    }
    const ok = pubAgendaFiltrado.reduce((s, m) => s + (m.qtd_eficiencia ?? 0), 0)
    const nok = pubAgendaFiltrado.reduce((s, m) => s + (m.qtd_desvio ?? 0), 0)
    const t = ok + nok
    return { ok, nok, pct: t > 0 ? (ok / t) * 100 : 0 }
  }, [pubAgendaFiltrado, periodoCurtoAtivo, resumosSemana])

  const cadTotais = useMemo(() => {
    if (periodoCurtoAtivo && resumosSemana?.cad) {
      const t = totaisOpsCadastroFromResumo(resumosSemana.cad)
      return { dentro: t.dentro, fora: t.fora, tot: t.total, pct: t.pct }
    }
    const dentro = cadFiltrado.reduce((s, m) => s + m.dentro_prazo, 0)
    const fora = cadFiltrado.reduce((s, m) => s + m.fora_prazo, 0)
    const tot = dentro + fora
    return { dentro, fora, tot, pct: tot > 0 ? (dentro / tot) * 100 : null }
  }, [cadFiltrado, periodoCurtoAtivo, resumosSemana])

  return (
    <div className="space-y-5">
      {!hideSecaoNav ? (
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
      ) : null}

      {secao === 'protocolos' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SLA PROTOCOLO
                </h3>
                <OverviewRacionalButton
                  onClick={() => setRacionalAberto('ops_legais_sla_protocolo')}
                  className="w-auto"
                />
              </div>
              <EficienciaEficDesvioCard
                okLabel="D1"
                nokLabel="PROTOCOLADO NO FATAL"
                qtdOk={protTotais.qtdD1}
                qtdNok={protTotais.qtdFatal}
                loading={loading || (periodoCurtoAtivo && loadingSemana)}
              />
              <OpsLegaisInconsistenciasCard
                indicador="ops_legais_sla_protocolo"
                ano={ano}
                mesFiltro={mesFiltro}
                title="Inconsistências — Protocolado no Fatal"
                enabled={secao === 'protocolos'}
              />
              <EficienciaEvolucaoChart
                title="SLA PROTOCOLO"
                data={
                  periodoCurtoAtivo
                    ? [
                        {
                          mes: 1,
                          valor: protTotais.pctD1,
                          label: periodoCurtoLabel ?? 'Período',
                        },
                      ]
                    : protFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_d1 ?? 0),
                      }))
                }
                color="#7c3aed"
                metaFixa={EFICIENCIA_META_OPS_SLA_PROTOCOLO}
                onRacionalClick={() => setRacionalAberto('ops_legais_sla_protocolo')}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Eficiência Protocolo
                </h3>
                <OverviewRacionalButton
                  onClick={() => setRacionalAberto('ops_legais_eficiencia_protocolo')}
                  className="w-auto"
                />
              </div>
              <EficienciaEficDesvioCard
                okLabel="Eficiência"
                nokLabel="Inconsistência"
                qtdOk={protTotais.semInc}
                qtdNok={protTotais.comInc}
                loading={loading || (periodoCurtoAtivo && loadingSemana)}
              />
              <OpsLegaisInconsistenciasCard
                indicador="ops_legais_eficiencia_protocolo"
                ano={ano}
                mesFiltro={mesFiltro}
                title="Inconsistências — Controladoria"
                enabled={secao === 'protocolos'}
              />
              <EficienciaEvolucaoChart
                title="Eficiência Protocolo"
                data={
                  periodoCurtoAtivo
                    ? [
                        {
                          mes: 1,
                          valor: protTotais.pctInc,
                          label: periodoCurtoLabel ?? 'Período',
                        },
                      ]
                    : protFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_sem_inconsistencia),
                      }))
                }
                color="#059669"
                metaFixa={EFICIENCIA_META_OPS_EFICIENCIA}
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
                loading={loading || (periodoCurtoAtivo && loadingSemana)}
              />
              <OpsLegaisInconsistenciasCard
                indicador="ops_legais_pub_analise"
                ano={ano}
                mesFiltro={mesFiltro}
                title="Inconsistências — Análise"
                enabled={secao === 'publicacoes'}
              />
              <EficienciaEvolucaoChart
                title="ANÁLISE DE PUBLICAÇÃO"
                data={
                  periodoCurtoAtivo
                    ? [
                        {
                          mes: 1,
                          valor: pubAnaliseTotais.pct,
                          label: periodoCurtoLabel ?? 'Período',
                        },
                      ]
                    : pubAnaliseFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_eficiencia ?? 0),
                      }))
                }
                color="#0891b2"
                metaFixa={EFICIENCIA_META_OPS_PUBLICACOES}
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
                loading={loading || (periodoCurtoAtivo && loadingSemana)}
              />
              <OpsLegaisInconsistenciasCard
                indicador="ops_legais_pub_agendamento"
                ano={ano}
                mesFiltro={mesFiltro}
                title="Inconsistências — Agendamento"
                enabled={secao === 'publicacoes'}
              />
              <EficienciaEvolucaoChart
                title="AGENDAMENTO DE PUBLICAÇÃO"
                data={
                  periodoCurtoAtivo
                    ? [
                        {
                          mes: 1,
                          valor: pubAgendaTotais.pct,
                          label: periodoCurtoLabel ?? 'Período',
                        },
                      ]
                    : pubAgendaFiltrado.map((m) => ({
                        mes: m.mes,
                        valor: Number(m.pct_eficiencia ?? 0),
                      }))
                }
                color="#0e7490"
                metaFixa={EFICIENCIA_META_OPS_PUBLICACOES}
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
            Controladoria da operação (Isadora, Maria Júlia, Marina, Natália) — % de conformidade
            (DePara via Adesão ao Indicador: vazio/SEM ADESÃO = OK). População: Abertura de Pasta,
            Abertura de Pasta Com Agendamentos e Serviço. Meta{' '}
            {formatPercent(EFICIENCIA_META_OPS_CADASTRO)}.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <EficienciaKpiCard
                title="Eficiência Cadastro"
                value={cadTotais.pct != null ? formatPercent(cadTotais.pct) : '—'}
                hint="Cadastrar processos sem erros de inconsistência no sistema"
                meta={formatPercent(EFICIENCIA_META_OPS_CADASTRO)}
                atingiuMeta={
                  cadTotais.pct != null ? cadTotais.pct >= EFICIENCIA_META_OPS_CADASTRO : null
                }
                icon={FolderKanban}
                accentClass="bg-emerald-100 text-emerald-700"
                loading={loading}
              />
              <EficienciaEficDesvioCard
                okLabel="Em conformidade"
                nokLabel="Inconsistências"
                qtdOk={cadTotais.dentro}
                qtdNok={cadTotais.fora}
                loading={loading}
              />
              <OpsLegaisInconsistenciasCard
                indicador="ops_legais_cadastro"
                ano={ano}
                mesFiltro={mesFiltro}
                title="Inconsistências — Cadastro"
                enabled={secao === 'cadastro'}
              />
            </div>
            <EficienciaEvolucaoChart
              title="Eficiência Cadastro"
              subtitle="BI · DePara · controladoria · Abertura/Serviço"
              data={cadFiltrado.map((m) => ({
                mes: m.mes,
                valor: Number(m.pct_dentro_prazo),
              }))}
              color="#059669"
              metaFixa={EFICIENCIA_META_OPS_CADASTRO}
              onRacionalClick={() => setRacionalAberto('ops_legais_cadastro')}
            />
          </div>
        </div>
      )}

      {secao === 'treinamentos' && (
        <OpsLegaisTreinamentosSection
          ativos={ativosOps}
          itens={itens}
          ano={ano}
          loading={loadingTreino || loadingAtivosTreino}
        />
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Top tempo de casa</h2>
              {loadingTurn || loadingAtivosOps ? (
                <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ) : top5Ops.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Sem dados.</p>
              ) : (
                <ol className="divide-y divide-slate-50">
                  {top5Ops.map((p, idx) => {
                    const nome = resolvePessoaDisplayNome(p.nome, teamMembers, avatarCatalog)
                    const avatarUrl = resolvePessoaAvatarUrl(p.nome, teamMembers, avatarCatalog)
                    return (
                      <li
                        key={p.nome}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                              idx === 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {idx + 1}
                          </span>
                          <Avatar
                            src={avatarUrl}
                            fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                            fullName={nome}
                            size="md"
                            className="h-9 w-9 shrink-0 text-xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{nome}</p>
                            <p className="truncate text-xs text-slate-400">{p.cargo ?? '—'}</p>
                          </div>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                          {formatMeses(p.meses_casa)}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Pessoas Ativas</h2>
                {pessoasAtivasOps.length > 0 ? (
                  <span className="text-xs text-slate-400">
                    {pessoasAtivasOps.length}{' '}
                    {pessoasAtivasOps.length === 1 ? 'pessoa' : 'pessoas'} · A–Z
                  </span>
                ) : null}
              </div>
              {loadingTurn || loadingAtivosOps ? (
                <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ) : pessoasAtivasOps.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Sem ativos.</p>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                        <th className="py-2 pr-2 font-medium tabular-nums">#</th>
                        <th className="py-2 pr-3 font-medium">Colaborador</th>
                        <th className="hidden py-2 pr-3 font-medium sm:table-cell">Cargo</th>
                        <th className="py-2 pl-2 text-right font-medium md:text-left">
                          Admissão
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pessoasAtivasOps.map((p, idx) => {
                        const nome = resolvePessoaDisplayNome(p.nome, teamMembers, avatarCatalog)
                        const avatarUrl = resolvePessoaAvatarUrl(
                          p.nome,
                          teamMembers,
                          avatarCatalog,
                        )
                        return (
                          <tr key={p.nome} className="text-slate-700">
                            <td className="py-2 pr-2 align-middle text-xs tabular-nums text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 pr-3 align-middle">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <Avatar
                                  src={avatarUrl}
                                  fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                                  fullName={nome}
                                  size="sm"
                                  className="h-8 w-8 shrink-0 text-[10px]"
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-900">{nome}</p>
                                  <p className="truncate text-[11px] text-slate-400 sm:hidden">
                                    {p.cargo ?? '—'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden max-w-[140px] truncate py-2 pr-3 align-middle text-slate-600 sm:table-cell">
                              {p.cargo ?? '—'}
                            </td>
                            <td className="whitespace-nowrap py-2 pl-2 text-right align-middle tabular-nums text-slate-600 md:text-left">
                              {p.admissao ? formatDate(p.admissao) : '—'}
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

          <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Desligamentos no ano</h2>
            {loadingTurn ? (
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ) : desligamentosOps.length === 0 ? (
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
                    {desligamentosOps.map((d, i) => {
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
                  : racionalAberto === 'ops_legais_cadastro'
                    ? 'Eficiência Cadastro'
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
