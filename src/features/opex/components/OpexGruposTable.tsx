import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { opexService } from '../services/opexService'
import { OPEX_COLORS } from '../constants'
import { formatPeriodoOpex, mesesFiltroKey, temFiltroMeses } from '../utils/opexPeriodo'
import { OpexPlanoTitulos } from './OpexPlanoTitulos'
import type { OpexGrupoRow, OpexPlanoRow } from '../types/opex.types'

type Props = {
  grupos: OpexGrupoRow[]
  ano: number
  mesesFiltro: number[]
}

function pct(realizado: number, previsto: number): string {
  if (!previsto) return '—'
  return `${((realizado / previsto) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
}

function PlanoRow({
  plano,
  ano,
  grupo,
  mesesFiltro,
  expandido,
  onToggle,
}: {
  plano: OpexPlanoRow
  ano: number
  grupo: string
  mesesFiltro: number[]
  expandido: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 sm:items-center sm:px-4"
      >
        {expandido ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 sm:mt-0" aria-hidden />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 sm:mt-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-800">{plano.plano_contas}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] sm:hidden">
            <span className={OPEX_COLORS.realizado.text}>
              Real. {formatCurrency(plano.realizado_ytd)}
            </span>
            <span className={OPEX_COLORS.previsto.text}>
              Prev. {formatCurrency(plano.previsto_ano)}
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 gap-4 text-right text-xs tabular-nums sm:flex">
          <span className={cn('min-w-[5.5rem]', OPEX_COLORS.realizado.text)}>
            {formatCurrency(plano.realizado_ytd)}
          </span>
          <span className={cn('min-w-[5.5rem]', OPEX_COLORS.previsto.text)}>
            {formatCurrency(plano.previsto_ano)}
          </span>
        </span>
      </button>
      {expandido && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 pb-3 pt-1 sm:px-4">
          <OpexPlanoTitulos ano={ano} grupo={grupo} plano={plano.plano_contas} mesesFiltro={mesesFiltro} />
        </div>
      )}
    </div>
  )
}

function GrupoDetalhe({
  ano,
  grupo,
  mesesFiltro,
}: {
  ano: number
  grupo: string
  mesesFiltro: number[]
}) {
  const [planoAberto, setPlanoAberto] = useState<string | null>(null)
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const { data, isLoading } = useQuery({
    queryKey: ['opex', 'planos', ano, grupo, mesesFiltroKey(mesesFiltro)],
    queryFn: () => opexService.fetchPlanosGrupo(ano, grupo, mesesFiltro),
    staleTime: 60_000,
  })

  if (isLoading) return <p className="px-4 py-3 text-xs text-slate-400 sm:px-5">Carregando planos…</p>
  if (!data?.length) {
    return <p className="px-4 py-3 text-xs text-slate-400 sm:px-5">Sem detalhamento por plano.</p>
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-3 sm:px-5">
      <div className="mb-2 hidden items-center justify-between px-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:flex">
        <span>Plano de contas</span>
        <span className="flex gap-4">
          <span className="min-w-[5.5rem] text-right">
            {filtroAtivo ? 'Realizado período' : 'Realizado YTD'}
          </span>
          <span className="min-w-[5.5rem] text-right">
            {filtroAtivo ? 'Previsto período' : 'Previsto ano'}
          </span>
        </span>
      </div>
      <p className="mb-2 text-[11px] text-slate-500 sm:hidden">
        Toque no plano para ver os títulos que compõem o valor.
      </p>
      <div className="space-y-2">
        {data.map((p: OpexPlanoRow) => (
          <PlanoRow
            key={p.plano_contas}
            plano={p}
            ano={ano}
            grupo={grupo}
            mesesFiltro={mesesFiltro}
            expandido={planoAberto === p.plano_contas}
            onToggle={() => setPlanoAberto((prev) => (prev === p.plano_contas ? null : p.plano_contas))}
          />
        ))}
      </div>
    </div>
  )
}

export function OpexGruposTable({ grupos, ano, mesesFiltro }: Props) {
  const [aberto, setAberto] = useState<string | null>(null)
  const [soFixas, setSoFixas] = useState(false)
  const filtroAtivo = temFiltroMeses(mesesFiltro)

  const lista = soFixas ? grupos.filter((g) => g.fixo) : grupos

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Despesas por grupo de conta</h2>
          <p className="text-xs text-slate-500">
            {filtroAtivo
              ? `Detalhamento de ${formatPeriodoOpex(mesesFiltro, 0, ano)} · grupo → plano → título`
              : 'Clique no grupo e depois no plano para ver os títulos'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSoFixas((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
            soFixas
              ? 'border-violet-200 bg-violet-50 text-violet-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
          )}
        >
          <Pin className="h-3 w-3" aria-hidden />
          Só despesas fixas
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-0 text-sm md:min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3 sm:px-5">Grupo</th>
              <th className="px-4 py-3 text-right">
                {filtroAtivo ? 'Realizado período' : 'Realizado YTD'}
              </th>
              <th className="hidden px-4 py-3 text-right sm:table-cell">
                {filtroAtivo ? 'Previsto período' : 'Previsto ano'}
              </th>
              {!filtroAtivo && <th className="hidden px-4 py-3 text-right lg:table-cell">Projetado ano</th>}
              <th className="hidden px-4 py-3 text-center md:table-cell">% realizado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((g) => {
              const expandido = aberto === g.grupo_conta
              return (
                <Fragment key={g.grupo_conta}>
                  <tr
                    className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/80"
                    onClick={() => setAberto(expandido ? null : g.grupo_conta)}
                  >
                    <td className="px-4 py-2.5 sm:px-5">
                      <span className="flex items-center gap-2">
                        {expandido ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-800">{g.grupo_conta}</span>
                          <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] sm:hidden">
                            <span className={OPEX_COLORS.realizado.text}>
                              {formatCurrency(g.realizado_ytd)}
                            </span>
                            <span className={OPEX_COLORS.previsto.text}>
                              prev. {formatCurrency(g.previsto_ano)}
                            </span>
                          </span>
                        </span>
                        {g.fixo && (
                          <span
                            className={cn(
                              'hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline',
                              OPEX_COLORS.fixo.bg,
                              OPEX_COLORS.fixo.text,
                            )}
                          >
                            Fixa
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums', OPEX_COLORS.realizado.text)}>
                      {formatCurrency(g.realizado_ytd)}
                    </td>
                    <td className={cn('hidden px-4 py-2.5 text-right tabular-nums sm:table-cell', OPEX_COLORS.previsto.text)}>
                      {formatCurrency(g.previsto_ano)}
                    </td>
                    {!filtroAtivo && (
                      <td className={cn('hidden px-4 py-2.5 text-right tabular-nums lg:table-cell', OPEX_COLORS.projetado.text)}>
                        {formatCurrency(g.projetado_ano)}
                      </td>
                    )}
                    <td className="hidden px-4 py-2.5 text-center tabular-nums text-slate-500 md:table-cell">
                      {pct(g.realizado_ytd, g.previsto_ano)}
                    </td>
                  </tr>
                  {expandido && (
                    <tr>
                      <td colSpan={filtroAtivo ? 4 : 5} className="p-0">
                        <GrupoDetalhe ano={ano} grupo={g.grupo_conta} mesesFiltro={mesesFiltro} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
