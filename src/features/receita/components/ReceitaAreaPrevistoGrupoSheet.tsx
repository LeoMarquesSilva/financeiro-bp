import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronRight,
  Download,
  FileText,
  Loader2,
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
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { receitaService } from '../services/receitaService'
import { buildClienteGrupoMap } from '../utils/recebidoGrupos'
import {
  agruparPrevistoPorGrupo,
  agruparPrevistoPorTitulo,
  type ReceitaPrevistoGrupoAgg,
} from '../utils/previstoGrupos'
import { exportAreaPrevistoGrupoExcel } from '../utils/receitaAreaPrevistoExport'
import type { ReceitaPrevistoItemRow } from '../types/receita.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  mesLabel: string
  areaKey: string
  areaLabel: string
  totalPrevisto: number
}

type View = 'grupos' | 'titulos'

export function ReceitaAreaPrevistoGrupoSheet({
  open,
  onOpenChange,
  ano,
  mes,
  mesLabel,
  areaKey,
  areaLabel,
  totalPrevisto,
}: Props) {
  const [view, setView] = useState<View>('grupos')
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null)

  const [loadingItens, setLoadingItens] = useState(false)
  const [errorItens, setErrorItens] = useState<string | null>(null)
  const [itens, setItens] = useState<ReceitaPrevistoItemRow[]>([])
  const [clienteGrupoMap, setClienteGrupoMap] = useState<Map<string, string>>(new Map())

  const [busca, setBusca] = useState('')
  const [exportando, setExportando] = useState(false)
  const buscaDebounced = useDebounce(busca, 250)

  useEffect(() => {
    if (!open) {
      setView('grupos')
      setGrupoSelecionado(null)
      setBusca('')
      return
    }
    let cancelled = false
    setLoadingItens(true)
    setErrorItens(null)
    setItens([])
    setClienteGrupoMap(new Map())

    Promise.all([
      receitaService.fetchPrevistoItensPorArea(ano, mes, areaKey),
      receitaService.fetchEmpresasNomeGrupo(),
    ])
      .then(([itensData, empresas]) => {
        if (cancelled) return
        setItens(itensData)
        setClienteGrupoMap(buildClienteGrupoMap(empresas))
      })
      .catch((e) => {
        if (!cancelled) {
          setErrorItens(e instanceof Error ? e.message : 'Erro ao carregar previsto.')
          setItens([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingItens(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, ano, mes, areaKey])

  const gruposAgg = useMemo(
    () => agruparPrevistoPorGrupo(itens, clienteGrupoMap),
    [itens, clienteGrupoMap],
  )

  const gruposFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return gruposAgg
    return gruposAgg.filter((g) => g.grupo.toLowerCase().includes(q))
  }, [gruposAgg, buscaDebounced])

  const totalGruposFiltrados = useMemo(
    () => gruposFiltrados.reduce((s, g) => s + g.total, 0),
    [gruposFiltrados],
  )

  const titulosAgg = useMemo(() => {
    if (!grupoSelecionado) return []
    return agruparPrevistoPorTitulo(itens, grupoSelecionado, clienteGrupoMap)
  }, [itens, grupoSelecionado, clienteGrupoMap])

  const titulosFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return titulosAgg
    return titulosAgg.filter(
      (t) =>
        (t.nro_titulo?.toLowerCase().includes(q) ?? false) ||
        (t.cliente?.toLowerCase().includes(q) ?? false) ||
        (t.descricao?.toLowerCase().includes(q) ?? false) ||
        String(t.ci_titulo).includes(q),
    )
  }, [titulosAgg, buscaDebounced])

  const totalTitulosFiltrados = useMemo(
    () => titulosFiltrados.reduce((s, t) => s + t.total, 0),
    [titulosFiltrados],
  )

  const grupoAtual = useMemo(
    () => gruposAgg.find((g) => g.grupo === grupoSelecionado) ?? null,
    [gruposAgg, grupoSelecionado],
  )

  const abrirTitulos = (grupo: ReceitaPrevistoGrupoAgg) => {
    setGrupoSelecionado(grupo.grupo)
    setBusca('')
    setView('titulos')
  }

  const voltarGrupos = () => {
    setView('grupos')
    setGrupoSelecionado(null)
    setBusca('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('grupos')
      setGrupoSelecionado(null)
    }
    onOpenChange(next)
  }

  const handleExportar = async () => {
    if (gruposAgg.length === 0) return
    setExportando(true)
    try {
      await exportAreaPrevistoGrupoExcel(gruposAgg, itens, clienteGrupoMap, {
        ano,
        mes,
        mesLabel,
        areaKey,
        areaLabel,
      })
    } catch (e) {
      setErrorItens(e instanceof Error ? e.message : 'Erro ao exportar planilha.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-violet-600 to-violet-700 px-6 py-4 pr-14 text-left">
          {view === 'titulos' && grupoSelecionado ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1.5 px-2 text-violet-100 hover:bg-white/10 hover:text-white"
                  onClick={voltarGrupos}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Grupos de empresas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 border-white/30 bg-white/10 text-xs text-white hover:bg-white/20 hover:text-white"
                  disabled={loadingItens || exportando || gruposAgg.length === 0}
                  onClick={() => void handleExportar()}
                >
                  {exportando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Excel
                </Button>
              </div>
              <SheetTitle className="text-base font-semibold text-white">{grupoSelecionado}</SheetTitle>
              <SheetDescription className="text-xs text-violet-100">
                {areaLabel} · {mesLabel} / {ano} · {grupoAtual?.quantidadeTitulos ?? titulosAgg.length}{' '}
                {(grupoAtual?.quantidadeTitulos ?? titulosAgg.length) === 1 ? 'título' : 'títulos'}
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(grupoAtual?.total ?? totalTitulosFiltrados)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                    <CalendarClock className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <SheetTitle className="text-base font-semibold text-white">
                      Previsto — {areaLabel}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-xs text-violet-100">
                      {mesLabel} / {ano} · por grupo de empresas
                    </SheetDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 border-white/30 bg-white/10 text-xs text-white hover:bg-white/20 hover:text-white"
                  disabled={loadingItens || exportando || gruposAgg.length === 0}
                  onClick={() => void handleExportar()}
                >
                  {exportando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Excel
                </Button>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {formatCurrency(totalPrevisto)}
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
                  view === 'grupos'
                    ? 'Buscar grupo de empresas…'
                    : 'Buscar título, cliente, descrição…'
                }
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {loadingItens && (
              <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                Carregando…
              </div>
            )}

            {errorItens && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {errorItens}
              </p>
            )}

            {view === 'grupos' && !loadingItens && !errorItens && gruposFiltrados.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {buscaDebounced
                  ? 'Nenhum grupo corresponde à busca.'
                  : 'Nenhum previsto nesta área no mês.'}
              </p>
            )}

            {view === 'grupos' && !loadingItens && !errorItens && gruposFiltrados.length > 0 && (
              <ul className="space-y-2 py-2">
                {gruposFiltrados.map((g) => (
                  <li key={g.grupo}>
                    <button
                      type="button"
                      onClick={() => abrirTitulos(g)}
                      className="group w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50/50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                          <Building2 className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800 group-hover:text-violet-900">
                              {g.grupo}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-violet-700">
                              {formatCurrency(g.total)}
                              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-violet-600" />
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {g.quantidadeTitulos}{' '}
                            {g.quantidadeTitulos === 1 ? 'título' : 'títulos'} · {g.quantidadeItens}{' '}
                            {g.quantidadeItens === 1 ? 'item' : 'itens'} · ver detalhamento
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {view === 'titulos' && !loadingItens && !errorItens && titulosFiltrados.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {buscaDebounced ? 'Nenhum título corresponde à busca.' : 'Nenhum título neste grupo.'}
              </p>
            )}

            {view === 'titulos' && !loadingItens && !errorItens && titulosFiltrados.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Título</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Cliente</th>
                      <th className="px-3 py-2">Vencimento</th>
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
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-violet-700">
                          {formatCurrency(titulo.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {view === 'grupos' && !loadingItens && gruposFiltrados.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {buscaDebounced
                    ? `${gruposFiltrados.length} de ${gruposAgg.length} grupos`
                    : `${gruposAgg.length} grupos`}
                </span>
                <span className="tabular-nums text-violet-800">{formatCurrency(totalGruposFiltrados)}</span>
              </div>
            </div>
          )}

          {view === 'titulos' && !loadingItens && titulosFiltrados.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {buscaDebounced
                    ? `${titulosFiltrados.length} de ${titulosAgg.length} títulos`
                    : `${titulosAgg.length} títulos`}
                </span>
                <span className="tabular-nums text-violet-800">{formatCurrency(totalTitulosFiltrados)}</span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
