import { useEffect, useMemo, useState } from 'react'
import { Target } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import { mesNome, RECEITA_COLORS } from '../constants'
import { calcularAtingimentoMetaKpi } from '../utils/receitaAcumuladoChart'
import { isMesFuturo } from '../utils/receitaMes'
import type { ReceitaMesRow } from '../types/receita.types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  rows: ReceitaMesRow[]
  mesesIncluidos: Set<number> | null
  onAplicar: (meses: Set<number>) => void
}

function periodoMesesLabel(meses: number[], ano: number): string {
  const sorted = [...meses].sort((a, b) => a - b)
  if (sorted.length === 0) return String(ano)
  const cap = (m: number) => {
    const n = mesNome(m)
    return n.charAt(0).toUpperCase() + n.slice(1)
  }
  const ini = cap(sorted[0]!)
  const fim = cap(sorted[sorted.length - 1]!)
  if (sorted.length === 1) return `${ini}/${String(ano).slice(-2)}`
  return `${ini}–${fim}/${String(ano).slice(-2)}`
}

export function ReceitaAtingimentoMetaDetalheSheet({
  open,
  onOpenChange,
  ano,
  rows,
  mesesIncluidos,
  onAplicar,
}: Props) {
  const base = useMemo(() => calcularAtingimentoMetaKpi(ano, rows), [ano, rows])

  const mesesDisponiveis = useMemo(
    () =>
      rows
        .filter((r) => r.metaBase > 0 && !isMesFuturo(ano, r.mes))
        .sort((a, b) => a.mes - b.mes),
    [rows, ano],
  )

  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) return
    const inicial =
      mesesIncluidos && mesesIncluidos.size > 0
        ? new Set(mesesIncluidos)
        : new Set(base.mesesMetaDecorridos)
    setSelecionados(inicial)
  }, [open, mesesIncluidos, base.mesesMetaDecorridos])

  const preview = useMemo(
    () => calcularAtingimentoMetaKpi(ano, rows, new Date(), selecionados),
    [ano, rows, selecionados],
  )

  const todosMarcados =
    mesesDisponiveis.length > 0 && mesesDisponiveis.every((r) => selecionados.has(r.mes))
  const algumMarcado = mesesDisponiveis.some((r) => selecionados.has(r.mes))
  const indeterminateHeader = algumMarcado && !todosMarcados

  const toggleMes = (mes: number) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(mes)) next.delete(mes)
      else next.add(mes)
      return next
    })
  }

  const toggleTodos = () => {
    if (todosMarcados) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(mesesDisponiveis.map((r) => r.mes)))
    }
  }

  const pctColor =
    preview.pct >= 100
      ? RECEITA_COLORS.meta.textStrong
      : preview.pct >= 80
        ? RECEITA_COLORS.meta.text
        : 'text-emerald-600'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg md:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <SheetTitle className="flex items-center gap-2 text-left">
            <Target className={cn('h-5 w-5 shrink-0', RECEITA_COLORS.meta.text)} aria-hidden />
            Atingimento da meta — {ano}
          </SheetTitle>
          <SheetDescription className="text-left">
            Selecione os meses para compor o recebido. O percentual é calculado sobre a meta anual de{' '}
            {formatCurrency(base.metaAnual)} (Jun–Dez).
          </SheetDescription>
        </SheetHeader>

        <div className="border-y border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Atingimento selecionado
              </p>
              <p className={cn('text-xl font-bold tabular-nums', pctColor)}>{formatPercent(preview.pct)}</p>
              <p className="text-xs text-slate-600">{formatCurrency(preview.recebidoAcumulado)} recebidos</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Meta {formatCurrencyCompact(base.metaAnual)} ·{' '}
                {periodoMesesLabel(preview.mesesSelecionados, ano) || 'Nenhum mês'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={toggleTodos}>
                {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-2 sm:px-6">
          {mesesDisponiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum mês com meta disponível.</p>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm">
                <Checkbox
                  checked={todosMarcados}
                  indeterminate={indeterminateHeader}
                  onCheckedChange={toggleTodos}
                  aria-label="Selecionar todos os meses"
                />
                <span className="flex-1">Mês</span>
                <span className="shrink-0 w-24 text-right">Recebido</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {mesesDisponiveis.map((r) => {
                  const marcado = selecionados.has(r.mes)
                  return (
                    <li
                      key={r.mes}
                      className={cn(
                        'py-2.5 text-sm transition-colors',
                        marcado ? 'opacity-100' : 'opacity-55',
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => toggleMes(r.mes)}
                          aria-label={`Incluir ${mesNome(r.mes)} na conta`}
                        />
                        <span className="min-w-0 flex-1 font-medium text-slate-900">
                          {mesNome(r.mes)}/{String(ano).slice(-2)}
                        </span>
                        <span className="shrink-0 w-24 text-right font-semibold tabular-nums text-slate-900">
                          {formatCurrency(r.recebido)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-slate-200 bg-slate-50 px-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={selecionados.size === 0}
            onClick={() => {
              onAplicar(new Set(selecionados))
              onOpenChange(false)
            }}
          >
            Aplicar ({formatPercent(preview.pct)})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
