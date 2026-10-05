import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderCheck,
  Lightbulb,
  LineChart,
  RefreshCw,
  Sparkles,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { IniciativasPessoasProvider, IniciativasResponsaveis, IniciativasResumoResponsaveis, ProjetoCategoriaBadge, ProjetoTipoIcon, useIniciativasPessoaNome } from './OpsLegaisIniciativasPresentation'
import { filtrarSubtarefasPorResponsavel, formatIniciativasBi, subtarefasRealizadasDaVisao } from '../utils/opsLegaisProjetoPresentation'
import { formatPercent } from '@/shared/utils/format'
import {
  isDiaFiltro,
  isSemanaFiltro,
  mesNoFiltro,
  rangePeriodoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type {
  OpsLegaisIniciativasDashboard,
  OpsLegaisIniciativasItem,
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
        className={cn('group font-semibold text-slate-900 decoration-emerald-600/40 underline-offset-4 hover:underline', className)}
      >
        {formatIniciativasBi(nome)}
        <ArrowUpRight className="ml-1 inline-block h-3.5 w-3.5 align-middle text-slate-300 transition-colors group-hover:text-emerald-600" aria-hidden />
      </a>
    )
  }
  return <span className={cn('font-semibold text-slate-900', className)}>{formatIniciativasBi(nome)}</span>
}

function statusSubtarefaLabel(status: string): string {
  const map: Record<string, string> = {
    concluido: 'Concluído',
    'in progress': 'Em progresso',
    standby: 'Standby',
    backlog: 'Backlog',
    fechados: 'Fechado',
  }
  return map[status] ?? (status?.trim() ? status : '—')
}

function ExpandChevron({ open, visible }: { open: boolean; visible: boolean }) {
  if (!visible) {
    return <span className="inline-flex h-4 w-4 shrink-0" aria-hidden />
  }
  return open ? (
    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
  ) : (
    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
  )
}

function PainelEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <FolderCheck className="h-5 w-5" aria-hidden />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-slate-500">{children}</p>
    </div>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  return tipo ? (
    <span
      className={cn(
        'inline-flex max-w-full rounded-md px-2.5 py-1 text-xs font-medium leading-relaxed',
        tipo === 'Projetos' || tipo === 'Projeto'
          ? 'bg-sky-50 text-sky-700'
          : tipo === 'Melhorias'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600',
      )}
    >
      {tipo}
    </span>
  ) : <span className="text-slate-300">—</span>
}

