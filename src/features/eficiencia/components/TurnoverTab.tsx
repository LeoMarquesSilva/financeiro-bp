import { useState } from 'react'
import { UserMinus } from 'lucide-react'
import { formatDate, formatPercent } from '@/shared/utils/format'
import { useTurnover } from '../hooks/useEficiencia'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { AreaFilterButtons } from './AreaFilterButtons'

function formatMeses(m: number | null): string {
  if (m == null) return '—'
  const anos = Math.floor(m / 12)
  const meses = m % 12
  if (anos === 0) return `${meses}m`
  return `${anos}a ${meses}m`
}

export function TurnoverTab({ ano }: { ano: number }) {
  const [area, setArea] = useState<string | null>(null)
  const { anual, desligamentos, top5, loading } = useTurnover(ano, area)
  const desligamentosFiltrados = area ? desligamentos.filter((d) => d.area === area) : desligamentos
  const top5Filtrado = area ? top5.filter((p) => p.area === area) : top5

  return (
    <div className="space-y-5">
      <AreaFilterButtons value={area} onChange={setArea} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Retenção de talentos"
          value={anual ? formatPercent(anual.pct_retencao) : '—'}
          meta={anual ? `mín. ${formatPercent(anual.meta_pct_retencao_minima)}` : undefined}
          atingiuMeta={anual ? anual.pct_retencao >= anual.meta_pct_retencao_minima : null}
          icon={UserMinus}
          accentClass="bg-teal-100 text-teal-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Funcionários ativos"
          value={anual ? String(anual.funcionarios_ativos) : '—'}
          icon={UserMinus}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Saídas voluntárias no ano"
          value={anual ? String(anual.saidas_voluntarias) : '—'}
          icon={UserMinus}
          accentClass="bg-rose-100 text-rose-700"
          loading={loading}
        />
      </div>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Top 5 tempo de casa</h2>
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ) : top5Filtrado.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sem dados de colaboradores ativos.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {top5Filtrado.map((p) => (
              <li key={p.nome} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{p.nome}</p>
                  <p className="text-xs text-slate-400">
                    {p.cargo ?? '—'} · {p.area ?? '—'}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                  {formatMeses(p.meses_casa)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Desligamentos no ano</h2>
        {loading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ) : desligamentosFiltrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhum desligamento no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Nome</th>
                  <th className="py-2 pr-3 font-medium">Área</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Desligamento</th>
                  <th className="py-2 pr-3 text-right font-medium">Tempo de casa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {desligamentosFiltrados.map((d, i) => (
                  <tr key={i} className="text-slate-700">
                    <td className="py-2 pr-3 font-medium text-slate-900">{d.nome}</td>
                    <td className="py-2 pr-3">{d.area ?? '—'}</td>
                    <td className="py-2 pr-3">{d.tipo_desligamento ?? '—'}</td>
                    <td className="py-2 pr-3">{formatDate(d.desligamento)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMeses(d.meses_casa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
