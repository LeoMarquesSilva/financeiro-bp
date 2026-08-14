import type { ReactNode } from 'react'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_SLA_PROTOCOLO,
  MES_INICIO_RESULTADO,
} from '../constants'
import type { EficienciaOverview } from '../types/eficiencia.types'
import type { ApresentacaoFinanceiroBundle } from '../utils/apresentacaoFinanceiro'
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

const PCT0 = (v: number) => `${v.toFixed(2)}%`
const VAZIA: HeatCell = { value: null, label: '-' }

function somaRazaoPct(numeros: number[], denominadores: number[]): HeatCell {
  const num = numeros.reduce((a, b) => a + b, 0)
  const den = denominadores.reduce((a, b) => a + b, 0)
  if (den === 0) return VAZIA
  const v = (num / den) * 100
  return { value: v, label: PCT0(v) }
}

function formatMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function formatMetaDesenvolvimentoEquipe(
  overviewByAno: Map<number, EficienciaOverview>,
  slots: MesAno[],
): string {
  const anos = [...new Set(slots.map((s) => s.ano))]
  const pessoas = Math.max(
    0,
    ...anos.map((a) => overviewByAno.get(a)?.treinamentos?.pessoas_ativas ?? 0),
  )
  const metaMin = anos.reduce(
    (s, a) => s + (overviewByAno.get(a)?.treinamentos?.meta_minutos ?? 0),
    0,
  )
  if (pessoas <= 0 || metaMin <= 0) return 'Meta 100%'
  return `Meta: ${formatMinutos(metaMin)}h (${pessoas} pessoas · proporcional × ${anos.length}a)`
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
  const opcoes = opcoesMesAnoAteHoje()
  const slots = enumerateMesAno(inicio, fim)
  const monthLabels = slots.map(labelMesAno)
  const anos = anosNoPeriodo(inicio, fim)

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

  if (loading || anos.some((a) => !overviewByAno.has(a))) {
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
      return { value: row.pct_eficiencia, label: PCT0(row.pct_eficiencia) }
    })
    const efiCells = slots.map((slot) => {
      const row = pick((o) => o.eficienciaProtocolo, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return { value: row.pct_eficiencia, label: PCT0(row.pct_eficiencia) }
    })
    const agendaCells = slots.map((slot) => {
      const row = pick((o) => o.agendamento, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return { value: row.pct_dentro_prazo, label: PCT0(row.pct_dentro_prazo) }
    })
    const vistRiscoCells = slots.map((slot) => {
      const row = pick((o) => o.slaVistagemRisco, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return { value: row.pct_d1, label: PCT0(row.pct_d1) }
    })
    const vistNormalCells = slots.map((slot) => {
      const row = pick((o) => o.slaVistagemComum, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return { value: row.pct_d1, label: PCT0(row.pct_d1) }
    })

    const treinoCells = slots.map((slot) => {
      const row = pick((o) => o.treinamentosMensal, slot, (r, m) => r.mes === m)
      if (!row) return VAZIA
      return {
        value: row.pct_atingimento,
        label: `${formatMinutos(row.minutos_lancados)} (${formatPercent(row.pct_atingimento)})`,
      }
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
      return { value: row.pctMeta, label: PCT0(row.pctMeta) }
    })

    const inadCells = slots.map((slot) => {
      if (slot.mes < MES_INICIO_RESULTADO) return VAZIA
      const fin = financeiroByAno.get(slot.ano)
      const gestao = fin?.mesesPorArea.get(null) ?? []
      const row = gestao.find((m) => m.mes === slot.mes)
      if (!row || row.inadimplenciaPct == null) return VAZIA
      return { value: row.inadimplenciaPct, label: PCT0(row.inadimplenciaPct) }
    })

    const npsCells = slots.map(() => VAZIA)

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
      const metaMin = anos.reduce(
        (s, a) => s + (overviewByAno.get(a)?.treinamentos?.meta_minutos ?? 0),
        0,
      )
      const pct = metaMin > 0 ? (minutos / metaMin) * 100 : treinoRows[0]!.pct_atingimento
      return {
        value: pct,
        label: `${formatMinutos(minutos)} (${formatPercent(pct)})`,
      }
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
      const pct = (recebido / meta) * 100
      return { value: pct, label: PCT0(pct) }
    })()

    const acumuladoInad: HeatCell = (() => {
      let inad = 0
      let previsto = 0
      for (const slot of slots) {
        if (slot.mes < MES_INICIO_RESULTADO) continue
        const gestao = financeiroByAno.get(slot.ano)?.mesesPorArea.get(null) ?? []
        const row = gestao.find((m) => m.mes === slot.mes)
        if (!row || row.inadimplencia == null || row.inadimplencia <= 0) continue
        inad += row.inadimplencia
        previsto += row.previsto
      }
      if (previsto <= 0) return VAZIA
      const pct = (inad / previsto) * 100
      return { value: pct, label: PCT0(pct) }
    })()

    const fimNorm = compareMesAno(inicio, fim) <= 0 ? fim : inicio

    /** Retenção: 1 célula por mês (valor do ano), sem colspan — alinha no PPT.
     * Texto no mês do meio de cada ano; `yearBands` funde o visual em pílula. */
    const retencaoCells: HeatCell[] = (() => {
      const out: HeatCell[] = slots.map(() => VAZIA)
      let i = 0
      while (i < slots.length) {
        const ano = slots[i]!.ano
        let j = i + 1
        while (j < slots.length && slots[j]!.ano === ano) j += 1
        const ov = overviewByAno.get(ano)
        const mid = Math.floor((i + j - 1) / 2)
        for (let k = i; k < j; k++) {
          if (!ov?.turnover) {
            out[k] = VAZIA
            continue
          }
          out[k] = {
            value: ov.turnover.pct_retencao,
            label: k === mid ? formatPercent(ov.turnover.pct_retencao) : '\u00A0',
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

    content = (
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
          metaLabel={`Meta ${metaRetencao}%`}
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
          metaLabel={`Meta ${EFICIENCIA_META_INDICE_INADIMPLENCIA}%`}
          metaComparacao="maximo"
          monthLabels={monthLabels}
          cells={inadCells}
          acumulado={acumuladoInad}
        />
        <OverviewKpiHeatCard
          showAcumulado={false}
          title="NPS"
          meta={Infinity}
          metaLabel="Meta 85%"
          monthLabels={monthLabels}
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
      </div>

      <div
        data-apresentacao-export="juridico_unificado"
        data-apresentacao-fill-slide
        style={{
          width: '100%',
          minWidth: 1100,
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: 4,
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
