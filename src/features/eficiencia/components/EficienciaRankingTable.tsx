import { Users } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'

export type RankingColumn = {
  key: string
  label: string
  format?: (value: number) => string
  /** Quando true, exibe o valor da linha como texto puro (sem tentar converter para número). */
  text?: boolean
}

type Props = {
  title: string
  subtitle?: string
  rows: Array<Record<string, unknown>>
  usuarioKey?: string
  columns: RankingColumn[]
  loading?: boolean
  emptyLabel?: string
}

function formatCell(column: RankingColumn, raw: unknown): string {
  if (column.text) return String(raw ?? '')
  const num = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isNaN(num)) return String(raw ?? '')
  return column.format ? column.format(num) : String(num)
}

/** Divide o ranking em N colunas (ordem de cima para baixo em cada coluna). */
function splitIntoColumns<T>(items: T[], colCount: number): T[][] {
  if (items.length === 0) return []
  const cols = Math.max(1, Math.min(colCount, items.length))
  const perCol = Math.ceil(items.length / cols)
  return Array.from({ length: cols }, (_, c) => items.slice(c * perCol, (c + 1) * perCol))
}

export function EficienciaRankingTable({
  title,
  subtitle,
  rows,
  usuarioKey = 'usuario',
  columns,
  loading,
  emptyLabel = 'Sem dados no período.',
}: Props) {
  const indexed = rows.map((row, index) => ({ row, rank: index + 1 }))
  // 1 col no mobile; 2 no sm+; 3 no xl quando há linhas suficientes
  const colCount = rows.length >= 18 ? 3 : rows.length >= 8 ? 2 : 1
  const columnChunks = splitIntoColumns(indexed, colCount)

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Users className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {loading ? (
        <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div
          className={
            columnChunks.length === 1
              ? 'grid grid-cols-1'
              : columnChunks.length === 2
                ? 'grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2'
                : 'grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3'
          }
        >
          {columnChunks.map((chunk, colIdx) => (
            <div key={colIdx} className="min-w-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="w-6 py-1 pr-1.5 font-medium">#</th>
                    <th className="py-1 pr-2 font-medium">Usuário</th>
                    {columns.map((c) => (
                      <th key={c.key} className="py-1 pl-1 text-right font-medium whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chunk.map(({ row, rank }) => (
                    <tr key={rank} className="border-b border-slate-50 last:border-0 text-slate-700">
                      <td className="py-1 pr-1.5 tabular-nums text-slate-400">{rank}</td>
                      <td
                        className="max-w-[9rem] truncate py-1 pr-2 font-medium text-slate-800 sm:max-w-[11rem]"
                        title={String(row[usuarioKey] ?? '')}
                      >
                        {String(row[usuarioKey] ?? '')}
                      </td>
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className="py-1 pl-1 text-right tabular-nums whitespace-nowrap"
                          title={formatCell(c, row[c.key])}
                        >
                          {formatCell(c, row[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function pctColumn(key: string, label: string): RankingColumn {
  return { key, label, format: (v) => formatPercent(v) }
}
