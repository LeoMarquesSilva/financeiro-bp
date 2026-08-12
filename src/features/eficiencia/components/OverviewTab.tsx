import { useRef, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPercent } from '@/shared/utils/format'
import { copyOverviewKpiCardsToClipboard } from '@/shared/utils/copyChartImage'
import { Button } from '@/components/ui/button'
import { OverviewKpiHeatRow, type HeatCell } from './OverviewKpiHeatRow'
import { AreaFilterButtons } from './AreaFilterButtons'
import { RacionalSheet } from './RacionalSheet'
import {
  EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL,
  EFICIENCIA_META_OPS_CADASTRO,
  EFICIENCIA_META_OPS_EFICIENCIA,
  EFICIENCIA_META_OPS_PUBLICACOES,
  EFICIENCIA_META_OPS_SLA_PROTOCOLO,
  EFICIENCIA_META_SLA_PROTOCOLO,
  isAgendamentoVistagemIndisponivelPorArea,
  isMesesFiltro,
  isPeriodoCurtoFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useOverviewFinanceiroKpis } from '../hooks/useOverviewFinanceiroKpis'
import type { EficienciaOverview, RacionalIndicador } from '../types/eficiencia.types'
import {
  aplicarCelulasFiltro,
  buildOverviewInadimplencia,
  buildOverviewReceitaBruta,
} from '../utils/overviewFinanceiroKpis'
import { acumuladoGestaoPdi, buildGestaoPdiCells } from '../utils/gestaoPdiCalc'
import { resolveMetaTexto } from '../utils/overviewKpiMeta'

type Props = {
  ano: number
  data: EficienciaOverview | null
  loading: boolean
  area: string | null
  onAreaChange: (area: string | null) => void
  mesFiltro: MesFiltroEficiencia
  /** Áreas visíveis no filtro (null = todas). */
  allowedAreas?: readonly string[] | null
  allowTodasAreas?: boolean
  /** Exibir slicer de área (admin/sócio: todas; coordenador: Todas + área dele). */
  showAreaFilter?: boolean
}

const RACIONAL_TITULOS: Record<RacionalIndicador, string> = {
  sla_protocolo: 'SLA PROTOCOLO',
  eficiencia_protocolo: 'Eficiência Protocolo',
  ops_legais_sla_protocolo: 'SLA PROTOCOLO',
  ops_legais_eficiencia_protocolo: 'Eficiência Protocolo',
  ops_legais_pub_analise: 'ANÁLISE DE PUBLICAÇÃO',
  ops_legais_pub_agendamento: 'AGENDAMENTO DE PUBLICAÇÃO',
  ops_legais_cadastro: 'Eficiência Cadastro',
  sla_ciencia_agendamentos: 'SLA Ciência Agendamentos',
  sla_vistagem_risco: 'SLA Vistagem Risco',
  sla_vistagem_normal: 'SLA Vistagem Normal',
  desenvolvimento_equipe: 'Desenvolvimento Equipe',
  retencao_talentos: 'Retenção de Talentos',
  gestao_pdi: 'Gestão de PDI',
  receita_bruta: 'Receita Bruta',
  indice_inadimplencia: 'Índice de Inadimplência',
  ops_legais_iniciativas: 'Iniciativas Estratégicas',
  ops_legais_marketing: 'Marketing Instagram',
}

const PCT0 = (v: number) => `${v.toFixed(2)}%`

const CELULAS_VAZIAS: HeatCell[] = Array.from({ length: 12 }, () => ({
  value: null,
  label: '-',
}))
const ACUMULADO_VAZIO: HeatCell = { value: null, label: '-' }

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

/** Meta anual de treinamentos — ex.: `Meta: 588:00h (42 x 14h)`. */
function formatMetaDesenvolvimentoEquipe(
  treinamentos: EficienciaOverview['treinamentos'],
): string {
  if (!treinamentos || treinamentos.pessoas_ativas <= 0) return 'Meta 100%'
  return `Meta: ${formatMinutos(treinamentos.meta_minutos)}h (${treinamentos.pessoas_ativas} x 14h)`
}

