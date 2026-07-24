import { useQuery } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { opexService } from '../services/opexService'
import { OPEX_COLORS } from '../constants'
import { formatPeriodoOpex, mesesFiltroKey, planoFiltroKey, temFiltroMeses } from '../utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'
import { OpexPlanoTitulos } from './OpexPlanoTitulos'
import type { OpexGrupoRow, OpexPlanoRow } from '../types/opex.types'

type Props = {
  grupos: OpexGrupoRow[]
  ano: number
  mesesFiltro: number[]
  soFixas: boolean
  orcamentoImportado?: boolean
  onSoFixasChange: (value: boolean) => void
  chartSlot: ReactNode
  sortByVariacaoTrigger?: number
  planoFiltro?: OpexPlanoFiltroState
}

type SortKey =
  | 'grupo_conta'
  | 'realizado_ytd'
  | 'previsto_ano'
  | 'previsto_vios'
  | 'projetado_ano'
  | 'variacao'
  | 'pct'

type SortDir = 'asc' | 'desc'

function pct(realizado: number, referencia: number): string {
  if (!referencia) return '—'
  return formatPercent((realizado / referencia) * 100)
}

function referenciaGrupoMeta(orcamentoImportado: boolean | undefined, filtroAtivo: boolean) {
  return {
    label: orcamentoImportado
      ? filtroAtivo
        ? 'Orçado período'
        : 'Orçado ano'
      : filtroAtivo
        ? 'Previsto período'
        : 'Previsto ano',
    labelCurto: orcamentoImportado ? 'orç.' : 'prev.',
    pctLabel: orcamentoImportado ? '% do orçado' : '% do previsto',
    color: orcamentoImportado ? OPEX_COLORS.orcamento.text : OPEX_COLORS.previsto.text,
  }
}

function grupoVariacao(g: OpexGrupoRow): number {
  return g.realizado_ytd - g.previsto_ano
}

function variacaoClass(valor: number): string {
  if (valor > 0) return 'text-rose-700'
  if (valor < 0) return 'text-emerald-700'
  return 'text-slate-500'
}

function pctValue(realizado: number, referencia: number): number {
  if (!referencia) return -1
  return (realizado / referencia) * 100
}

function compareGrupos(a: OpexGrupoRow, b: OpexGrupoRow, key: SortKey): number {
  switch (key) {
    case 'grupo_conta':
      return a.grupo_conta.localeCompare(b.grupo_conta, 'pt-BR')
    case 'realizado_ytd':
      return a.realizado_ytd - b.realizado_ytd
    case 'previsto_ano':
      return a.previsto_ano - b.previsto_ano
    case 'previsto_vios':
      return a.previsto_vios - b.previsto_vios
    case 'projetado_ano':
      return a.projetado_ano - b.projetado_ano
    case 'variacao':
      return grupoVariacao(a) - grupoVariacao(b)
    case 'pct':
      return pctValue(a.realizado_ytd, a.previsto_ano) - pctValue(b.realizado_ytd, b.previsto_ano)
    default:
      return 0
  }
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}) {
  const active = activeKey === sortKey
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th
      className={cn(
        className,
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-slate-800',
          align === 'right' && 'w-full justify-end',
          align === 'center' && 'w-full justify-center',
          active ? 'text-slate-800' : 'text-slate-600',
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
  )
}

function PlanoRow({
  plano,
  ano,
  grupo,
  mesesFiltro,
  orcamentoImportado,
  planoFiltro,
  expandido,
  onToggle,
}: {
  plano: OpexPlanoRow
  ano: number
  grupo: string
  mesesFiltro: number[]
  orcamentoImportado?: boolean
  planoFiltro?: OpexPlanoFiltroState
  expandido: boolean
  onToggle: () => void
}) {
  const referenciaLabelCurto = orcamentoImportado ? 'Orç.' : 'Prev.'
  const referenciaColor = orcamentoImportado ? OPEX_COLORS.orcamento.text : OPEX_COLORS.previsto.text

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
            <span className={referenciaColor}>
              {referenciaLabelCurto} {formatCurrency(plano.previsto_ano)}
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 gap-4 text-right text-xs tabular-nums sm:flex">
          <span className={cn('min-w-[5.5rem]', OPEX_COLORS.realizado.text)}>
            {formatCurrency(plano.realizado_ytd)}
          </span>
          <span className={cn('min-w-[5.5rem]', referenciaColor)}>
            {formatCurrency(plano.previsto_ano)}
          </span>
        </span>
      </button>
      {expandido && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 pb-3 pt-1 sm:px-4">
          <OpexPlanoTitulos
            ano={ano}
            grupo={grupo}
            plano={plano.plano_contas}
            mesesFiltro={mesesFiltro}
            orcamentoImportado={orcamentoImportado}
            planoFiltro={planoFiltro}
          />
        </div>
      )}
    </div>
  )
}

