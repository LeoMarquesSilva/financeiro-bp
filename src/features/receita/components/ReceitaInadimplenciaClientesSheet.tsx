import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Loader2, Search } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency } from '@/shared/utils/format'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import type {
  ReceitaInadimplenciaClientePeriodo,
  ReceitaInadimplenciaGrupoPeriodo,
} from '../types/receitaInadimplencia.types'
import { gruposPeriodoPadrao } from '../utils/receitaInadimplenciaCalc'
import { exportClientesPeriodoExcel } from '../utils/receitaInadimplenciaExport'
import { ReceitaInadimplenciaClienteTitulosDetalhe } from './ReceitaInadimplenciaClienteTitulosDetalhe'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mesInicio: number
  mesFim: number
  periodoLabel: string
  incluidos: Set<string> | null
  onGruposLoaded: (grupos: ReceitaInadimplenciaGrupoPeriodo[]) => void
  onIncluidosChange: (incluidos: Set<string>) => void
  onAplicarSelecao: (incluidos: Set<string>) => void
}

function GrupoEmpresasDetalhe({
  ano,
  mesInicio,
  mesFim,
  grupo,
  empresas,
}: {
  ano: number
  mesInicio: number
  mesFim: number
  grupo: string
  empresas: ReceitaInadimplenciaClientePeriodo[]
}) {
  const [expandido, setExpandido] = useState<string | null>(null)

  if (empresas.length === 0) {
    return <p className="py-2 pl-9 text-xs text-slate-500">Nenhuma empresa com inadimplência neste grupo.</p>
  }

  return (
    <div className="mb-2 mt-1 space-y-2 border-l-2 border-slate-200 pl-3 ml-7">
      <p className="text-[11px] text-slate-500">
        Empresas de {grupo} — valores por razão social (o total do grupo consolida todas as empresas).
      </p>
      <ul className="space-y-1">
        {empresas.map((e) => {
          const aberto = expandido === e.cliente
          return (
            <li key={e.cliente} className="rounded-md bg-slate-50/80">
              <button
                type="button"
                onClick={() => setExpandido(aberto ? null : e.cliente)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {aberto ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                  <span className="truncate font-medium text-slate-800">{e.cliente}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {formatCurrency(e.valor)}
                </span>
              </button>
              {aberto && (
                <ReceitaInadimplenciaClienteTitulosDetalhe
                  ano={ano}
                  mesInicio={mesInicio}
                  mesFim={mesFim}
                  cliente={e.cliente}
                  valorPeriodo={e.valor}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ReceitaInadimplenciaClientesSheet({
  open,
  onOpenChange,
  ano,
  mesInicio,
  mesFim,
  periodoLabel,
  incluidos,
  onGruposLoaded,
  onIncluidosChange,
  onAplicarSelecao,
}: Props) {
  const { role } = useAuth()
  const canEditSelecao = role === 'admin' || role === 'financeiro'
  const [grupos, setGrupos] = useState<ReceitaInadimplenciaGrupoPeriodo[]>([])
  const [empresas, setEmpresas] = useState<ReceitaInadimplenciaClientePeriodo[]>([])
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const buscaDebounced = useDebounce(busca, 250)

  useEffect(() => {
    if (!open) {
      setBusca('')
      setExpandido(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    receitaInadimplenciaService
      .fetchGruposPeriodo(ano, mesInicio, mesFim)
      .then(async (dataGrupos) => {
        if (cancelled) return
        const dataEmpresas = await receitaInadimplenciaService.fetchClientesPeriodo(ano, mesInicio, mesFim)
        if (cancelled) return
        setGrupos(dataGrupos)
        setEmpresas(dataEmpresas)
        onGruposLoaded(dataGrupos)
        if (incluidos == null) {
          const salvos = await receitaInadimplenciaService.fetchSelecaoPeriodo(ano, mesInicio, mesFim)
          if (cancelled) return
          if (salvos) onIncluidosChange(new Set(salvos))
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar grupos.')
          setGrupos([])
          setEmpresas([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // incluidos omitido: não reinicializar seleção ao abrir de novo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ano, mesInicio, mesFim, onGruposLoaded, onIncluidosChange])

  const empresasPorGrupo = useMemo(() => {
    const map = new Map<string, ReceitaInadimplenciaClientePeriodo[]>()
    for (const e of empresas) {
      const list = map.get(e.grupo_cliente) ?? []
      list.push(e)
      map.set(e.grupo_cliente, list)
    }
    return map
  }, [empresas])

  const incluidosAtivos = incluidos ?? gruposPeriodoPadrao(grupos)

  const filtrados = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase()
    const base = [...grupos]
    if (!termo) return base
    return base.filter((g) => {
      if (g.grupo_cliente.toLowerCase().includes(termo)) return true
      const lista = empresasPorGrupo.get(g.grupo_cliente) ?? []
      return lista.some((e) => e.cliente.toLowerCase().includes(termo))
    })
  }, [grupos, buscaDebounced, empresasPorGrupo])

  const totalSelecionado = useMemo(
    () => grupos.filter((g) => incluidosAtivos.has(g.grupo_cliente)).reduce((s, g) => s + g.valor, 0),
    [grupos, incluidosAtivos],
  )

  const qtdSelecionados = useMemo(
    () => grupos.filter((g) => incluidosAtivos.has(g.grupo_cliente)).length,
    [grupos, incluidosAtivos],
  )

  const todosFiltradosMarcados =
    filtrados.length > 0 && filtrados.every((g) => incluidosAtivos.has(g.grupo_cliente))
  const algumFiltradoMarcado = filtrados.some((g) => incluidosAtivos.has(g.grupo_cliente))
  const indeterminateHeader = algumFiltradoMarcado && !todosFiltradosMarcados

  const toggleGrupo = (grupo: string) => {
    const next = new Set(incluidosAtivos)
    if (next.has(grupo)) next.delete(grupo)
    else next.add(grupo)
    onIncluidosChange(next)
  }

  const toggleFiltrados = () => {
    const next = new Set(incluidosAtivos)
    if (todosFiltradosMarcados) {
      filtrados.forEach((g) => next.delete(g.grupo_cliente))
    } else {
      filtrados.forEach((g) => next.add(g.grupo_cliente))
    }
    onIncluidosChange(next)
  }

  const selecionarTodos = () => onIncluidosChange(gruposPeriodoPadrao(grupos))
  const limparSelecao = () => onIncluidosChange(new Set())

  const toggleExpand = (grupo: string) => {
    setExpandido((prev) => (prev === grupo ? null : grupo))
  }

  const handleExportar = async () => {
    if (empresas.length === 0) return
    setExportando(true)
    try {
      const incluidosEmpresas = new Set(
        empresas.filter((e) => incluidosAtivos.has(e.grupo_cliente)).map((e) => e.cliente),
      )
      await exportClientesPeriodoExcel(empresas, incluidosEmpresas, { periodoLabel, ano })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar planilha.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setBusca('')
          setExpandido(null)
        }
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg md:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <SheetTitle>Grupos inadimplentes — {periodoLabel}</SheetTitle>
          <SheetDescription>
            {qtdSelecionados} de {grupos.length} na conta · {formatCurrency(totalSelecionado)}
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Saldo consolidado por grupo no período {periodoLabel}. O total do grupo pode diferir da
              soma por razão social quando há troca de cadastro (ex.: Artico → Atmos).
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-y border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={loading || exportando || empresas.length === 0}
              onClick={() => void handleExportar()}
            >
              {exportando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Exportar Excel
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={selecionarTodos} disabled={!canEditSelecao}>
              Marcar todos
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={limparSelecao} disabled={!canEditSelecao}>
              Desmarcar todos
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar grupo ou empresa..."
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-2 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando grupos...
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-rose-600">{error}</p>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum grupo inadimplente no período.</p>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm">
                <Checkbox
                  checked={todosFiltradosMarcados}
                  indeterminate={indeterminateHeader}
                  onCheckedChange={toggleFiltrados}
                  disabled={!canEditSelecao}
                  aria-label="Selecionar grupos filtrados"
                />
                <span className="flex-1">Incluir na conta</span>
                <span className="shrink-0">Valor</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {filtrados.map((g) => {
                  const marcado = incluidosAtivos.has(g.grupo_cliente)
                  const aberto = expandido === g.grupo_cliente
                  const listaEmpresas = empresasPorGrupo.get(g.grupo_cliente) ?? []
                  return (
                    <li
                      key={g.grupo_cliente}
                      className={cn(
                        'py-2.5 text-sm transition-colors',
                        marcado ? 'opacity-100' : 'opacity-55',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => toggleGrupo(g.grupo_cliente)}
                          disabled={!canEditSelecao}
                          className="mt-0.5"
                          aria-label={`Incluir ${g.grupo_cliente} na conta`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleExpand(g.grupo_cliente)}
                          className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-expanded={aberto}
                          aria-label={aberto ? 'Ocultar empresas' : 'Ver empresas do grupo'}
                        >
                          {aberto ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpand(g.grupo_cliente)}
                          className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-900">{g.grupo_cliente}</p>
                            <p className="text-xs text-slate-500">
                              {g.qtd_clientes} empresa{g.qtd_clientes > 1 ? 's' : ''}
                              {g.qtd_meses > 1 ? ` · inadimplente em ${g.qtd_meses} meses` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                            {formatCurrency(g.valor)}
                          </span>
                        </button>
                      </div>
                      {aberto && (
                        <GrupoEmpresasDetalhe
                          ano={ano}
                          mesInicio={mesInicio}
                          mesFim={mesFim}
                          grupo={g.grupo_cliente}
                          empresas={listaEmpresas}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-slate-200 bg-slate-50 px-4 sm:px-6">
          {canEditSelecao ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                onAplicarSelecao(incluidosAtivos)
                onOpenChange(false)
              }}
            >
              Aplicar ({formatCurrency(totalSelecionado)})
            </Button>
          ) : (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
