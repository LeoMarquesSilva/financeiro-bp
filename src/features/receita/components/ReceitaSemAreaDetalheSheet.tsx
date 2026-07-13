import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Building2, ChevronRight, FileText, Loader2, Search } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { receitaService } from '../services/receitaService'
import { labelPlanoContas } from '../utils/planoContasLabel'
import {
  agruparSemAreaPorDepartamento,
  agruparSemAreaPorTitulo,
  type ReceitaSemAreaDepartamentoAgg,
} from '../utils/recebidoSemArea'
import type { ReceitaRecebidoSemAreaItemRow } from '../types/receita.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number | null
  periodoLabel: string
  totalSemArea: number
}

type View = 'departamentos' | 'titulos'

export function ReceitaSemAreaDetalheSheet({
  open,
  onOpenChange,
  ano,
  mes,
  periodoLabel,
  totalSemArea,
}: Props) {
  const [view, setView] = useState<View>('departamentos')
  const [departamentoSelecionado, setDepartamentoSelecionado] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [itens, setItens] = useState<ReceitaRecebidoSemAreaItemRow[]>([])

  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 250)

  useEffect(() => {
    if (!open) {
      setView('departamentos')
      setDepartamentoSelecionado(null)
      setBusca('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    receitaService
      .fetchRecebidoItensSemArea(ano, mes)
      .then((data) => {
        if (!cancelled) setItens(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar títulos sem área.')
          setItens([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mes])

  const departamentosAgg = useMemo(() => agruparSemAreaPorDepartamento(itens), [itens])

  const departamentosFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return departamentosAgg
    return departamentosAgg.filter((d) => d.departamento.toLowerCase().includes(q))
  }, [departamentosAgg, buscaDebounced])

  const titulosAgg = useMemo(() => {
    if (!departamentoSelecionado) return []
    return agruparSemAreaPorTitulo(itens, departamentoSelecionado)
  }, [itens, departamentoSelecionado])

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

  const totalDepartamentosFiltrados = departamentosFiltrados.reduce((s, d) => s + d.total, 0)
  const totalTitulosFiltrados = titulosFiltrados.reduce((s, t) => s + t.total, 0)

  const departamentoAtual = useMemo(
    () => departamentosAgg.find((d) => d.departamento === departamentoSelecionado) ?? null,
    [departamentosAgg, departamentoSelecionado],
  )

  const abrirTitulos = (dep: ReceitaSemAreaDepartamentoAgg) => {
    setDepartamentoSelecionado(dep.departamento)
    setBusca('')
    setView('titulos')
  }

  const voltarDepartamentos = () => {
    setView('departamentos')
    setDepartamentoSelecionado(null)
    setBusca('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('departamentos')
      setDepartamentoSelecionado(null)
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-amber-500 to-amber-600 px-6 py-4 pr-14 text-left">
          {view === 'titulos' && departamentoSelecionado ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-amber-50 hover:bg-white/10 hover:text-white"
                onClick={voltarDepartamentos}
              >
                <ArrowLeft className="h-4 w-4" />
                Departamentos
              </Button>
              <SheetTitle className="text-base font-semibold text-white">
                {departamentoSelecionado}
              </SheetTitle>
              <SheetDescription className="text-xs text-amber-50">
                {periodoLabel} · {departamentoAtual?.quantidadeTitulos ?? titulosAgg.length}{' '}
                {(departamentoAtual?.quantidadeTitulos ?? titulosAgg.length) === 1 ? 'título' : 'títulos'}
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(departamentoAtual?.total ?? totalTitulosFiltrados)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-semibold text-white">
                    Recebido sem área — {periodoLabel}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs text-amber-50">
                    Departamento não mapeado nas 5 áreas do rateio · clique para ver os títulos
                  </SheetDescription>
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {formatCurrency(totalSemArea)}
              </p>
            </>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-100 px-6 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={
                  view === 'departamentos'
                    ? 'Buscar departamento…'
                    : 'Buscar título, cliente, descrição…'
                }
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {loading && (
              <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                Carregando…
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            {view === 'departamentos' && !loading && !error && departamentosFiltrados.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {buscaDebounced
                  ? 'Nenhum departamento corresponde à busca.'
                  : 'Nenhum título recebido sem área neste período.'}
              </p>
            )}

            {view === 'departamentos' && !loading && !error && departamentosFiltrados.length > 0 && (
              <ul className="space-y-2 py-2">
                {departamentosFiltrados.map((d) => (
                  <li key={d.departamento}>
                    <button
                      type="button"
                      onClick={() => abrirTitulos(d)}
                      className="group w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50/50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                          <Building2 className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800 group-hover:text-amber-900">
                              {d.departamento}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-amber-700">
                              {formatCurrency(d.total)}
                              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600" />
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {d.quantidadeTitulos} {d.quantidadeTitulos === 1 ? 'título' : 'títulos'} ·{' '}
                            {d.quantidadeItens} {d.quantidadeItens === 1 ? 'item' : 'itens'} · ver
                            detalhamento
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {view === 'titulos' && !loading && !error && titulosFiltrados.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {buscaDebounced ? 'Nenhum título corresponde à busca.' : 'Nenhum título neste departamento.'}
              </p>
            )}

            {view === 'titulos' && !loading && !error && titulosFiltrados.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Título</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Cliente</th>
                      <th className="px-3 py-2">Plano</th>
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
                        <td className="whitespace-nowrap px-3 py-2.5 align-top text-slate-600">
                          {labelPlanoContas(titulo.plano_contas)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                          {formatDate(titulo.data_pagamento)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-amber-700">
                          {formatCurrency(titulo.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {view === 'departamentos' && !loading && departamentosFiltrados.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {buscaDebounced
                    ? `${departamentosFiltrados.length} de ${departamentosAgg.length} departamentos`
                    : `${departamentosAgg.length} departamentos`}
                </span>
                <span className="tabular-nums text-amber-800">
                  {formatCurrency(totalDepartamentosFiltrados)}
                </span>
              </div>
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
                <span className="tabular-nums text-amber-800">
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
