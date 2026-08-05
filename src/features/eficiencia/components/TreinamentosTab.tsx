import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { useTreinamentos } from '../hooks/useEficiencia'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaRankingTable } from './EficienciaRankingTable'
import { AreaFilterButtons } from './AreaFilterButtons'

function formatMinutosParaHoras(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

export function TreinamentosTab({ ano }: { ano: number }) {
  const [area, setArea] = useState<string | null>(null)
  const { anual, porPessoa, loading } = useTreinamentos(ano, area)

  return (
    <div className="space-y-5">
      <AreaFilterButtons value={area} onChange={setArea} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Atingimento de treinamentos"
          value={anual ? formatPercent(anual.pct_atingimento) : '—'}
          hint={anual ? `${formatMinutosParaHoras(anual.minutos_lancados)} lançadas` : undefined}
          meta="14h / pessoa ativa"
          atingiuMeta={anual ? anual.pct_atingimento >= 100 : null}
          icon={GraduationCap}
          accentClass="bg-indigo-100 text-indigo-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Pessoas ativas"
          value={anual ? String(anual.pessoas_ativas) : '—'}
          icon={GraduationCap}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Meta total do ano"
          value={anual ? formatMinutosParaHoras(anual.meta_minutos) : '—'}
          icon={GraduationCap}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
      </div>

      <EficienciaRankingTable
        title="Treinamentos por colaborador"
        subtitle="Horas lançadas no ano · meta 14h/pessoa"
        rows={porPessoa.map((p) => ({ ...p }))}
        usuarioKey="colaborador"
        loading={loading}
        columns={[{ key: 'horas_formatadas', label: 'Horas', text: true }]}
      />
    </div>
  )
}
