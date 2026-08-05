import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { useEficienciaProtocolo, useEficienciaProtocoloRanking } from '../hooks/useEficiencia'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingTable, pctColumn } from './EficienciaRankingTable'
import { AreaFilterButtons } from './AreaFilterButtons'

export function EficienciaProtocoloTab({ ano }: { ano: number }) {
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const { data: mensal, loading } = useEficienciaProtocolo(ano, area)
  const { data: ranking, loading: loadingRanking } = useEficienciaProtocoloRanking(ano, mesFiltro)

  const semInconsistencia = mensal.reduce((s, m) => s + m.sem_inconsistencia, 0)
  const total = mensal.reduce((s, m) => s + m.total, 0)
  const pctGeral = total > 0 ? (semInconsistencia / total) * 100 : 0

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensal.find((m) => m.mes === mesAtual)

  return (
    <div className="space-y-5">
      <AreaFilterButtons value={area} onChange={setArea} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Eficiência de Protocolo no ano"
          value={formatPercent(pctGeral)}
          hint={`${semInconsistencia} de ${total} protocolos sem inconsistência`}
          icon={ClipboardCheck}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Eficiência no mês atual"
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_eficiencia) : '—'}
          hint={rowMesAtual ? `${rowMesAtual.total} protocolos no mês` : 'sem dados'}
          icon={ClipboardCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Protocolos no ano"
          value={String(total)}
          icon={ClipboardCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Eficiência de Protocolo"
        subtitle="% de protocolos sem inconsistência jurídica"
        data={mensal.map((m) => ({ mes: m.mes, valor: m.pct_eficiencia }))}
        color="#059669"
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
        title="Ranking de inconsistência jurídica"
        subtitle="Por usuário que criou o protocolo"
        rows={ranking}
        loading={loadingRanking}
        columns={[
          { key: 'qtd_inconsistencia', label: 'Inconsistências' },
          pctColumn('pct_do_total', '% do total'),
        ]}
      />
    </div>
  )
}
