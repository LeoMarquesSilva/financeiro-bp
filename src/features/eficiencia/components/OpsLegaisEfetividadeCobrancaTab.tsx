import { useMemo } from 'react'
import { MessageCircle, Target } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { useCobrancaKpiRows } from '@/features/cobranca/hooks/useWhatsapp'
import {
  EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
  filtroEfetivoGestaoAVista,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import {
  agregarEfetividade,
  filtrarPainelEfetividade,
  serieMensalEfetividade,
} from '../utils/opsEfetividadeCobranca'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { explicarEfetividadeCobranca } from '../fenix/eficienciaOperacionalFenix'
import { explicarGraficoRazaoSimples } from '../fenix/eficienciaGraficosFenix'
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
  const filtroGav = useMemo(() => filtroEfetivoGestaoAVista(ano), [ano])
  const filtradasGav = useMemo(
    () => filtrarPainelEfetividade(rows, ano, filtroGav),
    [rows, ano, filtroGav],
  )
  const gestaoVista = useMemo(() => agregarEfetividade(filtradasGav), [filtradasGav])

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

  const foraOuSem = periodo.total - periodo.cobrados_d1

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Efetividade Gestão a Vista"
          value={
            gestaoVista.total > 0 ? formatPercent(gestaoVista.pct_efetividade) : '—'
          }
          hint="WhatsApp D+1 ÷ abertos · jun→hoje"
          icon={Target}
          accentClass="bg-slate-100 text-slate-700"
          loading={loading}
          fenix={{
            chave: 'eficiencia.ops-legais.efetividade-cobranca.gestao-a-vista',
            explicar: () =>
              explicarEfetividadeCobranca({
                ano,
                escopo: 'gestao_a_vista',
                mesFiltro: filtroGav,
                total: gestaoVista.total,
                cobrados: gestaoVista.cobrados_d1,
                pct: gestaoVista.pct_efetividade,
                valor: gestaoVista.total > 0 ? formatPercent(gestaoVista.pct_efetividade) : '—',
              }),
          }}
        />
        <EficienciaKpiCard
          title="Efetividade no período selecionado"
          value={periodo.total > 0 ? formatPercent(periodo.pct_efetividade) : '—'}
          hint="WhatsApp D+1 ÷ abertos · meses filtrados"
          meta={`Meta ${formatPercent(EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA)}`}
          atingiuMeta={
            periodo.total > 0
              ? periodo.pct_efetividade >= EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA
              : null
          }
          icon={MessageCircle}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loading}
          fenix={{
            chave: 'eficiencia.ops-legais.efetividade-cobranca.periodo',
            explicar: () =>
              explicarEfetividadeCobranca({
                ano,
                escopo: 'periodo',
                mesFiltro,
                total: periodo.total,
                cobrados: periodo.cobrados_d1,
                pct: periodo.pct_efetividade,
                valor: periodo.total > 0 ? formatPercent(periodo.pct_efetividade) : '—',
              }),
          }}
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
          fenix={{
            chave: 'eficiencia.ops-legais.efetividade-cobranca.titulos',
            explicar: () =>
              explicarEfetividadeCobranca({
                ano,
                escopo: 'titulos',
                mesFiltro,
                total: periodo.total,
                cobrados: periodo.cobrados_d1,
                pct: periodo.pct_efetividade,
                valor: String(periodo.total),
              }),
          }}
        />
      </div>

      <EficienciaEvolucaoChart
        title="Efetividade na Cobrança Inicial"
        subtitle="% títulos em aberto cobrados por WhatsApp no D+1 útil (mesma base da aba Cobrança)"
        data={chartData}
        fenix={{
          chave: 'eficiencia.ops-legais.efetividade-cobranca.grafico',
          explicar: (ponto) =>
            explicarGraficoRazaoSimples(
              {
                tipo: 'efetividade',
                tela: 'Operações Legais › Efetividade na Cobrança',
                titulo: 'Efetividade na Cobrança Inicial',
                ano,
                mesFiltro,
                data: chartData,
                metaFixa: EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
                meses: serieAno.map((m) => ({ mes: m.mes, ok: m.cobrados_d1, total: m.total })),
              },
              ponto,
            ),
        }}
        color="#059669"
        metaFixa={EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA}
      />
    </div>
  )
}
