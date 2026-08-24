import { Fragment, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  LineChart,
  RefreshCw,
  Sparkles,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

function SubtarefaNestedRows({
  items,
  mode,
}: {
  items: OpsLegaisIniciativasSubtarefa[]
  mode: 'concluidos' | 'andamento'
}) {
  return items.map((s) => {
    const dot = STATUS_DOT[s.status] ?? '#9CA3AF'
    const ultimaCol =
      mode === 'andamento'
        ? statusSubtarefaLabel(s.status)
        : s.data
          ? formatDataBr(s.data)
          : 'em andamento'
    return (
      <tr key={s.id} className="bg-slate-50/70">
        <td className="px-1.5 py-1 align-top">
          <div className="flex items-start gap-2 border-l-2 border-slate-200 pl-3 ml-6">
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ background: dot }}
              aria-hidden
            />
            <span className="min-w-0 text-[10px] font-medium leading-snug text-slate-700">
              {s.nome}
            </span>
          </div>
        </td>
        <td className="px-1.5 py-1 text-center align-top text-[10px] text-slate-400">Subtarefa</td>
        <td className="px-1.5 py-1 text-center align-top text-[10px] text-slate-300">—</td>
        <td className="px-1.5 py-1 text-center align-top text-[10px] text-slate-600">
          <span className="line-clamp-2 break-words">{respLabel(s.responsavel)}</span>
        </td>
        <td
          className={cn(
            'px-1.5 py-1 text-center align-top text-[10px] whitespace-nowrap',
            mode === 'andamento' ? 'font-medium text-slate-600' : 'text-slate-500',
          )}
        >
          {ultimaCol}
        </td>
      </tr>
    )
  })
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

function filterProjetosBaixados(rows: OpsLegaisIniciativasProjeto[]): OpsLegaisIniciativasProjeto[] {
  return rows.filter(projetoConcluido)
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
      const qtd = semanaRows.length
      const subs = countSubsConcluidas(semanaRows)
      const inicio = painel?.semana_inicio ? formatDataBr(painel.semana_inicio) : ''
      const fim = painel?.semana_fim ? formatDataBr(painel.semana_fim) : ''
      const intervalo = inicio && fim ? ` (${inicio} – ${fim})` : ''
      return (
        <>
          <b className="text-slate-700">{qtd}</b> concluída{qtd === 1 ? '' : 's'} na semana
          passada
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
      🔄 <b className="text-slate-700">{qtd}</b> em andamento
      {subs > 0 ? (
        <>
          {' '}
          · ↳ <b className="text-slate-700">{subs}</b> subtarefa{subs === 1 ? '' : 's'}
        </>
      ) : null}
    </>
  )
}

