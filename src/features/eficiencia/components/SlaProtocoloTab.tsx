import { useState } from 'react'
import { FileCheck2 } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { useSlaProtocolo, useSlaProtocoloRankingFatal } from '../hooks/useEficiencia'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingTable, pctColumn } from './EficienciaRankingTable'
import { AreaFilterButtons } from './AreaFilterButtons'

export function SlaProtocoloTab({ ano }: { ano: number }) {
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const { data: mensal, loading } = useSlaProtocolo(ano, area)
  const { data: ranking, loading: loadingRanking } = useSlaProtocoloRankingFatal(ano, mesFiltro)

  const qtdD1 = mensal.reduce((s, m) => s + m.qtd_d1, 0)
  const qtdTotal = mensal.reduce((s, m) => s + m.qtd_total, 0)
  const pctGeral = qtdTotal > 0 ? (qtdD1 / qtdTotal) * 100 : 0
  const metaAtual = mensal.length ? mensal[mensal.length - 1].meta : null

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensal.find((m) => m.mes === mesAtual)

  return (
    <div className="space-y-5">
      <AreaFilterButtons value={area} onChange={setArea} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="SLA de Protocolo no ano"
          value={formatPercent(pctGeral)}
          hint={`${qtdD1} D-1 de ${qtdTotal} CIs`}
          meta={metaAtual != null ? formatPercent(metaAtual) : undefined}
          atingiuMeta={metaAtual != null ? pctGeral >= metaAtual : null}
          icon={FileCheck2}
          accentClass="bg-violet-100 text-violet-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="SLA de Protocolo no mês atual"
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_eficiencia) : '—'}
          hint={rowMesAtual ? `${rowMesAtual.qtd_d1} D-1 de ${rowMesAtual.qtd_total}` : 'sem dados'}
          meta={rowMesAtual?.meta != null ? formatPercent(rowMesAtual.meta) : undefined}
          atingiuMeta={
            rowMesAtual?.meta != null ? rowMesAtual.pct_eficiencia >= rowMesAtual.meta : null
          }
          icon={FileCheck2}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="FATAL no ano"
          value={String(mensal.reduce((s, m) => s + m.qtd_fatal, 0))}
          icon={FileCheck2}
          accentClass="bg-rose-100 text-rose-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="SLA de Protocolo (D-1 vs FATAL)"
        subtitle="% de CIs concluídos dentro do prazo D-1, com meta vigente no período"
        data={mensal.map((m) => ({ mes: m.mes, valor: m.pct_eficiencia, meta: m.meta }))}
        color="#7c3aed"
      />

      <div className="flex justify-end">
        <select
          value={mesFiltro ?? ''}
          onChange={(e) => setMesFiltro(e.target.value ? Number(e.target.value) : null)}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 shadow-sm"
        >
          <option value="">Ranking: ano todo</option>
          {mensal.map((m) => (
            <option key={m.mes} value={m.mes}>
              Ranking: mês {m.mes}
            </option>
          ))}
        </select>
      </div>

      <EficienciaRankingTable
        title="Ranking de FATAL não-excludente"
        subtitle="Por usuário que concluiu a tarefa"
        rows={ranking}
        loading={loadingRanking}
        columns={[{ key: 'qtd_fatal', label: 'FATAL' }, pctColumn('pct_do_total', '% do total')]}
      />
    </div>
  )
}
