import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { formatCurrency, formatCnpj, formatDate, formatHorasDuracao } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import type { ClientInadimplenciaRow, InadimplenciaClasse, InadimplenciaLogRow, ClienteEscritorioRow, ContagemCiPorGrupoRow, ProvidenciaRow, ProvidenciaFollowUpRow } from '@/lib/database.types'
import { resolveTeamMember } from '@/lib/teamMembersService'
import { getTeamMember } from '@/lib/teamAvatars'
import { getPrioridade } from '../services/prioridade'
import type { PrioridadeTipo } from '../types/inadimplencia.types'
import { TIPOS_ACAO } from '@/shared/constants/inadimplencia'
import { logsService } from '../services/logsService'
import { ModalEditarCliente } from './ModalEditarCliente'
import { ModalHistorico } from './ModalHistorico'
import { ModalNovaProvidencia } from './ModalNovaProvidencia'
import { ModalNovoFollowUp } from './ModalNovoFollowUp'
import { providenciaService, PROVIDENCIA_FOLLOW_UP_TIPO_LABEL } from '../services/providenciaService'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Pencil, History, Check, AlertTriangle, ChevronDown, ChevronRight, MessageSquare, FileText, ListChecks, CheckCircle2, Clock, AlertCircle, Trash2, DollarSign, CalendarDays, Building2, Briefcase, RotateCcw } from 'lucide-react'
import {
  fetchClientesEscritorio,
  fetchContagemCiPorGrupo,
  fetchHorasPorGrupo,
  getHorasParaGrupo,
  normalizarNomeGrupo,
  fetchProcessosPorAreaDoGrupo,
  type ProcessosPorAreaItem,
} from '@/features/escritorio/services/escritorioService'
import { fetchParcelasPorCliente, type ParcelaRow } from '../services/parcelasService'
import { ModalConfirmacao } from '@/components/ui/modal-confirmacao'
import { toast } from 'sonner'

const ULTIMOS_LOGS = 5

function getTipoLabel(tipo: string) {
  return TIPOS_ACAO.find((t) => t.value === tipo)?.label ?? tipo
}

const LABELS_CONTAGEM_CI: Record<string, string> = {
  arquivado: 'Arquivado',
  arquivado_definitivamente: 'Arquivado Definitivamente',
  arquivado_provisoriamente: 'Arquivado Provisoriamente',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  ex_cliente: 'Encerrado - Ex-Cliente',
  suspenso: 'Suspenso',
  outros: 'Outros',
}

const PRIORIDADE_LABEL: Record<PrioridadeTipo, string> = {
  urgente: 'Urgente',
  atencao: 'Atenção',
  controlado: 'Controlado',
}

const BADGE_VARIANT_CLASSE: Record<InadimplenciaClasse, 'classeA' | 'classeB' | 'classeC'> = {
  A: 'classeA',
  B: 'classeB',
  C: 'classeC',
}

const BADGE_VARIANT_PRIORIDADE: Record<PrioridadeTipo, 'urgente' | 'atencao' | 'controlado'> = {
  urgente: 'urgente',
  atencao: 'atencao',
  controlado: 'controlado',
}

