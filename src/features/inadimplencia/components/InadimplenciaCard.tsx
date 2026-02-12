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
import { ModalRegistrarAcao } from './ModalRegistrarAcao'
import { ModalRegistrarPagamento } from './ModalRegistrarPagamento'
import { ModalEditarCliente } from './ModalEditarCliente'
import { ModalHistorico } from './ModalHistorico'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Pencil, Banknote, History, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

const ULTIMOS_LOGS = 3
function getTipoLabel(tipo: string) {
  return TIPOS_ACAO.find((t) => t.value === tipo)?.label ?? tipo
}

interface InadimplenciaCardProps {
  client: ClientInadimplenciaRow
  onMarcarResolvido: (id: string) => void
  onRefresh?: () => void
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

export function InadimplenciaCard({ client, onMarcarResolvido, onRefresh }: InadimplenciaCardProps) {
  const { teamMembers } = useTeamMembers()
  const [modalAcao, setModalAcao] = useState(false)
  const [modalPagamento, setModalPagamento] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
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

  const prioridade: PrioridadeTipo = getPrioridade(client.dias_em_aberto, Number(client.valor_em_aberto))
  const followUpVencido =
    client.data_follow_up && new Date(client.data_follow_up) < new Date()
  const gestorMember = resolveTeamMember(client.gestor ?? null, teamMembers)

  const closeAndRefresh = () => {
    setModalAcao(false)
    setModalPagamento(false)
    setModalEditar(false)
    setModalHistorico(false)
    onRefresh?.()
  }

  const subinfo = [client.area, client.cnpj ? formatCnpj(client.cnpj) : null].filter(Boolean).join(' · ') || null
  const gestorAvatarUrl = gestorMember
    ? getTeamMember(gestorMember.email)?.avatar ?? gestorMember.avatar_url
    : null

  return (
    <>
      <Card>
        <CardHeader className="space-y-0 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900">
                {client.razao_social}
              </h3>
              {subinfo && (
                <p className="mt-0.5 text-sm text-slate-500">{subinfo}</p>
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

        <CardContent className="space-y-5 pt-0">
          {/* Grid de métricas */}
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 shadow-sm">
              <p className="text-xs text-slate-500">Valor em aberto</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(Number(client.valor_em_aberto))}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 shadow-sm">
              <p className="text-xs text-slate-500">Dias em atraso</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{client.dias_em_aberto}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 shadow-sm">
              <p className="text-xs text-slate-500">Valor mensal</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {client.valor_mensal != null ? formatCurrency(Number(client.valor_mensal)) : '–'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 shadow-sm">
              <p className="text-xs text-slate-500">Gestor responsável</p>
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
          </section>

          {/* Processos e horas (timesheet) – expansível */}
          {(client.qtd_processos != null ||
            client.horas_total != null ||
            (client.horas_por_ano && Object.keys(client.horas_por_ano).length > 0)) && (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 shadow-sm">
              <button
                type="button"
                onClick={() => setProcessosHorasAberto((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-xs font-medium text-slate-600">Processos e horas (timesheet)</span>
                {!processosHorasAberto && (
                  <span className="truncate text-xs text-slate-500">
                    {client.qtd_processos != null && client.qtd_processos}
                    {client.qtd_processos != null && client.horas_total != null && ' · '}
                    {client.horas_total != null && formatHorasDuracao(Number(client.horas_total))}
                  </span>
                )}
                {processosHorasAberto ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                )}
              </button>
              {processosHorasAberto && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                          {client.qtd_processos != null ? client.qtd_processos : '–'}
                        </td>
                        <td className="px-3 py-1.5 text-slate-900">
                          {client.horas_total != null
                            ? formatHorasDuracao(Number(client.horas_total))
                            : '–'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {client.horas_por_ano && Object.keys(client.horas_por_ano).length > 0 && (
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
                          {Object.entries(client.horas_por_ano)
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
                </div>
              )}
            </section>
          )}

          {/* Providência + Follow-up */}
          <section className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 shadow-sm">
            {client.ultima_providencia && (
              <div className="mb-4 last:mb-0">
                <p className="text-xs font-medium text-slate-500">Providência</p>
                <p className="mt-1 text-sm text-slate-700">{client.ultima_providencia}</p>
                <p className="mt-0.5 text-xs text-slate-400">{formatDate(client.data_providencia)}</p>
              </div>
            )}
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
              {client.follow_up ? (
                <>
                  <p className="mt-1 text-sm text-slate-700">{client.follow_up}</p>
                  <p
                    className={cn(
                      'mt-0.5 text-xs',
                      followUpVencido ? 'font-medium text-red-600' : 'text-slate-400'
                    )}
                  >
                    {formatDate(client.data_follow_up)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Nenhum agendado</p>
              )}
            </div>
          </section>

          {/* Mini-timeline últimas ações */}
          <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-600">Últimas ações</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalHistorico(true)}
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
                    className="flex items-start gap-2 rounded border border-slate-200/60 bg-white px-2 py-1.5 text-xs"
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

        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalAcao(true)}
              title="Registrar ação"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Ação
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalEditar(true)}
              title="Editar"
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalPagamento(true)}
              title="Registrar pagamento"
              className="gap-1.5"
            >
              <Banknote className="h-4 w-4" />
              Pagamento
            </Button>
          </div>
          <Button
            variant="success"
            size="sm"
            onClick={() => onMarcarResolvido(client.id)}
            className="rounded-full gap-1.5"
          >
            <Check className="h-4 w-4" />
            Resolver
          </Button>
        </CardFooter>
      </Card>

      <ModalRegistrarAcao
        open={modalAcao}
        onClose={() => setModalAcao(false)}
        clientId={client.id}
        onSuccess={closeAndRefresh}
      />
      <ModalRegistrarPagamento
        open={modalPagamento}
        onClose={() => setModalPagamento(false)}
        clientId={client.id}
        onSuccess={closeAndRefresh}
      />
      <ModalEditarCliente
        open={modalEditar}
        onClose={() => setModalEditar(false)}
        client={client}
        onSuccess={closeAndRefresh}
      />
      <ModalHistorico open={modalHistorico} onClose={() => setModalHistorico(false)} clientId={client.id} />
    </>
  )
}