function GrupoDetalhe({
  ano,
  grupo,
  mesesFiltro,
  orcamentoImportado,
  planoFiltro,
}: {
  ano: number
  grupo: string
  mesesFiltro: number[]
  orcamentoImportado?: boolean
  planoFiltro?: OpexPlanoFiltroState
}) {
  const [planoAberto, setPlanoAberto] = useState<string | null>(null)
  const filtroAtivo = temFiltroMeses(mesesFiltro)
  const referenciaLabel = orcamentoImportado
    ? filtroAtivo
      ? 'Orçado período'
      : 'Orçado ano'
    : filtroAtivo
      ? 'Previsto período'
      : 'Previsto ano'
  const { data, isLoading } = useQuery({
    queryKey: ['opex', 'planos', ano, grupo, mesesFiltroKey(mesesFiltro), planoFiltroKey(planoFiltro ?? { gruposExcluidos: [], planosExcluidos: [] })],
    queryFn: () => opexService.fetchPlanosGrupo(ano, grupo, mesesFiltro, planoFiltro),
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
          <span className="min-w-[5.5rem] text-right">{referenciaLabel}</span>
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
            orcamentoImportado={orcamentoImportado}
            planoFiltro={planoFiltro}
            expandido={planoAberto === p.plano_contas}
            onToggle={() => setPlanoAberto((prev) => (prev === p.plano_contas ? null : p.plano_contas))}
          />
        ))}
      </div>
    </div>
  )
}

export function OpexGruposTable({
  grupos,
  ano,
  mesesFiltro,
  soFixas,
  orcamentoImportado,
  onSoFixasChange,
  chartSlot,
  sortByVariacaoTrigger,
  planoFiltro,
}: Props) {
  const [aberto, setAberto] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('realizado_ytd')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const filtroAtivo = temFiltroMeses(mesesFiltro)

  useEffect(() => {
    if (sortByVariacaoTrigger) {
      setSortKey('variacao')
      setSortDir('desc')
    }
  }, [sortByVariacaoTrigger])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'grupo_conta' ? 'asc' : 'desc')
    }
  }

  const lista = useMemo(() => {
    const base = soFixas ? grupos.filter((g) => g.fixo) : grupos
    const list = [...base]
    const sign = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => sign * compareGrupos(a, b, sortKey))
    return list
  }, [grupos, soFixas, sortKey, sortDir])

  const referenciaMeta = referenciaGrupoMeta(orcamentoImportado, filtroAtivo)
  const colSpanDetalhe = filtroAtivo
    ? orcamentoImportado
      ? 6
      : 5
    : orcamentoImportado
      ? 7
      : 6

  return (
    <section id="opex-grupos-table" className="rounded-xl border border-slate-200/60 bg-white shadow-sm scroll-mt-6">
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
          onClick={() => onSoFixasChange(!soFixas)}
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

      {chartSlot}

      <div className="overflow-x-auto">
        <table className="w-full min-w-0 text-sm md:min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <SortableTh
                label="Grupo"
                sortKey="grupo_conta"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="px-4 py-3 sm:px-5"
              />
              <SortableTh
                label={filtroAtivo ? 'Realizado período' : 'Realizado YTD'}
                sortKey="realizado_ytd"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="px-4 py-3 text-right"
                align="right"
              />
              <SortableTh
                label={referenciaMeta.label}
                sortKey="previsto_ano"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className={cn('hidden px-4 py-3 sm:table-cell', referenciaMeta.color)}
                align="right"
              />
              {orcamentoImportado && (
                <SortableTh
                  label="Previsto VIOS"
                  sortKey="previsto_vios"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  className={cn('hidden px-4 py-3 md:table-cell', OPEX_COLORS.previsto.text)}
                  align="right"
                />
              )}
              {!filtroAtivo && (
                <SortableTh
                  label="Projetado ano"
                  sortKey="projetado_ano"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  className={cn('hidden px-4 py-3 lg:table-cell', OPEX_COLORS.projetado.text)}
                  align="right"
                />
              )}
              <SortableTh
                label="Variação"
                sortKey="variacao"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="hidden px-4 py-3 md:table-cell"
                align="right"
              />
              <SortableTh
                label={referenciaMeta.pctLabel}
                sortKey="pct"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="hidden px-4 py-3 md:table-cell"
                align="center"
              />
            </tr>
          </thead>
          <tbody>
            {lista.map((g) => {
              const expandido = aberto === g.grupo_conta
              const variacao = grupoVariacao(g)
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
                            <span className={referenciaMeta.color}>
                              {referenciaMeta.labelCurto} {formatCurrency(g.previsto_ano)}
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
                    <td className={cn('hidden px-4 py-2.5 text-right tabular-nums sm:table-cell', referenciaMeta.color)}>
                      {formatCurrency(g.previsto_ano)}
                    </td>
                    {orcamentoImportado && (
                      <td className={cn('hidden px-4 py-2.5 text-right tabular-nums md:table-cell', OPEX_COLORS.previsto.text)}>
                        {formatCurrency(g.previsto_vios)}
                      </td>
                    )}
                    {!filtroAtivo && (
                      <td className={cn('hidden px-4 py-2.5 text-right tabular-nums lg:table-cell', OPEX_COLORS.projetado.text)}>
                        {formatCurrency(g.projetado_ano)}
                      </td>
                    )}
                    <td className={cn('hidden px-4 py-2.5 text-right tabular-nums md:table-cell', variacaoClass(variacao))}>
                      {formatCurrency(variacao)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-center tabular-nums text-slate-500 md:table-cell">
                      {pct(g.realizado_ytd, g.previsto_ano)}
                    </td>
                  </tr>
                  {expandido && (
                    <tr>
                      <td colSpan={colSpanDetalhe} className="p-0">
                        <GrupoDetalhe
                          ano={ano}
                          grupo={g.grupo_conta}
                          mesesFiltro={mesesFiltro}
                          orcamentoImportado={orcamentoImportado}
                          planoFiltro={planoFiltro}
                        />
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
