import { Smile } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { EFICIENCIA_META_NPS, type MesFiltroEficiencia } from '../constants'
import { useNpsKpi } from '../hooks/useEficiencia'
import { npsZona } from '../utils/npsCalc'
import { atingiuMetaKpi } from '../utils/overviewKpiMeta'
import { EficienciaKpiCard } from './EficienciaKpiCard'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

function formatScore10(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function NpsTab({ ano }: Props) {
  const { data, loading } = useNpsKpi(ano)
  const nps = data?.nps ?? null
  const zona = npsZona(nps)
  const atingiu = atingiuMetaKpi(nps, EFICIENCIA_META_NPS)
  const campanha = data?.campaignName?.trim() || `NPS ${ano}`
  const respostas = data?.total ?? 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EficienciaKpiCard
          title="NPS"
          value={nps == null ? '—' : formatPercent(nps)}
          hint={
            loading
              ? 'Carregando pesquisa do OrqestrAI…'
              : data?.unavailable
                ? 'Fonte OrqestrAI indisponível no momento.'
                : `${campanha} · avaliação única no ano · ${respostas} resposta${respostas === 1 ? '' : 's'}${zona ? ` · ${zona}` : ''}`
          }
          meta={`Meta ${formatPercent(EFICIENCIA_META_NPS)}`}
          atingiuMeta={atingiu}
          icon={Smile}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Promotores (9–10)"
          value={loading ? '—' : String(data?.promoters ?? 0)}
          hint="Clientes que recomendariam o escritório"
          icon={Smile}
          accentClass="bg-emerald-50 text-emerald-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Neutros (7–8)"
          value={loading ? '—' : String(data?.passives ?? 0)}
          hint="Clientes neutros na recomendação"
          icon={Smile}
          accentClass="bg-amber-50 text-amber-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Detratores (0–6)"
          value={loading ? '—' : String(data?.detractors ?? 0)}
          hint="Clientes que não recomendariam"
          icon={Smile}
          accentClass="bg-rose-50 text-rose-700"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EficienciaKpiCard
          title="Disponibilidade"
          value={formatScore10(data?.dimensions.availability ?? null)}
          hint="Média 0 a 10"
          icon={Smile}
          accentClass="bg-slate-100 text-slate-600"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Comunicação"
          value={formatScore10(data?.dimensions.communication ?? null)}
          hint="Média 0 a 10"
          icon={Smile}
          accentClass="bg-slate-100 text-slate-600"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Inovação"
          value={formatScore10(data?.dimensions.innovation ?? null)}
          hint="Média 0 a 10"
          icon={Smile}
          accentClass="bg-slate-100 text-slate-600"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Competência técnica"
          value={formatScore10(data?.dimensions.technical ?? null)}
          hint="Média 0 a 10"
          icon={Smile}
          accentClass="bg-slate-100 text-slate-600"
          loading={loading}
        />
      </div>
    </div>
  )
}
