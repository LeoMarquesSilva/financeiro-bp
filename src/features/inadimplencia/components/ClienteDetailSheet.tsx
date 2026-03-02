import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { formatCurrency, formatCnpj, formatDate, formatHorasDuracao } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
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
import { Pencil, History, Check, AlertTriangle, ChevronDown, ChevronUp, MessageSquare, FileText, ListChecks, CreditCard, CheckCircle2, Clock, AlertCircle, Trash2 } from 'lucide-react'
import {
  fetchClientesEscritorio,
  fetchContagemCiPorGrupo,
  fetchHorasPorGrupo,
  getHorasParaGrupo,
  normalizarNomeGrupo,
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
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

interface ProvidenciaCardProps {
  p: ProvidenciaRow
  clientId: string
  onRefresh?: () => void
}

function ProvidenciaCard({ p, clientId, onRefresh }: ProvidenciaCardProps) {
  const queryClient = useQueryClient()
  const [modalExcluir, setModalExcluir] = useState(false)

  const handleDeleteProvidencia = async () => {
    const { error } = await providenciaService.deleteProvidencia(p.id)
    if (error) {
      toast.error('Erro ao apagar providência')
      throw error
    }
    toast.success('Providência apagada')
    queryClient.invalidateQueries({ queryKey: ['providencias', clientId] })
    onRefresh?.()
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <FileText className="h-4 w-4 text-slate-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">
                Providência — {formatDate(p.data_providencia ?? p.created_at)}
              </p>
              <button
                type="button"
                onClick={() => setModalExcluir(true)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Apagar providência"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-900 leading-snug">
              {p.texto}
            </p>
            <FollowUpsList providenciaId={p.id} clientId={clientId} onRefresh={onRefresh} />
          </div>
        </div>
      </div>
      <ModalConfirmacao
        open={modalExcluir}
        onClose={() => setModalExcluir(false)}
        title="Apagar providência"
        description="Apagar esta providência? Os follow-ups vinculados também serão removidos."
        confirmLabel="Apagar"
        variant="destructive"
        onConfirm={handleDeleteProvidencia}
      />
    </>
  )
}

interface FollowUpsListProps {
  providenciaId: string
  clientId: string
  onRefresh?: () => void
}

function FollowUpsList({ providenciaId, clientId, onRefresh }: FollowUpsListProps) {
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

  const handleDeleteFollowUp = async () => {
    if (!fuParaExcluir) return
    const { error } = await providenciaService.deleteFollowUp(fuParaExcluir.id)
    if (error) {
      toast.error('Erro ao apagar follow-up')
      throw error
    }
    toast.success('Follow-up apagado')
    queryClient.invalidateQueries({ queryKey: ['providencias', clientId] })
    queryClient.invalidateQueries({ queryKey: ['providencia-follow-ups', providenciaId] })
    onRefresh?.()
  }

  if (list.length === 0) return null
  return (
    <>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Follow-ups</p>
        <ul className="space-y-2">
          {list.map((fu: ProvidenciaFollowUpRow) => (
            <li
              key={fu.id}
              className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary" className="text-xs font-medium">
                  {PROVIDENCIA_FOLLOW_UP_TIPO_LABEL[fu.tipo]}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{formatDate(fu.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => setFuParaExcluir(fu)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Apagar follow-up"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="min-w-0 text-slate-800 whitespace-pre-wrap">{fu.texto || '–'}</p>
            </li>
          ))}
        </ul>
      </div>
      <ModalConfirmacao
        open={!!fuParaExcluir}
        onClose={() => setFuParaExcluir(null)}
        title="Apagar follow-up"
        description="Apagar este follow-up?"
        confirmLabel="Apagar"
        variant="destructive"
        onConfirm={handleDeleteFollowUp}
      />
    </>
  )
}

export interface ClienteDetailSheetProps {
  open: boolean
  onClose: () => void
  client: ClientInadimplenciaRow | null
  onMarcarResolvido: (id: string) => void
  onRefresh?: () => void
}

export function ClienteDetailSheet({
  open,
  onClose,
  client,
  onMarcarResolvido,
  onRefresh,
}: ClienteDetailSheetProps) {
  const { teamMembers } = useTeamMembers()
  const [modalEditar, setModalEditar] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [modalProvidencia, setModalProvidencia] = useState(false)
  const [modalFollowUp, setModalFollowUp] = useState(false)
  const [processosHorasAberto, setProcessosHorasAberto] = useState(true)

  const { data: logs } = useQuery({
    queryKey: ['inadimplencia', 'logs', client?.id],
    queryFn: async () => {
      if (!client?.id) return []
      const { data, error } = await logsService.listByClientId(client.id)
      if (error) throw error
      return data ?? []
    },
    enabled: !!client?.id && open,
  })
  const ultimosLogs = (logs ?? []).slice(0, ULTIMOS_LOGS)

  const { data: clientesEscritorio = [] } = useQuery({
    queryKey: ['clientes-escritorio'],
    queryFn: fetchClientesEscritorio,
    enabled: open,
  })
  const linkedEscritorio =
    client?.pessoa_id != null
      ? clientesEscritorio.find((ce: ClienteEscritorioRow) => ce.id === client.pessoa_id)
      : null
  const grupoCliente = linkedEscritorio?.grupo_cliente ?? null
  const empresasDoGrupo =
    grupoCliente != null && grupoCliente !== ''
      ? clientesEscritorio.filter((ce: ClienteEscritorioRow) => (ce.grupo_cliente ?? '') === grupoCliente)
      : []

  const { data: horasPorGrupoMap } = useQuery({
    queryKey: ['horas-por-grupo'],
    queryFn: fetchHorasPorGrupo,
    enabled: open,
  })
  const horasDoGrupo =
    grupoCliente && horasPorGrupoMap
      ? getHorasParaGrupo(horasPorGrupoMap, grupoCliente)
      : { total: 0, porAno: {} as Record<string, number> }

  // Processos: do cliente escritório quando vinculado, senão da inadimplência. Horas: só da tabela TimeSheets (por grupo)
  const qtdProcessos = linkedEscritorio?.qtd_processos ?? client?.qtd_processos
  const horasTotal =
    grupoCliente && horasDoGrupo.total > 0 ? horasDoGrupo.total : null
  const horasPorAno =
    grupoCliente && horasDoGrupo.porAno && Object.keys(horasDoGrupo.porAno).length > 0
      ? horasDoGrupo.porAno
      : null

  const { data: contagemList = [] } = useQuery({
    queryKey: ['contagem-ci-por-grupo'],
    queryFn: fetchContagemCiPorGrupo,
    enabled: open,
  })
  const contagemCi =
    grupoCliente && contagemList.length > 0
      ? contagemList.find((c: ContagemCiPorGrupoRow) => c.grupo_cliente.trim() === grupoCliente.trim()) ??
        contagemList.find((c: ContagemCiPorGrupoRow) => normalizarNomeGrupo(c.grupo_cliente) === normalizarNomeGrupo(grupoCliente))
      : null

  const { data: providencias = [] } = useQuery({
    queryKey: ['providencias', client?.id],
    queryFn: async () => {
      if (!client?.id) return []
      const { data, error } = await providenciaService.listByCliente(client.id)
      if (error) throw error
      return data
    },
    enabled: open && !!client?.id,
  })

  const { data: parcelasData } = useQuery({
    queryKey: ['parcelas-cliente', client?.pessoa_id, client?.razao_social],
    queryFn: () =>
      fetchParcelasPorCliente({
        pessoa_id: client?.pessoa_id ?? null,
        razao_social: client?.razao_social ?? '',
      }),
    enabled: open && !!(client?.pessoa_id || client?.razao_social?.trim()),
  })

  const closeAndRefresh = () => {
    setModalEditar(false)
    setModalHistorico(false)
    setModalProvidencia(false)
    setModalFollowUp(false)
    onRefresh?.()
  }

  if (!client) return null

  const prioridade: PrioridadeTipo = getPrioridade(client.dias_em_aberto, Number(client.valor_em_aberto))
  const followUpVencido =
    client.data_follow_up && new Date(client.data_follow_up) < new Date()
  const gestorMember = resolveTeamMember(client.gestor ?? null, teamMembers)
  const cnpjExibir = (linkedEscritorio?.cnpj ?? client.cnpj) || null
  const subinfo = [client.area, cnpjExibir ? formatCnpj(cnpjExibir) : null].filter(Boolean).join(' · ') || null
  const gestorAvatarUrl = gestorMember
    ? getTeamMember(gestorMember.email)?.avatar ?? gestorMember.avatar_url
    : null

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side="right"
          className="flex w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl rounded-l-xl border-l border-slate-200 bg-white shadow-xl"
        >
          {/* Header */}
          <header className="shrink-0 border-b border-slate-200 bg-white px-6 pt-5 pb-4 pr-12">
            <SheetTitle className="text-xl font-semibold text-slate-900 leading-tight">
              {grupoCliente || client.razao_social}
            </SheetTitle>
            {(subinfo || empresasDoGrupo.length > 0) && (
              <SheetDescription className="mt-1 text-sm text-slate-500">
                {subinfo}
                {subinfo && empresasDoGrupo.length > 0 && ' · '}
                {empresasDoGrupo.length > 0 &&
                  `${empresasDoGrupo.length} ${empresasDoGrupo.length === 1 ? 'empresa' : 'empresas'}`}
              </SheetDescription>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={BADGE_VARIANT_CLASSE[client.status_classe]} className="rounded-full">
                Classe {client.status_classe}
              </Badge>
              <Badge variant={BADGE_VARIANT_PRIORIDADE[prioridade]} className="rounded-full">
                {PRIORIDADE_LABEL[prioridade]}
              </Badge>
            </div>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Resumo financeiro (contexto rápido) */}
            <section className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-slate-600">Resumo financeiro</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Valor em aberto</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(Number(client.valor_em_aberto))}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Dias em atraso</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{client.dias_em_aberto}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Valor mensal</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                    {client.valor_mensal != null ? formatCurrency(Number(client.valor_mensal)) : '–'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Gestor</p>
                  <div className="mt-1 flex items-center gap-2">
                    {gestorMember ? (
                      <>
                        <Avatar className="h-7 w-7">
                          {gestorAvatarUrl && (
                            <AvatarImage src={gestorAvatarUrl} alt={gestorMember.full_name} />
                          )}
                          <AvatarFallback className="text-xs bg-slate-300 text-slate-700">
                            {getIniciais(gestorMember.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-slate-900 truncate">{gestorMember.full_name}</span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">–</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Parcelas: últimas pagas, em atraso, próximas a vencer */}
            {parcelasData && (parcelasData.pagas.length > 0 || parcelasData.emAtraso.length > 0 || parcelasData.aVencer.length > 0) && (
              <section className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-slate-600 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Parcelas
                </h3>
                <div className="space-y-4">
                  {parcelasData.emAtraso.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        Em atraso ({parcelasData.emAtraso.length})
                      </p>
                      <ul className="space-y-1.5">
                        {parcelasData.emAtraso.map((p: ParcelaRow) => (
                          <li key={p.id} className="rounded border border-red-100 bg-white px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 font-medium text-slate-800">
                                {p.descricao || p.tipo || p.nro_titulo}
                              </span>
                              <span className="shrink-0 font-medium text-red-700 tabular-nums">{formatCurrency(Number(p.valor))}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                              {p.competencia && <span>Competência: {p.competencia}</span>}
                              {p.parcela && <span>Parcela {p.parcela}{p.parcelas ? ` de ${p.parcelas}` : ''}</span>}
                              <span>Venc.: {formatDate(p.data_vencimento)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parcelasData.aVencer.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                        <Clock className="h-4 w-4" />
                        Próximas a vencer ({parcelasData.aVencer.length})
                      </p>
                      <ul className="space-y-1.5">
                        {parcelasData.aVencer.map((p: ParcelaRow) => (
                          <li key={p.id} className="rounded border border-amber-100 bg-white px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 font-medium text-slate-800">
                                {p.descricao || p.tipo || p.nro_titulo}
                              </span>
                              <span className="shrink-0 font-medium text-slate-900 tabular-nums">{formatCurrency(Number(p.valor))}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                              {p.competencia && <span>Competência: {p.competencia}</span>}
                              {p.parcela && <span>Parcela {p.parcela}{p.parcelas ? ` de ${p.parcelas}` : ''}</span>}
                              <span>Venc.: {formatDate(p.data_vencimento)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parcelasData.pagas.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Últimas parcelas pagas ({parcelasData.pagas.length})
                      </p>
                      <ul className="space-y-1.5">
                        {parcelasData.pagas.map((p: ParcelaRow) => (
                          <li key={p.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 font-medium text-slate-800">
                                {p.descricao || p.tipo || p.nro_titulo}
                              </span>
                              <span className="shrink-0 font-medium text-slate-900 tabular-nums">
                                {p.valor_pago != null ? formatCurrency(Number(p.valor_pago)) : formatCurrency(Number(p.valor))}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                              {p.competencia && <span>Competência: {p.competencia}</span>}
                              {p.parcela && <span>Parcela {p.parcela}{p.parcelas ? ` de ${p.parcelas}` : ''}</span>}
                              <span>Baixa: {formatDate(p.data_baixa)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}
            {parcelasData && parcelasData.pagas.length === 0 && parcelasData.emAtraso.length === 0 && parcelasData.aVencer.length === 0 && (
              <section className="mb-6">
                <h3 className="mb-2 text-sm font-medium text-slate-600 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Parcelas
                </h3>
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Nenhuma parcela encontrada na base financeira. Verifique se o cliente está vinculado e se o relatório foi sincronizado.
                </p>
              </section>
            )}

            {/* Providências e follow-ups – destaque para o dia a dia */}
            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-slate-600" aria-hidden />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Providências e follow-ups</h3>
                  <p className="text-xs text-slate-500">Acompanhamento e próximos passos</p>
                </div>
              </div>
              <div className="space-y-4">
                {providencias.length > 0 ? (
                  providencias.map((p: ProvidenciaRow) => (
                    <ProvidenciaCard
                      key={p.id}
                      p={p}
                      clientId={client.id}
                      onRefresh={onRefresh}
                    />
                  ))
                ) : client.ultima_providencia ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <FileText className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-500">
                          Providência — {client.data_providencia ? formatDate(client.data_providencia) : '–'}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900 leading-snug">
                          {client.ultima_providencia}
                        </p>
                        {(client.follow_up || client.data_follow_up) && (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Follow-up
                            </p>
                            <div
                              className={cn(
                                'rounded-md border px-3 py-2',
                                followUpVencido ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
                              )}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                {followUpVencido && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Vencido
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">
                                  {client.data_follow_up ? formatDate(client.data_follow_up) : ''}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-800">{client.follow_up}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
                    <FileText className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-600">Nenhuma providência</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Adicione uma providência para acompanhar este cliente.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Observações gerais */}
            {client.observacoes_gerais && (
              <section className="mb-6">
                <h3 className="mb-2 text-sm font-medium text-slate-600">Observações gerais</h3>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{client.observacoes_gerais}</p>
                </div>
              </section>
            )}

            {/* Empresas (nome do grupo já está no título do painel) */}
            {linkedEscritorio && empresasDoGrupo.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-2 text-sm font-medium text-slate-600">Empresas</h3>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <ul className="max-h-32 overflow-y-auto list-inside list-disc space-y-0.5 text-sm text-slate-700">
                    {empresasDoGrupo.map((ce: ClienteEscritorioRow) => (
                      <li key={ce.id}>{ce.nome}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Processos, horas e contagem por grupo (visível ao abrir o painel) */}
            {(qtdProcessos != null ||
              horasTotal != null ||
              (horasPorAno && Object.keys(horasPorAno).length > 0) ||
              (contagemCi && grupoCliente)) && (
              <section className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-slate-600">Processos (escritório) · Horas (TimeSheets)</h3>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <button
                    type="button"
                    onClick={() => setProcessosHorasAberto((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left text-sm font-medium text-slate-700 hover:text-slate-900"
                  >
                    <span>
                      {qtdProcessos != null && qtdProcessos} processos ·{' '}
                      {horasTotal != null && formatHorasDuracao(Number(horasTotal))}
                    </span>
                    {processosHorasAberto ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {processosHorasAberto && (
                    <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-3 py-2 font-medium text-slate-600">Processos</th>
                            <th className="px-3 py-2 font-medium text-slate-600">Horas total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-3 py-2 text-slate-900">
                              {qtdProcessos != null ? qtdProcessos : '–'}
                            </td>
                            <td className="px-3 py-2 text-slate-900">
                              {horasTotal != null
                                ? formatHorasDuracao(Number(horasTotal))
                                : '–'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {horasPorAno && Object.keys(horasPorAno).length > 0 && (
                        <div className="border-t border-slate-200 px-3 py-2">
                          <p className="mb-1.5 text-xs font-medium text-slate-500">Horas por ano</p>
                          <table className="w-full text-left text-sm">
                            <tbody>
                              {Object.entries(horasPorAno)
                                .sort(([a], [b]) => b.localeCompare(a))
                                .map(([ano, horas]) => (
                                  <tr key={ano} className="border-t border-slate-100 first:border-0">
                                    <td className="py-1 text-slate-700">{ano}</td>
                                    <td className="py-1 text-slate-700 font-medium text-right">
                                      {formatHorasDuracao(Number(horas))}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {contagemCi && grupoCliente && (
                        <div className="border-t border-slate-200 px-3 py-2">
                          <p className="mb-1.5 text-xs font-medium text-slate-500">Processos por situação (grupo)</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-800">
                            Total geral: {contagemCi.total_geral} {contagemCi.total_geral === 1 ? 'processo' : 'processos'}
                          </p>
                          <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                            {Object.entries(LABELS_CONTAGEM_CI).map(([key, label]) => {
                              const val = contagemCi[key as keyof typeof contagemCi]
                              if (typeof val !== 'number' || val <= 0) return null
                              return (
                                <li key={key} className="flex justify-between gap-2">
                                  <span>{label}</span>
                                  <strong>{val}</strong>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Últimas ações */}
            <section>
              <h3 className="mb-3 text-sm font-medium text-slate-600">Últimas ações</h3>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                {ultimosLogs.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma ação registrada.</p>
                ) : (
                  <ul className="space-y-2">
                    {(ultimosLogs as InadimplenciaLogRow[]).map((log) => (
                      <li
                        key={log.id}
                        className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
                          {getTipoLabel(log.tipo)}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-slate-500">{log.descricao || '–'}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatDate(log.data_acao)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {/* Footer – ações */}
          <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalProvidencia(true)} className="gap-1.5">
                <FileText className="h-4 w-4" />
                Providência
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModalFollowUp(true)} className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Follow-up
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModalEditar(true)} className="gap-1.5">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModalHistorico(true)} className="gap-1.5">
                <History className="h-4 w-4" />
                Histórico
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => onMarcarResolvido(client.id)}
                className="ml-auto gap-1.5"
              >
                <Check className="h-4 w-4" />
                Resolver
              </Button>
            </div>
          </footer>
        </SheetContent>
      </Sheet>

      <ModalEditarCliente
        open={modalEditar}
        onClose={() => setModalEditar(false)}
        client={client}
        onSuccess={closeAndRefresh}
      />
      <ModalHistorico open={modalHistorico} onClose={() => setModalHistorico(false)} clientId={client.id} />
      <ModalNovaProvidencia
        open={modalProvidencia}
        onClose={() => setModalProvidencia(false)}
        clientId={client.id}
        onSuccess={closeAndRefresh}
      />
      <ModalNovoFollowUp
        open={modalFollowUp}
        onClose={() => setModalFollowUp(false)}
        clientId={client.id}
        onSuccess={closeAndRefresh}
      />
    </>
  )
}
