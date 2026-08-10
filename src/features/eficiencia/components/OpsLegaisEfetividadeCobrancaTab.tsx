import { useMemo } from 'react'
import { MessageCircle, Target } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { useCobrancaKpiRows } from '@/features/cobranca/hooks/useWhatsapp'
import {
  EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
  isMesesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import {
  agregarEfetividade,
  filtrarPainelEfetividade,
  serieMensalEfetividade,
} from '../utils/opsEfetividadeCobranca'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

export function OpsLegaisEfetividadeCobrancaTab({ ano, mesFiltro }: Props) {
  const { rows, loading } = useCobrancaKpiRows()

  const filtradas = useMemo(
    () => filtrarPainelEfetividade(rows, ano, mesFiltro),
    [rows, ano, mesFiltro],
  )
  const periodo = useMemo(() => agregarEfetividade(filtradas), [filtradas])

  const serieAno = useMemo(() => serieMensalEfetividade(rows, ano), [rows, ano])
  const chartData = useMemo(() => {
    return serieAno
      .filter((m) => mesNoFiltro(m.mes, mesFiltro, ano))
      .map((m) => ({
        mes: m.mes,
        valor: m.pct_efetividade,
        meta: EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
      }))
  }, [serieAno, mesFiltro, ano])

  const mesDestaque =
    isMesesFiltro(mesFiltro) && mesFiltro.length === 1
      ? mesFiltro[0]!
      : new Date().getMonth() + 1
  const rowMes = serieAno.find((m) => m.mes === mesDestaque)
  const mesNoEscopo =
    rowMes != null && mesNoFiltro(rowMes.mes, mesFiltro, ano)

  const foraOuSem = periodo.total - periodo.cobrados_d1

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Efetividade Gestão a Vista"
          value={
            mesNoEscopo && rowMes
              ? formatPercent(rowMes.pct_efetividade)
              : '—'
          }
          hint="WhatsApp no D+1 útil · títulos em aberto (mesmo painel Cobrança)"
          icon={Target}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Efetividade no período selecionado"
          value={periodo.total > 0 ? formatPercent(periodo.pct_efetividade) : '—'}
          hint="Cobrados D+1 ÷ títulos em aberto com prazo vencido"
          meta={`Meta ${formatPercent(EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA)}`}
          atingiuMeta={
            periodo.total > 0
              ? periodo.pct_efetividade >= EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA
              : null
          }
          icon={MessageCircle}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loading}
        />
        <EficienciaKpiCard
          title="Títulos no período selecionado"
          value={loading ? '—' : String(periodo.total)}
          hint={
            periodo.total > 0
              ? `${periodo.cobrados_d1} no D+1 · ${foraOuSem} fora/sem cobrança`
              : 'Sem títulos em aberto com prazo D+1 no período'
          }
          icon={MessageCircle}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Efetividade na Cobrança Inicial"
        subtitle="% títulos em aberto cobrados por WhatsApp no D+1 útil (mesma base da aba Cobrança)"
        data={chartData}
        color="#059669"
        metaFixa={EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA}
      />
    </div>
  )
}
