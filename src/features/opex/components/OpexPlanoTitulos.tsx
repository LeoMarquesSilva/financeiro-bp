import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { opexService } from '../services/opexService'
import { OPEX_COLORS } from '../constants'
import { mesesFiltroKey, planoFiltroKey } from '../utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'
import type { OpexTituloRow } from '../types/opex.types'

type Props = {
  ano: number
  grupo: string
  plano: string
  mesesFiltro: number[]
  orcamentoImportado?: boolean
  planoFiltro?: OpexPlanoFiltroState
  sortVariacao?: 'desc' | 'asc'
  /** Orçado do plano no período, quando o orçamento não veio quebrado por título. */
  orcamentoPlano?: number
}

type SortKey = 'descricao' | 'fornecedor' | 'vencimento' | 'pagamento' | 'orcado' | 'realizado' | 'variacao'
type SortDir = 'asc' | 'desc'

function referenciaTitulo(titulo: OpexTituloRow, orcamentoImportado?: boolean): number {
  return orcamentoImportado ? titulo.valor_orcamento : titulo.valor_previsto
}

function variacaoTitulo(titulo: OpexTituloRow, orcamentoImportado?: boolean): number {
  return titulo.valor_realizado - referenciaTitulo(titulo, orcamentoImportado)
}

function variacaoClass(valor: number): string {
  if (valor > 0) return 'text-rose-700'
  if (valor < 0) return 'text-emerald-700'
  return 'text-slate-500'
}

function situacaoBadgeClass(situacao: string): string {
  const s = situacao.toUpperCase()
  if (s.includes('PAGO') || s.includes('QUIT')) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (s.includes('ABERTO') || s.includes('VENC')) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function mesDaData(value: string | null): number | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})/.exec(value)
  return m ? Number(m[2]) : null
}

function tituloNoPeriodo(titulo: OpexTituloRow, meses: number[]): boolean {
  if (!meses.length) return true
  const venc = mesDaData(titulo.data_vencimento)
  const pag = mesDaData(titulo.data_pagamento)
  return (venc != null && meses.includes(venc)) || (pag != null && meses.includes(pag))
}

