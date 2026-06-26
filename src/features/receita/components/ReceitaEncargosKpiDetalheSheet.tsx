import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FileText,
  Loader2,
  PieChart,
  Receipt,
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
import {
  agruparEncargosPorGrupo,
  buildClienteGrupoMap,
  resolverGrupoCliente,
  type ReceitaRecebidoGrupoAgg,
} from '../utils/recebidoGrupos'
import { RECEITA_COLORS } from '../constants'
import { isMesFuturo } from '../utils/receitaMes'
import type {
  ReceitaEncargosItemRow,
  ReceitaMesRow,
  ReceitaRecebidoPlanoRow,
} from '../types/receita.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  rows: ReceitaMesRow[]
  totalEncargos: number
}

const PLANO_COLORS = [
  'bg-orange-500',
  'bg-amber-600',
  'bg-yellow-600',
  'bg-red-500',
  'bg-rose-500',
  'bg-orange-600',
  'bg-amber-500',
  'bg-yellow-500',
]

type View = 'meses' | 'planos' | 'grupos' | 'titulos'

export function ReceitaEncargosKpiDetalheSheet({
  open,
  onOpenChange,
  ano,
  rows,
  totalEncargos,
}: Props) {
  const [view, setView] = useState<View>('meses')
  const [mesSelecionado, setMesSelecionado] = useState<ReceitaMesRow | null>(null)
  const [planoSelecionado, setPlanoSelecionado] = useState<ReceitaRecebidoPlanoRow | null>(null)
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null)

  const [loadingPlanos, setLoadingPlanos] = useState(false)
  const [errorPlanos, setErrorPlanos] = useState<string | null>(null)
  const [planos, setPlanos] = useState<ReceitaRecebidoPlanoRow[]>([])

  const [loadingItens, setLoadingItens] = useState(false)
  const [errorItens, setErrorItens] = useState<string | null>(null)
  const [itens, setItens] = useState<ReceitaEncargosItemRow[]>([])
  const [clienteGrupoMap, setClienteGrupoMap] = useState<Map<string, string>>(new Map())

  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 250)

  const mesesComEncargos = useMemo(
    () =>
      [...rows]
        .filter((r) => r.encargos > 0 && !isMesFuturo(ano, r.mes))
        .sort((a, b) => a.mes - b.mes),
    [rows, ano],
  )

  const somaMeses = mesesComEncargos.reduce((s, r) => s + r.encargos, 0)

  useEffect(() => {
    if (!open) {
      setView('meses')
      setMesSelecionado(null)
      setPlanoSelecionado(null)
      setGrupoSelecionado(null)
      setBusca('')
      setPlanos([])
      setItens([])
      return
    }
  }, [open])

  useEffect(() => {
    if (!open || view === 'meses' || !mesSelecionado) return
    let cancelled = false
    setLoadingPlanos(true)
    setErrorPlanos(null)
    receitaService
      .fetchEncargosPorPlano(ano, mesSelecionado.mes)
      .then((data) => {
        if (!cancelled) {
          setPlanos(data)
          setPlanoSelecionado((atual) => {
            if (!atual) return atual
            return data.find((p) => p.plano_contas === atual.plano_contas) ?? atual
          })
        }
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
  }, [open, view, ano, mesSelecionado])

  useEffect(() => {
    if (!open || view === 'meses' || view === 'planos' || !mesSelecionado || !planoSelecionado) return
    let cancelled = false
    setLoadingItens(true)
    setErrorItens(null)
    setItens([])
    setClienteGrupoMap(new Map())

    Promise.all([
      receitaService.fetchEncargosItens(ano, mesSelecionado.mes, planoSelecionado.plano_contas),
      receitaService.fetchEmpresasNomeGrupo(),
    ])
      .then(([itensData, empresas]) => {
        if (cancelled) return
        setItens(itensData)
        setClienteGrupoMap(buildClienteGrupoMap(empresas))
      })
      .catch((e) => {
        if (!cancelled) {
          setErrorItens(e instanceof Error ? e.message : 'Erro ao carregar detalhes.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingItens(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, view, ano, mesSelecionado, planoSelecionado])

  const somaPlanos = planos.reduce((s, l) => s + l.total, 0)
  const baseTotalPlanos = somaPlanos > 0 ? somaPlanos : (mesSelecionado?.encargos ?? 0)

  const planosComPct = useMemo(
    () =>
      [...planos]
        .sort((a, b) => b.total - a.total)
        .map((l, i) => ({
          ...l,
          pct: baseTotalPlanos > 0 ? (l.total / baseTotalPlanos) * 100 : 0,
          color: PLANO_COLORS[i % PLANO_COLORS.length],
        })),
    [planos, baseTotalPlanos],
  )

  const gruposAgg = useMemo(
    () => agruparEncargosPorGrupo(itens, clienteGrupoMap),
    [itens, clienteGrupoMap],
  )

  const somaGrupos = gruposAgg.reduce((s, g) => s + g.total, 0)

  const gruposFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return gruposAgg
    return gruposAgg.filter((g) => g.grupo.toLowerCase().includes(q))
  }, [gruposAgg, buscaDebounced])

  const itensGrupo = useMemo(() => {
    if (!grupoSelecionado) return []
    return itens.filter(
      (i) => resolverGrupoCliente(i.cliente, clienteGrupoMap) === grupoSelecionado,
    )
  }, [itens, grupoSelecionado, clienteGrupoMap])

  const itensGrupoFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return itensGrupo
    return itensGrupo.filter((t) => {
      const hay = [t.nro_titulo, t.cliente, t.descricao, String(t.ci_titulo)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [itensGrupo, buscaDebounced])

  const grupoAtual = useMemo(
    () => gruposAgg.find((g) => g.grupo === grupoSelecionado) ?? null,
    [gruposAgg, grupoSelecionado],
  )

  const abrirPlanos = (mes: ReceitaMesRow) => {
    setMesSelecionado(mes)
    setPlanoSelecionado(null)
    setGrupoSelecionado(null)
    setBusca('')
    setView('planos')
  }

  const abrirGrupos = (plano: ReceitaRecebidoPlanoRow) => {
    setPlanoSelecionado(plano)
    setGrupoSelecionado(null)
    setBusca('')
    setView('grupos')
  }

  const abrirTitulos = (grupo: ReceitaRecebidoGrupoAgg) => {
    setGrupoSelecionado(grupo.grupo)
    setBusca('')
    setView('titulos')
  }

  const voltarMeses = () => {
    setView('meses')
    setMesSelecionado(null)
    setPlanoSelecionado(null)
    setGrupoSelecionado(null)
    setPlanos([])
    setItens([])
    setBusca('')
  }

  const voltarPlanos = () => {
    setView('planos')
    setPlanoSelecionado(null)
    setGrupoSelecionado(null)
    setItens([])
    setBusca('')
  }

  const voltarGrupos = () => {
    setView('grupos')
    setGrupoSelecionado(null)
    setBusca('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('meses')
      setMesSelecionado(null)
      setPlanoSelecionado(null)
      setGrupoSelecionado(null)
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-orange-600 to-orange-700 px-6 py-4 pr-14 text-left">
          {view === 'titulos' && grupoSelecionado && planoSelecionado && mesSelecionado ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-orange-100 hover:bg-white/10 hover:text-white"
                onClick={voltarGrupos}
              >
                <ArrowLeft className="h-4 w-4" />
                Grupos de empresas
              </Button>
              <SheetTitle className="text-base font-semibold text-white">{grupoSelecionado}</SheetTitle>
              <SheetDescription className="text-xs text-orange-100">
                {labelPlanoContas(planoSelecionado.plano_contas)} · {mesSelecionado.mesLabel} / {ano}
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(grupoAtual?.total ?? itensGrupoFiltrados.reduce((s, t) => s + t.valor_encargos, 0))}
              </p>
            </>
          ) : view === 'grupos' && planoSelecionado && mesSelecionado ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-orange-100 hover:bg-white/10 hover:text-white"
                onClick={voltarPlanos}
              >
                <ArrowLeft className="h-4 w-4" />
                Planos de contas
              </Button>
              <SheetTitle className="text-base font-semibold text-white">
                {labelPlanoContas(planoSelecionado.plano_contas)}
              </SheetTitle>
              <SheetDescription className="text-xs text-orange-100">
                {mesSelecionado.mesLabel} / {ano} · por grupo · boleto/juros
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(planoSelecionado.total)}
              </p>
            </>
          ) : view === 'planos' && mesSelecionado ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-orange-100 hover:bg-white/10 hover:text-white"
                onClick={voltarMeses}
              >
                <ArrowLeft className="h-4 w-4" />
                Meses
              </Button>
              <SheetTitle className="text-base font-semibold text-white capitalize">
                Encargos — {mesSelecionado.mesLabel} / {ano}
              </SheetTitle>
              <SheetDescription className="text-xs text-orange-100">
                Por plano · pago − fluxo (juros e encargos de boleto)
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(mesSelecionado.encargos)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                  <Receipt className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-semibold text-white">
                    Encargos — {ano}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs text-orange-100">
                    Juros e encargos de boleto (não entram no recebido)
                  </SheetDescription>
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {formatCurrency(totalEncargos)}
              </p>
            </>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {view === 'meses' && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {mesesComEncargos.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <PieChart className="h-8 w-8 text-slate-300" aria-hidden />
                  <p className="text-sm text-slate-500">Nenhum encargo neste ano.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {mesesComEncargos.map((m) => {
                    const pct = totalEncargos > 0 ? (m.encargos / totalEncargos) * 100 : 0
                    return (
                      <li key={m.mes}>
                        <button
                          type="button"
                          onClick={() => abrirPlanos(m)}
                          className="group w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium capitalize text-slate-800 group-hover:text-orange-900">
                              {m.mesLabel}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-orange-700">
                              {formatCurrency(m.encargos)}
                              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-orange-600" />
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-orange-500"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-[11px] font-medium tabular-nums text-slate-500">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {view === 'planos' && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingPlanos && (
                <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                  Carregando planos…
                </div>
              )}
              {errorPlanos && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {errorPlanos}
                </p>
              )}
              {!loadingPlanos && !errorPlanos && planosComPct.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">Nenhum recebimento neste mês.</p>
              )}
              {!loadingPlanos && !errorPlanos && planosComPct.length > 0 && (
                <ul className="space-y-2">
                  {planosComPct.map((l) => (
                    <li key={l.plano_contas}>
                      <button
                        type="button"
                        onClick={() => abrirGrupos(l)}
                        className="group w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 group-hover:text-orange-900">
                            {labelPlanoContas(l.plano_contas)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-orange-700">
                            {formatCurrency(l.total)}
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-orange-600" />
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
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(view === 'grupos' || view === 'titulos') && (
            <>
              <div className="shrink-0 border-b border-slate-100 px-6 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={
                      view === 'grupos' ? 'Buscar grupo de empresas…' : 'Buscar título, cliente…'
                    }
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-2">
                {loadingItens && (
                  <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                    Carregando…
                  </div>
                )}
                {errorItens && (
                  <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {errorItens}
                  </p>
                )}
                {view === 'grupos' && !loadingItens && !errorItens && gruposFiltrados.length > 0 && (
                  <ul className="space-y-2 py-2">
                    {gruposFiltrados.map((g) => (
                      <li key={g.grupo}>
                        <button
                          type="button"
                          onClick={() => abrirTitulos(g)}
                          className="group w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/50"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                              <Building2 className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium text-slate-800">{g.grupo}</span>
                                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-orange-700">
                                  {formatCurrency(g.total)}
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {g.quantidadeTitulos} título{g.quantidadeTitulos !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {view === 'titulos' && !loadingItens && !errorItens && itensGrupoFiltrados.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Título</th>
                          <th className="hidden px-3 py-2 sm:table-cell">Cliente</th>
                          <th className="px-3 py-2">Pagamento</th>
                          <th className="px-3 py-2 text-right">Fluxo</th>
                          <th className="px-3 py-2 text-right">Pago</th>
                          <th className="px-3 py-2 text-right">Encargo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensGrupoFiltrados.map((item) => (
                          <tr key={item.ci_item} className="border-t border-slate-100 hover:bg-slate-50/80">
                            <td className="px-3 py-2.5 align-top">
                              <div className="flex items-start gap-2">
                                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800">
                                    {item.nro_titulo
                                      ? `Tít. ${item.nro_titulo}`
                                      : `Tít. ${item.ci_titulo}`}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                                    {item.descricao || '—'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden max-w-[160px] px-3 py-2.5 align-top text-slate-600 sm:table-cell">
                              <span className="line-clamp-2">{item.cliente || '—'}</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                              {formatDate(item.data_pagamento)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-slate-600">
                              {item.valor_fluxo_item != null ? formatCurrency(item.valor_fluxo_item) : '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-slate-600">
                              {formatCurrency(item.valor_pago_item)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-orange-700">
                              {formatCurrency(item.valor_encargos)}
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

          {view === 'meses' && mesesComEncargos.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>Soma dos meses ({mesesComEncargos.length})</span>
                <span className={cn('tabular-nums', RECEITA_COLORS.encargos.textStrong)}>
                  {formatCurrency(somaMeses)}
                </span>
              </div>
              {Math.abs(somaMeses - totalEncargos) > 0.01 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  KPI exibe {formatCurrency(totalEncargos)} — confira meses exibidos no gráfico.
                </p>
              )}
            </div>
          )}

          {view === 'planos' && !loadingPlanos && planosComPct.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>Total planos</span>
                <span className="tabular-nums text-orange-800">{formatCurrency(somaPlanos)}</span>
              </div>
              {mesSelecionado && Math.abs(somaPlanos - mesSelecionado.encargos) > 0.01 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Resumo do mês: {formatCurrency(mesSelecionado.encargos)}
                </p>
              )}
            </div>
          )}

          {view === 'grupos' && !loadingItens && gruposAgg.length > 0 && planoSelecionado && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>Total grupos ({gruposAgg.length})</span>
                <span className="tabular-nums text-orange-800">{formatCurrency(somaGrupos)}</span>
              </div>
              {Math.abs(somaGrupos - planoSelecionado.total) > 0.01 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Total do plano: {formatCurrency(planoSelecionado.total)}
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