function SubtarefasList({
  items,
  mode,
  title,
}: {
  items: (OpsLegaisIniciativasSubtarefa & { url?: string | null; paiTitulo?: string })[]
  mode: 'concluidos' | 'andamento'
  title?: string
}) {
  return (
    <section aria-label="Subtarefas do projeto" className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 sm:px-5">
      <div className="grid gap-4 border-b border-slate-200/70 py-3 text-sm text-slate-500 md:grid-cols-[minmax(0,1fr)_220px_140px]">
        <h5 className="font-medium text-slate-600">{title ? `${title} · ${items.length}` : `${items.length} subtarefa${items.length === 1 ? '' : 's'}`}</h5>
        <span className="hidden md:block">Responsável</span>
        <span className="hidden text-right md:block">{mode === 'andamento' ? 'Status' : 'Conclusão'}</span>
      </div>
      <ul className="divide-y divide-slate-200/70">
        {items.map((s) => {
          const ultimaCol = mode === 'andamento' ? statusSubtarefaLabel(s.status) : s.data ? formatDataBr(s.data) : 'em andamento'
          return (
            <li key={s.id} className="grid items-start gap-x-4 gap-y-3 py-4 md:grid-cols-[minmax(0,1fr)_220px_140px]">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_DOT[s.status] ?? '#9CA3AF' }} aria-hidden />
                <div className="min-w-0">
                  <TituloLink nome={s.nome} url={s.url ?? null} className="break-words text-lg font-medium leading-relaxed text-slate-700 xl:text-xl" />
                  {s.paiTitulo ? <p className="mt-1 text-sm text-slate-500">Projeto: {formatIniciativasBi(s.paiTitulo)}</p> : null}
                </div>
              </div>
              <div className="pl-5 md:pl-0"><IniciativasResponsaveis value={s.responsavel} /></div>
              <p className="pl-5 text-sm font-medium leading-relaxed tabular-nums text-slate-500 md:pl-0 md:text-right">{ultimaCol}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function KpiShell({
  title,
  description,
  value,
  valueStyle,
  unit,
  progress,
  highlight = false,
  footer,
  iconWrapClass,
  icon: Icon,
  loading,
}: {
  title: string
  description: string
  value: string
  valueStyle?: CSSProperties
  unit?: string
  progress?: number
  highlight?: boolean
  footer: ReactNode
  iconWrapClass: string
  icon: typeof Lightbulb
  loading?: boolean
}) {
  return (
    <article aria-label={title} className={cn(
      'flex min-h-[260px] min-w-0 flex-col rounded-2xl border bg-white p-5 shadow-sm sm:min-h-[300px] sm:p-6',
      highlight ? 'border-emerald-200' : 'border-slate-200',
    )}>
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-slate-900 xl:text-xl">
          {title}
        </h3>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            iconWrapClass,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-5 text-slate-500">{description}</p>
      {loading ? (
        <div className="mt-5 h-12 w-32 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <div className="mt-5 flex min-w-0 items-baseline gap-2">
          <p className="min-w-0 break-words text-4xl font-semibold leading-none tracking-tight tabular-nums text-slate-900 xl:text-5xl" style={valueStyle}>{value}</p>
          {unit ? <span className="text-base font-medium text-slate-400">{unit}</span> : null}
        </div>
      )}
      <div className="mt-auto pt-5">
        <div className="min-h-[72px] border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-500">
          {loading ? <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" /> : footer}
          {progress !== undefined && !loading ? (
            <div role="progressbar" aria-label="Progresso da meta anual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, progress))} aria-valuetext={`${value} da meta anual`} className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: valueStyle?.color }} />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function projetoConcluido(r: OpsLegaisIniciativasProjeto): boolean {
  if (r.concluido != null) return r.concluido
  return Boolean(r.data)
}

function tipoExtensaoFromTags(tags: string[]): { tipo: string; extensao: string } {
  let tipo = ''
  const extensao: string[] = []
  for (const raw of tags) {
    if (hasTagItem([raw], 'Projetos')) {
      if (!tipo) tipo = 'Projetos'
    } else if (hasTagItem([raw], 'Melhorias')) {
      if (!tipo) tipo = 'Melhorias'
    } else if (raw.trim()) {
      extensao.push(raw)
    }
  }
  return { tipo, extensao: extensao.join(', ') }
}

/** Lista Concluídos = mesma base dos KPIs (tarefa top-level baixada com tag meta). */
function buildConcluidosPainelFromItens(
  itens: OpsLegaisIniciativasItem[],
  painelDetalhe: OpsLegaisIniciativasProjeto[],
): OpsLegaisIniciativasProjeto[] {
  const byId = new Map(painelDetalhe.map((p) => [p.id, p]))
  return itens.map((item) => {
    const detalhe = byId.get(item.id)
    const { tipo, extensao } = tipoExtensaoFromTags(item.tags)
    if (detalhe) {
      return {
        ...detalhe,
        nome: item.nome,
        url: item.url ?? detalhe.url,
        tipo: detalhe.tipo || tipo,
        extensao: detalhe.extensao || extensao,
        data: item.data ?? detalhe.data,
        concluido: true,
      }
    }
    return {
      id: item.id,
      nome: item.nome,
      url: item.url,
      tipo,
      extensao,
      responsavel: '',
      data: item.data,
      concluido: true,
      subtarefas: [],
      total_sub: 0,
      sub_concluidas: 0,
    }
  })
}


function countSubsConcluidas(rows: OpsLegaisIniciativasProjeto[]): number {
  return rows.reduce(
    (s, p) => s + p.subtarefas.filter((t) => t.status === 'concluido').length,
    0,
  )
}

function summarizeConcluidos(rows: OpsLegaisIniciativasProjeto[]) {
  return {
    total: rows.length,
    projetos: rows.filter((r) => r.tipo === 'Projetos').length,
    melhorias: rows.filter((r) => r.tipo === 'Melhorias').length,
    subs: countSubsConcluidas(rows),
  }
}

function summarizeSemana(rows: OpsLegaisIniciativasProjeto[]) {
  const baixados = rows.filter((r) => projetoConcluido(r)).length
  return {
    total: rows.length,
    baixados,
    parcial: rows.length - baixados,
    subs: countSubsConcluidas(rows),
  }
}

function PainelResumoLinha({
  loading,
  view,
  painel,
  mesFiltroAtivo,
  semanaRows,
}: {
  loading: boolean
  view: PainelView
  mesFiltroAtivo: boolean
  semanaRows: OpsLegaisIniciativasProjeto[]
  painel: OpsLegaisIniciativasPainel | undefined
}) {
  if (loading) {
    return <span>Carregando…</span>
  }

  if (view === 'concluidos') {
    const { total, projetos, melhorias, subs } = summarizeConcluidos(painel?.concluidos ?? [])
    const periodo = mesFiltroAtivo ? 'no período' : 'no ano'
    return (
      <>
        <b className="text-slate-700">{total}</b> concluído{total === 1 ? '' : 's'} {periodo}
        {projetos > 0 || melhorias > 0 ? (
          <>
            {' '}
            · <b className="text-slate-700">{projetos}</b> projeto{projetos === 1 ? '' : 's'}
            {' '}
            · <b className="text-slate-700">{melhorias}</b> melhoria{melhorias === 1 ? '' : 's'}
          </>
        ) : null}
        {subs > 0 ? (
          <>
            {' '}
            · ↳ <b className="text-slate-700">{subs}</b> subtarefa{subs === 1 ? '' : 's'}
          </>
        ) : null}
      </>
    )
  }

  if (view === 'semana') {
    if (semanaRows.length > 0) {
      const { total, baixados, parcial, subs } = summarizeSemana(semanaRows)
      const inicio = painel?.semana_inicio ? formatDataBr(painel.semana_inicio) : ''
      const fim = painel?.semana_fim ? formatDataBr(painel.semana_fim) : ''
      const intervalo = inicio && fim ? ` (${inicio} – ${fim})` : ''
      return (
        <>
          <b className="text-slate-700">{total}</b> com realização na semana passada
          {intervalo}
          {baixados > 0 ? (
            <>
              {' '}
              · <b className="text-slate-700">{baixados}</b> baixado{baixados === 1 ? '' : 's'}
            </>
          ) : null}
          {parcial > 0 ? (
            <>
              {' '}
              · <b className="text-slate-700">{parcial}</b> parcial{parcial === 1 ? '' : 'is'}
            </>
          ) : null}
          {subs > 0 ? (
            <>
              {' '}
              · ↳ <b className="text-slate-700">{subs}</b> subtarefa{subs === 1 ? '' : 's'}
            </>
          ) : null}
        </>
      )
    }

    const rows = painel?.semana ?? []
    const qtd = rows.length
    const subs = rows.filter((r) => r.tipo === 'Subtarefa').length
    const inicio = painel?.semana_inicio ? formatDataBr(painel.semana_inicio) : ''
    const fim = painel?.semana_fim ? formatDataBr(painel.semana_fim) : ''
    const intervalo = inicio && fim ? ` (${inicio} – ${fim})` : ''
    return (
      <>
        <b className="text-slate-700">{qtd}</b> {qtd === 1 ? 'item' : 'itens'} na semana passada
        {intervalo}
        {subs > 0 ? (
          <>
            {' '}
            · ↳ <b className="text-slate-700">{subs}</b> subtarefa{subs === 1 ? '' : 's'}
          </>
        ) : null}
      </>
    )
  }

  const qtd = painel?.andamento.length ?? 0
  const subs =
    painel?.tarefas_sob_em_andamento ??
    (painel?.andamento ?? []).reduce((s, p) => s + p.subtarefas.length, 0)

  return (
    <>
      <b className="text-slate-700">{qtd}</b> em andamento
      {subs > 0 ? (
        <>
          {' '}
          · ↳ <b className="text-slate-700">{subs}</b> subtarefa{subs === 1 ? '' : 's'}
        </>
      ) : null}
    </>
  )
}

type ProjetosRealizadosPanelProps = {
  loading: boolean
  mesFiltroAtivo: boolean
  painel: OpsLegaisIniciativasPainel | undefined
}

function ProjetosRealizadosPanel(props: ProjetosRealizadosPanelProps) {
  return <IniciativasPessoasProvider><ProjetosRealizadosContent {...props} /></IniciativasPessoasProvider>
}

function ProjetosRealizadosContent({
  loading,
  painel,
  mesFiltroAtivo,
}: ProjetosRealizadosPanelProps) {
  const [view, setView] = useState<PainelView>('concluidos')
  const [responsavelAtivo, setResponsavelAtivo] = useState<string | null>(null)
  const resolveNome = useIniciativasPessoaNome()
  const concluidosLista = painel?.concluidos ?? []
  const concluidosResumo = useMemo(() => summarizeConcluidos(concluidosLista), [concluidosLista])
  const qtdConcluidos = concluidosResumo.total
  const qtdAndamento = painel?.andamento.length ?? painel?.projetos_em_andamento ?? 0
  const semanaRows = painel?.semana_por_tarefa?.length ? painel.semana_por_tarefa : []

  const qtdSemana =
    semanaRows.length > 0 ? semanaRows.length : (painel?.semana.length ?? 0)

  const subtarefasVisao = subtarefasRealizadasDaVisao(painel, view)
  const subtarefasFiltradas = filtrarSubtarefasPorResponsavel(subtarefasVisao, responsavelAtivo, resolveNome)
  const subtarefasIds = new Set(subtarefasFiltradas.map((tarefa) => tarefa.id))
  const filtrarProjetos = (rows: OpsLegaisIniciativasProjeto[]) => responsavelAtivo === null
    ? rows
    : rows.map((projeto) => ({ ...projeto, subtarefas: projeto.subtarefas.filter((tarefa) => subtarefasIds.has(tarefa.id)) })).filter((projeto) => projeto.subtarefas.length > 0)
  const concluidosFiltrados = filtrarProjetos(concluidosLista)
  const semanaFiltrada = filtrarProjetos(semanaRows)
  const andamentoFiltrado = filtrarProjetos(painel?.andamento ?? [])
  const semanaIndividuais = responsavelAtivo === null
    ? painel?.semana ?? []
    : (painel?.semana ?? []).filter((tarefa) => tarefa.tipo === 'Subtarefa' && subtarefasIds.has(tarefa.id))

  const tabs: { id: PainelView; label: string; count: number; icon: typeof CheckCircle2 }[] = [
    {
      id: 'concluidos',
      label: 'Concluídos',
      count: qtdConcluidos,
      icon: CheckCircle2,
    },
    {
      id: 'semana',
      label: 'Semana passada',
      count: qtdSemana,
      icon: CalendarDays,
    },
    {
      id: 'andamento',
      label: 'Em andamento',
      count: qtdAndamento,
      icon: RefreshCw,
    },
  ]

  return (
    <section aria-label="Projetos Realizados" className="flex min-h-[380px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <FolderCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Projetos Realizados</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Acompanhe as entregas e a evolução dos projetos e melhorias.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto" role="tablist" aria-label="Visões do painel">
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => {
                setView(id)
                setResponsavelAtivo(null)
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600',
                view === id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
              <span className={cn(
                'rounded-md px-2 py-0.5 text-xs tabular-nums',
                view === id ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
              )}>
                {loading ? '…' : count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-y border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6">
        <p className="text-xs leading-relaxed text-slate-500" aria-live="polite">
          <PainelResumoLinha
            loading={loading}
            view={view}
            painel={painel}
            mesFiltroAtivo={mesFiltroAtivo}
            semanaRows={semanaRows}
          />
        </p>
      </div>

      <IniciativasResumoResponsaveis
        subtarefas={subtarefasVisao}
        loading={loading}
        responsavelAtivo={responsavelAtivo}
        onResponsavelChange={setResponsavelAtivo}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-4 p-6" role="status" aria-label="Carregando projetos">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex animate-pulse items-center gap-6 border-b border-slate-100 pb-4" aria-hidden>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                </div>
                <div className="h-6 w-20 rounded-md bg-slate-100" />
                <div className="hidden h-4 w-24 rounded bg-slate-100 sm:block" />
              </div>
            ))}
          </div>
        ) : responsavelAtivo !== null && subtarefasFiltradas.length === 0 ? (
          <PainelEmptyState>Nenhuma subtarefa concluída para essa pessoa nesta visão.</PainelEmptyState>
        ) : view === 'concluidos' ? (
          <TabelaConcluidos
            key={responsavelAtivo}
            rows={concluidosFiltrados}
            expandAll={responsavelAtivo !== null}
            emptyLabel="Nenhum projeto ou melhoria baixado no período."
          />
        ) : view === 'semana' ? (
          responsavelAtivo !== null && semanaIndividuais.length > 0 ? (
            <TabelaSemana rows={semanaIndividuais} />
          ) : semanaFiltrada.length > 0 ? (
            <TabelaConcluidos
              key={responsavelAtivo}
              rows={semanaFiltrada}
              expandAll={responsavelAtivo !== null}
              resumoParcial={summarizeSemana(semanaFiltrada).parcial}
              emptyLabel="Nenhuma realização na semana passada."
            />
          ) : (
            <TabelaSemana rows={semanaIndividuais} />
          )
        ) : (
          <TabelaAndamento key={responsavelAtivo} rows={andamentoFiltrado} expandAll={responsavelAtivo !== null} />
        )}
      </div>
    </section>
  )
}

function conclusaoProjetoLabel(r: OpsLegaisIniciativasProjeto): string {
  if (!projetoConcluido(r)) {
    return r.subtarefas.some((s) => s.status === 'concluido') ? 'pendente' : '—'
  }
  return r.data ? formatDataBr(r.data) : '—'
}

function ListaProjetos({ rows, mode, expandAll = false }: {
  rows: OpsLegaisIniciativasProjeto[]
  mode: 'concluidos' | 'andamento'
  expandAll?: boolean
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null)
  return (
    <div className="divide-y divide-slate-200">
      {rows.map((r) => {
        const subtarefas = mode === 'concluidos' ? r.subtarefas.filter((s) => s.status === 'concluido') : r.subtarefas
        const temSubs = subtarefas.length > 0
        const aberto = expandAll || abertoId === r.id
        const toggle = () => {
          if (temSubs && !expandAll) setAbertoId(aberto ? null : r.id)
        }
        return (
          <article key={r.id} aria-label={formatIniciativasBi(r.nome)} className="px-4 py-5 sm:px-6 sm:py-6">
            <div onClick={toggle} className={cn('flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6', temSubs && !expandAll && 'cursor-pointer')}>
              <div className="flex min-w-0 flex-1 items-start gap-3.5">
                <ProjetoTipoIcon tipo={r.extensao} />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xl font-semibold leading-snug tracking-tight text-slate-900 xl:text-2xl">
                    <TituloLink nome={r.nome} url={r.url} onClick={(e) => e.stopPropagation()} className="break-words transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2" />
                  </h4>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                    <TipoBadge tipo={r.tipo} />
                    <ProjetoCategoriaBadge tipo={r.extensao} />
                    <div aria-label="Responsável do projeto"><IniciativasResponsaveis value={r.responsavel} /></div>
                    {temSubs ? <span className="text-sm text-slate-500">{subtarefas.length} subtarefa{subtarefas.length === 1 ? '' : 's'}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-start justify-between gap-5 pl-[3.375rem] lg:pl-0">
                {mode === 'andamento' ? (
                  <div className="w-44 space-y-2">
                    <p className="text-sm text-slate-500">Progresso do projeto</p>
                    <p className="text-base font-semibold tabular-nums text-slate-700">{r.total_sub ? `${r.sub_concluidas}/${r.total_sub} concluídas` : 'Sem subtarefas'}</p>
                    {r.total_sub > 0 ? (
                      <div role="progressbar" aria-label={'Subtarefas concluídas de ' + formatIniciativasBi(r.nome)} aria-valuemin={0} aria-valuemax={r.total_sub} aria-valuenow={r.sub_concluidas} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, r.sub_concluidas / r.total_sub * 100))}%` }} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-sm text-slate-500">Conclusão</p>
                    <p className={cn('inline-flex items-center gap-2 text-base font-medium tabular-nums', projetoConcluido(r) ? 'text-slate-700' : 'text-amber-700')}>
                      {projetoConcluido(r) ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> : <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />}
                      {conclusaoProjetoLabel(r)}
                    </p>
                  </div>
                )}
                {temSubs && !expandAll ? (
                  <button type="button" aria-expanded={aberto} aria-label={(aberto ? 'Recolher subtarefas de ' : 'Expandir subtarefas de ') + formatIniciativasBi(r.nome)} onClick={(e) => { e.stopPropagation(); toggle() }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    <ExpandChevron open={aberto} visible />
                  </button>
                ) : null}
              </div>
            </div>
            {aberto && temSubs ? <div className="mt-5"><SubtarefasList items={subtarefas} mode={mode} /></div> : null}
          </article>
        )
      })}
    </div>
  )
}

function TabelaConcluidos({ rows, expandAll = false, resumoParcial = 0, emptyLabel = 'Nenhum projeto ou melhoria baixado no período.' }: {
  rows: OpsLegaisIniciativasProjeto[]
  expandAll?: boolean
  resumoParcial?: number
  emptyLabel?: string
}) {
  const rowsOrdenadas = useMemo(() => [...rows].sort((a, b) => Number(projetoConcluido(b)) - Number(projetoConcluido(a)) || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })), [rows])
  if (!rows.length) return <PainelEmptyState>{emptyLabel}</PainelEmptyState>
  return (
    <div>
      {resumoParcial > 0 ? <p className="border-b border-amber-100 bg-amber-50/80 px-6 py-3 text-sm leading-relaxed text-amber-900"><strong>Pendente</strong> = projeto ainda aberto com subtarefa concluída na semana. Expanda para ver as entregas.</p> : null}
      <ListaProjetos rows={rowsOrdenadas} mode="concluidos" expandAll={expandAll} />
    </div>
  )
}

function TabelaSemana({ rows }: { rows: OpsLegaisIniciativasItemSemana[] }) {
  if (!rows.length) return <PainelEmptyState>Nenhuma tarefa concluída na semana passada.</PainelEmptyState>
  const items = rows.map((r) => ({ ...r, status: 'concluido', paiTitulo: r.pai_titulo }))
  return <div className="p-4 sm:p-6"><SubtarefasList items={items} mode="concluidos" title="Entregas na semana" /></div>
}

function TabelaAndamento({ rows, expandAll = false }: { rows: OpsLegaisIniciativasProjeto[]; expandAll?: boolean }) {
  if (!rows.length) return <PainelEmptyState>Nenhum projeto em andamento no momento.</PainelEmptyState>
  return <ListaProjetos rows={rows} mode="andamento" expandAll={expandAll} />
}


function projetoNoFiltro(
  dataIso: string | null,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): boolean {
  if (mesFiltro == null) return true
  if (!dataIso) return false
  if (isSemanaFiltro(mesFiltro) || isDiaFiltro(mesFiltro)) {
    const { inicio, fimExclusivo } = rangePeriodoFiltro(ano, mesFiltro)
    return dataIso >= inicio && dataIso < fimExclusivo
  }
  const mes = Number(dataIso.slice(5, 7))
  if (!Number.isFinite(mes)) return false
  return mesNoFiltro(mes, mesFiltro, ano)
}

function tagNorm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function hasTagItem(tags: string[], tag: string): boolean {
  const target = tagNorm(tag)
  return tags.some((t) => tagNorm(t) === target)
}

/** Meta anual só conta tag Projetos ou Melhorias. */
function contaNaMeta(tags: string[]): boolean {
  return hasTagItem(tags, 'Projetos') || hasTagItem(tags, 'Melhorias')
}

function progressColor(pct01: number): string {
  if (pct01 >= 1) return '#059669'
  if (pct01 >= 0.75) return '#0284C7'
  if (pct01 >= 0.5) return '#EAB308'
  return '#B91C1C'
}

function formatHorasGanhas(horas: number): string {
  const h = Math.floor(horas)
  const m = Math.round((horas - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Recalcula KPIs + painel.concluidos no client a partir do payload anual (sem novo FORJAI). */
function deriveIniciativasFiltrado(
  base: OpsLegaisIniciativasDashboard,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): OpsLegaisIniciativasDashboard {
  const itensMeta = base.itens.filter((i) => contaNaMeta(i.tags))
  const itens =
    mesFiltro == null
      ? itensMeta
      : itensMeta.filter((i) => projetoNoFiltro(i.data, mesFiltro, ano))

  const projetosConcluidos = itens.length
  const projetosFinalizados = itens.filter((i) => hasTagItem(i.tags, 'Projetos')).length
  const melhoriasFinalizadas = itens.filter((i) => hasTagItem(i.tags, 'Melhorias')).length
  const horasGanhas = itens.reduce((s, i) => s + (Number(i.horas) || 0), 0)
  const diasUteis = horasGanhas / 8
  const meta = base.meta_anual || 24
  const pctProgresso = meta > 0 ? projetosConcluidos / meta : 0

  const { inicio, fimExclusivo } =
    mesFiltro == null
      ? { inicio: base.inicio, fimExclusivo: base.fim }
      : rangePeriodoFiltro(ano, mesFiltro)

  const concluidos = buildConcluidosPainelFromItens(
    itens,
    base.painel?.concluidos ?? [],
  )

  return {
    ...base,
    projetos_concluidos: projetosConcluidos,
    projetos_finalizados: projetosFinalizados,
    melhorias_finalizadas: melhoriasFinalizadas,
    pct_progresso: Math.round(pctProgresso * 10000) / 100,
    pct_contribuicao_projetos:
      projetosConcluidos > 0
        ? Math.round((projetosFinalizados / projetosConcluidos) * 10000) / 100
        : 0,
    pct_contribuicao_melhorias:
      projetosConcluidos > 0
        ? Math.round((melhoriasFinalizadas / projetosConcluidos) * 10000) / 100
        : 0,
    horas_ganhas: Math.round(horasGanhas * 100) / 100,
    horas_formatadas: formatHorasGanhas(horasGanhas),
    dias_uteis: Math.round(diasUteis * 10) / 10,
    dias_uteis_mensal: Math.round((diasUteis / 12) * 10) / 10,
    cor_progresso: progressColor(pctProgresso),
    inicio,
    fim: fimExclusivo,
    itens,
    painel: base.painel
      ? {
          ...base.painel,
          concluidos,
        }
      : undefined,
  }
}

export function OpsLegaisIniciativasTab({ ano, mesFiltro }: Props) {
  /** Uma chamada FORJAI por ano; filtro de mês é só no client. */
  const { data: anoData, isLoading, isError, error } = useQuery({
    queryKey: ['eficiencia', 'ops-legais-iniciativas', ano],
    queryFn: (): Promise<OpsLegaisIniciativasDashboard> =>
      eficienciaService.fetchOpsLegaisIniciativas(ano, null),
    staleTime: 5 * 60_000,
  })

  const d = useMemo(
    () => (anoData ? deriveIniciativasFiltrado(anoData, mesFiltro, ano) : undefined),
    [anoData, mesFiltro, ano],
  )
  const loading = isLoading
  const painelFiltrado = d?.painel

  return (
    <div className="space-y-5">
      {isError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Não foi possível carregar o FORJAI.{' '}
          {error instanceof Error ? error.message : 'Verifique o secret FORJAI_SUPABASE_SERVICE_ROLE_KEY.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiShell
          title="Meta anual"
          description={`Concluir ${d?.meta_anual ?? 24} projetos e melhorias no ano.`}
          value={d ? formatPercent(d.pct_progresso) : '—'}
          valueStyle={d ? { color: d.cor_progresso } : undefined}
          progress={d?.pct_progresso}
          highlight
          icon={Lightbulb}
          iconWrapClass="bg-emerald-50 text-emerald-700"
          loading={loading}
          footer={
            <span><b className="text-base font-semibold tabular-nums text-slate-900">{d?.projetos_concluidos ?? '—'}</b> de <b className="font-medium tabular-nums text-slate-700">{d?.meta_anual ?? 24}</b> entregas concluídas</span>
          }
        />
        <KpiShell
          title="Projetos"
          description={mesFiltro == null ? 'Projetos concluídos no ano.' : 'Projetos concluídos no período.'}
          value={d ? String(d.projetos_finalizados) : '—'}
          icon={LineChart}
          iconWrapClass="bg-sky-50 text-sky-700"
          loading={loading}
          footer={
            <span>
              <b className="text-base font-semibold tabular-nums text-slate-900">
                {d ? formatPercent(d.pct_contribuicao_projetos) : '—'}
              </b>{' '}
              das entregas concluídas
            </span>
          }
        />
        <KpiShell
          title="Melhorias"
          description={mesFiltro == null ? 'Melhorias concluídas no ano.' : 'Melhorias concluídas no período.'}
          value={d ? String(d.melhorias_finalizadas) : '—'}
          icon={Sparkles}
          iconWrapClass="bg-emerald-50 text-emerald-700"
          loading={loading}
          footer={
            <span>
              <b className="text-base font-semibold tabular-nums text-slate-900">
                {d ? formatPercent(d.pct_contribuicao_melhorias) : '—'}
              </b>{' '}
              das entregas concluídas
            </span>
          }
        />
        <KpiShell
          title="Horas ganhas"
          description="Economia com projetos e melhorias concluídos."
          value={d?.horas_formatadas ?? '—'}
          unit="h"
          icon={Timer}
          iconWrapClass="bg-slate-100 text-slate-600"
          loading={loading}
          footer={
            <div className="flex flex-col gap-1">
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