function compareTitulos(
  a: OpexTituloRow,
  b: OpexTituloRow,
  key: SortKey,
  orcamentoImportado?: boolean,
): number {
  switch (key) {
    case 'descricao':
      return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR')
    case 'fornecedor':
      return (a.fornecedor || '').localeCompare(b.fornecedor || '', 'pt-BR')
    case 'vencimento':
      return (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? '')
    case 'pagamento':
      return (a.data_pagamento ?? '').localeCompare(b.data_pagamento ?? '')
    case 'orcado':
      return referenciaTitulo(a, orcamentoImportado) - referenciaTitulo(b, orcamentoImportado)
    case 'realizado':
      return a.valor_realizado - b.valor_realizado
    case 'variacao':
      return variacaoTitulo(a, orcamentoImportado) - variacaoTitulo(b, orcamentoImportado)
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
  align?: 'left' | 'right'
}) {
  const active = activeKey === sortKey
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th
      className={cn(
        'px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide',
        align === 'right' && 'text-right',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-slate-800',
          align === 'right' && 'w-full justify-end',
          active ? 'text-slate-800' : 'text-slate-600',
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
  )
}

export function OpexPlanoTitulos({
  ano,
  grupo,
  plano,
  mesesFiltro,
  orcamentoImportado,
  planoFiltro,
  sortVariacao,
  orcamentoPlano,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(sortVariacao ? 'variacao' : 'realizado')
  const [sortDir, setSortDir] = useState<SortDir>(sortVariacao ?? 'desc')

  useEffect(() => {
    if (sortVariacao) {
      setSortKey('variacao')
      setSortDir(sortVariacao)
    }
  }, [sortVariacao])

  const referenciaLabel = orcamentoImportado ? 'Orçado' : 'Previsto'
  const referenciaColor = orcamentoImportado ? OPEX_COLORS.orcamento.text : OPEX_COLORS.previsto.text

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'opex',
      'titulos',
      ano,
      grupo,
      plano,
      mesesFiltroKey(mesesFiltro),
      planoFiltroKey(planoFiltro ?? { gruposExcluidos: [], planosExcluidos: [] }),
    ],
    queryFn: (): Promise<OpexTituloRow[]> =>
      opexService.fetchPlanoTitulos(ano, grupo, plano, mesesFiltro, planoFiltro),
    staleTime: 60_000,
  })

  const titulos = useMemo(() => {
    const rows: OpexTituloRow[] = data ?? []
    if (!rows.length) return []
    const filtrados = rows.filter((t) => tituloNoPeriodo(t, mesesFiltro))
    const sign = sortDir === 'asc' ? 1 : -1
    return filtrados.sort((a, b) => sign * compareTitulos(a, b, sortKey, orcamentoImportado))
  }, [data, sortKey, sortDir, orcamentoImportado, mesesFiltro])

  const totais = useMemo(() => {
    const orcadoLinhas = titulos.reduce((s, t) => s + referenciaTitulo(t, orcamentoImportado), 0)
    const realizado = titulos.reduce((s, t) => s + t.valor_realizado, 0)
    const orcado = orcadoLinhas > 0 ? orcadoLinhas : Math.max(0, orcamentoPlano ?? 0)
    return { orcado, realizado, orcadoSoNoTotal: orcadoLinhas <= 0 && orcado > 0 }
  }, [titulos, orcamentoImportado, orcamentoPlano])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'descricao' || key === 'fornecedor' ? 'asc' : 'desc')
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Carregando títulos…
      </div>
    )
  }

  if (error) {
    return (
      <p className="py-3 text-xs text-red-600">
        Erro ao carregar títulos. Aplique a migration <code>opex_plano_titulos</code>.
      </p>
    )
  }

  if (!titulos.length) {
    return <p className="py-3 text-xs text-slate-400">Nenhum título encontrado neste plano.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
      <table className="w-full text-[11px] leading-tight">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
            <SortableTh
              label="Descrição"
              sortKey="descricao"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className="w-full px-2.5 py-1.5 sm:px-3"
            />
            <SortableTh
              label="Fornecedor"
              sortKey="fornecedor"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className="hidden px-2.5 py-1.5 md:table-cell"
            />
            <th className="hidden w-px px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap text-slate-600 lg:table-cell">
              Situação
            </th>
            <SortableTh
              label="Vencimento"
              sortKey="vencimento"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className="hidden w-px whitespace-nowrap px-2.5 py-1.5 sm:table-cell"
            />
            <SortableTh
              label="Pagamento"
              sortKey="pagamento"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className="hidden w-px whitespace-nowrap px-2.5 py-1.5 md:table-cell"
            />
            <SortableTh
              label={referenciaLabel}
              sortKey="orcado"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className={cn('hidden w-px whitespace-nowrap px-2.5 py-1.5 sm:table-cell', referenciaColor)}
              align="right"
            />
            <SortableTh
              label="Realizado"
              sortKey="realizado"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className={cn('w-px whitespace-nowrap px-2.5 py-1.5', OPEX_COLORS.realizado.text)}
              align="right"
            />
            <SortableTh
              label="Variação"
              sortKey="variacao"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              className="w-px whitespace-nowrap"
              align="right"
            />
            <th className="hidden w-px whitespace-nowrap px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 xl:table-cell">
              Depto.
            </th>
          </tr>
        </thead>
        <tbody>
          {titulos.map((titulo) => {
            const orcado = referenciaTitulo(titulo, orcamentoImportado)
            const variacao = titulo.valor_realizado - orcado
            const descricao = titulo.descricao.trim() && titulo.descricao !== '—' ? titulo.descricao : 'Sem descrição'
            return (
              <tr key={titulo.ci_item} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                <td className="min-w-0 px-2.5 py-1.5 sm:px-3">
                  <p className="truncate whitespace-nowrap font-medium text-slate-800" title={descricao}>
                    {descricao}
                  </p>
                </td>
                <td className="hidden max-w-[12rem] truncate px-2.5 py-1.5 text-slate-600 md:table-cell" title={titulo.fornecedor}>
                  {titulo.fornecedor !== '—' ? titulo.fornecedor : '—'}
                </td>
                <td className="hidden w-px whitespace-nowrap px-2.5 py-1.5 lg:table-cell">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide',
                      situacaoBadgeClass(titulo.situacao_titulo),
                    )}
                  >
                    {titulo.situacao_titulo || '—'}
                  </span>
                </td>
                <td className="hidden w-px whitespace-nowrap px-2.5 py-1.5 tabular-nums text-slate-700 sm:table-cell">
                  {formatDate(titulo.data_vencimento)}
                </td>
                <td className="hidden w-px whitespace-nowrap px-2.5 py-1.5 tabular-nums text-slate-700 md:table-cell">
                  {formatDate(titulo.data_pagamento)}
                </td>
                <td className={cn('hidden w-px whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums sm:table-cell', referenciaColor)}>
                  {orcado > 0 ? formatCurrency(orcado) : '—'}
                </td>
                <td className={cn('w-px whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums', OPEX_COLORS.realizado.text)}>
                  {titulo.valor_realizado > 0 ? formatCurrency(titulo.valor_realizado) : '—'}
                </td>
                <td className={cn('w-px whitespace-nowrap px-2.5 py-1.5 text-right font-medium tabular-nums', orcado > 0 ? variacaoClass(variacao) : 'text-slate-400')}>
                  {orcado > 0 ? formatCurrency(variacao) : '—'}
                </td>
                <td className="hidden w-px whitespace-nowrap px-2.5 py-1.5 text-slate-500 xl:table-cell">
                  {titulo.departamento !== '—' ? titulo.departamento : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/80 text-[11px] font-semibold">
            <td className="px-2.5 py-1.5 sm:px-3" colSpan={2}>
              Total · {titulos.length} título{titulos.length === 1 ? '' : 's'}
            </td>
            <td className="hidden lg:table-cell" />
            <td className="hidden sm:table-cell" />
            <td className="hidden md:table-cell" />
            <td className={cn('hidden w-px whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums sm:table-cell', referenciaColor)}>
              {formatCurrency(totais.orcado)}
            </td>
            <td className={cn('w-px whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums', OPEX_COLORS.realizado.text)}>
              {formatCurrency(totais.realizado)}
            </td>
            <td className={cn('w-px whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums', variacaoClass(totais.realizado - totais.orcado))}>
              {formatCurrency(totais.realizado - totais.orcado)}
            </td>
            <td className="hidden w-px whitespace-nowrap xl:table-cell" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