function getIniciais(name: string | null | undefined): string {
  if (!name || !name.trim()) return '–'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/* ── Collapsible section ── */
function CollapsibleSection({
  icon: Icon,
  title,
  count,
  variant = 'default',
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType
  title: string
  count: number
  variant?: 'danger' | 'warning' | 'success' | 'default'
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const styles = {
    danger: { bg: 'bg-red-50/60', border: 'border-red-200/60', iconBg: 'bg-red-100 text-red-600', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-amber-50/60', border: 'border-amber-200/60', iconBg: 'bg-amber-100 text-amber-600', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
    success: { bg: 'bg-emerald-50/40', border: 'border-slate-200/60', iconBg: 'bg-emerald-100 text-emerald-600', text: 'text-slate-800', badge: 'bg-emerald-100 text-emerald-700' },
    default: { bg: 'bg-slate-50/60', border: 'border-slate-200/60', iconBg: 'bg-slate-100 text-slate-500', text: 'text-slate-800', badge: 'bg-slate-100 text-slate-600' },
  }
  const s = styles[variant]

  return (
    <div className={cn('rounded-xl border', s.border, s.bg)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
      >
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', s.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn('flex-1 text-sm font-semibold', s.text)}>{title}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', s.badge)}>{count}</span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-inherit px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

/* ── Parcela item ── */
function ParcelaItem({ p, valueColor = 'text-slate-900' }: { p: ParcelaRow; valueColor?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/60 bg-white px-3 py-2.5">
      <span className="text-sm font-semibold text-slate-800">
        {formatDate(p.data_vencimento)}
      </span>
      <span className={cn('shrink-0 text-sm font-bold tabular-nums', valueColor)}>
        {p.valor_pago != null ? formatCurrency(Number(p.valor_pago)) : formatCurrency(Number(p.valor))}
      </span>
    </li>
  )
}

/* ── Metric card ── */
function MetricCard({ icon: Icon, label, value, iconClass }: { icon: React.ElementType; label: string; value: string; iconClass: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-3.5">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900">{value}</p>
      </div>
    </div>
  )
}

/* ── ProvidenciaCard ── */
function ProvidenciaCard({ p, clientId, onRefresh }: { p: ProvidenciaRow; clientId: string; onRefresh?: () => void }) {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'
  const { teamMembers } = useTeamMembers()
  const queryClient = useQueryClient()
  const [modalExcluir, setModalExcluir] = useState(false)

  const author = p.created_by ? teamMembers.find((m: { full_name: string; email: string }) => m.full_name === p.created_by || m.email === p.created_by) ?? null : null
  const authorAvatar = author ? getTeamMember(author.email)?.avatar ?? author.avatar_url : null

  const handleDelete = async () => {
    const { error } = await providenciaService.deleteProvidencia(p.id)
    if (error) { toast.error('Erro ao apagar providência'); throw error }
    toast.success('Providência apagada')
    queryClient.invalidateQueries({ queryKey: ['providencias', clientId] })
    onRefresh?.()
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200/60 bg-white p-4">
        <div className="flex items-start gap-3">
          {author ? (
            <Avatar className="h-8 w-8 shrink-0">
              {authorAvatar && <AvatarImage src={authorAvatar} alt={author.full_name} />}
              <AvatarFallback className="text-[10px] bg-primary-dark/10 text-primary-dark">{getIniciais(author.full_name)}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-dark/5">
              <FileText className="h-4 w-4 text-primary-dark" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {formatDate(p.data_providencia ?? p.created_at)}
                </p>
                {author && <span className="text-[11px] text-slate-500">{author.full_name}</span>}
              </div>
              {canEdit && (
                <button type="button" onClick={() => setModalExcluir(true)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Apagar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{p.texto}</p>
            <FollowUpsList providenciaId={p.id} clientId={clientId} onRefresh={onRefresh} />
          </div>
        </div>
      </div>
      <ModalConfirmacao open={modalExcluir} onClose={() => setModalExcluir(false)} title="Apagar providência" description="Apagar esta providência e seus follow-ups?" confirmLabel="Apagar" variant="destructive" onConfirm={handleDelete} />
    </>
  )
}

/* ── FollowUpsList ── */
function FollowUpsList({ providenciaId, clientId, onRefresh }: { providenciaId: string; clientId: string; onRefresh?: () => void }) {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'
  const { teamMembers } = useTeamMembers()
  const queryClient = useQueryClient()
  const [fuParaExcluir, setFuParaExcluir] = useState<ProvidenciaFollowUpRow | null>(null)
  const { data: list = [] } = useQuery({
    queryKey: ['providencia-follow-ups', providenciaId],
    queryFn: async () => {
      const { data, error } = await providenciaService.listFollowUpsByProvidencia(providenciaId)
      if (error) throw error
      return data ?? []
    },
  })

  const handleDelete = async () => {
    if (!fuParaExcluir) return
    const { error } = await providenciaService.deleteFollowUp(fuParaExcluir.id)
    if (error) { toast.error('Erro ao apagar follow-up'); throw error }
    toast.success('Follow-up apagado')
    queryClient.invalidateQueries({ queryKey: ['providencias', clientId] })
    queryClient.invalidateQueries({ queryKey: ['providencia-follow-ups', providenciaId] })
    onRefresh?.()
  }

  if (list.length === 0) return null
  return (
    <>
      <div className="mt-3 space-y-1.5">
        {list.map((fu: ProvidenciaFollowUpRow) => {
          const author = fu.created_by ? teamMembers.find((m: { full_name: string; email: string }) => m.full_name === fu.created_by || m.email === fu.created_by) ?? null : null
          const authorAvatar = author ? getTeamMember(author.email)?.avatar ?? author.avatar_url : null
          return (
            <div key={fu.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {author && (
                    <Avatar className="h-5 w-5">
                      {authorAvatar && <AvatarImage src={authorAvatar} alt={author.full_name} />}
                      <AvatarFallback className="text-[9px] bg-slate-200 text-slate-600">{getIniciais(author.full_name)}</AvatarFallback>
                    </Avatar>
                  )}
                  <Badge variant="secondary" className="text-[10px]">{PROVIDENCIA_FOLLOW_UP_TIPO_LABEL[fu.tipo]}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {fu.data_follow_up && (
                    <span className="text-[11px] text-slate-600" title="Data em que o follow-up foi realizado (ex.: reunião com o cliente)">
                      Realizado em {formatDate(fu.data_follow_up)}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400" title="Data em que o registro foi feito no sistema">
                    Registrado em {formatDate(fu.created_at)}
                  </span>
                  {canEdit && (
                    <button type="button" onClick={() => setFuParaExcluir(fu)} className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{fu.texto || '–'}</p>
            </div>
          )
        })}
      </div>
      <ModalConfirmacao open={!!fuParaExcluir} onClose={() => setFuParaExcluir(null)} title="Apagar follow-up" description="Apagar este follow-up?" confirmLabel="Apagar" variant="destructive" onConfirm={handleDelete} />
    </>
  )
}

/* ══════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                       */
/* ══════════════════════════════════════════════════════ */

export interface ClienteDetailSheetProps {
  open: boolean
  onClose: () => void
  client: ClientInadimplenciaRow | null
  onMarcarResolvido: (id: string) => void
  onReabrir?: (id: string) => void
  onRefresh?: () => void
}

export function ClienteDetailSheet({ open, onClose, client, onMarcarResolvido, onReabrir, onRefresh }: ClienteDetailSheetProps) {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'
  const { teamMembers } = useTeamMembers()
  const [modalEditar, setModalEditar] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [modalProvidencia, setModalProvidencia] = useState(false)
  const [modalFollowUp, setModalFollowUp] = useState(false)
  const [processosAberto, setProcessosAberto] = useState(true)

  /* ── Queries ── */
  const { data: logs } = useQuery({
    queryKey: ['inadimplencia', 'logs', client?.id],
    queryFn: async () => { if (!client?.id) return []; const { data, error } = await logsService.listByClientId(client.id); if (error) throw error; return data ?? [] },
    enabled: !!client?.id && open,
  })
  const ultimosLogs = (logs ?? []).slice(0, ULTIMOS_LOGS)

  const { data: clientesEscritorio = [] } = useQuery({ queryKey: ['clientes-escritorio'], queryFn: fetchClientesEscritorio, enabled: open })
  const linkedEscritorio = client?.pessoa_id != null ? clientesEscritorio.find((ce: ClienteEscritorioRow) => ce.id === client.pessoa_id) : null
  const grupoCliente = linkedEscritorio?.grupo_cliente ?? null
  const empresasDoGrupo = grupoCliente != null && grupoCliente !== '' ? clientesEscritorio.filter((ce: ClienteEscritorioRow) => (ce.grupo_cliente ?? '') === grupoCliente) : []

  const { data: horasPorGrupoMap } = useQuery({ queryKey: ['horas-por-grupo'], queryFn: fetchHorasPorGrupo, enabled: open })
  const horasDoGrupo = grupoCliente && horasPorGrupoMap ? getHorasParaGrupo(horasPorGrupoMap, grupoCliente) : { total: 0, porAno: {} as Record<string, number> }
  const qtdProcessos = linkedEscritorio?.qtd_processos ?? client?.qtd_processos
  const horasTotal = grupoCliente && horasDoGrupo.total > 0 ? horasDoGrupo.total : null
  const horasPorAno = grupoCliente && horasDoGrupo.porAno && Object.keys(horasDoGrupo.porAno).length > 0 ? horasDoGrupo.porAno : null

  const { data: contagemList = [] } = useQuery({ queryKey: ['contagem-ci-por-grupo'], queryFn: fetchContagemCiPorGrupo, enabled: open })
  const contagemCi = grupoCliente && contagemList.length > 0
    ? contagemList.find((c: ContagemCiPorGrupoRow) => c.grupo_cliente.trim() === grupoCliente.trim()) ?? contagemList.find((c: ContagemCiPorGrupoRow) => normalizarNomeGrupo(c.grupo_cliente) === normalizarNomeGrupo(grupoCliente))
    : null

  const { data: processosPorArea = [] } = useQuery({ queryKey: ['processos-por-area', grupoCliente], queryFn: () => fetchProcessosPorAreaDoGrupo(grupoCliente!), enabled: open && !!grupoCliente })
  const areasProcessos = useMemo(() => {
    const map = new Map<string, { situacao: string; total: number }[]>()
    for (const item of processosPorArea as ProcessosPorAreaItem[]) { if (!map.has(item.area)) map.set(item.area, []); map.get(item.area)!.push({ situacao: item.situacao_processo, total: Number(item.total) }) }
    return Array.from(map.entries()).map(([area, situacoes]) => ({ area, situacoes, totalArea: situacoes.reduce((s, x) => s + x.total, 0) })).sort((a, b) => a.area.localeCompare(b.area, 'pt-BR'))
  }, [processosPorArea])

  const { data: providencias = [] } = useQuery({ queryKey: ['providencias', client?.id], queryFn: async () => { if (!client?.id) return []; const { data, error } = await providenciaService.listByCliente(client.id); if (error) throw error; return data }, enabled: open && !!client?.id })

  const { data: ciclos = [] } = useQuery({
    queryKey: ['inadimplencia-ciclos', client?.id],
    queryFn: async () => {
      if (!client?.id) return []
      const { supabase } = await import('@/lib/supabaseClient')
      const { data, error } = await supabase
        .from('inadimplencia_ciclos')
        .select('*')
        .eq('cliente_inadimplencia_id', client.id)
        .order('data_evento', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: open && !!client?.id,
  })

  const grupoPessoaIds = useMemo(() => empresasDoGrupo.length > 0 ? empresasDoGrupo.map((ce: ClienteEscritorioRow) => ce.id) : [], [empresasDoGrupo])
  const { data: parcelasData } = useQuery({
    queryKey: ['parcelas-cliente', client?.pessoa_id, grupoPessoaIds, client?.razao_social],
    queryFn: () => fetchParcelasPorCliente({ pessoa_id: client?.pessoa_id ?? null, pessoa_ids: grupoPessoaIds.length > 0 ? grupoPessoaIds : undefined, razao_social: client?.razao_social ?? '' }),
    enabled: open && !!(client?.pessoa_id || grupoPessoaIds.length > 0 || client?.razao_social?.trim()),
  })

  const closeAndRefresh = () => { setModalEditar(false); setModalHistorico(false); setModalProvidencia(false); setModalFollowUp(false); onRefresh?.() }

  if (!client) return null

  const prioridade: PrioridadeTipo = getPrioridade(client.dias_em_aberto, Number(client.valor_em_aberto))
  const followUpVencido = client.data_follow_up && new Date(client.data_follow_up) < new Date()
  const gestorEmails: string[] = Array.isArray(client.gestor) ? client.gestor : client.gestor ? [client.gestor] : []
  const gestorMembers = gestorEmails.map((g) => resolveTeamMember(g, teamMembers)).filter((m): m is NonNullable<typeof m> => m !== null)
  const cnpjExibir = (linkedEscritorio?.cnpj ?? client.cnpj) || null
  const areasList: string[] = Array.isArray(client.area) ? client.area : client.area ? [client.area] : []
  const subinfo = [cnpjExibir ? formatCnpj(cnpjExibir) : null].filter(Boolean).join(' · ') || null
  const hasParcelas = parcelasData && (parcelasData.pagas.length > 0 || parcelasData.emAtraso.length > 0 || parcelasData.aVencer.length > 0)

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side="right"
          className="flex w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl rounded-l-2xl border-l border-slate-200/60 bg-slate-50 shadow-2xl"
        >
          {/* ── Header ── */}
          <header className="shrink-0 bg-gradient-to-br from-primary-dark to-[#0a1420] px-6 pt-6 pb-5 pr-12">
            <SheetTitle className="text-lg font-bold text-white leading-tight">
              {grupoCliente || client.razao_social}
            </SheetTitle>
            <SheetDescription className={cn('mt-1 text-sm text-slate-300', !(subinfo || empresasDoGrupo.length > 0) && 'sr-only')}>
              {subinfo || empresasDoGrupo.length > 0 ? (
                <>
                  {subinfo}
                  {subinfo && empresasDoGrupo.length > 0 && ' · '}
                  {empresasDoGrupo.length > 0 && `${empresasDoGrupo.length} ${empresasDoGrupo.length === 1 ? 'empresa' : 'empresas'}`}
                </>
              ) : 'Detalhes do cliente inadimplente'}
            </SheetDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={BADGE_VARIANT_CLASSE[client.status_classe]} className="rounded-full">{`Classe ${client.status_classe}`}</Badge>
              <Badge variant={BADGE_VARIANT_PRIORIDADE[prioridade]} className="rounded-full">{PRIORIDADE_LABEL[prioridade]}</Badge>
              {areasList.map((a) => <Badge key={a} variant="outline" className="rounded-full border-white/20 text-white/80">{a}</Badge>)}
            </div>
          </header>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-5 px-5 py-5">

              {/* Metrics grid */}
              <section className="grid grid-cols-2 gap-3">
                <MetricCard icon={DollarSign} label="Valor em aberto" value={formatCurrency(Number(client.valor_em_aberto))} iconClass="bg-red-50 text-red-500" />
                <MetricCard icon={CalendarDays} label="Dias em atraso" value={String(client.dias_em_aberto)} iconClass="bg-amber-50 text-amber-500" />
                <MetricCard icon={DollarSign} label="Valor mensal" value={client.valor_mensal != null ? formatCurrency(Number(client.valor_mensal)) : '–'} iconClass="bg-slate-100 text-slate-500" />
                <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-3.5">
                  <div className="flex -space-x-1.5">
                    {gestorMembers.length > 0 ? gestorMembers.slice(0, 3).map((gm) => {
                      const url = getTeamMember(gm.email)?.avatar ?? gm.avatar_url
                      return (
                        <Avatar key={gm.email} className="h-9 w-9 border-2 border-white">
                          {url && <AvatarImage src={url} alt={gm.full_name} />}
                          <AvatarFallback className="text-[10px] bg-primary-dark/10 text-primary-dark">{getIniciais(gm.full_name)}</AvatarFallback>
                        </Avatar>
                      )
                    }) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100"><Briefcase className="h-4 w-4 text-slate-400" /></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Gestores</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 truncate">
                      {gestorMembers.length > 0 ? (gestorMembers.length === 1 ? gestorMembers[0].full_name : `${gestorMembers.length} gestores`) : '–'}
                    </p>
                  </div>
                </div>
              </section>

              {/* ── Parcelas (collapsible) ── */}
              {hasParcelas && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Vencimento Parcela</h3>
                  </div>

                  {parcelasData.emAtraso.length > 0 && (
                    <CollapsibleSection icon={AlertCircle} title="Em atraso" count={parcelasData.emAtraso.length} variant="danger">
                      <ul className="space-y-2">
                        {parcelasData.emAtraso.map((p: ParcelaRow) => <ParcelaItem key={p.id} p={p} valueColor="text-red-700" />)}
                      </ul>
                    </CollapsibleSection>
                  )}

                  {parcelasData.aVencer.length > 0 && (
                    <CollapsibleSection icon={Clock} title="Próximas a vencer" count={parcelasData.aVencer.length} variant="warning">
                      <ul className="space-y-2">
                        {parcelasData.aVencer.map((p: ParcelaRow) => <ParcelaItem key={p.id} p={p} valueColor="text-amber-700" />)}
                      </ul>
                    </CollapsibleSection>
                  )}

                  {parcelasData.pagas.length > 0 && (
                    <CollapsibleSection icon={CheckCircle2} title="Últimas pagas" count={parcelasData.pagas.length} variant="success">
                      <ul className="space-y-2">
                        {parcelasData.pagas.map((p: ParcelaRow) => <ParcelaItem key={p.id} p={p} valueColor="text-emerald-700" />)}
                      </ul>
                    </CollapsibleSection>
                  )}
                </section>
              )}

              {parcelasData && !hasParcelas && (
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">Vencimento Parcela</h3>
                  </div>
                  <p className="rounded-xl border border-dashed border-slate-300/60 bg-white px-4 py-3 text-sm text-slate-500">
                    Nenhuma parcela encontrada. Verifique se o cliente está vinculado e se o relatório foi sincronizado.
                  </p>
                </section>
              )}

              {/* ── Providências ── */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">Providências e follow-ups</h3>
                </div>
                <div className="space-y-3">
                  {providencias.length > 0 ? (
                    providencias.map((p: ProvidenciaRow) => <ProvidenciaCard key={p.id} p={p} clientId={client.id} onRefresh={onRefresh} />)
                  ) : client.ultima_providencia ? (
                    <div className="rounded-xl border border-slate-200/60 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-dark/5">
                          <FileText className="h-4 w-4 text-primary-dark" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {client.data_providencia ? formatDate(client.data_providencia) : '–'}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{client.ultima_providencia}</p>
                          {(client.follow_up || client.data_follow_up) && (
                            <div className={cn('mt-3 rounded-lg border px-3 py-2', followUpVencido ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50')}>
                              <div className="flex items-center justify-between gap-2">
                                {followUpVencido && <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="h-3 w-3" />Vencido</span>}
                                <span className="text-[11px] text-slate-400">{client.data_follow_up ? formatDate(client.data_follow_up) : ''}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">{client.follow_up}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300/60 bg-white py-6 text-center">
                      <FileText className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-medium text-slate-600">Nenhuma providência</p>
                      <p className="mt-0.5 text-xs text-slate-400">Adicione para acompanhar este cliente.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Observações ── */}
              {client.observacoes_gerais && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><MessageSquare className="h-4 w-4 text-slate-500" />Observações</h3>
                  <div className="rounded-xl border border-slate-200/60 bg-white p-4">
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{client.observacoes_gerais}</p>
                  </div>
                </section>
              )}

              {/* ── Empresas ── */}
              {linkedEscritorio && empresasDoGrupo.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><Building2 className="h-4 w-4 text-slate-500" />Empresas do grupo</h3>
                  <div className="rounded-xl border border-slate-200/60 bg-white p-3">
                    <ul className="max-h-32 space-y-1 overflow-y-auto">
                      {empresasDoGrupo.map((ce: ClienteEscritorioRow) => (
                        <li key={ce.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700">{ce.nome}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* ── Processos / Horas ── */}
              {(qtdProcessos != null || horasTotal != null || areasProcessos.length > 0 || (contagemCi && grupoCliente)) && (
                <section>
                  <button type="button" onClick={() => setProcessosAberto((v) => !v)} className="mb-2 flex w-full items-center gap-2 text-left">
                    <Briefcase className="h-4 w-4 text-slate-500" />
                    <h3 className="flex-1 text-sm font-bold text-slate-800">Processos · Horas</h3>
                    {processosAberto ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </button>
                  {processosAberto && (
                    <div className="space-y-3">
                      {areasProcessos.length > 0 && (
                        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
                          {areasProcessos.map((ap, idx) => (
                            <div key={ap.area} className={cn(idx > 0 && 'border-t border-slate-100')}>
                              <div className="flex items-center justify-between bg-slate-50/80 px-4 py-2">
                                <span className="text-sm font-semibold text-slate-800">{ap.area}</span>
                                <Badge variant="secondary" className="text-xs">{ap.totalArea}</Badge>
                              </div>
                              <ul className="px-4 py-2 space-y-0.5">
                                {ap.situacoes.map((s) => (
                                  <li key={s.situacao} className="flex justify-between text-sm text-slate-600"><span>{s.situacao}</span><strong className="tabular-nums text-slate-800">{s.total}</strong></li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                      {areasProcessos.length === 0 && contagemCi && grupoCliente && (
                        <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3">
                          <p className="text-sm font-medium text-slate-800">Total: {contagemCi.total_geral} {contagemCi.total_geral === 1 ? 'processo' : 'processos'}</p>
                          <ul className="mt-1.5 space-y-0.5 text-sm text-slate-600">
                            {Object.entries(LABELS_CONTAGEM_CI).map(([key, label]) => { const val = contagemCi[key as keyof typeof contagemCi]; if (typeof val !== 'number' || val <= 0) return null; return <li key={key} className="flex justify-between"><span>{label}</span><strong>{val}</strong></li> })}
                          </ul>
                        </div>
                      )}
                      {horasPorAno && Object.keys(horasPorAno).length > 0 && (
                        <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Horas por ano</p>
                          {Object.entries(horasPorAno).sort(([a], [b]) => b.localeCompare(a)).map(([ano, horas]) => (
                            <div key={ano} className="flex justify-between border-t border-slate-50 py-1 text-sm"><span className="text-slate-600">{ano}</span><span className="font-medium text-slate-800">{formatHorasDuracao(Number(horas))}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* ── Timeline de ciclos ── */}
              {ciclos.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><RotateCcw className="h-4 w-4 text-slate-500" />Histórico de status</h3>
                  <div className="space-y-0">
                    {ciclos.map((ciclo: { id: string; tipo: string; data_evento: string; created_by: string | null; observacao: string | null }, idx: number) => {
                      const isLast = idx === ciclos.length - 1
                      const icon = ciclo.tipo === 'resolvido' ? Check : ciclo.tipo === 'reaberto' ? RotateCcw : FileText
                      const IconComp = icon
                      const colors = ciclo.tipo === 'resolvido' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : ciclo.tipo === 'reaberto' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      const label = ciclo.tipo === 'resolvido' ? 'Resolvido' : ciclo.tipo === 'reaberto' ? 'Reaberto' : 'Inserido'
                      return (
                        <div key={ciclo.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', colors)}>
                              <IconComp className="h-3.5 w-3.5" />
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-slate-200" />}
                          </div>
                          <div className="pb-4 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{label}</p>
                            <p className="text-xs text-slate-500">
                              {formatDate(ciclo.data_evento)}
                              {ciclo.created_by && <span className="ml-1">· {ciclo.created_by}</span>}
                            </p>
                            {ciclo.observacao && <p className="mt-0.5 text-xs text-slate-400">{ciclo.observacao}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── Últimas ações ── */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><History className="h-4 w-4 text-slate-500" />Últimas ações</h3>
                {ultimosLogs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300/60 bg-white px-4 py-3 text-sm text-slate-500">Nenhuma ação registrada.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(ultimosLogs as InadimplenciaLogRow[]).map((log) => (
                      <li key={log.id} className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white px-3 py-2.5">
                        <Badge variant="secondary" className="shrink-0 text-[10px]">{getTipoLabel(log.tipo)}</Badge>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{log.descricao || '–'}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{formatDate(log.data_acao)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="shrink-0 border-t border-slate-200/60 bg-white px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalProvidencia(true)} className="gap-1.5 rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"><FileText className="h-3.5 w-3.5" />Providência</Button>
              <Button variant="outline" size="sm" onClick={() => setModalFollowUp(true)} className="gap-1.5 rounded-lg border-violet-200 text-violet-600 hover:bg-violet-50 hover:text-violet-700"><MessageSquare className="h-3.5 w-3.5" />Follow-up</Button>
              {canEdit && <Button variant="outline" size="sm" onClick={() => setModalEditar(true)} className="gap-1.5 rounded-lg border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"><Pencil className="h-3.5 w-3.5" />Editar</Button>}
              <Button variant="outline" size="sm" onClick={() => setModalHistorico(true)} className="gap-1.5 rounded-lg"><History className="h-3.5 w-3.5" />Histórico</Button>
              {canEdit && !client.resolvido_at && (
                <button type="button" onClick={() => onMarcarResolvido(client.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow">
                  <Check className="h-3.5 w-3.5" />Resolver
                </button>
              )}
              {canEdit && client.resolvido_at && onReabrir && (
                <button type="button" onClick={() => onReabrir(client.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow">
                  <RotateCcw className="h-3.5 w-3.5" />Reabrir
                </button>
              )}
            </div>
          </footer>
        </SheetContent>
      </Sheet>

      <ModalEditarCliente open={modalEditar} onClose={() => setModalEditar(false)} client={client} onSuccess={closeAndRefresh} />
      <ModalHistorico open={modalHistorico} onClose={() => setModalHistorico(false)} clientId={client.id} />
      <ModalNovaProvidencia open={modalProvidencia} onClose={() => setModalProvidencia(false)} clientId={client.id} onSuccess={closeAndRefresh} />
      <ModalNovoFollowUp open={modalFollowUp} onClose={() => setModalFollowUp(false)} clientId={client.id} onSuccess={closeAndRefresh} />
    </>
  )
}
