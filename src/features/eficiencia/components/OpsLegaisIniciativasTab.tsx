import { Fragment, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  CalendarDays,
  Lightbulb,
  LineChart,
  RefreshCw,
  Sparkles,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/shared/utils/format'
import {
  isSemanaFiltro,
  mesNoFiltro,
  rangeSemanaFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type {
  OpsLegaisIniciativasDashboard,
  OpsLegaisIniciativasItemSemana,
  OpsLegaisIniciativasPainel,
  OpsLegaisIniciativasProjeto,
  OpsLegaisIniciativasSubtarefa,
} from '../types/eficiencia.types'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

type PainelView = 'concluidos' | 'semana' | 'andamento'

const STATUS_DOT: Record<string, string> = {
  concluido: '#059669',
  'in progress': '#1D4ED8',
  standby: '#D97706',
  backlog: '#6B7280',
  fechados: '#991B1B',
}

function formatDataBr(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function respLabel(v: string | null | undefined): string {
  return v?.trim() ? v : 'sem responsável'
}

function TituloLink({
  nome,
  url,
  className,
  onClick,
}: {
  nome: string
  url: string | null
  className?: string
  onClick?: (e: MouseEvent) => void
}) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={onClick}
        className={cn('font-semibold text-slate-900 hover:underline', className)}
      >
        {nome}
      </a>
    )
  }
  return <span className={cn('font-semibold text-slate-900', className)}>{nome}</span>
}

function SubChips({
  items,
  mode,
}: {
  items: OpsLegaisIniciativasSubtarefa[]
  mode: 'concluidos' | 'andamento'
}) {
  if (!items.length) return null
  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 px-2 py-2 leading-relaxed',
        mode === 'andamento' ? 'bg-amber-50' : 'bg-slate-50',
      )}
    >
      {items.map((s) => {
        const dataTxt = s.data ? formatDataBr(s.data) : 'em andamento'
        const meta =
          mode === 'andamento'
            ? `${s.status || '—'} · ${respLabel(s.responsavel)}`
            : `${respLabel(s.responsavel)} · ${dataTxt}`
        const dot = STATUS_DOT[s.status] ?? '#9CA3AF'
        return (
          <span
            key={s.id}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-700"
          >
            {mode === 'andamento' ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: dot }}
                aria-hidden
              />
            ) : (
              <span className="text-slate-400">↳</span>
            )}
            <span className="truncate">{s.nome}</span>
            <span className="truncate text-slate-400">({meta})</span>
          </span>
        )
      })}
    </div>
  )
}

function KpiShell({
  title,
  description,
  value,
  valueStyle,
  valueClassName,
  footer,
  iconWrapClass,
  icon: Icon,
  loading,
}: {
  title: string
  description: string
  value: string
  valueStyle?: CSSProperties
  valueClassName?: string
  footer: ReactNode
  iconWrapClass: string
  icon: typeof Lightbulb
  loading?: boolean
}) {
  return (
    <article className="flex min-h-[180px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full',
            iconWrapClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">{description}</p>
      {loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <p
          className={cn('mt-3 text-3xl font-bold tabular-nums text-slate-900', valueClassName)}
          style={valueStyle}
        >
          {value}
        </p>
      )}
      <div className="mt-2 text-xs text-slate-500">{!loading && footer}</div>
    </article>
  )
}

function projetoTemAtividadeNoFiltro(
  p: OpsLegaisIniciativasProjeto,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): boolean {
  if (projetoNoFiltro(p.data, mesFiltro, ano)) return true
  return p.subtarefas.some((s) => projetoNoFiltro(s.data, mesFiltro, ano))
}

