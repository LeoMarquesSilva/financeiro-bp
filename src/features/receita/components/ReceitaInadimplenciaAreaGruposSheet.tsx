import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency } from '@/shared/utils/format'
import { mesNome } from '../constants'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import type {
  ReceitaInadimplenciaClienteDepartamentoPeriodo,
  ReceitaInadimplenciaGrupoDepartamentoPeriodo,
  ReceitaInadimplenciaGrupoMes,
} from '../types/receitaInadimplencia.types'
import {
  departamentoMatchesAreaKey,
  gruposAlocadosPorArea,
} from '../utils/receitaInadimplenciaAreaFilter'
import { ReceitaInadimplenciaClienteTitulosDetalhe } from './ReceitaInadimplenciaClienteTitulosDetalhe'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  areaKey: string
  areaLabel: string
  ano: number
  mesInicio: number
  mesFim: number
  mesDetalhe?: number | null
  periodoLabel: string
  valorTotal: number
  gruposDeptPorMes: Record<number, ReceitaInadimplenciaGrupoDepartamentoPeriodo[]>
  gruposPorMes: Record<number, ReceitaInadimplenciaGrupoMes[]>
  loading?: boolean
}

type EmpresaArea = {
  cliente: string
  valor: number
}

function AreaGrupoEmpresasDetalhe({
  ano,
  mesInicio,
  mesFim,
  areaKey,
  empresas,
}: {
  ano: number
  mesInicio: number
  mesFim: number
  areaKey: string
  empresas: EmpresaArea[]
}) {
  const [expandido, setExpandido] = useState<string | null>(null)

  if (empresas.length === 0) {
    return (
      <p className="py-2 pl-7 text-xs text-slate-500">
        Nenhuma empresa com inadimplência nesta área neste grupo.
      </p>
    )
  }

  return (
    <div className="mb-2 mt-1 space-y-2 border-l-2 border-slate-200 pl-3 ml-7">
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
                  areaKey={areaKey}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ReceitaInadimplenciaAreaGruposSheet({
  open,
  onOpenChange,
  areaKey,
  areaLabel,
  ano,
  mesInicio,
  mesFim,
  mesDetalhe = null,
  periodoLabel,
  valorTotal,
  gruposDeptPorMes,
  gruposPorMes,
  loading = false,
}: Props) {
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [clientesDept, setClientesDept] = useState<ReceitaInadimplenciaClienteDepartamentoPeriodo[]>([])
  const [clientesDeptLoading, setClientesDeptLoading] = useState(false)
  const [clientesDeptError, setClientesDeptError] = useState<string | null>(null)

  const buscaDebounced = useDebounce(busca, 250)

  const mesInicioEff = mesDetalhe ?? mesInicio
  const mesFimEff = mesDetalhe ?? mesFim

  const mesesEscopo = useMemo(() => {
    if (mesDetalhe != null) return [mesDetalhe]
    if (mesFim < mesInicio) return []
    return Array.from({ length: mesFim - mesInicio + 1 }, (_, i) => mesInicio + i)
  }, [mesDetalhe, mesInicio, mesFim])

  const tituloPeriodo =
    mesDetalhe != null ? `${mesNome(mesDetalhe)}/${String(ano).slice(-2)}` : periodoLabel

  const grupos = useMemo(
    () => gruposAlocadosPorArea(gruposDeptPorMes, gruposPorMes, areaKey, mesesEscopo),
    [gruposDeptPorMes, gruposPorMes, areaKey, mesesEscopo],
  )

  useEffect(() => {
    if (!open) {
      setBusca('')
      setExpandido(null)
      return
    }
    let cancelled = false
    setClientesDeptLoading(true)
    setClientesDeptError(null)
    receitaInadimplenciaService
      .fetchClientesDepartamentoPeriodo(ano, mesInicioEff, mesFimEff, true)
      .then((data) => {
        if (!cancelled) setClientesDept(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === 'object' && e !== null && 'message' in e
                ? String((e as { message: unknown }).message)
                : 'Erro ao carregar empresas.'
          setClientesDeptError(msg)
          setClientesDept([])
        }
      })
      .finally(() => {
        if (!cancelled) setClientesDeptLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mesInicioEff, mesFimEff])

  const empresasPorGrupo = useMemo(() => {
    const map = new Map<string, EmpresaArea[]>()
    for (const row of clientesDept) {
      if (!departamentoMatchesAreaKey(row.departamento, areaKey)) continue
      const list = map.get(row.grupo_cliente) ?? []
      const prev = list.find((e) => e.cliente === row.cliente)
      if (prev) {
        prev.valor = Math.round((prev.valor + row.inadimplencia) * 100) / 100
      } else {
        list.push({ cliente: row.cliente, valor: row.inadimplencia })
      }
      map.set(row.grupo_cliente, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.valor - a.valor || a.cliente.localeCompare(b.cliente, 'pt-BR'))
    }
    return map
  }, [clientesDept, areaKey])

  const filtrados = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase()
    if (!termo) return grupos
    return grupos.filter((g) => {
      if (g.grupo_cliente.toLowerCase().includes(termo)) return true
      const lista = empresasPorGrupo.get(g.grupo_cliente) ?? []
      return lista.some((e) => e.cliente.toLowerCase().includes(termo))
    })
  }, [grupos, buscaDebounced, empresasPorGrupo])

  const listaLoading = loading || clientesDeptLoading

  const toggleExpand = (grupo: string) => {
    setExpandido((prev) => (prev === grupo ? null : grupo))
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
          <SheetTitle>
            Grupos inadimplentes — {tituloPeriodo} · {areaLabel}
          </SheetTitle>
          <SheetDescription>
            {grupos.length} grupo{grupos.length === 1 ? '' : 's'} · {formatCurrency(valorTotal)}
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Somente grupos com inadimplência alocada à área {areaLabel} no período {tituloPeriodo}{' '}
              (regra VIOS: departamento do item no título). Inclui clientes inativos.
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-y border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
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
          {listaLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando grupos...
            </div>
          ) : clientesDeptError && filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-rose-600">{clientesDeptError}</p>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {buscaDebounced.trim()
                ? 'Nenhum grupo corresponde à busca.'
                : 'Nenhum grupo com inadimplência alocada à área neste período.'}
            </p>
          ) : (
            <>
              {clientesDeptError && (
                <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Não foi possível carregar empresas por área ({clientesDeptError}). A lista de
                  grupos permanece disponível; expanda um grupo para tentar ver títulos.
                </p>
              )}
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm">
                <span className="w-4 shrink-0" aria-hidden />
                <span className="flex-1">Grupo</span>
                <span className="shrink-0">Valor alocado</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {filtrados.map((g) => {
                  const aberto = expandido === g.grupo_cliente
                  const listaEmpresas = empresasPorGrupo.get(g.grupo_cliente) ?? []
                  return (
                    <li key={g.grupo_cliente} className="py-2.5 text-sm">
                      <div className="flex items-start gap-2">
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
                              {listaEmpresas.length || g.qtd_clientes} empresa
                              {(listaEmpresas.length || g.qtd_clientes) > 1 ? 's' : ''}
                              {g.qtd_meses > 1 ? ` · inadimplente em ${g.qtd_meses} meses` : ''}
                              {g.valor_total_grupo > g.valor + 0.01 && (
                                <span>
                                  {' '}
                                  · total grupo {formatCurrency(g.valor_total_grupo)}
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                            {formatCurrency(g.valor)}
                          </span>
                        </button>
                      </div>
                      {aberto && (
                        <AreaGrupoEmpresasDetalhe
                          ano={ano}
                          mesInicio={mesInicioEff}
                          mesFim={mesFimEff}
                          areaKey={areaKey}
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
          <Button type="button" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Fechar ({formatCurrency(valorTotal)})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
