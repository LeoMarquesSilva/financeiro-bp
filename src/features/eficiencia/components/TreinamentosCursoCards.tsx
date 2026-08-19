import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, ChevronDown, Clock3, GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Avatar } from '@/shared/components/Avatar'
import { formatDate } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import type { TreinamentoItemRow, TreinamentosPorPessoaRow } from '../types/eficiencia.types'

type ParticipanteCurso = {
  colaborador: string
  minutos: number
  datas: string[]
  duplicado: boolean
}

type TreinamentoCurso = {
  key: string
  treinamento: string
  duracaoMinutos: number
  participantes: ParticipanteCurso[]
  duplicado: boolean
}

type Props = {
  porPessoa: TreinamentosPorPessoaRow[]
  itens: TreinamentoItemRow[]
  loading?: boolean
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

function formatHorasMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${h}h ${String(m).padStart(2, '0')}min`
}

export function buildTreinamentosPorCurso(
  porPessoa: TreinamentosPorPessoaRow[],
  itens: TreinamentoItemRow[],
): TreinamentoCurso[] {
  const elegiveis = new Set(porPessoa.map((p) => normalizeKey(p.colaborador)))
  const cursos = new Map<
    string,
    {
      treinamento: string
      duracaoMinutos: number
      duplicado: boolean
      participantes: Map<
        string,
        {
          colaborador: string
          minutos: number
          datas: Set<string>
          duplicado: boolean
        }
      >
    }
  >()

  for (const item of itens) {
    const colaboradorKey = normalizeKey(item.colaborador)
    if (!colaboradorKey || !elegiveis.has(colaboradorKey)) continue

    const treinamento = item.treinamento?.trim() || 'Treinamento não informado'
    const treinamentoKey = normalizeKey(treinamento)
    const minutos = Math.max(0, Number(item.duracao_minutos) || 0)
    const curso = cursos.get(treinamentoKey) ?? {
      treinamento,
      duracaoMinutos: 0,
      duplicado: false,
      participantes: new Map(),
    }
    const participante = curso.participantes.get(colaboradorKey) ?? {
      colaborador: item.colaborador,
      minutos: 0,
      datas: new Set<string>(),
      duplicado: false,
    }

    curso.duracaoMinutos = Math.max(curso.duracaoMinutos, minutos)
    curso.duplicado ||= item.duplicado === true
    participante.minutos = Math.max(participante.minutos, minutos)
    participante.duplicado ||= item.duplicado === true
    if (item.data) participante.datas.add(item.data)
    curso.participantes.set(colaboradorKey, participante)
    cursos.set(treinamentoKey, curso)
  }

  return Array.from(cursos, ([key, curso]) => ({
    key,
    treinamento: curso.treinamento,
    duracaoMinutos: curso.duracaoMinutos,
    duplicado: curso.duplicado,
    participantes: Array.from(curso.participantes.values())
      .map((participante) => ({
        ...participante,
        datas: Array.from(participante.datas).sort((a, b) => b.localeCompare(a)),
      }))
      .sort((a, b) =>
        a.colaborador.localeCompare(b.colaborador, 'pt-BR', { sensitivity: 'base' }),
      ),
  })).sort((a, b) =>
    a.treinamento.localeCompare(b.treinamento, 'pt-BR', { sensitivity: 'base' }),
  )
}

export function TreinamentosCursoCards({ porPessoa, itens, loading }: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())
  const cursos = useMemo(() => buildTreinamentosPorCurso(porPessoa, itens), [porPessoa, itens])

  function toggle(key: string) {
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
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

  if (cursos.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">Sem treinamentos no período.</p>
  }

  return (
    <div className="space-y-3">
      {cursos.map((curso) => {
        const aberto = abertos.has(curso.key)
        const qtd = curso.participantes.length

        return (
          <article
            key={curso.key}
            className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggle(curso.key)}
              aria-expanded={aberto}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/80"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <GraduationCap className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {curso.treinamento}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    {qtd} {qtd === 1 ? 'participante' : 'participantes'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" aria-hidden />
                    {formatHorasMinutos(curso.duracaoMinutos)}
                  </span>
                  {curso.duplicado ? (
                    <span className="inline-flex items-center gap-1 font-medium text-red-600">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Conferir duplicado
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                  aberto && 'rotate-180',
                )}
                aria-hidden
              />
            </button>

            {aberto ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {curso.participantes.map((participante) => {
                  const nome = resolvePessoaDisplayNome(
                    participante.colaborador,
                    teamMembers,
                    avatarCatalog,
                  )
                  const avatarUrl = resolvePessoaAvatarUrl(
                    participante.colaborador,
                    teamMembers,
                    avatarCatalog,
                  )
                  const datasLabel =
                    participante.datas.length > 0
                      ? participante.datas.map((data) => formatDate(data)).join(', ')
                      : 'Data não informada'

                  return (
                    <li
                      key={normalizeKey(participante.colaborador)}
                      className={cn(
                        'flex flex-wrap items-center gap-3 px-4 py-3 text-sm',
                        participante.duplicado && 'bg-red-50/70',
                      )}
                    >
                      <Avatar
                        src={avatarUrl}
                        fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                        fullName={nome}
                        size="sm"
                        className="h-9 w-9 shrink-0 text-[10px]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{nome}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                          <CalendarDays className="h-3 w-3" aria-hidden />
                          {datasLabel}
                        </p>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {participante.duplicado ? (
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                            Duplicado
                          </Badge>
                        ) : null}
                        <span className="font-semibold tabular-nums text-slate-700">
                          {formatHorasMinutos(participante.minutos)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