function ProjetosRealizadosPanel({
  loading,
  painel,
  mesFiltroAtivo,
}: {
  loading: boolean
  mesFiltroAtivo: boolean
  painel:
    | {
        projetos_em_andamento: number
        tarefas_sob_em_andamento: number
        subtarefas_concluidas_periodo: number
        concluidos: OpsLegaisIniciativasProjeto[]
        semana: OpsLegaisIniciativasItemSemana[]
        semana_por_tarefa?: OpsLegaisIniciativasProjeto[]
        andamento: OpsLegaisIniciativasProjeto[]
      }
    | undefined
}) {
  const [view, setView] = useState<PainelView>('concluidos')
  const qtdAndamento = painel?.projetos_em_andamento ?? 0
  const qtdConcluidos = painel?.concluidos.length ?? 0
  const qtdSubConcluidasFiltro = useMemo(
    () =>
      (painel?.concluidos ?? []).reduce(
        (s, p) => s + p.subtarefas.filter((t) => t.status === 'concluido').length,
        0,
      ),
    [painel?.concluidos],
  )
  const semanaRows = painel?.semana_por_tarefa?.length
    ? painel.semana_por_tarefa
    : []

  const tabs: { id: PainelView; label: string; icon: typeof CheckCircle2 }[] = [
    {
      id: 'concluidos',
      label: `Concluídos (${loading ? '…' : qtdConcluidos})`,
      icon: CheckCircle2,
    },
    { id: 'semana', label: 'Semana passada', icon: CalendarDays },
    {
      id: 'andamento',
      label: `Em andamento (${qtdAndamento})`,
      icon: RefreshCw,
    },
  ]

  return (
    <div className="flex min-h-[335px] flex-col gap-1.5 overflow-hidden rounded-[10px] border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-100 text-[11px]">
            ✅
          </span>
          <h3 className="text-xs font-semibold text-slate-600">Projetos Realizados</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors',
                view === id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200',
              )}
              aria-pressed={view === id}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-slate-400">
        ✅{' '}
        <b className="text-slate-900">{loading ? '…' : qtdConcluidos}</b> tarefa
        {qtdConcluidos === 1 ? '' : 's'} com conclusão
        {mesFiltroAtivo ? ' no período selecionado' : ' no ano'} · ↳{' '}
        <b className="text-slate-900">{loading ? '…' : qtdSubConcluidasFiltro}</b>{' '}
        subtarefas concluídas nessas tarefas · 🔄{' '}
        <b className="text-slate-900">{loading ? '…' : qtdAndamento}</b> em andamento
      </p>

      <hr className="border-0 border-t border-slate-200" />

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            <div className="h-8 animate-pulse rounded bg-slate-100" />
            <div className="h-8 animate-pulse rounded bg-slate-100" />
            <div className="h-8 animate-pulse rounded bg-slate-100" />
          </div>
        ) : view === 'concluidos' ? (
          <TabelaConcluidos rows={painel?.concluidos ?? []} emptyLabel="Nenhuma tarefa concluída no período." />
        ) : view === 'semana' ? (
          semanaRows.length > 0 ? (
            <TabelaConcluidos
              rows={semanaRows}
              emptyLabel="Nenhuma tarefa concluída na semana passada."
            />
          ) : (
            <TabelaSemana rows={painel?.semana ?? []} />
          )
        ) : (
          <TabelaAndamento rows={painel?.andamento ?? []} />
        )}
      </div>
    </div>
  )
}

