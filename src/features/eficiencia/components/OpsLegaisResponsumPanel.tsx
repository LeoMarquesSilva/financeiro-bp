import {
  CheckCircle2,
  Clock3,
  Star,
  ThumbsUp,
  Ticket,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/shared/components/Avatar'
import { formatPercent } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { OpsLegaisResponsumAvaliacoes, OpsLegaisResponsumPendentes } from './OpsLegaisResponsumDetalhes'
import type { OpsLegaisResponsumDashboard } from '../types/eficiencia.types'

type Props = {
  data: OpsLegaisResponsumDashboard | null
  loading?: boolean
  error?: Error | null
  /** Listas Concluídos / Pendentes (default true). Desligar na Apresentação. */
  showListas?: boolean
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function zonaStyles(zona: string): { text: string; bg: string } {
  if (zona.includes('Excelência')) return { text: 'text-emerald-700', bg: 'bg-emerald-50' }
  if (zona.includes('Qualidade')) return { text: 'text-blue-700', bg: 'bg-blue-50' }
  if (zona.includes('Aperfeiçoamento')) return { text: 'text-amber-700', bg: 'bg-amber-50' }
  return { text: 'text-red-700', bg: 'bg-red-50' }
}

function gaugeColor(media: number): string {
  if (media >= 9) return '#F97316'
  if (media >= 7) return '#22C55E'
  if (media >= 5) return '#EAB308'
  return '#EF4444'
}

export function OpsLegaisResponsumPanel({
  data,
  loading,
  error,
  showListas = true,
}: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
  }

  if (error) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        Não foi possível carregar o Responsum: {error.message}
      </p>
    )
  }

  if (!data) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">Sem dados Responsum no período.</p>
    )
  }

  const { tickets, nps, concluidos, pendentes } = data
  const zona = zonaStyles(nps.zona)
  const totalNps = Math.max(1, nps.total_avaliacoes)
  const dashOffset = 125.6 * (1 - Math.min(10, Math.max(0, nps.media_score)) / 10)
  const resolvePersonName = (name: string) => resolvePessoaDisplayNome(name, teamMembers, avatarCatalog)
  const renderPerson = (name: string) => {
    const displayName = resolvePersonName(name)
    return (
      <span className="inline-flex min-w-0 items-center gap-2.5 font-medium text-slate-700">
        <Avatar src={resolvePessoaAvatarUrl(name, teamMembers, avatarCatalog)} fullName={displayName} size="md" className="h-8 w-8 shrink-0" />
        <span className="min-w-0 break-words text-sm xl:text-base">{displayName}</span>
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total de Tickets',
            value: formatInt(tickets.total),
            icon: Ticket,
            iconBg: 'bg-slate-100 text-slate-600',
          },
          {
            label: 'Em Atendimento',
            value: formatInt(tickets.em_atendimento),
            icon: Clock3,
            iconBg: 'bg-orange-50 text-orange-600',
          },
          {
            label: 'Resolvidos',
            value: formatInt(tickets.resolvidos),
            icon: CheckCircle2,
            iconBg: 'bg-emerald-50 text-emerald-600',
          },
          {
            label: 'Taxa de Resolução',
            value: formatPercent(tickets.taxa_resolucao),
            icon: TrendingUp,
            iconBg: 'bg-blue-50 text-blue-600',
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">{c.label}</span>
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', c.iconBg)}>
                <c.icon className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start gap-2">
            <Star className="mt-0.5 h-4 w-4 text-amber-500" aria-hidden />
            <div style={{ minWidth: 0 }}>
              <h3
                className="text-sm font-semibold text-slate-900"
                style={
                  showListas
                    ? undefined
                    : { fontSize: 11, lineHeight: 1.1, whiteSpace: 'nowrap' }
                }
              >
                Net Promoter Score (NPS)
              </h3>
              <p
                className="text-[11px] text-slate-400"
                style={
                  showListas
                    ? undefined
                    : { fontSize: 9, lineHeight: 1.1, whiteSpace: 'nowrap' }
                }
              >
                Avaliação do atendimento (1–10)
              </p>
            </div>
          </div>
          <div className="mb-4 text-center">
            <div className="text-4xl font-extrabold tabular-nums text-slate-900">{nps.nps}</div>
            <span
              className={cn(
                'mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                zona.bg,
                zona.text,
              )}
            >
              {nps.zona}
            </span>
          </div>
          {(
            [
              ['Promotores (9–10)', nps.promotores, 'bg-emerald-500', 'text-emerald-700'],
              ['Neutros (7–8)', nps.neutros, 'bg-blue-500', 'text-blue-700'],
              ['Detratores (0–6)', nps.detratores, 'bg-red-500', 'text-red-700'],
            ] as const
          ).map(([label, qtd, bar, text]) => (
            <div key={label} className="mb-2">
              <div className="mb-1 flex justify-between text-[11px]">
                <span
                  className={cn('font-semibold', text)}
                  style={
                    showListas
                      ? undefined
                      : { fontSize: 9, lineHeight: 1.1, whiteSpace: 'nowrap' }
                  }
                >
                  {label}
                </span>
                <span className="font-bold tabular-nums text-slate-600">
                  {qtd > 0 ? formatInt(qtd) : ''}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                {qtd > 0 && (
                  <div
                    className={cn('h-full rounded-full', bar)}
                    style={{ width: `${(qtd / totalNps) * 100}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-slate-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">Qualidade do Atendimento</h3>
          </div>
          <div className="mb-4 flex justify-center">
            <div className="relative h-[55px] w-[90px]">
              <svg viewBox="0 0 100 60" width="90" height="55">
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={gaugeColor(nps.media_score)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="125.6"
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[20%] text-center">
                <div className="text-lg font-extrabold tabular-nums text-slate-900">
                  {nps.media_score.toLocaleString('pt-BR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </div>
                <div className="text-[9px] text-slate-400">de 10</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['Excelente', nps.excelente, 'bg-emerald-50 text-emerald-700'],
                ['Bom', nps.bom, 'bg-blue-50 text-blue-700'],
                ['Regular', nps.regular, 'bg-yellow-50 text-yellow-700'],
                ['Ruim', nps.ruim, 'bg-red-50 text-red-700'],
              ] as const
            ).map(([label, qtd, cls]) => (
              <div key={label} className={cn('rounded-lg p-2 text-center', cls)}>
                <div className="text-lg font-bold tabular-nums">{formatInt(qtd)}</div>
                <div className="text-[10px] font-medium">{label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <OpsLegaisResponsumAvaliacoes key={`${data.periodo.inicio}-${data.periodo.fim}-${data.atualizado_em ?? ""}`} items={data.avaliacoes_atencao} compact={!showListas} renderPerson={renderPerson} />

      {showListas ? (
      <div className="space-y-4">
        <OpsLegaisResponsumPendentes groups={pendentes} updatedAt={data.atualizado_em} renderPerson={renderPerson} resolvePersonName={resolvePersonName} />
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Concluídos no período</h3>
              <p className="text-[11px] text-slate-400">Tickets resolvidos no filtro de data</p>
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
            {concluidos.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">Nenhum resolvido no período.</p>
            )}
            {concluidos.map((c) => {
              const nome = c.is_sla_fatal
                ? c.nome
                : resolvePessoaDisplayNome(c.nome, teamMembers, avatarCatalog)
              const avatar = c.is_sla_fatal
                ? null
                : resolvePessoaAvatarUrl(c.nome, teamMembers, avatarCatalog)
              return (
                <div
                  key={`${c.nome}-${c.is_sla_fatal}`}
                  className="flex items-center gap-2.5 border-b border-slate-50 py-2 last:border-0"
                >
                  {c.is_sla_fatal ? (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-lg">
                      🚨
                    </div>
                  ) : (
                    <Avatar src={avatar} fullName={nome} size="md" className="h-11 w-11" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                    {nome}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-bold tabular-nums text-emerald-700">
                    {formatInt(c.qtd)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

      </div>
      ) : null}
    </div>
  )
}
