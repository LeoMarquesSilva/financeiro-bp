import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency, formatCnpj, formatDate, formatHorasDuracao } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { ClientInadimplenciaRow, InadimplenciaClasse, InadimplenciaLogRow } from '@/lib/database.types'
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
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Pencil, History, Check, AlertTriangle, ChevronDown, ChevronUp, MessageSquare, FileText } from 'lucide-react'
import {
  fetchClientesEscritorio,
  fetchContagemCiPorGrupo,
  fetchHorasPorGrupo,
  getHorasParaGrupo,
  normalizarNomeGrupo,
} from '@/features/escritorio/services/escritorioService'

const ULTIMOS_LOGS = 3
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

interface InadimplenciaCardProps {
  client: ClientInadimplenciaRow
  onMarcarResolvido: (id: string) => void
  onRefresh?: () => void
  onSelectClient?: (client: ClientInadimplenciaRow) => void
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

export function InadimplenciaCard({ client, onMarcarResolvido, onRefresh, onSelectClient }: InadimplenciaCardProps) {
  const { teamMembers } = useTeamMembers()
  const [modalEditar, setModalEditar] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [modalProvidencia, setModalProvidencia] = useState(false)
  const [modalFollowUp, setModalFollowUp] = useState(false)
  const [processosHorasAberto, setProcessosHorasAberto] = useState(false)

  const { data: logs } = useQuery({
    queryKey: ['inadimplencia', 'logs', client.id],
    queryFn: async () => {
      const { data, error } = await logsService.listByClientId(client.id)
      if (error) throw error
      return data ?? []
    },
  })
  const ultimosLogs = (logs ?? []).slice(0, ULTIMOS_LOGS)

  const { data: clientesEscritorio = [] } = useQuery({
    queryKey: ['clientes-escritorio'],
    queryFn: fetchClientesEscritorio,
  })
  const linkedEscritorio = client.cliente_escritorio_id
    ? clientesEscritorio.find((ce) => ce.id === client.cliente_escritorio_id)
    : null
  const grupoCliente = linkedEscritorio?.grupo_cliente ?? null
  const empresasDoGrupo =
    grupoCliente != null && grupoCliente !== ''
      ? clientesEscritorio.filter((ce) => (ce.grupo_cliente ?? '') === grupoCliente)
      : []

  const { data: horasPorGrupoMap } = useQuery({
    queryKey: ['horas-por-grupo'],
    queryFn: fetchHorasPorGrupo,
  })
  const horasDoGrupo =
    grupoCliente && horasPorGrupoMap
      ? getHorasParaGrupo(horasPorGrupoMap, grupoCliente)
      : { total: 0, porAno: {} as Record<string, number> }

  // Processos: do cliente escritório quando vinculado, senão da tabela inadimplência. Horas: só do TimeSheets (por grupo)
  const qtdProcessos = linkedEscritorio?.qtd_processos ?? client.qtd_processos
  const horasTotal = grupoCliente ? (horasDoGrupo.total > 0 ? horasDoGrupo.total : null) : null
  const horasPorAno =
    grupoCliente && horasDoGrupo.porAno && Object.keys(horasDoGrupo.porAno).length > 0
      ? horasDoGrupo.porAno
      : null

  const { data: providencias = [] } = useQuery({
    queryKey: ['providencias', client.id],
    queryFn: async () => {
      const { data, error } = await providenciaService.listByCliente(client.id)
      if (error) throw error
      return data
    },
  })
  const ultimaProvidencia = providencias[0] ?? null
  const { data: followUpsUltima = [] } = useQuery({
    queryKey: ['providencia-follow-ups', ultimaProvidencia?.id],
    queryFn: async () => {
      if (!ultimaProvidencia?.id) return []
      const { data, error } = await providenciaService.listFollowUpsByProvidencia(ultimaProvidencia.id)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ultimaProvidencia?.id,
  })

  const { data: contagemList = [] } = useQuery({
    queryKey: ['contagem-ci-por-grupo'],
    queryFn: fetchContagemCiPorGrupo,
  })
  const contagemCi =
    grupoCliente && contagemList.length > 0
      ? contagemList.find((c) => c.grupo_cliente.trim() === grupoCliente.trim()) ??
        contagemList.find((c) => normalizarNomeGrupo(c.grupo_cliente) === normalizarNomeGrupo(grupoCliente))
      : null

  const prioridade: PrioridadeTipo = getPrioridade(client.dias_em_aberto, Number(client.valor_em_aberto))
  const followUpVencido =
    client.data_follow_up && new Date(client.data_follow_up) < new Date()
  const gestorMember = resolveTeamMember(client.gestor ?? null, teamMembers)

  const closeAndRefresh = () => {
    setModalEditar(false)
    setModalHistorico(false)
    setModalProvidencia(false)
    setModalFollowUp(false)
    onRefresh?.()
  }

  const cnpjExibir = (linkedEscritorio?.cnpj ?? client.cnpj) || null
  const subinfo = [client.area, cnpjExibir ? formatCnpj(cnpjExibir) : null].filter(Boolean).join(' · ') || null
  const gestorAvatarUrl = gestorMember
    ? getTeamMember(gestorMember.email)?.avatar ?? gestorMember.avatar_url
    : null

  return (
    <>
      <Card
        className="shadow-lg transition-shadow duration-200 hover:shadow-xl focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2"
      >
        <div
          role={onSelectClient ? 'button' : undefined}
          tabIndex={onSelectClient ? 0 : undefined}
          onClick={() => onSelectClient?.(client)}
          onKeyDown={(e) => {
            if (onSelectClient && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onSelectClient(client)
            }
          }}
          className={cn(
            onSelectClient &&
              'cursor-pointer rounded-t-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-inset'
          )}
        >
        <CardHeader className="space-y-0 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold leading-tight tracking-tight text-slate-900">
                {grupoCliente || client.razao_social}
              </h3>
              {subinfo && (
                <p className="mt-0.5 text-sm text-slate-500">{subinfo}</p>
              )}
              {empresasDoGrupo.length > 0 && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {empresasDoGrupo.length} {empresasDoGrupo.length === 1 ? 'empresa' : 'empresas'}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant={BADGE_VARIANT_CLASSE[client.status_classe]} className="rounded-full">
                Classe {client.status_classe}
              </Badge>
              <Badge variant={BADGE_VARIANT_PRIORIDADE[prioridade]} className="rounded-full">
                {PRIORIDADE_LABEL[prioridade]}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          {/* Empresas do grupo (compacto; o nome do grupo já está no título do card) */}
          {linkedEscritorio && empresasDoGrupo.length > 0 && (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Empresas</p>
              <ul className="mt-1 max-h-20 overflow-y-auto list-inside list-disc space-y-0.5 text-xs text-slate-700">
                {empresasDoGrupo.map((ce) => (
                  <li key={ce.id} className="truncate" title={ce.razao_social}>
                    {ce.razao_social}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Grid de métricas – hierarquia: valor e dias em destaque, depois valor mensal e gestor */}
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Valor em aberto</p>
                <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">
                  {formatCurrency(Number(client.valor_em_aberto))}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Dias em atraso</p>
                <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">{client.dias_em_aberto}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Valor mensal</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                  {client.valor_mensal != null ? formatCurrency(Number(client.valor_mensal)) : '–'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Gestor responsável</p>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  {gestorMember ? (
                    <>
                      <Avatar className="h-8 w-8">
                        {gestorAvatarUrl && (
                          <AvatarImage
                            src={gestorAvatarUrl}
                            alt={gestorMember.full_name}
                          />
                        )}
                        <AvatarFallback className="text-xs">
                          {getIniciais(gestorMember.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="truncate text-sm font-medium text-slate-900"
                        title={`${gestorMember.full_name} (${gestorMember.area})`}
                      >
                        {gestorMember.full_name}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-slate-500">–</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Processos, horas e contagem por grupo (ao abrir/expandir) */}
          {(qtdProcessos != null ||
            horasTotal != null ||
            (horasPorAno && Object.keys(horasPorAno).length > 0) ||
            (contagemCi && grupoCliente)) && (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-sm transition-[box-shadow] duration-200">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setProcessosHorasAberto((v) => !v)
                }}
                className="flex w-full items-center justify-between gap-2 text-left rounded-md py-0.5 -my-0.5 hover:bg-slate-200/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
              >
                <span className="text-xs font-medium text-slate-600">Processos (escritório) · Horas (TimeSheets)</span>
                {!processosHorasAberto && (
                  <span className="truncate text-xs text-slate-500">
                    {qtdProcessos != null && qtdProcessos}
                    {qtdProcessos != null && horasTotal != null && ' · '}
                    {horasTotal != null && formatHorasDuracao(Number(horasTotal))}
                  </span>
                )}
                {processosHorasAberto ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                )}
              </button>
              {processosHorasAberto && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white transition-all duration-200 ease-out">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-1.5 font-medium text-slate-600">Processos</th>
                        <th className="px-3 py-1.5 font-medium text-slate-600">Horas total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-1.5 text-slate-900">
                          {qtdProcessos != null ? qtdProcessos : '–'}
                        </td>
                        <td className="px-3 py-1.5 text-slate-900">
                          {horasTotal != null
                            ? formatHorasDuracao(Number(horasTotal))
                            : '–'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {horasPorAno && Object.keys(horasPorAno).length > 0 && (
                    <>
                      <p className="mt-2 px-3 text-xs font-medium text-slate-500">Horas por ano</p>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/80">
                            <th className="px-3 py-1 font-medium text-slate-500">Ano</th>
                            <th className="px-3 py-1 font-medium text-slate-500">Horas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(horasPorAno)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .map(([ano, horas]) => (
                              <tr key={ano} className="border-b border-slate-100 last:border-0">
                                <td className="px-3 py-1 text-slate-700">{ano}</td>
                                <td className="px-3 py-1 text-slate-700">
                                  {formatHorasDuracao(Number(horas))}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  {contagemCi && grupoCliente && (
                    <div className="mt-2 border-t border-slate-200 px-3 py-2">
                      <p className="text-xs font-medium text-slate-500">Processos por situação (grupo)</p>
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
            </section>
          )}

          {/* Observações Gerais + Providência + Follow-ups */}
          <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm">
            {client.observacoes_gerais && (
              <div className="mb-4 last:mb-0">
                <p className="text-xs font-medium text-slate-500">Observações gerais</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{client.observacoes_gerais}</p>
              </div>
            )}
            {/* Providência: nova tabela ou legado */}
            {(ultimaProvidencia || client.ultima_providencia) && (
              <div className="mb-4 last:mb-0">
                <p className="text-xs font-medium text-slate-500">Providência</p>
                <p className="mt-1 text-sm text-slate-700">
                  {ultimaProvidencia ? ultimaProvidencia.texto : client.ultima_providencia}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {ultimaProvidencia
                    ? formatDate(ultimaProvidencia.created_at)
                    : client.data_providencia
                      ? formatDate(client.data_providencia)
                      : null}
                </p>
                {/* Follow-ups da última providência (novo modelo) */}
                {followUpsUltima.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-slate-200/80 pt-2">
                    {followUpsUltima.slice(0, 3).map((fu) => (
                      <li key={fu.id} className="flex items-start gap-1.5 text-xs">
                        <span className="shrink-0 font-medium text-slate-600">
                          {PROVIDENCIA_FOLLOW_UP_TIPO_LABEL[fu.tipo]}:
                        </span>
                        <span className="truncate text-slate-600">{fu.texto || '–'}</span>
                        <span className="shrink-0 text-slate-400">{formatDate(fu.created_at)}</span>
                      </li>
                    ))}
                    {followUpsUltima.length > 3 && (
                      <li className="text-xs text-slate-500">+{followUpsUltima.length - 3} mais</li>
                    )}
                  </ul>
                )}
              </div>
            )}
            {/* Legado: follow-up único no cliente (quando não há providências da tabela) */}
            {!ultimaProvidencia && (client.follow_up || client.data_follow_up) && (
              <div className={cn(followUpVencido && 'rounded-lg bg-red-50 p-3 -m-1')}>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-slate-500">Follow-up</p>
                  {followUpVencido && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Vencido
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-700">{client.follow_up}</p>
                <p
                  className={cn(
                    'mt-0.5 text-xs',
                    followUpVencido ? 'font-medium text-red-600' : 'text-slate-400'
                  )}
                >
                  {formatDate(client.data_follow_up)}
                </p>
              </div>
            )}
            {!ultimaProvidencia && !client.ultima_providencia && !client.follow_up && (
              <p className="text-sm text-slate-500">Nenhuma providência registrada.</p>
            )}
          </section>

          {/* Mini-timeline últimas ações */}
          <section className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-600">Últimas ações</p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setModalHistorico(true)
                }}
                className="h-7 gap-1.5 text-xs"
              >
                <History className="h-3.5 w-3.5" />
                Ver histórico
              </Button>
            </div>
            {ultimosLogs.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma ação registrada.</p>
            ) : (
              <ul className="space-y-1.5">
                {ultimosLogs.map((log: InadimplenciaLogRow) => (
                  <li
                    key={log.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-xs transition-colors duration-150"
                  >
                    <span className="shrink-0 font-medium text-slate-700">{getTipoLabel(log.tipo)}</span>
                    <span className="truncate text-slate-500">{log.descricao || '–'}</span>
                    <span className="ml-auto shrink-0 text-slate-400">{formatDate(log.data_acao)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
        </div>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-slate-200/90 bg-slate-50/30">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setModalProvidencia(true)
              }}
              title="Nova providência"
              className="gap-1.5 rounded-lg transition-colors duration-150"
            >
              <FileText className="h-4 w-4" />
              Providência
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setModalFollowUp(true)
              }}
              title="Novo follow-up"
              className="gap-1.5 rounded-lg transition-colors duration-150"
            >
              <MessageSquare className="h-4 w-4" />
              Follow-up
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setModalEditar(true)
              }}
              title="Editar"
              className="gap-1.5 rounded-lg transition-colors duration-150"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
          <Button
            variant="success"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onMarcarResolvido(client.id)
            }}
            className="rounded-full gap-1.5 shadow-sm transition-all duration-200 hover:shadow"
          >
            <Check className="h-4 w-4" />
            Resolver
          </Button>
        </CardFooter>
      </Card>

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