function TabelaConcluidos({
  rows,
  emptyLabel = 'Nenhuma tarefa concluída no período.',
}: {
  rows: OpsLegaisIniciativasProjeto[]
  emptyLabel?: string
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null)

  if (!rows.length) {
    return (
      <p className="px-4 py-8 text-center text-[11px] text-slate-400">
        {emptyLabel}
      </p>
    )
  }
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <colgroup>
        <col className="w-[32%]" />
        <col className="w-[14%]" />
        <col className="w-[16%]" />
        <col className="w-[22%]" />
        <col className="w-[16%]" />
      </colgroup>
      <thead className="sticky top-0 z-[1]">
        <tr className="bg-slate-50 text-slate-600">
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-left font-semibold">
            Tarefa
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Tipo
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Extensão
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Responsável
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Conclusão
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const subsConcluidas = r.subtarefas.filter((s) => s.status === 'concluido')
          const aberto = abertoId === r.id
          const temSubs = subsConcluidas.length > 0
          return (
            <Fragment key={r.id}>
              <tr
                className={cn(temSubs && 'cursor-pointer hover:bg-slate-50/80')}
                onClick={() => {
                  if (!temSubs) return
                  setAbertoId(aberto ? null : r.id)
                }}
              >
                <td className="px-1.5 py-1.5 align-top">
                  <div className="flex items-start gap-1">
                    {temSubs ? (
                      <span className="mt-0.5 text-[10px] text-slate-400" aria-hidden>
                        {aberto ? '▾' : '▸'}
                      </span>
                    ) : (
                      <span className="mt-0.5 w-2.5" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <TituloLink
                        nome={r.nome}
                        url={r.url}
                        className="text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {temSubs ? (
                        <p className="text-[9px] text-slate-400">
                          {subsConcluidas.length} subtarefa
                          {subsConcluidas.length === 1 ? '' : 's'} concluída
                          {subsConcluidas.length === 1 ? '' : 's'}
                          {!aberto ? ' · clique para ver' : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-1.5 py-1.5 text-center align-top whitespace-nowrap text-blue-700">
                  {r.tipo || '—'}
                </td>
                <td className="px-1.5 py-1.5 text-center align-top whitespace-nowrap text-emerald-600">
                  {r.extensao || '—'}
                </td>
                <td className="px-1.5 py-1.5 text-center align-top text-slate-900">
                  <span className="line-clamp-2 break-words">{respLabel(r.responsavel)}</span>
                </td>
                <td className="px-1.5 py-1.5 text-center align-top whitespace-nowrap text-slate-500">
                  {r.data ? formatDataBr(r.data) : 'em andamento'}
                </td>
              </tr>
              {aberto && temSubs ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <SubChips items={subsConcluidas} mode="concluidos" />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function TabelaSemana({ rows }: { rows: OpsLegaisIniciativasItemSemana[] }) {
  if (!rows.length) {
    return (
      <p className="px-4 py-8 text-center text-[11px] text-slate-400">
        Nenhuma tarefa concluída na semana passada.
      </p>
    )
  }
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <colgroup>
        <col className="w-[46%]" />
        <col className="w-[14%]" />
        <col className="w-[24%]" />
        <col className="w-[16%]" />
      </colgroup>
      <thead className="sticky top-0 z-[1]">
        <tr className="bg-slate-50 text-slate-600">
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-left font-semibold">
            Título
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Tipo
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Responsável
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Conclusão
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-1.5 py-1.5 align-top">
              <TituloLink nome={r.nome} url={r.url} className="text-[11px]" />
              {r.pai_titulo ? (
                <div className="text-[9px] font-normal text-slate-400">
                  ↳ subtarefa de {r.pai_titulo}
                </div>
              ) : null}
            </td>
            <td
              className={cn(
                'px-1.5 py-1.5 text-center align-top',
                r.tipo === 'Projeto' ? 'text-blue-700' : 'text-slate-500',
              )}
            >
              {r.tipo}
            </td>
            <td className="px-1.5 py-1.5 text-center align-top text-slate-900">
              {respLabel(r.responsavel)}
            </td>
            <td className="px-1.5 py-1.5 text-center align-top text-slate-500">
              {formatDataBr(r.data)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TabelaAndamento({ rows }: { rows: OpsLegaisIniciativasProjeto[] }) {
  if (!rows.length) {
    return (
      <p className="px-4 py-8 text-center text-[11px] text-slate-400">
        Nenhum projeto em andamento no momento.
      </p>
    )
  }
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[14%]" />
        <col className="w-[16%]" />
        <col className="w-[24%]" />
        <col className="w-[18%]" />
      </colgroup>
      <thead className="sticky top-0 z-[1]">
        <tr className="bg-slate-50 text-slate-600">
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-left font-semibold">
            Título
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Tipo
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Extensão
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Responsável
          </th>
          <th className="border-b border-slate-200 px-1.5 py-1.5 text-center font-semibold">
            Progresso
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const progresso =
            r.total_sub === 0
              ? 'sem subtarefas'
              : `${r.sub_concluidas}/${r.total_sub} concluídas`
          return (
            <Fragment key={r.id}>
              <tr>
                <td className="px-1.5 py-1.5 align-top">
                  <TituloLink nome={r.nome} url={r.url} className="text-[11px]" />
                </td>
                <td className="px-1.5 py-1.5 text-center align-top whitespace-nowrap text-blue-700">
                  {r.tipo || '—'}
                </td>
                <td className="px-1.5 py-1.5 text-center align-top whitespace-nowrap text-emerald-600">
                  {r.extensao || '—'}
                </td>
                <td className="px-1.5 py-1.5 text-center align-top whitespace-nowrap text-slate-900">
                  {respLabel(r.responsavel)}
                </td>
                <td className="px-1.5 py-1.5 text-center align-top whitespace-nowrap font-semibold text-amber-600">
                  {progresso}
                </td>
              </tr>
              {r.subtarefas.length > 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <SubChips items={r.subtarefas} mode="andamento" />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function projetoNoFiltro(
  dataIso: string | null,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): boolean {
  if (mesFiltro == null) return true
  if (!dataIso) return false
  if (isSemanaFiltro(mesFiltro)) {
    const { inicio, fimExclusivo } = rangeSemanaFiltro(mesFiltro)
    return dataIso >= inicio && dataIso < fimExclusivo
  }
  const mes = Number(dataIso.slice(5, 7))
  if (!Number.isFinite(mes)) return false
  return mesNoFiltro(mes, mesFiltro, ano)
}

export function OpsLegaisIniciativasTab({ ano, mesFiltro }: Props) {
  /** KPIs do topo = acumulado do ano (ignora MesFilterButtons), como no BI. */
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-iniciativas', ano],
    queryFn: (): Promise<OpsLegaisIniciativasDashboard> =>
      eficienciaService.fetchOpsLegaisIniciativas(ano, null),
  })

  const d = data
  const loading = isLoading

  const painelFiltrado = useMemo((): OpsLegaisIniciativasPainel | undefined => {
    const painel = d?.painel
    if (!painel) return undefined
    return {
      ...painel,
      concluidos: painel.concluidos.filter((p: OpsLegaisIniciativasProjeto) =>
        projetoTemAtividadeNoFiltro(p, mesFiltro, ano),
      ),
    }
  }, [d?.painel, mesFiltro, ano])

  return (
    <div className="space-y-5">
      {isError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Não foi possível carregar o ClickUp.{' '}
          {error instanceof Error ? error.message : 'Verifique o secret CLICKUP_API_TOKEN.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiShell
          title="Iniciativas Estratégicas"
          description="Promover o desenvolvimento e a implementação de, no mínimo, 24 projetos ou iniciativas de melhoria ao longo do ano."
          value={d ? formatPercent(d.pct_progresso) : '—'}
          valueStyle={d ? { color: d.cor_progresso } : undefined}
          icon={Lightbulb}
          iconWrapClass="bg-emerald-50 text-emerald-700"
          loading={loading}
          footer={
            <div className="flex items-center justify-between">
              <span>
                Meta: <b className="text-base text-slate-900">{d?.meta_anual ?? 24}</b>
              </span>
              <span>
                Total:{' '}
                <b className="text-lg" style={d ? { color: d.cor_progresso } : undefined}>
                  {d?.projetos_concluidos ?? '—'}
                </b>
              </span>
            </div>
          }
        />
        <KpiShell
          title="Projetos"
          description="Total de projetos concluídos"
          value={d ? String(d.projetos_finalizados) : '—'}
          valueClassName="text-sky-600"
          icon={LineChart}
          iconWrapClass="bg-sky-50 text-sky-700"
          loading={loading}
          footer={
            <span>
              Contribuição:{' '}
              <b className="text-slate-900">
                {d ? formatPercent(d.pct_contribuicao_projetos) : '—'}
              </b>{' '}
              do total
            </span>
          }
        />
        <KpiShell
          title="Melhorias"
          description="Total de melhorias concluídas"
          value={d ? String(d.melhorias_finalizadas) : '—'}
          valueClassName="text-emerald-600"
          icon={Sparkles}
          iconWrapClass="bg-emerald-50 text-emerald-700"
          loading={loading}
          footer={
            <span>
              Contribuição:{' '}
              <b className="text-slate-900">
                {d ? formatPercent(d.pct_contribuicao_melhorias) : '—'}
              </b>{' '}
              do total
            </span>
          }
        />
        <KpiShell
          title="Horas Ganhas"
          description="Total de horas economizadas com projetos e melhorias"
          value={d?.horas_formatadas ?? '—'}
          valueClassName="text-cyan-600"
          icon={Timer}
          iconWrapClass="bg-cyan-50 text-cyan-700"
          loading={loading}
          footer={
            <div className="flex flex-col gap-0.5">
              <span>
                Economia anual:{' '}
                <b className="text-slate-900">
                  {d
                    ? d.dias_uteis.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })
                    : '—'}
                </b>{' '}
                dias úteis
              </span>
              <span>
                Média mensal:{' '}
                <b className="text-slate-900">
                  {d
                    ? d.dias_uteis_mensal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })
                    : '—'}
                </b>{' '}
                dias úteis/mês
              </span>
            </div>
          }
        />
      </div>

      <ProjetosRealizadosPanel
        loading={loading}
        painel={painelFiltrado}
        mesFiltroAtivo={mesFiltro != null}
      />
    </div>
  )
}
