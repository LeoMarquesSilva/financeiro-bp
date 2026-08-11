import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { GestaoVistaMesRow } from '../types/receita.types'
import { semaforoPctNivel } from '../utils/receitaGestaoVista'

export type GestaoVistaMesClickColuna = 'recebido' | 'previsto'

type Props = {
  meses: GestaoVistaMesRow[]
  totalYtd: GestaoVistaMesRow | null
  onMesClick?: (row: GestaoVistaMesRow, coluna: GestaoVistaMesClickColuna) => void
  loading?: boolean
}

function SemaforoCelula({ pct }: { pct: number | null }) {
  const nivel = semaforoPctNivel(pct)
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.5rem] justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        nivel === 'verde' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        nivel === 'ambar' && 'border-amber-200 bg-amber-50 text-amber-800',
        nivel === 'vermelho' && 'border-red-200 bg-red-50 text-red-800',
        nivel === 'neutro' && 'border-transparent text-slate-400',
      )}
    >
      {pct != null ? formatPercent(pct) : '—'}
    </span>
  )
}

function MoedaCelula({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-slate-400">—</span>
  return <span className="tabular-nums">{formatCurrency(valor)}</span>
}

function TabelaSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="h-10 animate-pulse border-b border-slate-100 bg-slate-50" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-9 animate-pulse border-b border-slate-50 bg-white" />
      ))}
    </div>
  )
}

const COLS = [
  'Mês',
  'Meta',
  'Previsto',
  'Recebido',
  '% Meta',
  '% Previsto',
  'Inad.',
  'Inad. %',
] as const

export function ReceitaGestaoAVistaTabela({ meses, totalYtd, onMesClick, loading }: Props) {
  if (loading) return <TabelaSkeleton />

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {COLS.map((col) => (
                <th
                  key={col}
                  className={cn(
                    'whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:px-4 sm:text-[11px]',
                    col !== 'Mês' && 'text-right',
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meses.map((row) => {
              const clicavelRecebido =
                onMesClick != null && row.recebido != null && row.recebido > 0
              const clicavelPrevisto = onMesClick != null && row.previsto > 0

              const cellClicavelClass =
                'cursor-pointer transition-colors hover:bg-sky-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50'

              const handleCellClick = (coluna: GestaoVistaMesClickColuna) => {
                if (!onMesClick) return
                if (coluna === 'recebido' && !clicavelRecebido) return
                if (coluna === 'previsto' && !clicavelPrevisto) return
                onMesClick(row, coluna)
              }

              return (
                <tr key={row.mes} className="border-b border-slate-100 transition-colors">
                  <td className="whitespace-nowrap px-3 py-2 font-medium capitalize text-slate-800 sm:px-4">
                    {row.mesLabel}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700 sm:px-4">
                    <MoedaCelula valor={row.meta} />
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums text-slate-700 sm:px-4',
                      clicavelPrevisto && cellClicavelClass,
                    )}
                    onClick={clicavelPrevisto ? () => handleCellClick('previsto') : undefined}
                    onKeyDown={
                      clicavelPrevisto
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleCellClick('previsto')
                            }
                          }
                        : undefined
                    }
                    tabIndex={clicavelPrevisto ? 0 : undefined}
                    role={clicavelPrevisto ? 'button' : undefined}
                    title={clicavelPrevisto ? 'Ver composição do previsto' : undefined}
                  >
                    {formatCurrency(row.previsto)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums text-slate-800 sm:px-4',
                      clicavelRecebido && cellClicavelClass,
                    )}
                    onClick={clicavelRecebido ? () => handleCellClick('recebido') : undefined}
                    onKeyDown={
                      clicavelRecebido
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleCellClick('recebido')
                            }
                          }
                        : undefined
                    }
                    tabIndex={clicavelRecebido ? 0 : undefined}
                    role={clicavelRecebido ? 'button' : undefined}
                    title={clicavelRecebido ? 'Ver composição do recebido' : undefined}
                  >
                    <MoedaCelula valor={row.recebido} />
                  </td>
                  <td className="px-3 py-2 text-right sm:px-4">
                    <SemaforoCelula pct={row.pctMeta} />
                  </td>
                  <td className="px-3 py-2 text-right sm:px-4">
                    <SemaforoCelula pct={row.pctPrevisto} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums sm:px-4">
                    {row.inadimplencia != null ? (
                      formatCurrency(row.inadimplencia)
                    ) : row.congelado ? (
                      formatCurrency(0)
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-slate-400">—</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          Mês ainda não congelado — snapshot disponível após fechamento na aba
                          Inadimplência.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right sm:px-4">
                    {row.inadimplenciaPct != null ? (
                      formatPercent(row.inadimplenciaPct)
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {totalYtd && (
              <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold">
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-900 sm:px-4">{totalYtd.mesLabel}</td>
                <td className="px-3 py-2.5 text-right tabular-nums sm:px-4">
                  <MoedaCelula valor={totalYtd.meta} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums sm:px-4">
                  {formatCurrency(totalYtd.previsto)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums sm:px-4">
                  <MoedaCelula valor={totalYtd.recebido} />
                </td>
                <td className="px-3 py-2.5 text-right sm:px-4">
                  <SemaforoCelula pct={totalYtd.pctMeta} />
                </td>
                <td className="px-3 py-2.5 text-right sm:px-4">
                  <SemaforoCelula pct={totalYtd.pctPrevisto} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums sm:px-4">
                  <MoedaCelula valor={totalYtd.inadimplencia} />
                </td>
                <td className="px-3 py-2.5 text-right sm:px-4">
                  {totalYtd.inadimplenciaPct != null ? (
                    formatPercent(totalYtd.inadimplenciaPct)
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  )
}