function ProjetosRealizadosPanel({
  loading,
  painel,
  mesFiltroAtivo,
}: {
  loading: boolean
  mesFiltroAtivo: boolean
  painel: OpsLegaisIniciativasPainel | undefined
}) {
  const [view, setView] = useState<PainelView>('concluidos')
  const concluidosLista = painel?.concluidos ?? []
  const concluidosResumo = useMemo(() => summarizeConcluidos(concluidosLista), [concluidosLista])
  const qtdConcluidos = concluidosResumo.total
  const qtdAndamento = painel?.andamento.length ?? painel?.projetos_em_andamento ?? 0
  const semanaRows = painel?.semana_por_tarefa?.length ? painel.semana_por_tarefa : []
  const semanaBaixados = useMemo(() => filterProjetosBaixados(semanaRows), [semanaRows])

  const qtdSemana =
    semanaRows.length > 0 ? semanaBaixados.length : (painel?.semana.length ?? 0)

  const tabs: { id: PainelView; label: string; icon: typeof CheckCircle2 }[] = [
    {
      id: 'concluidos',
      label: `Concluídos (${loading ? '…' : qtdConcluidos})`,
      icon: CheckCircle2,
    },
    {
      id: 'semana',
      label: `Semana passada (${loading ? '…' : qtdSemana})`,
      icon: CalendarDays,
    },
    {
      id: 'andamento',
      label: `Em andamento (${loading ? '…' : qtdAndamento})`,
      icon: RefreshCw,
    },
  ]

  return (
    <div className="flex min-h-[335px] flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-200 px-3 pt-2.5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-100 text-[11px]">
              ✅
            </span>
            <h3 className="text-xs font-semibold text-slate-700">Projetos Realizados</h3>
          </div>
          <p className="text-[10px] text-slate-400">
            <PainelResumoLinha
              loading={loading}
              view={view}
              painel={painel}
              mesFiltroAtivo={mesFiltroAtivo}
              semanaRows={semanaRows}
            />
          </p>
        </div>

        <div className="mt-2 flex gap-0 overflow-x-auto" role="tablist" aria-label="Visões do painel">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-medium transition-colors -mb-px',
                view === id
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            <div className="h-8 animate-pulse rounded bg-slate-100" />
            <div className="h-8 animate-pulse rounded bg-slate-100" />
            <div className="h-8 animate-pulse rounded bg-slate-100" />
          </div>
        ) : view === 'concluidos' ? (
          <TabelaConcluidos
            rows={concluidosLista}
            emptyLabel="Nenhum projeto ou melhoria baixado no período."
          />
        ) : view === 'semana' ? (
          semanaRows.length > 0 ? (
            <TabelaConcluidos
              rows={filterProjetosBaixados(semanaRows)}
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

function conclusaoProjetoLabel(r: OpsLegaisIniciativasProjeto): string {
  if (!projetoConcluido(r)) {
    return r.subtarefas.some((s) => s.status === 'concluido') ? 'pendente' : '—'
  }
  return r.data ? formatDataBr(r.data) : '—'
}

function TabelaConcluidos({
  rows,
  emptyLabel = 'Nenhum projeto ou melhoria baixado no período.',
}: {
  rows: OpsLegaisIniciativasProjeto[]
  emptyLabel?: string
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const rowsOrdenadas = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Number(projetoConcluido(b)) - Number(projetoConcluido(a)) ||
          a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    [rows],
  )

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
          <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold">Tarefa</th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">Tipo</th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">
            Extensão
          </th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">
            Responsável
          </th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">
            Conclusão
          </th>
        </tr>
      </thead>
      <tbody>
        {rowsOrdenadas.map((r) => {
          const subsConcluidas = r.subtarefas.filter((s) => s.status === 'concluido')
          const aberto = abertoId === r.id
          const temSubs = subsConcluidas.length > 0
          const paiConcluido = projetoConcluido(r)
          return (
            <Fragment key={r.id}>
              <tr
                className={cn(
                  'border-b border-slate-100',
                  temSubs && 'cursor-pointer hover:bg-slate-50/80',
                  aberto && temSubs && 'bg-white',
                )}
                onClick={() => {
                  if (!temSubs) return
                  setAbertoId(aberto ? null : r.id)
                }}
              >
                <td className="px-2 py-2 align-top">
                  <div className="flex items-start gap-1.5">
                    <ExpandChevron open={aberto} visible={temSubs} />
                    <div className="min-w-0">
                      <TituloLink
                        nome={r.nome}
                        url={r.url}
                        className="text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {temSubs ? (
                        <p className="mt-0.5 text-[9px] text-slate-400">
                          {subsConcluidas.length} subtarefa
                          {subsConcluidas.length === 1 ? '' : 's'} concluída
                          {subsConcluidas.length === 1 ? '' : 's'}
                          {!paiConcluido ? ' · projeto pendente' : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-center align-top whitespace-nowrap text-blue-700">
                  {r.tipo || '—'}
                </td>
                <td className="px-2 py-2 text-center align-top whitespace-nowrap text-emerald-600">
                  {r.extensao || '—'}
                </td>
                <td className="px-2 py-2 text-center align-top text-slate-900">
                  <span className="line-clamp-2 break-words">{respLabel(r.responsavel)}</span>
                </td>
                <td
                  className={cn(
                    'px-2 py-2 text-center align-top whitespace-nowrap',
                    paiConcluido ? 'text-slate-500' : 'font-medium text-amber-600',
                  )}
                >
                  {conclusaoProjetoLabel(r)}
                </td>
              </tr>
              {aberto && temSubs ? (
                <SubtarefaNestedRows items={subsConcluidas} mode="concluidos" />
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
  const [abertoId, setAbertoId] = useState<string | null>(null)

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
          <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold">Título</th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">Tipo</th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">
            Extensão
          </th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">
            Responsável
          </th>
          <th className="border-b border-slate-200 px-2 py-2 text-center font-semibold">
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
          const temSubs = r.subtarefas.length > 0
          const aberto = abertoId === r.id
          return (
            <Fragment key={r.id}>
              <tr
                className={cn(
                  'border-b border-slate-100',
                  temSubs && 'cursor-pointer hover:bg-slate-50/80',
                )}
                onClick={() => {
                  if (!temSubs) return
                  setAbertoId(aberto ? null : r.id)
                }}
              >
                <td className="px-2 py-2 align-top">
                  <div className="flex items-start gap-1.5">
                    <ExpandChevron open={aberto} visible={temSubs} />
                    <div className="min-w-0">
                      <TituloLink
                        nome={r.nome}
                        url={r.url}
                        className="text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {temSubs ? (
                        <p className="mt-0.5 text-[9px] text-slate-400">
                          {r.subtarefas.length} subtarefa{r.subtarefas.length === 1 ? '' : 's'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-center align-top whitespace-nowrap text-blue-700">
                  {r.tipo || '—'}
                </td>
                <td className="px-2 py-2 text-center align-top whitespace-nowrap text-emerald-600">
                  {r.extensao || '—'}
                </td>
                <td className="px-2 py-2 text-center align-top whitespace-nowrap text-slate-900">
                  {respLabel(r.responsavel)}
                </td>
                <td className="px-2 py-2 text-center align-top whitespace-nowrap font-semibold text-amber-600">
                  {progresso}
                </td>
              </tr>
              {aberto && temSubs ? (
                <SubtarefaNestedRows items={r.subtarefas} mode="andamento" />
              ) : null}
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

/** Recalcula KPIs + painel.concluidos no client a partir do payload anual (sem novo ClickUp). */
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
  /** Uma chamada ClickUp por ano; filtro de mês é só no client. */
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
