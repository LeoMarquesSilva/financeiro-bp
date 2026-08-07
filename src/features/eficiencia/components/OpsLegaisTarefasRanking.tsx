import { useMemo } from 'react'
import { CalendarCheck2, Newspaper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/shared/components/Avatar'
import { formatPercent } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import type { OpsLegaisTarefasRankingRow } from '../types/eficiencia.types'

type Props = {
  rows: OpsLegaisTarefasRankingRow[]
  loading?: boolean
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

const RANK_RING: Record<number, string> = {
  1: 'ring-2 ring-amber-400',
  2: 'ring-2 ring-slate-300',
  3: 'ring-2 ring-orange-400',
}

const RANK_BADGE: Record<number, string> = {
  1: 'bg-amber-100 text-amber-900 border-amber-300',
  2: 'bg-slate-100 text-slate-700 border-slate-300',
  3: 'bg-orange-100 text-orange-900 border-orange-300',
}

export function OpsLegaisTarefasRanking({ rows, loading }: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  const top5 = useMemo(
    () =>
      [...rows]
        .filter((r) => r.rank_atividades <= 5)
        .sort((a, b) => a.rank_atividades - b.rank_atividades || b.total_atividades - a.total_atividades)
        .slice(0, 5),
    [rows],
  )

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  if (top5.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">Sem atividades no período.</p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {top5.map((r) => {
          const nome = resolvePessoaDisplayNome(r.pessoa, teamMembers, avatarCatalog)
          const avatar = resolvePessoaAvatarUrl(r.pessoa, teamMembers, avatarCatalog)
          const rank = r.rank_atividades
          const top = rank <= 3
          return (
            <article
              key={r.pessoa}
              className={cn(
                'flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm',
                top ? 'border-slate-300' : 'border-slate-200/70',
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  src={avatar}
                  fallbackSrc={avatar?.replace(/\.jpg$/i, '.png')}
                  fullName={nome}
                  size="lg"
                  className={cn('h-14 w-14 text-sm', RANK_RING[rank])}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      RANK_BADGE[rank] ?? 'border-slate-200 bg-slate-50 text-slate-600',
                    )}
                  >
                    {top ? `TOP ${rank}` : `#${rank}`}
                  </span>
                  <h3 className="mt-1 truncate text-sm font-semibold text-slate-900" title={nome}>
                    {nome}
                  </h3>
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl font-extrabold tabular-nums text-slate-900">
                  {formatInt(r.total_atividades)}
                </div>
                <div className="text-[11px] font-medium text-slate-500">Total de atividades</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                    <Newspaper className="h-3 w-3" aria-hidden />
                    Central Pub.
                  </div>
                  <div className="text-sm font-bold tabular-nums text-slate-800">
                    {formatInt(r.central_pub)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                    <CalendarCheck2 className="h-3 w-3" aria-hidden />
                    Central Agend.
                  </div>
                  <div className="text-sm font-bold tabular-nums text-slate-800">
                    {formatInt(r.central_agend)}
                  </div>
                </div>
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-2 text-xs">
                <div className="flex justify-between text-red-600">
                  <span>Desvio Pub.</span>
                  <span className="font-semibold tabular-nums">{formatInt(r.desvio_pub)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Desvio Agend.</span>
                  <span className="font-semibold tabular-nums">{formatInt(r.desvio_agend)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Total incons.</span>
                  <span className="tabular-nums">
                    {formatInt(r.total_erros)} ({formatPercent(r.pct_erros)})
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
