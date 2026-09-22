import type { ReactNode } from 'react'
import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_NPS,
  EFICIENCIA_NPS_MES_INICIO,
  EFICIENCIA_META_SLA_PROTOCOLO,
  MES_INICIO_RESULTADO,
} from '../constants'
import type { EficienciaOverview } from '../types/eficiencia.types'
import { eficienciaService } from '../services/eficienciaService'
import type { NpsKpi } from '../utils/npsCalc'
import type { ApresentacaoFinanceiroBundle } from '../utils/apresentacaoFinanceiro'
import { valorExibicaoEvolucao } from '@/features/receita/utils/receitaInadimplenciaCalc'
import {
  anosNoPeriodo,
  compareMesAno,
  enumerateMesAno,
  labelMesAno,
  mesAnoFromValue,
  mesAnoToValue,
  opcoesMesAnoAteHoje,
  type MesAno,
} from '../utils/apresentacaoMesAno'
import {
  buildDesenvolvimentoEquipeHeatCell,
  formatMinutosHeatLabel,
} from '../utils/desenvolvimentoEquipeHeatCell'
import { metaTreinamentoPeriodoMinutos } from '../utils/treinamentoMetaProporcional'
import {
  ApresentacaoUnificadoLinhasGrid,
  type UnificadoLinhaPonto,
  type UnificadoLinhaSerie,
} from './ApresentacaoUnificadoLinhasGrid'
import { OverviewKpiHeatCard, type HeatCell } from './OverviewKpiHeatRow'

type Props = {
  /** Overview consolidado por ano. */
  overviewByAno: Map<number, EficienciaOverview>
  /** Bundle financeiro por ano. */
  financeiroByAno: Map<number, ApresentacaoFinanceiroBundle>
  loading?: boolean
  inicio: MesAno
  fim: MesAno
  onInicioChange: (v: MesAno) => void
  onFimChange: (v: MesAno) => void
}

const VAZIA: HeatCell = { value: null, label: '-' }

type VisaoUnificado = 'tabela' | 'linha'

function cellsToLinePoints(cells: HeatCell[], labels: string[]): UnificadoLinhaPonto[] {
  return cells.map((cell, i) => ({
    label: labels[i] ?? '',
    valor: cell.value,
    rotulo:
      cell.value == null || cell.label === '-' || cell.label === '\u00A0'
        ? undefined
        : (cell.subLabel ?? cell.label),
  }))
}

function pctCell(value: number): HeatCell {
  return { value, label: formatPercent(value) }
}

function somaRazaoPct(numeros: number[], denominadores: number[]): HeatCell {
  const num = numeros.reduce((a, b) => a + b, 0)
  const den = denominadores.reduce((a, b) => a + b, 0)
  if (den === 0) return VAZIA
  const v = (num / den) * 100
  return pctCell(v)
}

function metaAnualEquipeMinutos(
  overviewByAno: Map<number, EficienciaOverview>,
  ano: number,
): number {
  return overviewByAno.get(ano)?.treinamentos?.meta_minutos ?? 0
}

function formatMetaDesenvolvimentoEquipe(
  overviewByAno: Map<number, EficienciaOverview>,
  slots: MesAno[],
): string {
  const metaMin = metaTreinamentoPeriodoMinutos(
    (ano) => metaAnualEquipeMinutos(overviewByAno, ano),
    slots,
  )
  if (metaMin <= 0) return 'Meta 100%'
  return `Meta ${formatMinutosHeatLabel(metaMin)}h`
}

