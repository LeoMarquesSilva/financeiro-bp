import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatPercent } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { receitaService } from '../services/receitaService'
import type { ReceitaRecebidoClassificacaoItemRow, ReceitaPrevistoFechamentoMes } from '../types/receita.types'
import {
  agruparClassificacaoPorTitulo,
  agruparRecebidoPorCategoria,
  RECEBIDO_CATEGORIA_DESCRICOES,
  RECEBIDO_CATEGORIA_LABELS,
  somaRecebidoClassificado,
  type ReceitaRecebidoCategoria,
} from '../utils/recebidoClassificacao'
import { ReceitaPrevistoFechamentoPanel } from './ReceitaPrevistoFechamentoPanel'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  mesLabel: string
  totalRecebido: number
  totalPrevisto: number
  inadimplenciaMes?: number | null
}

type View = 'categorias' | 'titulos'

const CATEGORIA_ICONS: Record<
  ReceitaRecebidoCategoria,
  { Icon: typeof Clock; cardClass: string; iconClass: string }
> = {
  inadimplencia: {
    Icon: Clock,
    cardClass: 'hover:border-red-200 hover:bg-red-50/40',
    iconClass: 'bg-red-100 text-red-700',
  },
  novos_contratos: {
    Icon: Sparkles,
    cardClass: 'hover:border-violet-200 hover:bg-violet-50/40',
    iconClass: 'bg-violet-100 text-violet-700',
  },
  receita_mes: {
    Icon: TrendingUp,
    cardClass: 'hover:border-emerald-200 hover:bg-emerald-50/40',
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
}

export function ReceitaRecebidoClassificacaoSheet({
  open,
  onOpenChange,
  ano,
  mes,
  mesLabel,
  totalRecebido,
  totalPrevisto,
  inadimplenciaMes = null,
}: Props) {
  const [view, setView] = useState<View>('categorias')
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<ReceitaRecebidoCategoria | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [itens, setItens] = useState<ReceitaRecebidoClassificacaoItemRow[]>([])
  const [fechamento, setFechamento] = useState<ReceitaPrevistoFechamentoMes | null>(null)
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 250)

  useEffect(() => {
    if (!open) {
      setView('categorias')
      setCategoriaSelecionada(null)
      setBusca('')
      setItens([])
      setFechamento(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      receitaService.fetchRecebidoClassificacaoMes(ano, mes),
      receitaService.fetchPrevistoFechamentoMes(ano, mes),
    ])
      .then(([itensData, fechamentoData]) => {
        if (!cancelled) {
          setItens(itensData)
          setFechamento(fechamentoData)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar detalhe do recebido.')
          setItens([])
          setFechamento(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mes])

  const categoriasAgg = useMemo(() => agruparRecebidoPorCategoria(itens), [itens])
  const somaCategorias = useMemo(() => somaRecebidoClassificado(categoriasAgg), [categoriasAgg])
  const baseTotal = somaCategorias > 0 ? somaCategorias : totalRecebido

  const categoriasComPct = useMemo(() => {
    const totalNovos =
      categoriasAgg.find((c) => c.categoria === 'novos_contratos')?.total ?? 0
    const totalReceitaMes =
      categoriasAgg.find((c) => c.categoria === 'receita_mes')?.total ?? 0
    const receitaPrevistoPct =
      totalPrevisto > 0 ? ((totalNovos + totalReceitaMes) / totalPrevisto) * 100 : null

    return categoriasAgg.map((c) => ({
      ...c,
      pct:
        c.categoria === 'receita_mes' && receitaPrevistoPct != null ? receitaPrevistoPct : 0,
      exibirPct: c.categoria === 'receita_mes',
      pctSobrePrevisto: c.categoria === 'receita_mes',
    }))
  }, [categoriasAgg, totalPrevisto])

  const categoriaAtual = useMemo(
    () => categoriasComPct.find((c) => c.categoria === categoriaSelecionada) ?? null,
    [categoriasComPct, categoriaSelecionada],
  )

  const titulosAgg = useMemo(() => {
    if (!categoriaSelecionada) return []
    return agruparClassificacaoPorTitulo(itens, categoriaSelecionada)
  }, [itens, categoriaSelecionada])

  const titulosFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return titulosAgg
    return titulosAgg.filter((t) => {
      const hay = [t.nro_titulo, t.cliente, t.descricao, String(t.ci_titulo)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [titulosAgg, buscaDebounced])

  const totalTitulosFiltrados = titulosFiltrados.reduce((s, t) => s + t.total, 0)

  const abrirTitulos = (categoria: ReceitaRecebidoCategoria) => {
    setCategoriaSelecionada(categoria)
    setBusca('')
    setView('titulos')
  }

  const voltarCategorias = () => {
    setView('categorias')
    setCategoriaSelecionada(null)
    setBusca('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('categorias')
      setCategoriaSelecionada(null)
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-sky-600 to-sky-700 px-6 py-4 pr-14 text-left">
          {view === 'titulos' && categoriaSelecionada ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-sky-100 hover:bg-white/10 hover:text-white"
                onClick={voltarCategorias}
              >
                <ArrowLeft className="h-4 w-4" />
                Classificação do recebido
              </Button>
              <SheetTitle className="text-base font-semibold text-white">
                {RECEBIDO_CATEGORIA_LABELS[categoriaSelecionada]}
              </SheetTitle>
              <SheetDescription className="text-xs text-sky-100">
                {RECEBIDO_CATEGORIA_DESCRICOES[categoriaSelecionada]} · {mesLabel} / {ano} ·{' '}
                {categoriaAtual?.quantidadeTitulos ?? titulosAgg.length}{' '}
                {(categoriaAtual?.quantidadeTitulos ?? titulosAgg.length) === 1
                  ? 'título'
                  : 'títulos'}
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(categoriaAtual?.total ?? totalTitulosFiltrados)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                  <Banknote className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-semibold text-white">
                    Recebido — {mesLabel} / {ano}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs text-sky-100">
                    Inadimplência · Novos contratos · Receita do mês
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sky-100">
                    Previsto
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-white/95">
                    {formatCurrency(totalPrevisto)}
                  </p>
                  <p className="mt-0.5 min-h-[14px] text-[10px] leading-[14px] text-sky-100/90">
                    Vencimentos do mês
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sky-100">
                    Recebido
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-white">
                    {formatCurrency(somaCategorias > 0 ? somaCategorias : totalRecebido)}
                  </p>
                  <p className="mt-0.5 min-h-[14px] text-[10px] leading-[14px] text-sky-100/90">
                    {!loading && somaCategorias > 0
                      ? 'Inad. + Novos + Rec. mês'
                      : 'Caixa do mês'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sky-100">
                    Inadimplência
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-red-100">
                    {inadimplenciaMes != null ? formatCurrency(inadimplenciaMes) : '—'}
                  </p>
                  <p className="mt-0.5 min-h-[14px] text-[10px] leading-[14px] text-sky-100/90">
                    Vencimentos do mês não recebidos
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {view === 'titulos' && (
            <div className="shrink-0 border-b border-slate-100 px-6 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar título, cliente, descrição…"
                  className="pl-9"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                Carregando detalhe…
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            {!loading && !error && view === 'categorias' && categoriasComPct.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                Nenhum recebimento neste mês.
              </p>
            )}

            {!loading && !error && view === 'categorias' && fechamento && (
              <ReceitaPrevistoFechamentoPanel fechamento={fechamento} />
            )}

            {!loading && !error && view === 'categorias' && categoriasComPct.length > 0 && (
              <>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Detalhe por categoria — clique para ver títulos
                </h3>
              </>
            )}

            {!loading && !error && view === 'categorias' && categoriasComPct.length > 0 && (
              <ul className="space-y-2">
                {categoriasComPct.map((c) => {
                  const meta = CATEGORIA_ICONS[c.categoria]
                  const { Icon } = meta
                  return (
                    <li key={c.categoria}>
                      <button
                        type="button"
                        onClick={() => abrirTitulos(c.categoria)}
                        className={cn(
                          'group w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-colors',
                          meta.cardClass,
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                              meta.iconClass,
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900">
                                {RECEBIDO_CATEGORIA_LABELS[c.categoria]}
                              </span>
                              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-sky-700">
                                {formatCurrency(c.total)}
                                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600" />
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {RECEBIDO_CATEGORIA_DESCRICOES[c.categoria]}
                            </p>
                            {c.exibirPct ? (
                              <>
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn(
                                        'h-full rounded-full',
                                        meta.iconClass.split(' ')[0],
                                      )}
                                      style={{
                                        width: `${Math.max(Math.min(c.pct, 100), 2)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="w-12 text-right text-[11px] font-medium tabular-nums text-slate-500">
                                    {formatPercent(c.pct)}
                                  </span>
                                </div>
                                {c.pctSobrePrevisto ? (
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    do previsto do mês (incl. novos contratos)
                                  </p>
                                ) : null}
                              </>
                            ) : null}
                            <p className="mt-1 text-[11px] text-slate-400">
                              {c.quantidadeTitulos}{' '}
                              {c.quantidadeTitulos === 1 ? 'título' : 'títulos'} · {c.quantidadeItens}{' '}
                              {c.quantidadeItens === 1 ? 'item' : 'itens'}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {view === 'titulos' && !loading && !error && titulosFiltrados.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {buscaDebounced ? 'Nenhum título corresponde à busca.' : 'Nenhum título nesta categoria.'}
              </p>
            )}

            {view === 'titulos' && !loading && !error && titulosFiltrados.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Título</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Cliente</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2">Pagamento</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulosFiltrados.map((titulo) => (
                      <tr
                        key={titulo.ci_titulo}
                        className="border-t border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-2.5 align-top">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800">
                                {titulo.nro_titulo ? `Tít. ${titulo.nro_titulo}` : `CI ${titulo.ci_titulo}`}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                                {titulo.descricao || '—'}
                              </p>
                              {titulo.quantidadeItens > 1 && (
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {titulo.quantidadeItens} itens no título
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="hidden max-w-[180px] px-3 py-2.5 align-top text-slate-600 sm:table-cell">
                          <span className="line-clamp-2">{titulo.cliente || '—'}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                          {formatDate(titulo.data_vencimento)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                          {formatDate(titulo.data_pagamento)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-sky-700">
                          {formatCurrency(titulo.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {view === 'categorias' && !loading && fechamento && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-2">
              <p className="text-[10px] leading-snug text-slate-500">
                Previsto e inadimplência usam base de vencimento; caixa usa pagamentos do mês.
              </p>
            </div>
          )}

          {view === 'titulos' && !loading && titulosFiltrados.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {buscaDebounced
                    ? `${titulosFiltrados.length} de ${titulosAgg.length} títulos`
                    : `${titulosAgg.length} títulos`}
                </span>
                <span className="tabular-nums text-sky-800">
                  {formatCurrency(totalTitulosFiltrados)}
                </span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
