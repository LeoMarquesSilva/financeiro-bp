import { useMemo, useState } from 'react'
import { Check, ChevronDown, GraduationCap, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import type { TreinamentoItemRow, TreinamentosPorPessoaRow } from '../types/eficiencia.types'
import { EFICIENCIA_META_TREINAMENTO_MINUTOS } from '../constants'

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

type Accent = 'default' | 'violet' | 'amber' | 'indigo'

type Props = {
  porPessoa: TreinamentosPorPessoaRow[]
  itens: TreinamentoItemRow[]
  loading?: boolean
  /** null = sem meta (barra 100% decorativa). Default 14h. */
  metaMinutos?: number | null
  badgeLabel?: string
  accentClass?: Accent
}

const ACCENT: Record<
  Accent,
  { barOk: string; barNok: string; badgeOk: string; badgeNok: string }
> = {
  default: {
    barOk: 'bg-emerald-500',
    barNok: 'bg-rose-400',
    badgeOk: 'bg-emerald-100 text-emerald-700',
    badgeNok: 'bg-slate-100 text-slate-600',
  },
  violet: {
    barOk: 'bg-emerald-500',
    barNok: 'bg-violet-400',
    badgeOk: 'bg-emerald-100 text-emerald-700',
    badgeNok: 'bg-violet-100 text-violet-700',
  },
  amber: {
    barOk: 'bg-amber-500',
    barNok: 'bg-amber-400',
    badgeOk: 'bg-amber-100 text-amber-700',
    badgeNok: 'bg-amber-100 text-amber-700',
  },
  indigo: {
    barOk: 'bg-indigo-500',
    barNok: 'bg-indigo-400',
    badgeOk: 'bg-indigo-100 text-indigo-700',
    badgeNok: 'bg-indigo-100 text-indigo-700',
  },
}

export function TreinamentosPessoaCards({
  porPessoa,
  itens,
  loading,
  metaMinutos = EFICIENCIA_META_TREINAMENTO_MINUTOS,
  badgeLabel,
  accentClass = 'default',
}: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())
  const accent = ACCENT[accentClass]

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

  function toggle(colaborador: string) {
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(colaborador)) next.delete(colaborador)
      else next.add(colaborador)
      return next
    })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
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
        const metaPessoa =
          p.meta_minutos != null && Number.isFinite(Number(p.meta_minutos))
            ? Number(p.meta_minutos)
            : metaMinutos
        const semMetaPessoa = metaPessoa == null
        const minutos = Number(p.minutos_lancados ?? 0)
        const atingiu = !semMetaPessoa && minutos >= (metaPessoa ?? 0)
        const pct = semMetaPessoa
          ? 100
          : Math.min(100, (minutos / (metaPessoa || 1)) * 100)
        const nomeExibicao = resolvePessoaDisplayNome(
          p.colaborador,
          teamMembers,
          avatarCatalog,
        )
        const avatarUrl = resolvePessoaAvatarUrl(p.colaborador, teamMembers, avatarCatalog)
        const lista = itensPorPessoa.get(normalizeNome(p.colaborador)) ?? []
        const aberto = abertos.has(p.colaborador)

        return (
          <article
            key={p.colaborador}
            className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggle(p.colaborador)}
              aria-expanded={aberto}
              className="flex w-full items-start gap-3 px-4 pb-3 pt-4 text-left transition-colors hover:bg-slate-50/80"
            >
              <Avatar
                src={avatarUrl}
                fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                fullName={nomeExibicao}
                size="lg"
                className="h-14 w-14 text-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {nomeExibicao}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatHorasMinutos(minutos)}
                      <span className="text-slate-300"> · </span>
                      {Math.round(minutos)} min
                      {lista.length > 0 ? (
                        <>
                          <span className="text-slate-300"> · </span>
                          {lista.length} {lista.length === 1 ? 'lançamento' : 'lançamentos'}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        atingiu || badgeLabel ? accent.badgeOk : accent.badgeNok,
                        !atingiu && !badgeLabel && accent.badgeNok,
                      )}
                    >
                      {badgeLabel ? (
                        badgeLabel
                      ) : atingiu ? (
                        <>
                          <Check className="h-3 w-3" />
                          Meta
                        </>
                      ) : (
                        <>
                          <GraduationCap className="h-3 w-3" />
                          {`${Math.round(pct)}%`}
                        </>
                      )}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-slate-400 transition-transform',
                        aberto && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </div>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      atingiu || semMetaPessoa ? accent.barOk : accent.barNok,
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>

            {aberto ? (
              lista.length > 0 ? (
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
                        <span className="min-w-0">
                          <span className="block truncate">
                            {item.treinamento || 'Treinamento'}
                          </span>
                          <span className="mt-0.5 block tabular-nums text-[11px] text-slate-400">
                            {item.data ? formatDate(item.data) : '—'}
                          </span>
                        </span>
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
              )
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