export function OverviewTab({
  ano,
  data,
  loading,
  area,
  onAreaChange,
  mesFiltro,
  allowedAreas,
  allowTodasAreas = true,
  showAreaFilter = true,
}: Props) {
  const [racionalAberto, setRacionalAberto] = useState<RacionalIndicador | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const copyRef = useRef<HTMLDivElement>(null)
  const mesDestaque = isMesesFiltro(mesFiltro) ? mesFiltro : null
  const { data: financeiroKpis, isLoading: loadingFinanceiroKpis } = useOverviewFinanceiroKpis(ano)

  if (loading || !data) {
    return (
      <div className="space-y-3">
        {showAreaFilter ? (
          <AreaFilterButtons
            value={area}
            onChange={onAreaChange}
            allowedAreas={allowedAreas}
            allowTodas={allowTodasAreas}
            ano={ano}
            mesFiltro={mesFiltro}
          />
        ) : null}
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  // Indicadores anuais: Resultado NÃO apaga jan–mai nem recorta o Acum. (meta = ano todo).
  const treinamentosCells: HeatCell[] = Array.from({ length: 12 }, (_, i) => {
    const row = data.treinamentosMensal.find((r) => r.mes === i + 1)
    if (!row) return { value: null, label: '-' }
    return {
      value: row.pct_atingimento,
      label: `${formatMinutos(row.minutos_lancados)} (${formatPercent(row.pct_atingimento)})`,
    }
  })
  const treinamentosAcumulado: HeatCell = data.treinamentos
    ? {
        value: data.treinamentos.pct_atingimento,
        label: `${formatMinutos(data.treinamentos.minutos_lancados)} (${formatPercent(data.treinamentos.pct_atingimento)})`,
      }
    : { value: null, label: '-' }

  const retencaoCell: HeatCell = data.turnover
    ? { value: data.turnover.pct_retencao, label: formatPercent(data.turnover.pct_retencao) }
    : { value: null, label: '-' }

  const filterMensal = <T extends { mes: number }>(rows: T[]) =>
    rows.filter((r) => mesNoFiltro(r.mes, mesFiltro, ano))

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
    // Ano todo e Resultado: Acum. = atingimento anual (pessoas × 14h).
    mesFiltro == null || mesFiltro === 'resultado'
      ? treinamentosAcumulado
      : (() => {
          const rows = filterMensal(data.treinamentosMensal)
          if (rows.length === 0) return { value: null, label: '-' }
          const minutos = rows.reduce((s, r) => s + r.minutos_lancados, 0)
          const metaAno =
            data.treinamentos?.meta_minutos ?? rows[0]?.meta_minutos ?? 0
          const pct = metaAno > 0 ? (minutos / metaAno) * 100 : rows[0]!.pct_atingimento
          return {
            value: pct,
            label: `${formatMinutos(minutos)} (${formatPercent(pct)})`,
          }
        })()

  const slaProtocoloMetasPorMes = Array.from({ length: 12 }, (_, i) => {
    if (mesFiltro === 'resultado' && !mesNoFiltro(i + 1, 'resultado', ano)) return null
    const row = data.slaProtocolo.find((r) => r.mes === i + 1)
    return row?.meta ?? null
  })
  const slaProtocoloMetaAcumulado = (() => {
    const rows = filterMensal(data.slaProtocolo)
    const metas = rows.map((r) => r.meta).filter((m): m is number => m != null)
    return metas.length > 0 ? Math.min(...metas) : EFICIENCIA_META_SLA_PROTOCOLO
  })()

  const vistagemNormalIndisponivel =
    area === EFICIENCIA_AREA_SEM_VISTAGEM_NORMAL || isAgendamentoVistagemIndisponivelPorArea(area)
  const agendamentoVistagemOpsLegais = isAgendamentoVistagemIndisponivelPorArea(area)
  const cellsVistagemNormal: HeatCell[] = vistagemNormalIndisponivel
    ? CELULAS_VAZIAS
    : aplicarCelulasFiltro(buildCells(data.slaVistagemComum, (r) => r.pct_d1), mesFiltro, ano)
  const acumuladoVistagemComumExibicao: HeatCell = vistagemNormalIndisponivel
    ? ACUMULADO_VAZIO
    : acumuladoVistagemComum
  const cellsAgendamento: HeatCell[] = agendamentoVistagemOpsLegais
    ? CELULAS_VAZIAS
    : aplicarCelulasFiltro(buildCells(data.agendamento, (r) => r.pct_dentro_prazo), mesFiltro, ano)
  const acumuladoAgendamentoExibicao: HeatCell = agendamentoVistagemOpsLegais
    ? ACUMULADO_VAZIO
    : acumuladoAgendamento
  const cellsVistagemRisco: HeatCell[] = agendamentoVistagemOpsLegais
    ? CELULAS_VAZIAS
    : aplicarCelulasFiltro(buildCells(data.slaVistagemRisco, (r) => r.pct_d1), mesFiltro, ano)
  const acumuladoVistagemRiscoExibicao: HeatCell = agendamentoVistagemOpsLegais
    ? ACUMULADO_VAZIO
    : acumuladoVistagemRisco

  const receitaBruta = financeiroKpis
    ? buildOverviewReceitaBruta(financeiroKpis.meses, financeiroKpis.rows, ano, mesFiltro)
    : null
  const inadimplenciaOverview = financeiroKpis
    ? buildOverviewInadimplencia(financeiroKpis.meses, mesFiltro, ano)
    : null

  const cellsReceitaBruta = aplicarCelulasFiltro(
    receitaBruta?.cells ??
      Array.from({ length: 12 }, () => ({ value: null, label: '-' })),
    mesFiltro,
    ano,
  )
  const acumuladoReceitaBruta: HeatCell =
    receitaBruta?.acumulado ?? { value: null, label: '-' }

  const cellsInadimplencia = aplicarCelulasFiltro(
    inadimplenciaOverview?.cells ??
      Array.from({ length: 12 }, () => ({ value: null, label: '-' })),
    mesFiltro,
    ano,
  )
  const acumuladoInadimplencia: HeatCell =
    inadimplenciaOverview?.acumulado ?? { value: null, label: '-' }

  const cellsGestaoPdi = aplicarCelulasFiltro(
    data ? buildGestaoPdiCells(data.gestaoPdiMensal ?? []) : CELULAS_VAZIAS,
    mesFiltro,
    ano,
  )
  const acumuladoGestaoPdiCell: HeatCell = data
    ? acumuladoGestaoPdi(data.gestaoPdiMensal ?? [], mesFiltro, ano)
    : ACUMULADO_VAZIO

  const resultadosRacional: Record<RacionalIndicador, HeatCell> = {
    sla_protocolo: acumuladoSlaProtocolo,
    eficiencia_protocolo: acumuladoEficienciaProtocolo,
    ops_legais_sla_protocolo: ACUMULADO_VAZIO,
    ops_legais_eficiencia_protocolo: ACUMULADO_VAZIO,
    ops_legais_pub_analise: ACUMULADO_VAZIO,
    ops_legais_pub_agendamento: ACUMULADO_VAZIO,
    ops_legais_cadastro: ACUMULADO_VAZIO,
    sla_ciencia_agendamentos: acumuladoAgendamentoExibicao,
    sla_vistagem_risco: acumuladoVistagemRiscoExibicao,
    sla_vistagem_normal: acumuladoVistagemComumExibicao,
    desenvolvimento_equipe: acumuladoTreinamentos,
    retencao_talentos: retencaoCell,
    gestao_pdi: acumuladoGestaoPdiCell,
    receita_bruta: acumuladoReceitaBruta,
    indice_inadimplencia: acumuladoInadimplencia,
    ops_legais_iniciativas: ACUMULADO_VAZIO,
    ops_legais_marketing: ACUMULADO_VAZIO,
  }

  const slaProtocoloMetasFiltradas = (() => {
    if (isMesesFiltro(mesFiltro)) {
      return mesFiltro.map((m) => slaProtocoloMetasPorMes[m - 1] ?? null)
    }
    if (mesFiltro === 'resultado' || isPeriodoCurtoFiltro(mesFiltro)) {
      return slaProtocoloMetasPorMes.map((m, i) =>
        mesNoFiltro(i + 1, mesFiltro, ano) ? m : null,
      )
    }
    return slaProtocoloMetasPorMes
  })()

  const metaDesenvolvimentoEquipe = formatMetaDesenvolvimentoEquipe(data.treinamentos)

  const metasRacional: Record<RacionalIndicador, { metaAcumulado: number; metaLabel?: string }> =
    {
      sla_protocolo: {
        metaAcumulado: slaProtocoloMetaAcumulado,
        metaLabel: resolveMetaTexto(
          EFICIENCIA_META_SLA_PROTOCOLO,
          undefined,
          slaProtocoloMetasFiltradas,
        ),
      },
      eficiencia_protocolo: { metaAcumulado: 95 },
      ops_legais_sla_protocolo: { metaAcumulado: EFICIENCIA_META_OPS_SLA_PROTOCOLO },
      ops_legais_eficiencia_protocolo: { metaAcumulado: EFICIENCIA_META_OPS_EFICIENCIA },
      ops_legais_pub_analise: { metaAcumulado: EFICIENCIA_META_OPS_PUBLICACOES },
      ops_legais_pub_agendamento: { metaAcumulado: EFICIENCIA_META_OPS_PUBLICACOES },
      ops_legais_cadastro: { metaAcumulado: EFICIENCIA_META_OPS_CADASTRO },
      sla_ciencia_agendamentos: { metaAcumulado: 95 },
      sla_vistagem_risco: { metaAcumulado: 98 },
      sla_vistagem_normal: { metaAcumulado: 98 },
      desenvolvimento_equipe: {
        metaAcumulado: 100,
        metaLabel: metaDesenvolvimentoEquipe,
      },
      retencao_talentos: {
        metaAcumulado: data.turnover?.meta_pct_retencao_minima ?? 90,
      },
      gestao_pdi: { metaAcumulado: 100 },
      receita_bruta: { metaAcumulado: 100 },
      indice_inadimplencia: { metaAcumulado: Infinity, metaLabel: 'Meta x' },
      ops_legais_iniciativas: { metaAcumulado: 100 },
      ops_legais_marketing: { metaAcumulado: 100 },
    }

  const handleCopiarOverview = async () => {
    const container = copyRef.current
    if (!container) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }

    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-overview-copy-card]'))
    if (cards.length === 0) {
      toast.error('Conteúdo não disponível para cópia')
      return
    }

    setCopyStatus('loading')
    try {
      await copyOverviewKpiCardsToClipboard(cards)
      setCopyStatus('done')
      toast.success('Conteúdo copiado — cole no PowerPoint com Ctrl+V')
      window.setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (error) {
      setCopyStatus('idle')
      const message =
        error instanceof Error ? error.message : 'Não foi possível copiar o conteúdo'
      toast.error(message)
    }
  }

  const CopyIcon =
    copyStatus === 'loading' ? Loader2 : copyStatus === 'done' ? Check : Copy

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {showAreaFilter ? (
          <div className="min-w-0 flex-1">
            <AreaFilterButtons
              value={area}
              onChange={onAreaChange}
              allowedAreas={allowedAreas}
              allowTodas={allowTodasAreas}
              ano={ano}
              mesFiltro={mesFiltro}
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700"
          onClick={handleCopiarOverview}
          disabled={copyStatus === 'loading' || loadingFinanceiroKpis}
          aria-label="Copiar indicadores filtrados para PowerPoint"
        >
          <CopyIcon
            className={copyStatus === 'loading' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
            aria-hidden
          />
          COPIAR
        </Button>
      </div>

      {/* Réplica do Overview do BI: ordem e métricas idênticas às páginas KPI_HTML_*_MENSAL. */}
      <div ref={copyRef} className="space-y-3">
        <OverviewKpiHeatRow
          title="SLA Protocolo"
          meta={EFICIENCIA_META_SLA_PROTOCOLO}
          metasPorMes={slaProtocoloMetasPorMes}
          metaAcumulado={slaProtocoloMetaAcumulado}
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(
            buildCells(data.slaProtocolo, (r) => r.pct_eficiencia),
            mesFiltro,
            ano,
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
            ano,
          )}
          acumulado={acumuladoEficienciaProtocolo}
          onRacionalClick={() => setRacionalAberto('eficiencia_protocolo')}
        />
        <OverviewKpiHeatRow
          title="SLA Ciência Agendamentos"
          meta={95}
          mesDestaque={mesDestaque}
          cells={cellsAgendamento}
          acumulado={acumuladoAgendamentoExibicao}
          onRacionalClick={
            agendamentoVistagemOpsLegais
              ? undefined
              : () => setRacionalAberto('sla_ciencia_agendamentos')
          }
        />
        <OverviewKpiHeatRow
          title="SLA Vistagem Risco"
          meta={98}
          mesDestaque={mesDestaque}
          cells={cellsVistagemRisco}
          acumulado={acumuladoVistagemRiscoExibicao}
          onRacionalClick={
            agendamentoVistagemOpsLegais
              ? undefined
              : () => setRacionalAberto('sla_vistagem_risco')
          }
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
          metaLabel={metaDesenvolvimentoEquipe}
          mesDestaque={mesDestaque}
          cells={treinamentosCells}
          acumulado={acumuladoTreinamentos}
          onRacionalClick={() => setRacionalAberto('desenvolvimento_equipe')}
        />
        <OverviewKpiHeatRow
          title="Retenção de Talentos"
          meta={90}
          modoAnual
          anoLabel={String(ano)}
          cells={[]}
          acumulado={retencaoCell}
          onRacionalClick={() => setRacionalAberto('retencao_talentos')}
        />
        <OverviewKpiHeatRow
          title="Gestão de PDI"
          meta={100}
          mesDestaque={mesDestaque}
          cells={cellsGestaoPdi}
          acumulado={acumuladoGestaoPdiCell}
          onRacionalClick={() => setRacionalAberto('gestao_pdi')}
        />
        <OverviewKpiHeatRow
          title="Receita Bruta"
          meta={100}
          mesDestaque={mesDestaque}
          cells={
            loadingFinanceiroKpis
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsReceitaBruta
          }
          acumulado={loadingFinanceiroKpis ? { value: null, label: '…' } : acumuladoReceitaBruta}
          onRacionalClick={() => setRacionalAberto('receita_bruta')}
        />
        <OverviewKpiHeatRow
          title="Índice de Inadimplência"
          meta={Infinity}
          metaLabel="Meta x"
          mesDestaque={mesDestaque}
          cells={
            loadingFinanceiroKpis
              ? Array.from({ length: 12 }, () => ({ value: null, label: '…' }))
              : cellsInadimplencia
          }
          acumulado={
            loadingFinanceiroKpis ? { value: null, label: '…' } : acumuladoInadimplencia
          }
          onRacionalClick={() => setRacionalAberto('indice_inadimplencia')}
        />
      </div>

      <div className="space-y-3">
        <OverviewKpiHeatRow
          title="NPS"
          meta={Infinity}
          metaLabel="Meta 85%"
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(staticCells({}), mesFiltro, ano)}
          acumulado={{ value: null, label: '-' }}
        />
        <OverviewKpiHeatRow
          title="Reputação**"
          meta={Infinity}
          metaLabel="Meta x"
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(staticCells({}), mesFiltro, ano)}
          acumulado={{ value: null, label: '-' }}
        />
        <OverviewKpiHeatRow
          title="Êxito**"
          meta={Infinity}
          metaLabel="Meta x"
          mesDestaque={mesDestaque}
          cells={aplicarCelulasFiltro(staticCells({}), mesFiltro, ano)}
          acumulado={{ value: null, label: '-' }}
        />
      </div>

      <RacionalSheet
        indicador={racionalAberto}
        titulo={racionalAberto ? RACIONAL_TITULOS[racionalAberto] : ''}
        ano={ano}
        mes={
          // Desenvolvimento e Retenção são anuais: Resultado = ano todo no racional.
          racionalAberto === 'desenvolvimento_equipe' || racionalAberto === 'retencao_talentos'
            ? mesFiltro === 'resultado'
              ? null
              : mesFiltro
            : mesFiltro
        }
        area={area}
        resultado={racionalAberto ? resultadosRacional[racionalAberto] : null}
        metaAcumulado={racionalAberto ? metasRacional[racionalAberto].metaAcumulado : null}
        metaLabel={racionalAberto ? metasRacional[racionalAberto].metaLabel : undefined}
        onClose={() => setRacionalAberto(null)}
      />
    </div>
  )
}
