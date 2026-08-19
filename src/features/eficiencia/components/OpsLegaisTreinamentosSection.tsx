import { useMemo, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/shared/utils/format'
import {
  isTreinamentoLideranca,
  type OpsTreinamentoCategoria,
} from '../constants'
import type { TreinamentoItemRow } from '../types/eficiencia.types'
import {
  buildOpsTreinamentosCategorias,
  type OpsTurnoverAtivo,
} from '../utils/opsTreinamentosCategorias'
import { metaTreinamentoMinutosProporcional } from '../utils/treinamentoMetaProporcional'
import { toPriMaiuscula } from '../utils/textFormat'
import { OverviewRacionalButton } from './OverviewKpiHeatRow'
import { TreinamentosCursoCards } from './TreinamentosCursoCards'
import { TreinamentosPessoaCards } from './TreinamentosPessoaCards'
import {
  TreinamentosVisaoToggle,
  type TreinamentosVisao,
} from './TreinamentosVisaoToggle'

type Props = {
  ativos: OpsTurnoverAtivo[]
  itens: TreinamentoItemRow[]
  ano: number
  loading?: boolean
  onRacionalClick?: (visao: TreinamentosVisao) => void
}

const CARD_STYLE: Record<
  OpsTreinamentoCategoria,
  { border: string; accent: string; fillOk: string; fillNok: string }
> = {
  Equipe: {
    border: 'border-t-blue-500',
    accent: 'text-blue-600',
    fillOk: 'bg-emerald-500',
    fillNok: 'bg-rose-500',
  },
  Liderança: {
    border: 'border-t-violet-500',
    accent: 'text-violet-600',
    fillOk: 'bg-emerald-500',
    fillNok: 'bg-violet-500',
  },
  Gerente: {
    border: 'border-t-amber-500',
    accent: 'text-amber-600',
    fillOk: 'bg-amber-500',
    fillNok: 'bg-amber-500',
  },
}

export function OpsLegaisTreinamentosSection({
  ativos,
  itens,
  ano,
  loading,
  onRacionalClick,
}: Props) {
  const [categoriaAtiva, setCategoriaAtiva] = useState<OpsTreinamentoCategoria>('Equipe')
  const [visao, setVisao] = useState<TreinamentosVisao>('equipe')
  const { resumos, pessoas, equipeEmLideranca } = useMemo(
    () => buildOpsTreinamentosCategorias(ativos, itens, ano),
    [ativos, itens, ano],
  )

  const resumoAtivo = resumos.find((r) => r.categoria === categoriaAtiva)

  const pessoasLista = useMemo(() => {
    // Lista todos da categoria (inclui 0 min) — headcount do card precisa bater com o detalhe.
    return pessoas
      .filter((p) => p.categoria === categoriaAtiva)
      .map((p) => ({
        colaborador: p.colaborador,
        minutos_lancados: p.minutos,
        horas_formatadas: '',
        admissao: p.admissao ?? null,
        meta_minutos: metaTreinamentoMinutosProporcional(p.admissao, ano),
      }))
  }, [pessoas, categoriaAtiva, ano])

  const itensFiltrados = itens

  const equipeEmLiderancaCards = useMemo(
    () =>
      equipeEmLideranca.map((p) => ({
        colaborador: p.colaborador,
        minutos_lancados: p.minutos,
        horas_formatadas: '',
      })),
    [equipeEmLideranca],
  )

  const itensEquipeLideranca = useMemo(
    () => itens.filter((i) => isTreinamentoLideranca(i.treinamento)),
    [itens],
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TreinamentosVisaoToggle value={visao} onChange={setVisao} />
        {onRacionalClick ? (
          <OverviewRacionalButton
            onClick={() => onRacionalClick(visao)}
            className="w-auto"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {resumos.map((r) => {
          const style = CARD_STYLE[r.categoria]
          const ativo = categoriaAtiva === r.categoria
          const pct = r.pctAtingimento
          const ok = pct != null && pct >= 100
          const barPct = pct == null ? 100 : Math.min(100, pct)
          return (
            <button
              key={r.categoria}
              type="button"
              onClick={() => setCategoriaAtiva(r.categoria)}
              className={cn(
                'rounded-xl border border-slate-200/70 border-t-[5px] bg-white p-4 text-left shadow-sm transition-all',
                style.border,
                ativo ? 'ring-2 ring-slate-300 scale-[1.01]' : 'hover:shadow-md',
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {r.categoria === 'Gerente'
                  ? toPriMaiuscula('Total de horas realizadas')
                  : toPriMaiuscula('Meta proporcional à admissão')}
              </p>
              <p className="mt-1 text-sm font-extrabold text-slate-900">
                {r.categoria === 'Gerente'
                  ? toPriMaiuscula('Gerente')
                  : `${r.categoria} (${r.qtdPessoas} ${r.qtdPessoas === 1 ? 'pessoa' : 'pessoas'})`}
              </p>
              <p
                className={cn(
                  'mt-3 text-3xl font-black tabular-nums',
                  r.categoria === 'Gerente'
                    ? style.accent
                    : ok
                      ? 'text-emerald-600'
                      : r.categoria === 'Liderança'
                        ? 'text-violet-600'
                        : 'text-rose-600',
                )}
              >
                {r.categoria === 'Gerente'
                  ? r.horasLabel
                  : pct != null
                    ? formatPercent(pct)
                    : '—'}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {r.categoria === 'Gerente'
                  ? `${Math.round(r.minutos)} minutos no total`
                  : `${r.horasLabel} realizadas`}
              </p>
              {r.categoria !== 'Gerente' ? (
                <>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full', ok ? style.fillOk : style.fillNok)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Meta:{' '}
                    {r.metaMinutos != null
                      ? `${Math.round(r.metaMinutos / 60)}h total (${r.qtdPessoas} pessoas · proporcional)`
                      : '—'}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[10px] text-slate-400">Sem meta definida</p>
              )}
            </button>
          )
        })}
      </div>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          {visao === 'treinamentos'
            ? toPriMaiuscula(`Treinamentos — ${categoriaAtiva}`)
            : categoriaAtiva === 'Gerente'
              ? toPriMaiuscula('Treinamentos — Gerente')
              : toPriMaiuscula(
                  `Colaboradores — ${categoriaAtiva} (${resumoAtivo?.qtdPessoas ?? 0} pessoas)`,
                )}
        </div>
        {visao === 'equipe' ? (
          <TreinamentosPessoaCards
            porPessoa={pessoasLista}
            itens={itensFiltrados}
            metaMinutos={categoriaAtiva === 'Gerente' ? null : undefined}
            badgeLabel={categoriaAtiva === 'Gerente' ? 'Total' : undefined}
            accentClass={
              categoriaAtiva === 'Liderança'
                ? 'violet'
                : categoriaAtiva === 'Gerente'
                  ? 'amber'
                  : 'default'
            }
          />
        ) : (
          <TreinamentosCursoCards porPessoa={pessoasLista} itens={itensFiltrados} />
        )}
      </section>

      {categoriaAtiva === 'Liderança' && equipeEmLiderancaCards.length > 0 ? (
        <section className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-1 flex items-center gap-3">
            <hr className="flex-1 border-dashed border-indigo-200" />
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-500">
              {toPriMaiuscula('Capacitação da Equipe para Liderança')}
            </p>
            <hr className="flex-1 border-dashed border-indigo-200" />
          </div>
          <p className="mb-3 text-[11px] italic text-slate-400">
            Colaboradores da Equipe que participaram de treinamentos de Liderança · não
            contabilizado na meta
          </p>
          <TreinamentosPessoaCards
            porPessoa={equipeEmLiderancaCards}
            itens={itensEquipeLideranca}
            metaMinutos={null}
            badgeLabel="Equipe"
            accentClass="indigo"
          />
        </section>
      ) : null}
    </div>
  )
}
