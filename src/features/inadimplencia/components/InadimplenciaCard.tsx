import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency, formatCnpj, formatDate } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import type { ClientInadimplenciaRow, InadimplenciaClasse, ClienteEscritorioRow, ProvidenciaFollowUpRow } from '@/lib/database.types'
import { resolveTeamMember } from '@/lib/teamMembersService'
import { getTeamMember } from '@/lib/teamAvatars'
import { usePrioridadeConfig } from '@/features/configuracoes/hooks/usePrioridadeConfig'
import type { PrioridadeTipo } from '../types/inadimplencia.types'
import { ModalEditarCliente } from './ModalEditarCliente'
import { ModalNovaProvidencia } from './ModalNovaProvidencia'
import { ModalNovoFollowUp } from './ModalNovoFollowUp'
import { providenciaService, PROVIDENCIA_FOLLOW_UP_TIPO_LABEL } from '../services/providenciaService'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Pencil, Check, AlertTriangle, MessageSquare, FileText, Calendar, RotateCcw } from 'lucide-react'
import { fetchClientesEscritorio } from '@/features/escritorio/services/escritorioService'

interface InadimplenciaCardProps {
  client: ClientInadimplenciaRow
  onMarcarResolvido: (id: string) => void
  onReabrir?: (id: string) => void
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

const VALOR_COLOR: Record<PrioridadeTipo, string> = {
  urgente: 'text-red-700',
  atencao: 'text-amber-700',
  controlado: 'text-slate-900',
}

function getIniciais(name: string | null | undefined): string {
  if (!name || !name.trim()) return '–'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function InadimplenciaCard({ client, onMarcarResolvido, onReabrir, onRefresh, onSelectClient }: InadimplenciaCardProps) {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'
  const { teamMembers } = useTeamMembers()
  const { getPrioridade } = usePrioridadeConfig()
  const [modalEditar, setModalEditar] = useState(false)
  const [modalProvidencia, setModalProvidencia] = useState(false)
  const [modalFollowUp, setModalFollowUp] = useState(false)

  const { data: clientesEscritorio = [] } = useQuery({
    queryKey: ['clientes-escritorio'],
    queryFn: fetchClientesEscritorio,
  })
  const linkedEscritorio = client.pessoa_id
    ? clientesEscritorio.find((ce: ClienteEscritorioRow) => ce.id === client.pessoa_id)
    : null
  const grupoCliente = linkedEscritorio?.grupo_cliente ?? null

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

  const prioridade: PrioridadeTipo = getPrioridade(client.dias_em_aberto, Number(client.valor_em_aberto))
  const followUpVencido = client.data_follow_up && new Date(client.data_follow_up) < new Date()
  const gestorEmails: string[] = Array.isArray(client.gestor) ? client.gestor : client.gestor ? [client.gestor] : []
  const gestorMembers = gestorEmails
    .map((g) => resolveTeamMember(g, teamMembers))
    .filter((m): m is NonNullable<typeof m> => m !== null)
  const cnpjExibir = (linkedEscritorio?.cnpj ?? client.cnpj) || null
  const areasList: string[] = Array.isArray(client.area) ? client.area : client.area ? [client.area] : []

  const closeAndRefresh = () => {
    setModalEditar(false)
    setModalProvidencia(false)
    setModalFollowUp(false)
    onRefresh?.()
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Card
        className={cn(
          'group relative flex h-full flex-col overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all duration-200 hover:shadow-md',
          client.resolvido_at ? 'opacity-75 border-l-[3px] border-l-emerald-400' : followUpVencido && 'border-l-[3px] border-l-red-400',
        )}
      >
        {/* Clickable area */}
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
          className={cn('flex-1', onSelectClient && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset rounded-t-xl')}
        >
          {/* Header */}
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-tight text-slate-900 line-clamp-2">
                  {grupoCliente || client.razao_social}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                  {areasList.length > 0 && areasList.map((a) => (
                    <Badge key={a} variant="outline" className="rounded-full px-1.5 py-0 text-[10px] font-normal">
                      {a}
                    </Badge>
                  ))}
                  {cnpjExibir && <span>{formatCnpj(cnpjExibir)}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {client.resolvido_at && (
                  <Badge className="rounded-full bg-emerald-100 text-emerald-700 text-[11px]">
                    <Check className="mr-0.5 h-3 w-3" /> Resolvido
                  </Badge>
                )}
                <Badge variant={BADGE_VARIANT_CLASSE[client.status_classe]} className="rounded-full text-[11px]">
                  Classe {client.status_classe}
                </Badge>
                {!client.resolvido_at && (
                  <Badge variant={BADGE_VARIANT_PRIORIDADE[prioridade]} className="rounded-full text-[11px]">
                    {PRIORIDADE_LABEL[prioridade]}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pb-3 pt-0">
            {/* Hero metrics */}
            <div className="flex items-baseline gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Valor em aberto</p>
                <p className={cn('mt-0.5 text-xl font-bold tabular-nums leading-tight', VALOR_COLOR[prioridade])}>
                  {formatCurrency(Number(client.valor_em_aberto))}
                </p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Dias em atraso</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums leading-tight text-slate-900">
                  {client.dias_em_aberto}
                </p>
              </div>
            </div>

            {/* Secondary metrics row */}
            <div className="flex items-center gap-3 text-sm">
              {client.valor_mensal != null && (
                <span className="text-slate-500">
                  <span className="text-xs text-slate-400">Mensal</span>{' '}
                  <span className="font-medium tabular-nums text-slate-700">{formatCurrency(Number(client.valor_mensal))}</span>
                </span>
              )}
              {gestorMembers.length > 0 && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="flex -space-x-1.5">
                    {gestorMembers.map((gm) => {
                      const avatarUrl = getTeamMember(gm.email)?.avatar ?? gm.avatar_url
                      return (
                        <Avatar key={gm.email} className="h-5 w-5 border border-white">
                          {avatarUrl && <AvatarImage src={avatarUrl} alt={gm.full_name} />}
                          <AvatarFallback className="text-[9px] bg-slate-200 text-slate-600">
                            {getIniciais(gm.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      )
                    })}
                  </div>
                  <span className="truncate text-xs font-medium text-slate-600">
                    {gestorMembers.length === 1
                      ? gestorMembers[0].full_name
                      : `${gestorMembers.length} gestores`}
                  </span>
                </div>
              )}
            </div>

            {/* Status zone: latest providencia or follow-up */}
            {(ultimaProvidencia || client.ultima_providencia || followUpVencido) && (
              <div className={cn(
                'rounded-lg px-3 py-2 text-xs',
                followUpVencido ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100',
              )}>
                {followUpVencido && (
                  <div className="mb-1 flex items-center gap-1 text-red-600 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    Follow-up vencido
                    {client.data_follow_up && (
                      <span className="ml-auto text-red-500">{formatDate(client.data_follow_up)}</span>
                    )}
                  </div>
                )}
                {(ultimaProvidencia || client.ultima_providencia) && (
                  <div className="flex items-start gap-1.5">
                    <FileText className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                    <p className="line-clamp-2 text-slate-600">
                      {ultimaProvidencia ? ultimaProvidencia.texto : client.ultima_providencia}
                    </p>
                  </div>
                )}
                {followUpsUltima.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-slate-500">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {PROVIDENCIA_FOLLOW_UP_TIPO_LABEL[(followUpsUltima[0] as ProvidenciaFollowUpRow).tipo]}:{' '}
                      {(followUpsUltima[0] as ProvidenciaFollowUpRow).texto || '–'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </div>

        {/* Footer: icon-only actions + Resolver CTA */}
        <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2">
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setModalProvidencia(true) }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  aria-label="Nova providência"
                >
                  <FileText className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Providência</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setModalFollowUp(true) }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-500 transition-colors hover:bg-violet-50 hover:text-violet-700"
                  aria-label="Novo follow-up"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Follow-up</TooltipContent>
            </Tooltip>
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setModalEditar(true) }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-700"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Editar</TooltipContent>
              </Tooltip>
            )}
          </div>
          {canEdit && !client.resolvido_at && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarcarResolvido(client.id) }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 hover:shadow"
            >
              <Check className="h-3.5 w-3.5" />
              Resolver
            </button>
          )}
          {canEdit && client.resolvido_at && onReabrir && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReabrir(client.id) }}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reabrir
            </button>
          )}
        </CardFooter>
      </Card>

      <ModalEditarCliente
        open={modalEditar}
        onClose={() => setModalEditar(false)}
        client={client}
        onSuccess={closeAndRefresh}
      />
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
    </TooltipProvider>
  )
}
