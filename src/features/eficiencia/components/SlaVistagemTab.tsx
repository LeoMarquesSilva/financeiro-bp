import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { useSlaVistagem, useSlaVistagemRanking } from '../hooks/useEficiencia'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingTable, pctColumn } from './EficienciaRankingTable'
import { AreaFilterButtons } from './AreaFilterButtons'

type Props = {
  ano: number
  risco: boolean
}

export function SlaVistagemTab({ ano, risco }: Props) {
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const { data: mensal, loading } = useSlaVistagem(ano, risco, area)
  const { data: ranking, loading: loadingRanking } = useSlaVistagemRanking(ano, mesFiltro, risco)

  const totalPublicacoes = mensal.reduce((s, m) => s + m.total, 0)
  const totalVistadoD1 = mensal.reduce((s, m) => s + m.vistado_d1, 0)
  const pctGeral = totalPublicacoes > 0 ? (totalVistadoD1 / totalPublicacoes) * 100 : 0

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensal.find((m) => m.mes === mesAtual)

  return (
    <div className="space-y-5">
      <AreaFilterButtons value={area} onChange={setArea} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title={`SLA D+1 no ano (${risco ? 'demanda de risco' : 'demanda comum'})`}
          value={formatPercent(pctGeral)}
          hint={`${totalVistadoD1} de ${totalPublicacoes} publicações`}
          icon={ShieldCheck}
          accentClass="bg-sky-100 text-sky-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="SLA D+1 no mês atual"
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_d1) : '—'}
          hint={rowMesAtual ? `${rowMesAtual.vistado_d1} de ${rowMesAtual.total}` : 'sem publicações'}
          icon={ShieldCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Publicações no ano"
          value={String(totalPublicacoes)}
          icon={ShieldCheck}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title={`SLA de Vistagem D+1 — ${risco ? 'Demanda de Risco' : 'Demanda Comum'}`}
        subtitle="% de publicações vistadas até o próximo dia útil + 12h"
        data={mensal.map((m) => ({ mes: m.mes, valor: m.pct_d1 }))}
        color={risco ? '#dc2626' : '#0ea5e9'}
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
        title="Ranking por vistador"
        subtitle="% de vistagens D+1 por usuário"
        rows={ranking}
        loading={loadingRanking}
        columns={[
          { key: 'total', label: 'Total' },
          { key: 'vistado_d1', label: 'D+1' },
          pctColumn('pct_d1', '% D+1'),
          pctColumn('pct_do_total', '% do total'),
        ]}
      />
    </div>
  )
}
