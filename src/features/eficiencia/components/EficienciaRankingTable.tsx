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

export function EficienciaRankingTable({
  title,
  subtitle,
  rows,
  usuarioKey = 'usuario',
  columns,
  loading,
  emptyLabel = 'Sem dados no período.',
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-start gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Users className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Usuário</th>
                {columns.map((c) => (
                  <th key={c.key} className="py-2 pr-3 text-right font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, i) => (
                <tr key={i} className="text-slate-700">
                  <td className="py-2 pr-3 font-medium text-slate-900">
                    {String(row[usuarioKey] ?? '')}
                  </td>
                  {columns.map((c) => {
                    const raw = row[c.key]
                    if (c.text) {
                      return (
                        <td key={c.key} className="py-2 pr-3 text-right tabular-nums">
                          {String(raw ?? '')}
                        </td>
                      )
                    }
                    const num = typeof raw === 'number' ? raw : Number(raw)
                    return (
                      <td key={c.key} className="py-2 pr-3 text-right tabular-nums">
                        {c.format ? c.format(num) : num}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function pctColumn(key: string, label: string): RankingColumn {
  return { key, label, format: (v) => formatPercent(v) }
}
