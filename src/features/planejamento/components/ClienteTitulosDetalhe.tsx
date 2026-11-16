import { useMemo, useState } from 'react'
import { Split } from 'lucide-react'
import { formatDate } from '@/shared/utils/format'
import { usePlanRateiosTitulos, usePlanTitulosCliente } from '../hooks/usePlanejamento'
import { MESES_ABREV, areaNome } from '../utils/areasPlanejamento'
import type { LinhaRateio } from '../utils/rateioTitulo'
import { moeda } from './PlanUi'
import { RateioTituloEditor } from './RateioTituloEditor'

/**
 * Títulos do cliente sem área no ano (para identificar a área) e onde ele pagou em áreas.
 * Cada título pode ser dividido por % entre áreas; sem rateio, segue a área escolhida para o cliente.
 */
export function ClienteTitulosDetalhe({
  ano,
  cliente,
  areaCliente,
  sugestao,
}: {
  ano: number
  cliente: string
  /** Área escolhida para o cliente (vale para os títulos sem rateio). */
  areaCliente: string | null
  sugestao: string | null
}) {
  const { titulos, historico } = usePlanTitulosCliente(ano, cliente)
  const hist = historico.data ?? []
  const itens = useMemo(() => titulos.data ?? [], [titulos.data])
  const ids = useMemo(() => [...new Set(itens.map((t) => t.ci_titulo).filter((v): v is number => v != null))], [itens])
  const rateiosQ = usePlanRateiosTitulos(ids)
  const [editando, setEditando] = useState<number | null>(null)

  const rateios = useMemo(() => {
    const m = new Map<number, LinhaRateio[]>()
    for (const r of rateiosQ.data ?? []) {
      const l = m.get(r.ci_titulo) ?? []
      l.push({ area_key: r.area_key, pct: r.pct })
      m.set(r.ci_titulo, l)
    }
    return m
  }, [rateiosQ.data])
  const valorTitulo = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of itens) if (t.ci_titulo != null) m.set(t.ci_titulo, (m.get(t.ci_titulo) ?? 0) + t.valor)
    return m
  }, [itens])
  const tituloEditando = editando == null ? null : (itens.find((t) => t.ci_titulo === editando) ?? null)
  const rateioEditando = editando == null ? undefined : rateios.get(editando)

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
      <p className="text-[11px] text-slate-500">
        Título dividido entre áreas? Clique em <strong>Dividir</strong> e informe o % de cada área. O rateio do título vale mais que a área
        escolhida para o cliente.
      </p>
      {titulos.isLoading ? (
        <div className="h-16 animate-pulse rounded bg-white" />
      ) : titulos.error ? (
        <p className="text-xs text-red-700">{titulos.error instanceof Error ? titulos.error.message : 'Erro ao carregar os títulos'}</p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full min-w-[1040px] text-[11px]">
            <thead className="bg-slate-100 text-slate-500">
              <tr>
                <th className="px-2 py-1 text-left font-medium">CI título</th>
                <th className="px-2 py-1 text-left font-medium">Nº título</th>
                <th className="px-2 py-1 text-left font-medium">Mês</th>
                <th className="px-2 py-1 text-left font-medium">Vencimento</th>
                <th className="px-2 py-1 text-left font-medium">Pagamento</th>
                <th className="px-2 py-1 text-right font-medium">Recebido</th>
                <th className="px-2 py-1 text-left font-medium">Área</th>
                <th className="px-2 py-1 text-left font-medium">Plano de contas</th>
                <th className="px-2 py-1 text-left font-medium">Descrição</th>
                <th className="px-2 py-1 text-left font-medium">Contrato</th>
                <th className="px-2 py-1 text-left font-medium">Etiquetas</th>
                <th className="px-2 py-1 text-left font-medium">Departamento</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((t) => {
                const rateio = t.ci_titulo != null ? rateios.get(t.ci_titulo) : undefined
                const aberto = t.ci_titulo != null && editando === t.ci_titulo
                return (
                  <tr
                    key={`${t.ci_titulo}-${t.ci_item}`}
                    className={aberto ? 'border-t border-indigo-100 bg-indigo-50/70' : 'border-t border-slate-100'}
                  >
                    <td className="px-2 py-1 font-mono text-slate-800">{t.ci_titulo ?? '—'}</td>
                    <td className="px-2 py-1 text-slate-600">{t.nro_titulo ?? '—'}</td>
                    <td className="px-2 py-1 text-slate-600">
                      {MESES_ABREV[t.mes - 1] ?? t.mes}/{String(ano).slice(-2)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-600">{formatDate(t.data_vencimento)}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-600">{formatDate(t.data_pagamento)}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{moeda(t.valor)}</td>
                    <td className="whitespace-nowrap px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        {rateio ? (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-800" title="Rateio do título">
                            {rateio.map((r) => `${areaNome(r.area_key)} ${r.pct.toLocaleString('pt-BR')}%`).join(' · ')}
                          </span>
                        ) : areaCliente ? (
                          <span className="text-slate-500" title="Segue a área escolhida para o cliente">
                            {areaNome(areaCliente)} <span className="text-slate-400">(do cliente)</span>
                          </span>
                        ) : (
                          <span className="font-medium text-amber-700">Sem área</span>
                        )}
                        {t.ci_titulo != null && (
                          <button
                            type="button"
                            onClick={() => setEditando(aberto ? null : t.ci_titulo)}
                            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-indigo-700 hover:bg-indigo-100"
                            title="Dividir este título entre áreas por %"
                          >
                            <Split className="h-3 w-3" aria-hidden /> {rateio ? 'Editar' : 'Dividir'}
                          </button>
                        )}
                      </div>
                    </td>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Fora da tabela (que rola na horizontal) para o editor ficar sempre inteiro na tela. */}
      {tituloEditando?.ci_titulo != null && (
        <RateioTituloEditor
          key={tituloEditando.ci_titulo}
          ciTitulo={tituloEditando.ci_titulo}
          rotuloTitulo={tituloEditando.nro_titulo ? `nº ${tituloEditando.nro_titulo}` : `CI ${tituloEditando.ci_titulo}`}
          valorTitulo={valorTitulo.get(tituloEditando.ci_titulo) ?? tituloEditando.valor}
          inicial={rateioEditando ?? ((areaCliente ?? sugestao) ? [{ area_key: (areaCliente ?? sugestao) as string, pct: 100 }] : [])}
          temRateio={Boolean(rateioEditando)}
          titulosCliente={ids}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