function MesAnoSelect({
  label,
  value,
  onChange,
  opcoes,
}: {
  label: string
  value: MesAno
  onChange: (v: MesAno) => void
  opcoes: MesAno[]
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <span style={{ fontWeight: 600, color: '#64748B' }}>{label}</span>
      <select
        value={mesAnoToValue(value)}
        onChange={(e) => onChange(mesAnoFromValue(e.target.value))}
        style={{
          height: 28,
          borderRadius: 6,
          border: '1px solid #CBD5E1',
          background: '#fff',
          padding: '0 8px',
          fontSize: 11,
          fontWeight: 600,
          color: '#0F172A',
        }}
      >
        {opcoes.map((o) => (
          <option key={mesAnoToValue(o)} value={mesAnoToValue(o)}>
            {labelMesAno(o)}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Indicadores jurídicos consolidados multi-ano (Jan/25…), layout Overview,
 * com filtro De/Até mês/ano. Colunas = Mes/AA do intervalo.
 */
export function ApresentacaoJuridicoUnificadoBloco({
  overviewByAno,
  financeiroByAno,
  loading,
  inicio,
  fim,
  onInicioChange,
  onFimChange,
}: Props) {
  const [visao, setVisao] = useState<VisaoUnificado>('tabela')
  const opcoes = opcoesMesAnoAteHoje()
  const slots = enumerateMesAno(inicio, fim)
  const monthLabels = slots.map(labelMesAno)
  const anos = anosNoPeriodo(inicio, fim)
  const npsQueries = useQueries({
    queries: anos.map((y) => ({
      queryKey: ['eficiencia', 'nps', y] as const,
      queryFn: (): Promise<NpsKpi> => eficienciaService.fetchNpsKpi(y),
      staleTime: 5 * 60 * 1000,
    })),
  })
  const npsByAno = new Map<number, NpsKpi>()
  anos.forEach((y, i) => {
    const kpi = npsQueries[i]?.data
    if (kpi) npsByAno.set(y, kpi)
  })

  const pick = <T,>(
    getRows: (ov: EficienciaOverview) => T[],
    slot: MesAno,
    match: (row: T, mes: number) => boolean,
  ): T | null => {
    const ov = overviewByAno.get(slot.ano)
    if (!ov) return null
    return getRows(ov).find((r) => match(r, slot.mes)) ?? null
  }

  let content: ReactNode

  if (
    loading ||
    anos.some((a) => !overviewByAno.has(a)) ||
    npsQueries.some((q: { isLoading: boolean; isPending: boolean }) => q.isLoading || q.isPending)
  ) {
    content = (
      <div style={{ display: 'grid', gap: 8, padding: 4 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            style={{ height: 56, borderRadius: 8, background: 'rgba(0,0,0,0.06)' }}
          />
        ))}
      </div>
    )
  } else {
    const slaCells = slots.map((slot) => {
      const row = pick((o) => o.slaProtocolo, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return pctCell(row.pct_eficiencia)
    })
    const efiCells = slots.map((slot) => {
      const row = pick((o) => o.eficienciaProtocolo, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return pctCell(row.pct_eficiencia)
    })
    const agendaCells = slots.map((slot) => {
      const row = pick((o) => o.agendamento, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return pctCell(row.pct_dentro_prazo)
    })
    const vistRiscoCells = slots.map((slot) => {
      const row = pick((o) => o.slaVistagemRisco, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return pctCell(row.pct_d1)
    })
    const vistNormalCells = slots.map((slot) => {
      const row = pick((o) => o.slaVistagemComum, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return pctCell(row.pct_d1)
    })

    const treinoCells = slots.map((slot) => {
      const row = pick((o) => o.treinamentosMensal, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return buildDesenvolvimentoEquipeHeatCell(row.minutos_lancados, row.pct_atingimento)
    })

    const pdiCells = slots.map((slot) => {
      const row = pick((o) => o.gestaoPdiMensal ?? [], slot, (r, m) => r.mes === m)
      if (!row || row.pct_aptas == null) return VAZIA
      return { value: row.pct_aptas, label: formatPercent(row.pct_aptas) }
    })

    const receitaCells = slots.map((slot) => {
      if (slot.mes < MES_INICIO_RESULTADO) return VAZIA
      const fin = financeiroByAno.get(slot.ano)
      const gestao = fin?.mesesPorArea.get(null) ?? []
      const row = gestao.find((m) => m.mes === slot.mes)
      if (!row || row.pctMeta == null) return VAZIA
      return pctCell(row.pctMeta)
    })

    const inadCells = slots.map((slot) => {
      if (slot.mes < MES_INICIO_RESULTADO) return VAZIA
      const fin = financeiroByAno.get(slot.ano)
      const row = fin?.inadDashboard.evolucao.find((m) => m.mes === slot.mes)
      if (!row) return VAZIA
      const { pct } = valorExibicaoEvolucao(row)
      if (pct <= 0 && row.valor <= 0) return VAZIA
      return pctCell(pct)
    })

    const npsBuilt = (() => {
      const cells: HeatCell[] = []
      const colSpans: number[] = []
      let i = 0
      while (i < slots.length) {
        const anoSlot = slots[i]!.ano
        let j = i + 1
        while (j < slots.length && slots[j]!.ano === anoSlot) j += 1
        const yearSlots = slots.slice(i, j)
        const kpi = npsByAno.get(anoSlot)
        const nps = kpi?.nps
        const startBand = yearSlots.findIndex((s) => s.mes >= EFICIENCIA_NPS_MES_INICIO)
        if (nps == null || startBand < 0) {
          for (let k = 0; k < yearSlots.length; k++) {
            cells.push(VAZIA)
            colSpans.push(1)
          }
        } else {
          for (let k = 0; k < startBand; k++) {
            cells.push(VAZIA)
            colSpans.push(1)
          }
          cells.push({ value: nps, label: formatPercent(nps) })
          colSpans.push(yearSlots.length - startBand)
        }
        i = j
      }
      return { cells, colSpans }
    })()
    const npsCells = npsBuilt.cells
    const npsColSpans = npsBuilt.colSpans

    // Acumulados no intervalo
    const slaRows = slots
      .map((s) => pick((o) => o.slaProtocolo, s, (r, m) => r.mes === m))
      .filter((r): r is NonNullable<typeof r> => r != null)
    const efiRows = slots
      .map((s) => pick((o) => o.eficienciaProtocolo, s, (r, m) => r.mes === m))
      .filter((r): r is NonNullable<typeof r> => r != null)
    const agendaRows = slots
      .map((s) => pick((o) => o.agendamento, s, (r, m) => r.mes === m))
      .filter((r): r is NonNullable<typeof r> => r != null)
    const vistRiscoRows = slots
      .map((s) => pick((o) => o.slaVistagemRisco, s, (r, m) => r.mes === m))
      .filter((r): r is NonNullable<typeof r> => r != null)
    const vistNormalRows = slots
      .map((s) => pick((o) => o.slaVistagemComum, s, (r, m) => r.mes === m))
      .filter((r): r is NonNullable<typeof r> => r != null)

    const acumuladoSla = somaRazaoPct(
      slaRows.map((r) => r.qtd_d1),
      slaRows.map((r) => r.qtd_total),
    )
    const acumuladoEfi = somaRazaoPct(
      efiRows.map((r) => r.sem_inconsistencia),
      efiRows.map((r) => r.total),
    )
    const acumuladoAgenda = somaRazaoPct(
      agendaRows.map((r) => r.dentro_prazo),
      agendaRows.map((r) => r.dentro_prazo + r.fora_prazo),
    )
    const acumuladoVistRisco = somaRazaoPct(
      vistRiscoRows.map((r) => r.vistado_d1),
      vistRiscoRows.map((r) => r.total),
    )
    const acumuladoVistNormal = somaRazaoPct(
      vistNormalRows.map((r) => r.vistado_d1),
      vistNormalRows.map((r) => r.total),
    )

    const slaMetas = slots.map((slot) => {
      const row = pick((o) => o.slaProtocolo, slot, (r, m) => r.mes === m)
      return row?.meta ?? null
    })
    const slaMetaAcum = (() => {
      const metas = slaMetas.filter((m): m is number => m != null)
      return metas.length > 0 ? Math.min(...metas) : EFICIENCIA_META_SLA_PROTOCOLO
    })()

    const treinoRows = slots
      .map((s) => pick((o) => o.treinamentosMensal, s, (r, m) => r.mes === m))
      .filter((r): r is NonNullable<typeof r> => r != null)
    const acumuladoTreino: HeatCell = (() => {
      if (treinoRows.length === 0) return VAZIA
      const minutos = treinoRows.reduce((s, r) => s + r.minutos_lancados, 0)
      const metaMin = metaTreinamentoPeriodoMinutos(
        (ano) => metaAnualEquipeMinutos(overviewByAno, ano),
        slots,
      )
      const pct = metaMin > 0 ? (minutos / metaMin) * 100 : treinoRows[0]!.pct_atingimento
      return buildDesenvolvimentoEquipeHeatCell(minutos, pct)
    })()

    const pdiRows = slots
      .map((s) => pick((o) => o.gestaoPdiMensal ?? [], s, (r, m) => r.mes === m))
      .filter((r): r is NonNullable<typeof r> => r != null)
    const acumuladoPdi: HeatCell = (() => {
      if (pdiRows.length === 0) return VAZIA
      const elegiveis = pdiRows.reduce((s, r) => s + r.elegiveis, 0)
      const aptas = pdiRows.reduce((s, r) => s + r.aptas, 0)
      if (elegiveis <= 0) return VAZIA
      const pct = Math.round((aptas / elegiveis) * 10000) / 100
      return { value: pct, label: formatPercent(pct) }
    })()

    const acumuladoReceita: HeatCell = (() => {
      let recebido = 0
      let meta = 0
      for (const slot of slots) {
        if (slot.mes < MES_INICIO_RESULTADO) continue
        const gestao = financeiroByAno.get(slot.ano)?.mesesPorArea.get(null) ?? []
        const row = gestao.find((m) => m.mes === slot.mes)
        if (!row) continue
        recebido += row.recebido ?? 0
        meta += row.meta ?? 0
      }
      if (meta <= 0) return VAZIA
      return pctCell((recebido / meta) * 100)
    })()

    const acumuladoInad: HeatCell = (() => {
      const candidatos = slots
        .filter((s) => s.mes >= MES_INICIO_RESULTADO)
        .map((slot) => {
          const row = financeiroByAno
            .get(slot.ano)
            ?.inadDashboard.evolucao.find((m) => m.mes === slot.mes)
          if (!row) return null
          const exib = valorExibicaoEvolucao(row)
          if (exib.pct <= 0 && exib.valor <= 0) return null
          return { slot, exib, congelado: row.congelado }
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
      if (candidatos.length === 0) return VAZIA
      const congelados = candidatos.filter((c) => c.congelado)
      const pool = congelados.length > 0 ? congelados : candidatos
      const last = pool.reduce((best, c) =>
        c.slot.ano > best.slot.ano ||
        (c.slot.ano === best.slot.ano && c.slot.mes > best.slot.mes)
          ? c
          : best,
      )
      return pctCell(last.exib.pct)
    })()

    const metaTreinoMin = metaTreinamentoPeriodoMinutos(
      (ano) => metaAnualEquipeMinutos(overviewByAno, ano),
      slots,
    )
    const treinoLinhaPoints: UnificadoLinhaPonto[] = (() => {
      let acc = 0
      let started = false
      return slots.map((slot, i) => {
        const row = pick((o) => o.treinamentosMensal, slot, (r, m) => r.mes === m)
        if (row) {
          acc += row.minutos_lancados
          started = true
        }
        return {
          label: monthLabels[i] ?? '',
          valor: started ? acc : null,
          rotulo: started ? formatMinutosHeatLabel(acc) : undefined,
        }
      })
    })()

    const npsLinhaPoints: UnificadoLinhaPonto[] = slots.map((slot, i) => {
      const nps = npsByAno.get(slot.ano)?.nps
      if (nps == null || slot.mes < EFICIENCIA_NPS_MES_INICIO) {
        return { label: monthLabels[i] ?? '', valor: null }
      }
      const firstOfYear =
        slots.findIndex((s) => s.ano === slot.ano && s.mes >= EFICIENCIA_NPS_MES_INICIO) === i
      return {
        label: monthLabels[i] ?? '',
        valor: nps,
        rotulo: firstOfYear ? formatPercent(nps) : undefined,
      }
    })

    const retencaoLinhaPoints: UnificadoLinhaPonto[] = slots.map((slot, i) => {
      const pct = overviewByAno.get(slot.ano)?.turnover?.pct_retencao
      if (pct == null) return { label: monthLabels[i] ?? '', valor: null }
      const firstOfYear = slots.findIndex((s) => s.ano === slot.ano) === i
      return {
        label: monthLabels[i] ?? '',
        valor: pct,
        rotulo: firstOfYear ? formatPercent(pct) : undefined,
      }
    })

    const fimNorm = compareMesAno(inicio, fim) <= 0 ? fim : inicio

    /** Retenção: indicador anual — valor único por ano, rótulo no 1º mês da faixa. */
    const retencaoCells: HeatCell[] = (() => {
      const out: HeatCell[] = slots.map(() => VAZIA)
      let i = 0
      while (i < slots.length) {
        const ano = slots[i]!.ano
        let j = i + 1
        while (j < slots.length && slots[j]!.ano === ano) j += 1
        const ov = overviewByAno.get(ano)
        const label =
          ov?.turnover != null ? formatPercent(ov.turnover.pct_retencao) : '-'
        for (let k = i; k < j; k++) {
          if (!ov?.turnover) {
            out[k] = VAZIA
            continue
          }
          out[k] = {
            value: ov.turnover.pct_retencao,
            label: k === i ? label : '\u00A0',
          }
        }
        i = j
      }
      return out
    })()
    const metaRetencao =
      overviewByAno.get(fimNorm.ano)?.turnover?.meta_pct_retencao_minima ??
      overviewByAno.get(slots[0]?.ano ?? fimNorm.ano)?.turnover?.meta_pct_retencao_minima ??
      90

    const seriesLinha: UnificadoLinhaSerie[] = [
      {
        id: 'sla_protocolo',
        title: 'SLA Protocolo',
        meta: slaMetaAcum,
        metaLabel: `Meta ${formatPercent(slaMetaAcum)}`,
        yKind: 'pct',
        points: cellsToLinePoints(slaCells, monthLabels),
      },
      {
        id: 'efi_protocolo',
        title: 'Eficiência Protocolo',
        meta: 95,
        metaLabel: `Meta ${formatPercent(95)}`,
        yKind: 'pct',
        points: cellsToLinePoints(efiCells, monthLabels),
      },
      {
        id: 'ciencia',
        title: 'SLA Ciência Agendamentos',
        meta: 95,
        metaLabel: `Meta ${formatPercent(95)}`,
        yKind: 'pct',
        points: cellsToLinePoints(agendaCells, monthLabels),
      },
      {
        id: 'vist_risco',
        title: 'SLA Vistagem Risco',
        meta: 98,
        metaLabel: `Meta ${formatPercent(98)}`,
        yKind: 'pct',
        points: cellsToLinePoints(vistRiscoCells, monthLabels),
      },
      {
        id: 'vist_normal',
        title: 'SLA Vistagem Normal',
        meta: 98,
        metaLabel: `Meta ${formatPercent(98)}`,
        yKind: 'pct',
        points: cellsToLinePoints(vistNormalCells, monthLabels),
      },
      {
        id: 'desenvolvimento',
        title: 'Desenvolvimento Equipe',
        meta: metaTreinoMin,
        metaLabel: formatMetaDesenvolvimentoEquipe(overviewByAno, slots),
        yKind: 'horas',
        points: treinoLinhaPoints,
      },
      {
        id: 'retencao',
        title: 'Retenção de Talentos',
        meta: metaRetencao,
        metaLabel: `Meta ${formatPercent(metaRetencao)}`,
        yKind: 'pct',
        points: retencaoLinhaPoints,
      },
      {
        id: 'pdi',
        title: 'Gestão de PDI',
        meta: 100,
        metaLabel: `Meta ${formatPercent(100)}`,
        yKind: 'pct',
        points: cellsToLinePoints(pdiCells, monthLabels),
      },
      {
        id: 'receita',
        title: 'Receita Bruta',
        meta: 100,
        metaLabel: `Meta ${formatPercent(100)}`,
        yKind: 'pct',
        points: cellsToLinePoints(receitaCells, monthLabels),
      },
      {
        id: 'inadimplencia',
        title: 'Índice de Inadimplência',
        meta: EFICIENCIA_META_INDICE_INADIMPLENCIA,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_INDICE_INADIMPLENCIA)}`,
        yKind: 'pct',
        yInvertido: true,
        points: cellsToLinePoints(inadCells, monthLabels),
      },
      {
        id: 'nps',
        title: 'NPS',
        meta: EFICIENCIA_META_NPS,
        metaLabel: `Meta ${formatPercent(EFICIENCIA_META_NPS)}`,
        yKind: 'pct',
        points: npsLinhaPoints,
      },
    ]

    content =
      visao === 'linha' ? (
        <ApresentacaoUnificadoLinhasGrid series={seriesLinha} />
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="SLA Protocolo"
          meta={EFICIENCIA_META_SLA_PROTOCOLO}
          metasPorMes={slaMetas}
          metaAcumulado={slaMetaAcum}
          monthLabels={monthLabels}
          cells={slaCells}
          acumulado={acumuladoSla}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="Eficiência Protocolo"
          meta={95}
          monthLabels={monthLabels}
          cells={efiCells}
          acumulado={acumuladoEfi}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="SLA Ciência Agendamentos"
          meta={95}
          monthLabels={monthLabels}
          cells={agendaCells}
          acumulado={acumuladoAgenda}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="SLA Vistagem Risco"
          meta={98}
          monthLabels={monthLabels}
          cells={vistRiscoCells}
          acumulado={acumuladoVistRisco}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="SLA Vistagem Normal"
          meta={98}
          monthLabels={monthLabels}
          cells={vistNormalCells}
          acumulado={acumuladoVistNormal}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="Desenvolvimento Equipe"
          meta={100}
          metaLabel={formatMetaDesenvolvimentoEquipe(overviewByAno, slots)}
          monthLabels={monthLabels}
          cells={treinoCells}
          acumulado={acumuladoTreino}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="Retenção de Talentos"
          meta={metaRetencao}
          monthLabels={monthLabels}
          yearBands
          cells={retencaoCells}
          acumulado={VAZIA}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="Gestão de PDI"
          meta={100}
          monthLabels={monthLabels}
          cells={pdiCells}
          acumulado={acumuladoPdi}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="Receita Bruta"
          meta={100}
          monthLabels={monthLabels}
          cells={receitaCells}
          acumulado={acumuladoReceita}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="Índice de Inadimplência"
          meta={EFICIENCIA_META_INDICE_INADIMPLENCIA}
          metaComparacao="maximo"
          monthLabels={monthLabels}
          cells={inadCells}
          acumulado={acumuladoInad}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="NPS"
          meta={EFICIENCIA_META_NPS}
          metaLabel={`Meta ${formatPercent(EFICIENCIA_META_NPS)}`}
          monthLabels={monthLabels}
          cellColSpans={npsColSpans}
          cells={npsCells}
          acumulado={VAZIA}
        />
      </div>
      )
  }

  const periodoLabel =
    slots.length > 0
      ? `${labelMesAno(slots[0]!)} – ${labelMesAno(slots[slots.length - 1]!)}`
      : ''

  return (
    <div
      style={{
        width: '100%',
        minWidth: 1100,
        minHeight: visao === 'linha' ? 'calc(95vh - 200px)' : undefined,
        height: visao === 'linha' ? 'calc(95vh - 200px)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      <div
        data-chart-export-ignore
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
          Período Jurídico Unificado (mês/ano)
        </span>
        <MesAnoSelect
          label="De"
          value={inicio}
          onChange={onInicioChange}
          opcoes={opcoes}
        />
        <MesAnoSelect label="Até" value={fim} onChange={onFimChange} opcoes={opcoes} />
        {periodoLabel ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
            {periodoLabel}
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Ver por</span>
          {(
            [
              ['tabela', 'Tabela'] as const,
              ['linha', 'Gráfico de linha'] as const,
            ] as const
          ).map(([id, label]) => {
            const ativo = visao === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setVisao(id)}
                style={{
                  height: 28,
                  borderRadius: 6,
                  border: ativo ? '1px solid #1D4ED8' : '1px solid #CBD5E1',
                  background: ativo ? '#EFF6FF' : '#fff',
                  padding: '0 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: ativo ? '#1D4ED8' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
          {visao === 'linha' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginLeft: 8, fontSize: 10, fontWeight: 600, color: '#2B2B2B' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 14, height: 2, background: '#1B3A6B', borderRadius: 1 }} />
                Resultado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 14, height: 0, borderTop: '2px dashed #E6C200' }} />
                Meta
              </span>
            </span>
          ) : null}
        </span>
      </div>

      <div
        data-apresentacao-export="juridico_unificado"
        data-apresentacao-fill-slide
        style={{
          width: '100%',
          minWidth: 1100,
          flex: visao === 'linha' ? '1 1 auto' : undefined,
          minHeight: visao === 'linha' ? 0 : undefined,
          height: visao === 'linha' ? '100%' : undefined,
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: visao === 'linha' ? 0 : 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {content}
      </div>
    </div>
  )
}
