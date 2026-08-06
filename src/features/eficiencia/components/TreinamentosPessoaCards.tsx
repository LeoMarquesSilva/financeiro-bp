import { useMemo } from 'react'
import { Check, GraduationCap, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/shared/components/Avatar'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import type { TreinamentoItemRow, TreinamentosPorPessoaRow } from '../types/eficiencia.types'

const META_MINUTOS = 14 * 60

function formatHorasMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${h}h ${String(m).padStart(2, '0')}min`
}

function normalizeNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

type Props = {
  porPessoa: TreinamentosPorPessoaRow[]
  itens: TreinamentoItemRow[]
  loading?: boolean
}

export function TreinamentosPessoaCards({ porPessoa, itens, loading }: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  const itensPorPessoa = useMemo(() => {
    const map = new Map<string, TreinamentoItemRow[]>()
    for (const item of itens) {
      if (!item.colaborador) continue
      const key = normalizeNome(item.colaborador)
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [itens])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  if (porPessoa.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">Sem colaboradores no período.</p>
    )
  }

  const ordenados = [...porPessoa].sort((a, b) => b.minutos_lancados - a.minutos_lancados)

  return (
    <div className="space-y-3">
      {ordenados.map((p) => {
        const minutos = Number(p.minutos_lancados ?? 0)
        const atingiu = minutos >= META_MINUTOS
        const pct = Math.min(100, (minutos / META_MINUTOS) * 100)
        const avatarUrl = resolvePessoaAvatarUrl(p.colaborador, teamMembers, avatarCatalog)
        const lista = itensPorPessoa.get(normalizeNome(p.colaborador)) ?? []

        return (
          <article
            key={p.colaborador}
            className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm"
          >
            <div className="flex items-start gap-3 px-4 pb-3 pt-4">
              <Avatar
                src={avatarUrl}
                fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                fullName={p.colaborador}
                size="lg"
                className="h-12 w-12 text-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {p.colaborador}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatHorasMinutos(minutos)}
                      <span className="text-slate-300"> · </span>
                      {Math.round(minutos)} min
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      atingiu
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {atingiu ? <Check className="h-3 w-3" /> : <GraduationCap className="h-3 w-3" />}
                    {atingiu ? 'Meta' : `${Math.round(pct)}%`}
                  </span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      atingiu ? 'bg-emerald-500' : 'bg-rose-400',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>

            {lista.length > 0 ? (
              <ul className="border-t border-slate-100">
                {lista.map((item, idx) => (
                  <li
                    key={`${item.treinamento}-${item.data}-${idx}`}
                    className={cn(
                      'flex items-center justify-between gap-3 px-4 py-2 text-xs',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80',
                    )}
                  >
                    <span className="flex min-w-0 items-start gap-2 text-slate-700">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" aria-hidden />
                      <span className="truncate">{item.treinamento || 'Treinamento'}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {formatHorasMinutos(item.duracao_minutos)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-400">
                Sem lançamentos detalhados.
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}
