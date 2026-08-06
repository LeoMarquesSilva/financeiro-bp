import { useState } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { isAgendamentoVistagemIndisponivelPorArea } from '../constants'
import { useAgendamento, useAgendamentoRanking } from '../hooks/useEficiencia'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { EficienciaRankingTable, pctColumn } from './EficienciaRankingTable'
import { AreaFilterButtons } from './AreaFilterButtons'

export function AgendamentoTab({ ano }: { ano: number }) {
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const { data: mensal, loading } = useAgendamento(ano, area)
  const { data: ranking, loading: loadingRanking } = useAgendamentoRanking(ano, mesFiltro)

  const indisponivel = isAgendamentoVistagemIndisponivelPorArea(area)
  const dentroPrazo = indisponivel ? 0 : mensal.reduce((s, m) => s + m.dentro_prazo, 0)
  const foraPrazo = indisponivel ? 0 : mensal.reduce((s, m) => s + m.fora_prazo, 0)
  const totalGeral = dentroPrazo + foraPrazo
  const pctGeral = !indisponivel && totalGeral > 0 ? (dentroPrazo / totalGeral) * 100 : null

  const mesAtual = new Date().getMonth() + 1
  const rowMesAtual = mensal.find((m) => m.mes === mesAtual)

  return (
    <div className="space-y-5">
      <AreaFilterButtons value={area} onChange={setArea} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Agendamento/Ciência D+1 no ano"
          value={pctGeral != null ? formatPercent(pctGeral) : '—'}
          hint={
            indisponivel
              ? 'Indicador não se aplica a Operações Legais'
              : `${dentroPrazo} de ${totalGeral} tarefas dentro do prazo`
          }
          icon={CalendarCheck2}
          accentClass="bg-amber-100 text-amber-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Dentro do prazo no mês atual"
          value={rowMesAtual ? formatPercent(rowMesAtual.pct_dentro_prazo) : '—'}
          hint={rowMesAtual ? `${rowMesAtual.dentro_prazo} de ${rowMesAtual.dentro_prazo + rowMesAtual.fora_prazo}` : 'sem dados'}
          icon={CalendarCheck2}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Fora do prazo no ano"
          value={String(foraPrazo)}
          icon={CalendarCheck2}
          accentClass="bg-rose-100 text-rose-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Agendamento / Ciência D+1"
        subtitle="% de tarefas concluídas dentro do prazo D+1"
        data={mensal.map((m) => ({ mes: m.mes, valor: m.pct_dentro_prazo }))}
        color="#d97706"
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
        title="Ranking por usuário"
        subtitle="Tarefas dentro e fora do prazo D+1"
        rows={ranking}
        loading={loadingRanking}
        columns={[
          { key: 'dentro_prazo', label: 'Dentro do prazo' },
          { key: 'fora_prazo', label: 'Fora do prazo' },
          pctColumn('pct_do_total', '% do total'),
        ]}
      />
    </div>
  )
}
