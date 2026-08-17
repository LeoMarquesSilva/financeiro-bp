import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarClock,
  ChevronDown,
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
import { buildClienteGrupoMap, resolverGrupoCliente } from '../utils/recebidoGrupos'
import {
  agruparPrevistoPorTitulo,
  agruparPrevistoPorVencimentoEGrupo,
  filtrarPrevistoItensPorBusca,
  normalizePrevistoVencimentoKey,
  PREVISTO_SEM_VENCIMENTO_KEY,
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

type View = 'vencimentos' | 'titulos'

const labelVencimento = (vencimentoKey: string) =>
  vencimentoKey === PREVISTO_SEM_VENCIMENTO_KEY
    ? 'Sem data de vencimento'
    : formatDate(vencimentoKey)

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
  const [view, setView] = useState<View>('vencimentos')
  const [vencimentoExpandido, setVencimentoExpandido] = useState<string | null>(null)
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null)
  const [vencimentoSelecionado, setVencimentoSelecionado] = useState<string | null>(null)

  const [loadingItens, setLoadingItens] = useState(false)
  const [errorItens, setErrorItens] = useState<string | null>(null)
  const [itens, setItens] = useState<ReceitaPrevistoItemRow[]>([])
  const [clienteGrupoMap, setClienteGrupoMap] = useState<Map<string, string>>(new Map())

  const [busca, setBusca] = useState('')
  const [exportando, setExportando] = useState(false)
  const buscaDebounced = useDebounce(busca, 250)

  useEffect(() => {
    if (!open) {
      setView('vencimentos')
      setVencimentoExpandido(null)
      setGrupoSelecionado(null)
      setVencimentoSelecionado(null)
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

  const itensFiltrados = useMemo(
    () => filtrarPrevistoItensPorBusca(itens, buscaDebounced, clienteGrupoMap),
    [itens, buscaDebounced, clienteGrupoMap],
  )

  const vencimentosAgg = useMemo(
    () => agruparPrevistoPorVencimentoEGrupo(itensFiltrados, clienteGrupoMap),
    [itensFiltrados, clienteGrupoMap],
  )

  const totalVencimentosFiltrados = useMemo(
    () => vencimentosAgg.reduce((s, v) => s + v.total, 0),
    [vencimentosAgg],
  )

  const titulosAgg = useMemo(() => {
    if (!grupoSelecionado || !vencimentoSelecionado) return []
    const itensVencGrupo = itens.filter(
      (i) =>
        normalizePrevistoVencimentoKey(i.data_vencimento) === vencimentoSelecionado &&
        resolverGrupoCliente(i.cliente, clienteGrupoMap) === grupoSelecionado,
    )
    return agruparPrevistoPorTitulo(itensVencGrupo, grupoSelecionado, clienteGrupoMap)
  }, [itens, grupoSelecionado, vencimentoSelecionado, clienteGrupoMap])

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

  const grupoAtual = useMemo(() => {
    if (!grupoSelecionado || !vencimentoSelecionado) return null
    const venc = vencimentosAgg.find((v) => v.vencimentoKey === vencimentoSelecionado)
    return venc?.grupos.find((g) => g.grupo === grupoSelecionado) ?? null
  }, [vencimentosAgg, grupoSelecionado, vencimentoSelecionado])

  const abrirTitulos = (vencimentoKey: string, grupo: ReceitaPrevistoGrupoAgg) => {
    setVencimentoSelecionado(vencimentoKey)
    setGrupoSelecionado(grupo.grupo)
    setBusca('')
    setView('titulos')
  }

  const voltarVencimentos = () => {
    setView('vencimentos')
    setGrupoSelecionado(null)
    setVencimentoSelecionado(null)
    setBusca('')
  }

  const toggleVencimento = (vencimentoKey: string) => {
    setVencimentoExpandido((prev) => (prev === vencimentoKey ? null : vencimentoKey))
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('vencimentos')
      setVencimentoExpandido(null)
      setGrupoSelecionado(null)
      setVencimentoSelecionado(null)
    }
    onOpenChange(next)
  }

  const handleExportar = async () => {
    const gruposFlat = vencimentosAgg.flatMap((v) => v.grupos)
    if (gruposFlat.length === 0) return
    setExportando(true)
    try {
      await exportAreaPrevistoGrupoExcel(gruposFlat, itens, clienteGrupoMap, {
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
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-violet-600 to-violet-700 px-6 py-4 pr-16 text-left">
          {view === 'titulos' && grupoSelecionado && vencimentoSelecionado ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1.5 px-2 text-violet-100 hover:bg-white/10 hover:text-white"
                  onClick={voltarVencimentos}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Vencimentos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 border-white/30 bg-white/10 text-xs text-white hover:bg-white/20 hover:text-white"
                  disabled={loadingItens || exportando || vencimentosAgg.length === 0}
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
                {areaLabel} · {labelVencimento(vencimentoSelecionado)} · {mesLabel} / {ano} ·{' '}
                {grupoAtual?.quantidadeTitulos ?? titulosAgg.length}{' '}
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
                      {mesLabel} / {ano} · por vencimento e grupo
                    </SheetDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 border-white/30 bg-white/10 text-xs text-white hover:bg-white/20 hover:text-white"
                  disabled={loadingItens || exportando || vencimentosAgg.length === 0}
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
                  view === 'vencimentos'
                    ? 'Buscar vencimento ou grupo…'
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

            {view === 'vencimentos' && !loadingItens && !errorItens && vencimentosAgg.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {buscaDebounced
                  ? 'Nenhum vencimento ou grupo corresponde à busca.'
                  : 'Nenhum previsto nesta área no mês.'}
              </p>
            )}

            {view === 'vencimentos' && !loadingItens && !errorItens && vencimentosAgg.length > 0 && (
              <ul className="space-y-2 py-2">
                {vencimentosAgg.map((venc) => {
                  const expandido = vencimentoExpandido === venc.vencimentoKey
                  return (
                    <li key={venc.vencimentoKey} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleVencimento(venc.vencimentoKey)}
                        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-violet-50/40"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                          <Calendar className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {labelVencimento(venc.vencimentoKey)}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-violet-700">
                              {formatCurrency(venc.total)}
                              {expandido ? (
                                <ChevronDown className="h-4 w-4 text-violet-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {venc.grupos.length}{' '}
                            {venc.grupos.length === 1 ? 'grupo' : 'grupos'} · {venc.quantidadeTitulos}{' '}
                            {venc.quantidadeTitulos === 1 ? 'título' : 'títulos'}
                          </p>
                        </div>
                      </button>
                      {expandido && (
                        <ul className="border-t border-slate-100 bg-slate-50/40">
                          {venc.grupos.map((g) => (
                            <li key={`${venc.vencimentoKey}-${g.grupo}`}>
                              <button
                                type="button"
                                onClick={() => abrirTitulos(venc.vencimentoKey, g)}
                                className="group flex w-full items-start gap-3 border-t border-slate-100/80 px-3 py-2.5 pl-6 text-left transition-colors first:border-t-0 hover:bg-violet-50/50"
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-violet-700 shadow-sm">
                                  <Building2 className="h-3.5 w-3.5" aria-hidden />
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
                                  <p className="mt-0.5 text-[11px] text-slate-400">
                                    {g.quantidadeTitulos}{' '}
                                    {g.quantidadeTitulos === 1 ? 'título' : 'títulos'} ·{' '}
                                    {g.quantidadeItens} {g.quantidadeItens === 1 ? 'item' : 'itens'}
                                  </p>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
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

          {view === 'vencimentos' && !loadingItens && vencimentosAgg.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {vencimentosAgg.length}{' '}
                  {vencimentosAgg.length === 1 ? 'vencimento' : 'vencimentos'} ·{' '}
                  {vencimentosAgg.reduce((s, v) => s + v.grupos.length, 0)} grupos
                </span>
                <span className="tabular-nums text-violet-800">
                  {formatCurrency(totalVencimentosFiltrados)}
                </span>
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
