import { useMemo, useState } from 'react'
import { Check, ChevronDown, GraduationCap, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate, formatPercent } from '@/shared/utils/format'
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

type PessoaCardItemProps = {
  cardId: string
  pessoa: TreinamentosPorPessoaRow
  lista: TreinamentoItemRow[]
  aberto: boolean
  onToggle: (cardId: string) => void
  metaMinutos: number | null | undefined
  badgeLabel?: string
  accent: (typeof ACCENT)[Accent]
  teamMembers: ReturnType<typeof useTeamMembers>['teamMembers']
  avatarCatalog: ReturnType<typeof useBpUsuariosAvatar>['usuarios']
}

function TreinamentoPessoaCardItem({
  cardId,
  pessoa,
  lista,
  aberto,
  onToggle,
  metaMinutos,
  badgeLabel,
  accent,
  teamMembers,
  avatarCatalog,
}: PessoaCardItemProps) {
  const metaPessoa =
    pessoa.meta_minutos != null && Number.isFinite(Number(pessoa.meta_minutos))
      ? Number(pessoa.meta_minutos)
      : metaMinutos
  const semMetaPessoa = metaPessoa == null
  const minutos = Number(pessoa.minutos_lancados ?? 0)
  const atingiu = !semMetaPessoa && minutos >= (metaPessoa ?? 0)
  const faltamMinutos = semMetaPessoa ? 0 : Math.max(0, (metaPessoa ?? 0) - minutos)
  const pct = semMetaPessoa ? 100 : Math.min(100, (minutos / (metaPessoa || 1)) * 100)
  const nomeExibicao = resolvePessoaDisplayNome(pessoa.colaborador, teamMembers, avatarCatalog)
  const avatarUrl = resolvePessoaAvatarUrl(pessoa.colaborador, teamMembers, avatarCatalog)
  const temDuplicado = lista.some((item) => item.duplicado)

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(cardId)}
        aria-expanded={aberto}
        aria-controls={`treinamento-pessoa-${cardId}`}
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
              <h3 className="truncate text-sm font-semibold leading-5 text-slate-900">
                {nomeExibicao}
              </h3>
              <p className="mt-0.5 block text-xs leading-4 text-slate-500">
                {semMetaPessoa ? (
                  formatHorasMinutos(minutos)
                ) : atingiu ? (
                  'Meta atingida'
                ) : (
                  <>Faltam {formatHorasMinutos(faltamMinutos)} para a meta</>
                )}
                {!semMetaPessoa ? (
                  <>
                    <span className="text-slate-300"> · </span>
                    Meta {formatHorasMinutos(metaPessoa ?? 0)}
                  </>
                ) : null}
                {temDuplicado ? (
                  <span className="font-medium text-red-600"> · conferir duplicado</span>
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
                    {formatPercent(pct)}
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
        <div id={`treinamento-pessoa-${cardId}`}>
          {lista.length > 0 ? (
            <ul className="border-t border-slate-100">
              {lista.map((item, idx) => (
                <li
                  key={`${item.treinamento}-${item.data}-${idx}`}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-2 text-xs',
                    item.duplicado
                      ? 'bg-red-50'
                      : idx % 2 === 0
                        ? 'bg-white'
                        : 'bg-slate-50/80',
                  )}
                  title={
                    item.duplicado
                      ? 'Lançamento duplicado — mesma pessoa, treinamento e data. Conferir na origem.'
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      'flex min-w-0 items-start gap-2',
                      item.duplicado ? 'text-red-700' : 'text-slate-700',
                    )}
                  >
                    <MapPin
                      className={cn(
                        'mt-0.5 h-3 w-3 shrink-0',
                        item.duplicado ? 'text-red-600' : 'text-rose-500',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            'block truncate',
                            item.duplicado && 'font-semibold text-red-700',
                          )}
                        >
                          {item.treinamento || 'Treinamento'}
                        </span>
                        {item.duplicado ? (
                          <Badge
                            variant="destructive"
                            className="shrink-0 px-1.5 py-0 text-[10px]"
                          >
                            Duplicado
                          </Badge>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block tabular-nums text-[11px]',
                          item.duplicado ? 'text-red-500' : 'text-slate-400',
                        )}
                      >
                        {item.data ? formatDate(item.data) : '—'}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      item.duplicado ? 'font-medium text-red-700' : 'text-slate-500',
                    )}
                  >
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
        </div>
      ) : null}
    </article>
  )
}

function splitEmColunas<T>(items: T[]): [T[], T[]] {
  const esquerda: T[] = []
  const direita: T[] = []
  items.forEach((item, index) => {
    if (index % 2 === 0) esquerda.push(item)
    else direita.push(item)
  })
  return [esquerda, direita]
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
  const [abertoId, setAbertoId] = useState<string | null>(null)
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

  function toggle(cardId: string) {
    setAbertoId((prev) => (prev === cardId ? null : cardId))
  }

  const ordenados = useMemo(
    () =>
      [...porPessoa].sort(
        (a, b) =>
          b.minutos_lancados - a.minutos_lancados ||
          a.colaborador.localeCompare(b.colaborador, 'pt-BR', { sensitivity: 'base' }),
      ),
    [porPessoa],
  )

  const cards = useMemo(
    () =>
      ordenados.map((pessoa, index) => ({
        pessoa,
        index,
        cardId: `${normalizeNome(pessoa.colaborador) || pessoa.colaborador}-${index}`,
        lista: itensPorPessoa.get(normalizeNome(pessoa.colaborador)) ?? [],
      })),
    [itensPorPessoa, ordenados],
  )

  const [colunaEsquerda, colunaDireita] = useMemo(() => splitEmColunas(cards), [cards])

  function renderCard(entry: (typeof cards)[number]) {
    return (
      <TreinamentoPessoaCardItem
        key={entry.cardId}
        cardId={entry.cardId}
        pessoa={entry.pessoa}
        lista={entry.lista}
        aberto={abertoId === entry.cardId}
        onToggle={toggle}
        metaMinutos={metaMinutos}
        badgeLabel={badgeLabel}
        accent={accent}
        teamMembers={teamMembers}
        avatarCatalog={avatarCatalog}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="hidden min-w-0 flex-1 flex-col gap-3 lg:flex">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  if (porPessoa.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">Sem colaboradores no período.</p>
    )
  }

  const qtdDuplicados = itens.filter((item) => item.duplicado).length

  return (
    <div className="space-y-3">
      {qtdDuplicados > 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {qtdDuplicados} {qtdDuplicados === 1 ? 'lançamento duplicado' : 'lançamentos duplicados'}{' '}
          (mesma pessoa, treinamento e data). Destacados em vermelho para o gestor conferir na
          origem.
        </p>
      ) : null}

      {/* Mobile: uma coluna */}
      <div className="flex flex-col gap-3 lg:hidden">{cards.map(renderCard)}</div>

      {/* Desktop: duas colunas independentes — expandir um card não afeta a altura do vizinho */}
      <div className="hidden items-start gap-3 lg:flex">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {colunaEsquerda.map(renderCard)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {colunaDireita.map(renderCard)}
        </div>
      </div>
    </div>
  )
}
