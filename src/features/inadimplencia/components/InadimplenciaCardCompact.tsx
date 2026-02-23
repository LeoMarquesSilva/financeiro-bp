import { formatCurrency } from '@/shared/utils/format'
import type { ClientInadimplenciaRow, InadimplenciaClasse } from '@/lib/database.types'
import { resolveTeamMember } from '@/lib/teamMembersService'
import { getTeamMember } from '@/lib/teamAvatars'
import { getPrioridade } from '../services/prioridade'
import type { PrioridadeTipo } from '../types/inadimplencia.types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { ChevronRight } from 'lucide-react'

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

interface InadimplenciaCardCompactProps {
  client: ClientInadimplenciaRow
  onMarcarResolvido: (id: string) => void
  onRefresh?: () => void
  onSelectClient?: (client: ClientInadimplenciaRow) => void
}

export function InadimplenciaCardCompact({
  client,
  onMarcarResolvido,
  onRefresh,
  onSelectClient,
}: InadimplenciaCardCompactProps) {
  const { teamMembers } = useTeamMembers()

  const prioridade: PrioridadeTipo = getPrioridade(client.dias_em_aberto, Number(client.valor_em_aberto))
  const gestorMember = resolveTeamMember(client.gestor ?? null, teamMembers)
  const gestorAvatarUrl = gestorMember
    ? getTeamMember(gestorMember.email)?.avatar ?? gestorMember.avatar_url
    : null

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelectClient?.(client)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelectClient?.(client)
        }
      }}
      className="min-w-0 cursor-pointer shadow-lg transition-shadow duration-200 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
    >
        <div className="flex flex-col p-5 space-y-0 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold leading-tight tracking-tight text-slate-900">{client.razao_social}</h3>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant={BADGE_VARIANT_CLASSE[client.status_classe]} className="rounded-full">
                Classe {client.status_classe}
              </Badge>
              <Badge variant={BADGE_VARIANT_PRIORIDADE[prioridade]} className="rounded-full">
                {PRIORIDADE_LABEL[prioridade]}
              </Badge>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 space-y-4">
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Valor em aberto</p>
                <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                  {formatCurrency(Number(client.valor_em_aberto))}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Dias em atraso</p>
                <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{client.dias_em_aberto}</p>
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
                          <AvatarImage src={gestorAvatarUrl} alt={gestorMember.full_name} />
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
        </div>
    </Card>
  )
}
