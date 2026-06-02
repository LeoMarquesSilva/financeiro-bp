import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  Loader2,
  PieChart,
  Search,
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
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { receitaService } from '../services/receitaService'
import { labelPlanoContas } from '../utils/planoContasLabel'
import type { ReceitaRecebidoItemRow, ReceitaRecebidoPlanoRow } from '../types/receita.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  mesLabel: string
  totalRecebido: number
}

const PLANO_COLORS = [
  'bg-sky-500',
  'bg-blue-600',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-amber-500',
]

type View = 'planos' | 'itens'

export function ReceitaRecebidoDetalheSheet({
  open,
  onOpenChange,
  ano,
  mes,
  mesLabel,
  totalRecebido,
}: Props) {
  const [view, setView] = useState<View>('planos')
  const [planoSelecionado, setPlanoSelecionado] = useState<ReceitaRecebidoPlanoRow | null>(null)

  const [loadingPlanos, setLoadingPlanos] = useState(false)
  const [errorPlanos, setErrorPlanos] = useState<string | null>(null)
  const [planos, setPlanos] = useState<ReceitaRecebidoPlanoRow[]>([])

  const [loadingItens, setLoadingItens] = useState(false)
  const [errorItens, setErrorItens] = useState<string | null>(null)
  const [itens, setItens] = useState<ReceitaRecebidoItemRow[]>([])
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 250)

  useEffect(() => {
    if (!open) {
      setView('planos')
      setPlanoSelecionado(null)
      setBusca('')
      return
    }
    let cancelled = false
    setLoadingPlanos(true)
    setErrorPlanos(null)
    receitaService
      .fetchRecebidoPorPlano(ano, mes)
      .then((data) => {
        if (!cancelled) setPlanos(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setErrorPlanos(e instanceof Error ? e.message : 'Erro ao carregar planos.')
          setPlanos([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPlanos(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mes])

  useEffect(() => {
    if (!open || view !== 'itens' || !planoSelecionado) return
    let cancelled = false
    setLoadingItens(true)
    setErrorItens(null)
    setItens([])
    receitaService
      .fetchRecebidoItens(ano, mes, planoSelecionado.plano_contas)
      .then((data) => {
        if (!cancelled) setItens(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setErrorItens(e instanceof Error ? e.message : 'Erro ao carregar itens.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingItens(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, view, ano, mes, planoSelecionado])

  const somaPlanos = planos.reduce((s, l) => s + l.total, 0)
  const baseTotal = somaPlanos > 0 ? somaPlanos : totalRecebido

  const planosComPct = useMemo(
    () =>
      [...planos]
        .sort((a, b) => b.total - a.total)
        .map((l, i) => ({
          ...l,
          pct: baseTotal > 0 ? (l.total / baseTotal) * 100 : 0,
          color: PLANO_COLORS[i % PLANO_COLORS.length],
        })),
    [planos, baseTotal],
  )

  const itensFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return itens
    return itens.filter((item) => {
      const hay = [
        item.cliente,
        item.descricao,
        item.nro_titulo,
        item.situacao_titulo,
        String(item.ci_item),
        String(item.ci_titulo),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [itens, buscaDebounced])

  const totalItensFiltrados = itensFiltrados.reduce((s, i) => s + i.valor_pago_item, 0)

  const abrirItens = (plano: ReceitaRecebidoPlanoRow) => {
    setPlanoSelecionado(plano)
    setBusca('')
    setView('itens')
  }

  const voltarPlanos = () => {
    setView('planos')
    setPlanoSelecionado(null)
    setItens([])
    setBusca('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('planos')
      setPlanoSelecionado(null)
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-sky-600 to-sky-700 px-6 py-4 pr-14 text-left">
          {view === 'itens' && planoSelecionado ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-sky-100 hover:bg-white/10 hover:text-white"
                onClick={voltarPlanos}
              >
                <ArrowLeft className="h-4 w-4" />
                Planos de contas
              </Button>
              <SheetTitle className="text-base font-semibold text-white">
                {labelPlanoContas(planoSelecionado.plano_contas)}
              </SheetTitle>
              <SheetDescription className="text-xs text-sky-100">
                {mesLabel} / {ano} · {planoSelecionado.quantidade}{' '}
                {planoSelecionado.quantidade === 1 ? 'item' : 'itens'}
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(planoSelecionado.total)}
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
                    Por plano de contas · clique para ver cada item
                  </SheetDescription>
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {formatCurrency(totalRecebido)}
              </p>
            </>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {view === 'planos' && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingPlanos && (
                <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                  Carregando planos…
                </div>
              )}

              {errorPlanos && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {errorPlanos}
                </p>
              )}

              {!loadingPlanos && !errorPlanos && planosComPct.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <PieChart className="h-8 w-8 text-slate-300" aria-hidden />
                  <p className="text-sm text-slate-500">Nenhum recebimento neste mês.</p>
                </div>
              )}

              {!loadingPlanos && !errorPlanos && planosComPct.length > 0 && (
                <ul className="space-y-2">
                  {planosComPct.map((l) => (
                    <li key={l.plano_contas}>
                      <button
                        type="button"
                        onClick={() => abrirItens(l)}
                        className="group w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 group-hover:text-sky-900">
                            {labelPlanoContas(l.plano_contas)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-sky-700">
                            {formatCurrency(l.total)}
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600" />
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn('h-full rounded-full', l.color)}
                              style={{ width: `${Math.max(l.pct, 2)}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-[11px] font-medium tabular-nums text-slate-500">
                            {l.pct.toFixed(0)}%
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {l.quantidade} {l.quantidade === 1 ? 'item' : 'itens'} · ver detalhamento
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {view === 'itens' && (
            <>
              <div className="shrink-0 border-b border-slate-100 px-6 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar cliente, descrição, título…"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-2">
                {loadingItens && (
                  <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                    Carregando itens…
                  </div>
                )}

                {errorItens && (
                  <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {errorItens}
                  </p>
                )}

                {!loadingItens && !errorItens && itensFiltrados.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-500">
                    {buscaDebounced ? 'Nenhum item corresponde à busca.' : 'Nenhum item neste plano.'}
                  </p>
                )}

                {!loadingItens && !errorItens && itensFiltrados.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Cliente</th>
                          <th className="hidden px-3 py-2 sm:table-cell">Descrição</th>
                          <th className="px-3 py-2">Pagamento</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensFiltrados.map((item) => (
                          <tr
                            key={item.ci_item}
                            className="border-t border-slate-100 hover:bg-slate-50/80"
                          >
                            <td className="px-3 py-2.5 align-top">
                              <p className="font-medium text-slate-800">
                                {item.cliente || '—'}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                Item {item.ci_item}
                                {item.nro_titulo ? ` · Tít. ${item.nro_titulo}` : ''}
                              </p>
                            </td>
                            <td className="hidden max-w-[200px] px-3 py-2.5 align-top text-slate-600 sm:table-cell">
                              <span className="line-clamp-2">{item.descricao || '—'}</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                              {formatDate(item.data_pagamento)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-sky-700">
                              {formatCurrency(item.valor_pago_item)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {view === 'planos' && !loadingPlanos && planosComPct.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  Total ({planos.reduce((s, l) => s + l.quantidade, 0)} itens)
                </span>
                <span className="tabular-nums text-sky-800">{formatCurrency(somaPlanos)}</span>
              </div>
            </div>
          )}

          {view === 'itens' && !loadingItens && itensFiltrados.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {buscaDebounced
                    ? `${itensFiltrados.length} de ${itens.length} itens`
                    : `${itens.length} itens`}
                </span>
                <span className="tabular-nums text-sky-800">
                  {formatCurrency(totalItensFiltrados)}
                </span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
