import { CalendarDays, Clock3, GraduationCap } from 'lucide-react'
import { formatDate } from '@/shared/utils/format'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import type { TreinamentoSessaoFuturaRow } from '../types/eficiencia.types'

type Props = {
  sessoes: TreinamentoSessaoFuturaRow[]
  loading?: boolean
}

function formatHorasMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h <= 0) return `${m}min`
  return `${h}h ${String(m).padStart(2, '0')}min`
}

export function TreinamentosFuturosCards({ sessoes, loading }: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  if (sessoes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
        Nenhum treinamento previsto com data futura.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {sessoes.map((sessao) => {
        const ministradoLabel = sessao.ministrado_por
          ? resolvePessoaDisplayNome(sessao.ministrado_por, teamMembers, avatarCatalog)
          : null

        return (
          <article
            key={sessao.sp_id}
            className="overflow-hidden rounded-xl border border-sky-200/70 bg-gradient-to-br from-white to-sky-50/40 shadow-sm"
          >
            <div className="flex items-start gap-3 px-4 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                <GraduationCap className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{sessao.nome}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-medium text-sky-700">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {formatDate(sessao.data)}
                  </span>
                  {sessao.duracao_minutos != null && sessao.duracao_minutos > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      {formatHorasMinutos(sessao.duracao_minutos)}
                    </span>
                  ) : null}
                  {ministradoLabel ? (
                    <span>
                      Ministrado por:{' '}
                      <span className="font-medium text-slate-600">{ministradoLabel}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
