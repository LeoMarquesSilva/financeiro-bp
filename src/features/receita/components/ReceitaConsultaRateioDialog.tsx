import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, PieChart, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { MESES_ABREV, RECEITA_DEPARTAMENTO_CORES } from '../constants'
import { useReceitaRateioConsulta } from '../hooks/useReceitaRateioConsulta'
import {
  buildReceitaMetaAreaSlices,
  type ReceitaMetaAreaSlice,
} from '../utils/departamentoAreaCores'
import {
  RECEITA_RATEIO_OUTRAS_KEY,
  type ReceitaRateioGrupoRow,
} from '../utils/receitaRateioConsulta'
import type { ReceitaDepartamentoCoresConfig } from '../types/receita.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  departamentoCores?: ReceitaDepartamentoCoresConfig
}

function mesPadrao(ano: number): number {
  const hoje = new Date()
  if (hoje.getFullYear() === ano) return hoje.getMonth() + 1
  return 12
}

function celulaPct(pct: number | undefined): string {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return '—'
  return formatPercent(pct)
}

function pctArea(grupo: ReceitaRateioGrupoRow, areaKey: string): number {
  const v = grupo.pctPorArea[areaKey]
  if (v == null || !Number.isFinite(v)) return 0
  return v
}

type SortDir = 'asc' | 'desc'

export function ReceitaConsultaRateioDialog({
  open,
  onOpenChange,
  ano,
  departamentoCores,
}: Props) {
  const [mes, setMes] = useState(() => mesPadrao(ano))
  const [busca, setBusca] = useState('')
  const [sortArea, setSortArea] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const buscaDebounced = useDebounce(busca, 250)

  const { grupos, hasOutras, isLoading, error } = useReceitaRateioConsulta(ano, mes, open)

  const areaSlices = useMemo(
    () => buildReceitaMetaAreaSlices(departamentoCores ?? RECEITA_DEPARTAMENTO_CORES),
    [departamentoCores],
  )

  const colunas: ReceitaMetaAreaSlice[] = useMemo(() => {
    if (!hasOutras) return areaSlices
    return [
      ...areaSlices,
      {
        key: RECEITA_RATEIO_OUTRAS_KEY,
        pct: 0,
        label: 'Outras',
        color: '#64748b',
      },
    ]
  }, [areaSlices, hasOutras])

  useEffect(() => {
    if (!open) return
    setMes(mesPadrao(ano))
    setBusca('')
    setSortArea(null)
    setSortDir('desc')
  }, [open, ano])

  const gruposFiltrados = useMemo((): ReceitaRateioGrupoRow[] => {
    const q = buscaDebounced.trim().toLowerCase()
    const filtrados = q
      ? grupos.filter((g) => g.grupo_cliente.toLowerCase().includes(q))
      : grupos
    if (!sortArea) return filtrados
    const sign = sortDir === 'asc' ? 1 : -1
    return [...filtrados].sort((a, b) => {
      const cmp = pctArea(a, sortArea) - pctArea(b, sortArea)
      if (cmp !== 0) return cmp * sign
      return a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR')
    })
  }, [grupos, buscaDebounced, sortArea, sortDir])

  const handleSortArea = (areaKey: string) => {
    if (sortArea === areaKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortArea(areaKey)
    setSortDir('desc')
  }

  const totalMes = useMemo(
    () => gruposFiltrados.reduce((s, g) => s + g.total, 0),
    [gruposFiltrados],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        className="flex h-[min(90vh,90vw)] w-[min(90vh,90vw)] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-slate-500" aria-hidden />
            Consulta Rateio
          </DialogTitle>
          <DialogDescription>
            Rateio por área dos títulos lançados no mês (vencimento na cota), agrupado por grupo
            cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-6 pt-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Meses">
            {MESES_ABREV.map((label, idx) => {
              const valor = idx + 1
              const ativo = valor === mes
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => setMes(valor)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                    ativo
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                  )}
                >
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar grupo cliente"
                className="h-8 pl-8 text-sm"
                aria-label="Buscar grupo cliente"
              />
            </div>
            <p className="shrink-0 text-xs text-slate-500">
              {gruposFiltrados.length} grupo{gruposFiltrados.length === 1 ? '' : 's'}
              {totalMes > 0 ? ` · ${formatCurrency(totalMes)}` : ''}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
            {isLoading ? (
              <div className="flex h-full min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando rateios…
              </div>
            ) : error ? (
              <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-center text-sm text-red-700">
                {error instanceof Error ? error.message : 'Não foi possível carregar os rateios.'}
              </div>
            ) : gruposFiltrados.length === 0 ? (
              <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-center text-sm text-slate-500">
                Nenhum título lançado neste mês.
              </div>
            ) : (
              <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 min-w-[160px] bg-white">
                      Grupo cliente
                    </TableHead>
                    {colunas.map((area) => {
                      const ativo = sortArea === area.key
                      const SortIcon = ativo
                        ? sortDir === 'asc'
                          ? ArrowUp
                          : ArrowDown
                        : ArrowUpDown
                      return (
                        <TableHead key={area.key} className="min-w-[92px] p-0 text-center">
                          <button
                            type="button"
                            onClick={() => handleSortArea(area.key)}
                            aria-sort={
                              ativo ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                            }
                            title={`Ordenar por ${area.label}`}
                            className={cn(
                              'inline-flex h-10 w-full items-center justify-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-slate-800',
                              ativo ? 'text-slate-800' : 'text-slate-500',
                            )}
                          >
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: area.color }}
                              aria-hidden
                            />
                            <span className="max-w-[7.5rem] truncate" title={area.label}>
                              {area.label}
                            </span>
                            <SortIcon
                              className={cn('h-3 w-3 shrink-0', !ativo && 'opacity-40')}
                              aria-hidden
                            />
                          </button>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gruposFiltrados.map((grupo) => (
                    <TableRow key={grupo.grupo_cliente}>
                      <TableCell className="sticky left-0 bg-white font-medium text-slate-900">
                        <span className="block max-w-[220px] truncate" title={grupo.grupo_cliente}>
                          {grupo.grupo_cliente}
                        </span>
                      </TableCell>
                      {colunas.map((area) => {
                        const pct = grupo.pctPorArea[area.key]
                        const valor = grupo.valorPorArea[area.key] ?? 0
                        const label = celulaPct(pct)
                        return (
                          <TableCell
                            key={area.key}
                            className="text-center tabular-nums text-slate-800"
                          >
                            {valor > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default">{label}</span>
                                </TooltipTrigger>
                                <TooltipContent className="z-[80]">
                                  {formatCurrency(valor)}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              label
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TooltipProvider>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
