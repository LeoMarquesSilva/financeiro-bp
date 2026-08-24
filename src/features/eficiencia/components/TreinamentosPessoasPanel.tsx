import { useMemo } from 'react'
import { Check, GraduationCap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/shared/components/Avatar'
import { formatPercent } from '@/shared/utils/format'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import {
  buildTreinamentoPessoasResumo,
  type TreinamentoPessoaStat,
} from '../utils/treinamentoPessoaStats'
import type { TreinamentosPorPessoaRow } from '../types/eficiencia.types'

function formatHorasMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${h}h ${String(m).padStart(2, '0')}min`
}

type Accent = 'default' | 'violet' | 'amber'

type Props = {
  porPessoa: TreinamentosPorPessoaRow[]
  ano: number
  loading?: boolean
  /** % horas ÷ meta total (KPI atual do Overview) — referência. */
  pctHorasTotal?: number | null
  accentClass?: Accent
}

const ACCENT: Record<
  Accent,
  { barOk: string; barNok: string; summary: string; ring: string }
> = {
  default: {
    barOk: 'bg-emerald-500',
    barNok: 'bg-rose-400',
    summary: 'text-blue-600',
    ring: 'ring-blue-200',
  },
  violet: {
    barOk: 'bg-emerald-500',
    barNok: 'bg-violet-400',
    summary: 'text-violet-600',
    ring: 'ring-violet-200',
  },
  amber: {
    barOk: 'bg-amber-500',
    barNok: 'bg-amber-400',
    summary: 'text-amber-600',
    ring: 'ring-amber-200',
  },
}

function PessoaRow({
  linha,
  accent,
  teamMembers,
  avatarCatalog,
}: {
  linha: TreinamentoPessoaStat
  accent: (typeof ACCENT)[Accent]
  teamMembers: ReturnType<typeof useTeamMembers>['teamMembers']
  avatarCatalog: ReturnType<typeof useBpUsuariosAvatar>['usuarios']
}) {
  const nomeExibicao = resolvePessoaDisplayNome(linha.colaborador, teamMembers, avatarCatalog)
  const avatarUrl = resolvePessoaAvatarUrl(linha.colaborador, teamMembers, avatarCatalog)
  const barPct = Math.min(100, linha.pctIndividual)

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar
            src={avatarUrl}
            fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
            fullName={nomeExibicao}
            size="sm"
            className="h-9 w-9 text-xs"
          />
          <span className="text-sm font-medium text-slate-900">{nomeExibicao}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-sm text-slate-700">
        {formatHorasMinutos(linha.minutos)}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-sm text-slate-500">
        {formatHorasMinutos(linha.metaMinutos)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 min-w-[72px] flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full',
                linha.atingiuMeta ? accent.barOk : accent.barNok,
              )}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span
            className={cn(
              'w-14 shrink-0 text-right text-xs font-semibold tabular-nums',
              linha.atingiuMeta ? 'text-emerald-600' : 'text-slate-600',
            )}
          >
            {formatPercent(linha.pctIndividual)}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        {linha.atingiuMeta ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Check className="h-3 w-3" aria-hidden />
            Concluiu
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            <GraduationCap className="h-3 w-3" aria-hidden />
            Pendente
          </span>
        )}
      </td>
    </tr>
  )
}

export function TreinamentosPessoasPanel({
  porPessoa,
  ano,
  loading,
  pctHorasTotal,
  accentClass = 'default',
}: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()
  const accent = ACCENT[accentClass]

  const resumo = useMemo(
    () =>
      buildTreinamentoPessoasResumo(
        porPessoa.map((p) => ({
          colaborador: p.colaborador,
          minutos: p.minutos_lancados,
          admissao: p.admissao,
          metaMinutos: p.meta_minutos,
        })),
        ano,
      ),
    [porPessoa, ano],
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (porPessoa.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">Sem colaboradores no período.</p>
    )
  }

  const okEquipe = resumo.pctPessoasMeta != null && resumo.pctPessoasMeta >= 100

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          className={cn(
            'rounded-xl border border-slate-200/70 bg-slate-50/80 p-4',
            okEquipe && 'ring-1 ring-emerald-200',
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Concluíram a meta
          </p>
          <p className={cn('mt-1 text-2xl font-black tabular-nums', accent.summary)}>
            {resumo.pctPessoasMeta != null ? formatPercent(resumo.pctPessoasMeta) : '—'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            {resumo.qtdAtingiu} de {resumo.qtdTotal}{' '}
            {resumo.qtdTotal === 1 ? 'pessoa' : 'pessoas'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Média individual
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">
            {resumo.pctMedioIndividual != null ? formatPercent(resumo.pctMedioIndividual) : '—'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Progresso médio de cada colaborador
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Horas ÷ meta total
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums text-slate-500">
            {pctHorasTotal != null ? formatPercent(pctHorasTotal) : '—'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            KPI atual (soma horas ÷ soma metas)
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Meta individual: <strong>14h/ano</strong>, proporcional à admissão. Uma pessoa concluiu
        quando atingiu 100% da meta dela — independente das horas dos colegas.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200/60">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3 w-3" aria-hidden />
                  Colaborador
                </span>
              </th>
              <th className="px-3 py-2.5 text-right">Realizadas</th>
              <th className="px-3 py-2.5 text-right">Meta</th>
              <th className="px-3 py-2.5">% da meta</th>
              <th className="px-3 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map((linha) => (
              <PessoaRow
                key={linha.colaborador}
                linha={linha}
                accent={accent}
                teamMembers={teamMembers}
                avatarCatalog={avatarCatalog}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
