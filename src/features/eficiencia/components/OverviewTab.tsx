import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import { formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import { receitaService } from '@/features/receita/services/receitaService'
import { dashboardService as inadimplenciaDashboardService } from '@/features/inadimplencia/services/dashboardService'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { OverviewKpiHeatRow, type HeatCell } from './OverviewKpiHeatRow'
import { AreaFilterButtons } from './AreaFilterButtons'
import { MesFilterButtons } from './MesFilterButtons'
import { RacionalSheet } from './RacionalSheet'
import { MES_INICIO_RESULTADO, EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL, type MesFiltroEficiencia } from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import type { EficienciaOverview, RacionalIndicador } from '../types/eficiencia.types'
import {
  aplicarCelulasFiltro,
  buildOverviewInadimplencia,
  buildOverviewReceitaBruta,
} from '../utils/overviewFinanceiroKpis'
import { resolveMetaTexto } from '../utils/overviewKpiMeta'

type Props = {
  ano: number
  data: EficienciaOverview | null
  loading: boolean
  area: string | null
  onAreaChange: (area: string | null) => void
}

const RACIONAL_TITULOS: Record<RacionalIndicador, string> = {
  sla_protocolo: 'SLA Protocolo',
  eficiencia_protocolo: 'Eficiência Protocolo',
  sla_ciencia_agendamentos: 'SLA Ciência Agendamentos',
  sla_vistagem_risco: 'SLA Vistagem Risco',
  sla_vistagem_normal: 'SLA Vistagem Normal',
  desenvolvimento_equipe: 'Desenvolvimento Equipe',
  retencao_talentos: 'Retenção de Talentos',
}

const PCT0 = (v: number) => `${v.toFixed(2)}%`

/** Monta as 12 células (Jan-Dez) de uma linha heat-strip a partir de um array mensal esparso. */
function buildCells<T extends { mes: number }>(
  rows: T[],
  getValor: (r: T) => number,
): HeatCell[] {
  const porMes = new Map(rows.map((r) => [r.mes, r]))
  return Array.from({ length: 12 }, (_, i) => {
    const row = porMes.get(i + 1)
    if (!row) return { value: null, label: '-' }
    const v = getValor(row)
    return { value: v, label: PCT0(v) }
  })
}

/** Monta 12 células a partir de valores literais fixos por mês (1-indexado), para os cartões do BI ainda sem fonte de dados própria. */
function staticCells(valoresPorMes: Record<number, number>): HeatCell[] {
  return Array.from({ length: 12 }, (_, i) => {
    const v = valoresPorMes[i + 1]
    return v == null ? { value: null, label: '-' } : { value: v, label: PCT0(v) }
  })
}

function somaRazaoPct(numeros: number[], denominadores: number[]): HeatCell {
  const num = numeros.reduce((a, b) => a + b, 0)
  const den = denominadores.reduce((a, b) => a + b, 0)
  if (den === 0) return { value: null, label: '-' }
  const v = (num / den) * 100
  return { value: v, label: PCT0(v) }
}

function formatMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function OverviewTab({ ano, data, loading, area, onAreaChange }: Props) {
  const [mesFiltro, setMesFiltro] = useState<MesFiltroEficiencia>(null)
  const [racionalAberto, setRacionalAberto] = useState<RacionalIndicador | null>(null)
  const mesDestaque = typeof mesFiltro === 'number' ? mesFiltro : null
  const { data: receitaMensal, isLoading: loadingReceita } = useQuery({
    queryKey: ['eficiencia', 'overview-receita', ano],
    queryFn: () => receitaService.fetchTotaisMensais(ano),
  })
  const { data: inadimplencia, isLoading: loadingInadimplencia } = useQuery({
    queryKey: ['eficiencia', 'overview-inadimplencia'],
    queryFn: () => inadimplenciaDashboardService.getDashboard(),
  })
  const { data: financeiroKpis, isLoading: loadingFinanceiroKpis } = useOverviewFinanceiroKpis(ano)

  const receitaMes = (() => {
    if (!receitaMensal || receitaMensal.size === 0) return null
    if (typeof mesFiltro === 'number') {
      const valores = receitaMensal.get(mesFiltro)
      return valores ? { mes: mesFiltro, ...valores } : null
    }
    const entradas =
      mesFiltro === 'resultado'
        ? [...receitaMensal.entries()].filter(([m]) => m >= MES_INICIO_RESULTADO)
        : [...receitaMensal.entries()]
    if (entradas.length === 0) return null
    const mesesComRecebido = entradas.filter(([, v]) => v.recebido > 0)
    const [mesRef, valores] = mesesComRecebido.length
      ? mesesComRecebido.reduce((a, b) => (a[0] > b[0] ? a : b))
      : entradas.reduce((a, b) => (a[0] > b[0] ? a : b))
    return { mes: mesRef, ...valores }
  })()

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <MesFilterButtons value={mesFiltro} onChange={setMesFiltro} />
        <AreaFilterButtons value={area} onChange={onAreaChange} />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  const treinamentosCells: HeatCell[] = aplicarCelulasFiltro(
    Array.from({ length: 12 }, (_, i) => {
      const row = data.treinamentosMensal.find((r) => r.mes === i + 1)
      if (!row) return { value: null, label: '-' }
      return {
        value: row.pct_atingimento,
        label: `${formatMinutos(row.minutos_lancados)} (${row.pct_atingimento.toFixed(0)}%)`,
      }
    }),
    mesFiltro,
  )
  const treinamentosAcumulado: HeatCell = data.treinamentos
    ? {
        value: data.treinamentos.pct_atingimento,
        label: `${formatMinutos(data.treinamentos.minutos_lancados)} (${data.treinamentos.pct_atingimento.toFixed(2)}%)`,
      }
    : { value: null, label: '-' }

  const retencaoCell: HeatCell = data.turnover
    ? { value: data.turnover.pct_retencao, label: PCT0(data.turnover.pct_retencao) }
    : { value: null, label: '-' }

  const filterMensal = <T extends { mes: number }>(rows: T[]) => {
    if (mesFiltro === 'resultado') return rows.filter((r) => r.mes >= MES_INICIO_RESULTADO)
    if (typeof mesFiltro === 'number') return rows.filter((r) => r.mes === mesFiltro)
    return rows
  }

  const acumuladoSlaProtocolo = (() => {
    const rows = filterMensal(data.slaProtocolo)
    return somaRazaoPct(
      rows.map((r) => r.qtd_d1),
      rows.map((r) => r.qtd_total),
    )
  })()
  const acumuladoEficienciaProtocolo = (() => {
    const rows = filterMensal(data.eficienciaProtocolo)
    return somaRazaoPct(
      rows.map((r) => r.sem_inconsistencia),
      rows.map((r) => r.total),
    )
  })()
  const acumuladoAgendamento = (() => {
    const rows = filterMensal(data.agendamento)
    return somaRazaoPct(
      rows.map((r) => r.dentro_prazo),
      rows.map((r) => r.dentro_prazo + r.fora_prazo),
    )
  })()
  const acumuladoVistagemRisco = (() => {
    const rows = filterMensal(data.slaVistagemRisco)
    return somaRazaoPct(
      rows.map((r) => r.vistado_d1),
      rows.map((r) => r.total),
    )
  })()
  const acumuladoVistagemComum = (() => {
    const rows = filterMensal(data.slaVistagemComum)
    return somaRazaoPct(
      rows.map((r) => r.vistado_d1),
      rows.map((r) => r.total),
    )
  })()
  const acumuladoTreinamentos: HeatCell =
    mesFiltro == null
      ? treinamentosAcumulado
      : (() => {
          const rows = filterMensal(data.treinamentosMensal)
          if (rows.length === 0) return { value: null, label: '-' }
          if (typeof mesFiltro === 'number') {
            const row = rows[0]
            return {
              value: row.pct_atingimento,
              label: `${formatMinutos(row.minutos_lancados)} (${row.pct_atingimento.toFixed(2)}%)`,
            }
          }
          const minutos = rows.reduce((s, r) => s + r.minutos_lancados, 0)
          const meta = rows.reduce((s, r) => s + r.meta_minutos, 0)
          if (meta <= 0) return { value: null, label: '-' }
          const pct = (minutos / meta) * 100
          return { value: pct, label: `${formatMinutos(minutos)} (${pct.toFixed(2)}%)` }
        })()

  const slaProtocoloMetasPorMes = Array.from({ length: 12 }, (_, i) => {
    if (mesFiltro === 'resultado' && i + 1 < MES_INICIO_RESULTADO) return null
    const row = data.slaProtocolo.find((r) => r.mes === i + 1)
    return row?.meta ?? null
  })
  const slaProtocoloMetaAcumulado = (() => {
    const rows = filterMensal(data.slaProtocolo)
    const metas = rows.map((r) => r.meta).filter((m): m is number => m != null)
    return metas.length > 0 ? Math.min(...metas) : 90
  })()

  const vistagemNormalIndisponivel = area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL
  const cellsVistagemNormal: HeatCell[] = vistagemNormalIndisponivel
    ? Array.from({ length: 12 }, () => ({ value: null, label: '-' }))
    : aplicarCelulasFiltro(buildCells(data.slaVistagemComum, (r) => r.pct_d1), mesFiltro)
  const acumuladoVistagemComumExibicao: HeatCell = vistagemNormalIndisponivel
    ? { value: null, label: '-' }
    : acumuladoVistagemComum

  const receitaBruta = financeiroKpis
    ? buildOverviewReceitaBruta(financeiroKpis.meses, financeiroKpis.rows, ano, mesFiltro)
    : null
  const inadimplenciaOverview = financeiroKpis
    ? buildOverviewInadimplencia(financeiroKpis.meses, mesFiltro)
    : null

  const cellsReceitaBruta = aplicarCelulasFiltro(
    receitaBruta?.cells ??
      Array.from({ length: 12 }, () => ({ value: null, label: '-' })),
    mesFiltro,
  )
  const acumuladoReceitaBruta: HeatCell =
    receitaBruta?.acumulado ?? { value: null, label: '-' }

  const cellsInadimplencia = aplicarCelulasFiltro(
    inadimplenciaOverview?.cells ??
      Array.from({ length: 12 }, () => ({ value: null, label: '-' })),
    mesFiltro,
  )
  const acumuladoInadimplencia: HeatCell =
    inadimplenciaOverview?.acumulado ?? { value: null, label: '-' }

  const resultadosRacional: Record<RacionalIndicador, HeatCell> = {
    sla_protocolo: acumuladoSlaProtocolo,
    eficiencia_protocolo: acumuladoEficienciaProtocolo,
    sla_ciencia_agendamentos: acumuladoAgendamento,
    sla_vistagem_risco: acumuladoVistagemRisco,
    sla_vistagem_normal: acumuladoVistagemComumExibicao,
    desenvolvimento_equipe: acumuladoTreinamentos,
    retencao_talentos: retencaoCell,
  }

  const slaProtocoloMetasFiltradas = (() => {
    if (typeof mesFiltro === 'number') return [slaProtocoloMetasPorMes[mesFiltro - 1] ?? null]
    if (mesFiltro === 'resultado') {
      return slaProtocoloMetasPorMes.map((m, i) => (i + 1 >= MES_INICIO_RESULTADO ? m : null))
    }
    return slaProtocoloMetasPorMes
  })()

  const metasRacional: Record<RacionalIndicador, { metaAcumulado: number; metaLabel?: string }> =
    {
      sla_protocolo: {
        metaAcumulado: slaProtocoloMetaAcumulado,
        metaLabel: resolveMetaTexto(90, undefined, slaProtocoloMetasFiltradas),
      },
      eficiencia_protocolo: { metaAcumulado: 95 },
      sla_ciencia_agendamentos: { metaAcumulado: 95 },
      sla_vistagem_risco: { metaAcumulado: 98 },
      sla_vistagem_normal: { metaAcumulado: 98 },
      desenvolvimento_equipe: { metaAcumulado: 100 },
      retencao_talentos: {
        metaAcumulado: data.turnover?.meta_pct_retencao_minima ?? 90,
      },
    }

  return (
    <div className="space-y-5">
      <MesFilterButtons value={mesFiltro} onChange={setMesFiltro} />
      <AreaFilterButtons value={area} onChange={onAreaChange} />

      {/* Réplica do Overview do BI: ordem e métricas idênticas às páginas KPI_HTML_*_MENSAL. */}
      <div className="space-y-3">
        <OverviewKpiHeatRow
          title="SLA Protocolo"
          meta={90}
          metasPorMes={slaProtocoloMetasPorMes}
          metaAcumulado={slaProtocoloMetaAcumulado}
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(
            buildCells(data.slaProtocolo, (r) => r.pct_eficiencia),
            mesFiltro,
          )}
          acumulado={acumuladoSlaProtocolo}
          onRacionalClick={() => setRacionalAberto('sla_protocolo')}
        />
        <OverviewKpiHeatRow
          title="Eficiência Protocolo"
          meta={95}
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(
            buildCells(data.eficienciaProtocolo, (r) => r.pct_eficiencia),
            mesFiltro,
          )}
          acumulado={acumuladoEficienciaProtocolo}
          onRacionalClick={() => setRacionalAberto('eficiencia_protocolo')}
        />
        <OverviewKpiHeatRow
          title="SLA Ciência Agendamentos"
          meta={95}
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(
            buildCells(data.agendamento, (r) => r.pct_dentro_prazo),
            mesFiltro,
          )}
          acumulado={acumuladoAgendamento}
          onRacionalClick={() => setRacionalAberto('sla_ciencia_agendamentos')}
        />
        <OverviewKpiHeatRow
          title="SLA Vistagem Risco"
          meta={98}
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(
            buildCells(data.slaVistagemRisco, (r) => r.pct_d1),
            mesFiltro,
          )}
          acumulado={acumuladoVistagemRisco}
          onRacionalClick={() => setRacionalAberto('sla_vistagem_risco')}
        />
        <OverviewKpiHeatRow
          title="SLA Vistagem Normal"
          meta={98}
          mesDestaque={mesDestaque}
          cells={cellsVistagemNormal}
          acumulado={acumuladoVistagemComumExibicao}
          onRacionalClick={
            vistagemNormalIndisponivel
              ? undefined
              : () => setRacionalAberto('sla_vistagem_normal')
          }
        />
        <OverviewKpiHeatRow
          title="Desenvolvimento Equipe"
          meta={100}
          mesDestaque={mesDestaque}
          cells={treinamentosCells}
          acumulado={acumuladoTreinamentos}
          onRacionalClick={() => setRacionalAberto('desenvolvimento_equipe')}
        />
        <OverviewKpiHeatRow
          title="Retenção de Talentos"
          meta={90}
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(
            Array.from({ length: 12 }, () => ({ value: null, label: '-' })),
            mesFiltro,
          )}
          acumulado={retencaoCell}
          onRacionalClick={() => setRacionalAberto('retencao_talentos')}
        />

        {/* Cartões do BI ainda sem fonte de dados própria (valores estáticos). */}
        <OverviewKpiHeatRow
          title="Gestão de PDI**"
          meta={100}
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(staticCells({ 6: 100 }), mesFiltro)}
          acumulado={
            mesFiltro == null || mesFiltro === 'resultado' || mesFiltro === 6
              ? { value: 100, label: '100,00%' }
              : { value: null, label: '-' }
          }
        />
        <OverviewKpiHeatRow
          title="NPS**"
          meta={Infinity}
          metaLabel="Meta 85%"
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(staticCells({}), mesFiltro)}
          acumulado={{ value: null, label: '-' }}
        />
        <OverviewKpiHeatRow
          title="Receita Bruta"
          meta={100}
          mesDestaque={mesDestaque}
          cells={loadingFinanceiroKpis ? Array.from({ length: 12 }, () => ({ value: null, label: '…' })) : cellsReceitaBruta}
          acumulado={loadingFinanceiroKpis ? { value: null, label: '…' } : acumuladoReceitaBruta}
        />
        <OverviewKpiHeatRow
          title="Índice de Inadimplência**"
          meta={Infinity}
          metaLabel="Meta x"
          mesDestaque={mesDestaque}
          cells={loadingFinanceiroKpis ? Array.from({ length: 12 }, () => ({ value: null, label: '…' })) : cellsInadimplencia}
          acumulado={loadingFinanceiroKpis ? { value: null, label: '…' } : acumuladoInadimplencia}
        />
        <OverviewKpiHeatRow
          title="Reputação**"
          meta={Infinity}
          metaLabel="Meta x"
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(staticCells({}), mesFiltro)}
          acumulado={{ value: null, label: '-' }}
        />
        <OverviewKpiHeatRow
          title="Êxito**"
          meta={Infinity}
          metaLabel="Meta x"
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(staticCells({}), mesFiltro)}
          acumulado={{ value: null, label: '-' }}
        />
      </div>

      {/* Bloco financeiro real do SIOE, com dados ao vivo do SIOE (adicional ao Overview do BI). */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Financeiro (SIOE)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EficienciaKpiCard
            title={
              typeof mesFiltro === 'number'
                ? `Recebido em ${String(mesFiltro).padStart(2, '0')}/${ano}`
                : mesFiltro === 'resultado'
                  ? 'Recebido (resultado)'
                  : 'Recebido no mês'
            }
            value={receitaMes ? formatCurrencyCompact(receitaMes.recebido) : '—'}
            hint={receitaMes ? `previsto ${formatCurrencyCompact(receitaMes.previsto)}` : undefined}
            icon={TrendingUp}
            accentClass="bg-green-100 text-green-700"
            loading={loadingReceita}
          />
          <EficienciaKpiCard
            title="Inadimplência total em aberto"
            value={inadimplencia ? formatCurrencyCompact(inadimplencia.totais.totalEmAberto) : '—'}
            hint="carteiras comitê + pontual + judicializada"
            icon={AlertTriangle}
            accentClass="bg-orange-100 text-orange-700"
            loading={loadingInadimplencia}
          />
          <EficienciaKpiCard
            title="Recuperado no mês"
            value={inadimplencia ? formatCurrencyCompact(inadimplencia.totais.totalRecuperadoMes) : '—'}
            hint={
              inadimplencia
                ? `${formatPercent(inadimplencia.totais.percentualRecuperacao)} de recuperação`
                : undefined
            }
            icon={TrendingUp}
            accentClass="bg-slate-100 text-slate-700"
            loading={loadingInadimplencia}
          />
        </div>
      </div>

      <RacionalSheet
        indicador={racionalAberto}
        titulo={racionalAberto ? RACIONAL_TITULOS[racionalAberto] : ''}
        ano={ano}
        mes={mesFiltro}
        area={area}
        resultado={racionalAberto ? resultadosRacional[racionalAberto] : null}
        metaAcumulado={racionalAberto ? metasRacional[racionalAberto].metaAcumulado : null}
        metaLabel={racionalAberto ? metasRacional[racionalAberto].metaLabel : undefined}
        onClose={() => setRacionalAberto(null)}
      />
    </div>
  )
}
