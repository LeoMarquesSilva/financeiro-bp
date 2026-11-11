import { formatDate } from '@/shared/utils/format'
import { usePlanTitulosCliente } from '../hooks/usePlanejamento'
import { MESES_ABREV, areaNome } from '../utils/areasPlanejamento'
import { moeda } from './PlanUi'

/** Títulos do cliente sem área no ano (para identificar a área) e onde ele pagou em áreas. */
export function ClienteTitulosDetalhe({ ano, cliente }: { ano: number; cliente: string }) {
  const { titulos, historico } = usePlanTitulosCliente(ano, cliente)
  const hist = historico.data ?? []
  return (
    <div className="space-y-2 bg-slate-50/70 px-3 py-2">
      <div className="text-[11px] text-slate-600">
        <span className="font-medium">Este cliente em títulos de área (2025 em diante): </span>
        {historico.isLoading
          ? 'carregando…'
          : hist.length === 0
            ? 'nenhum título em área'
            : hist.map((h) => `${areaNome(h.area_key)} ${h.ano}: ${moeda(h.total)} (${h.titulos})`).join(' · ')}
      </div>
      {titulos.isLoading ? (
        <div className="h-16 animate-pulse rounded bg-white" />
      ) : titulos.error ? (
        <p className="text-xs text-red-700">{titulos.error instanceof Error ? titulos.error.message : 'Erro ao carregar os títulos'}</p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-[11px]">
            <thead className="bg-slate-100 text-slate-500">
              <tr>
                <th className="px-2 py-1 text-left font-medium">CI título</th>
                <th className="px-2 py-1 text-left font-medium">Nº título</th>
                <th className="px-2 py-1 text-left font-medium">Mês</th>
                <th className="px-2 py-1 text-left font-medium">Vencimento</th>
                <th className="px-2 py-1 text-left font-medium">Pagamento</th>
                <th className="px-2 py-1 text-right font-medium">Recebido</th>
                <th className="px-2 py-1 text-left font-medium">Plano de contas</th>
                <th className="px-2 py-1 text-left font-medium">Descrição</th>
                <th className="px-2 py-1 text-left font-medium">Contrato</th>
                <th className="px-2 py-1 text-left font-medium">Etiquetas</th>
                <th className="px-2 py-1 text-left font-medium">Departamento</th>
              </tr>
            </thead>
            <tbody>
              {(titulos.data ?? []).map((t) => (
                <tr key={`${t.ci_titulo}-${t.ci_item}`} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-mono text-slate-800">{t.ci_titulo ?? '—'}</td>
                  <td className="px-2 py-1 text-slate-600">{t.nro_titulo ?? '—'}</td>
                  <td className="px-2 py-1 text-slate-600">
                    {MESES_ABREV[t.mes - 1] ?? t.mes}/{String(ano).slice(-2)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">{formatDate(t.data_vencimento)}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">{formatDate(t.data_pagamento)}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{moeda(t.valor)}</td>
                  <td className="px-2 py-1 text-slate-600">{t.plano_contas ?? '—'}</td>
                  <td className="max-w-[220px] px-2 py-1 text-slate-600" title={t.descricao ?? undefined}>
                    {t.descricao ?? '—'}
                  </td>
                  <td className="px-2 py-1 text-slate-600">{t.contrato ?? '—'}</td>
                  <td className="max-w-[160px] truncate px-2 py-1 text-slate-600" title={t.etiquetas ?? undefined}>
                    {t.etiquetas ?? '—'}
                  </td>
                  <td className="px-2 py-1 text-slate-500">{t.departamento ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
