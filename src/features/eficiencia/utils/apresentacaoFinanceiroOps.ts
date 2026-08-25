import { MESES_NOME } from '@/features/receita/constants'
import { formatPercent } from '@/shared/utils/format'
import { cobrancaService } from '@/features/cobranca/services/cobrancaService'
import type { CobrancaPainelKpiRow } from '@/features/cobranca/services/cobrancaService'
import {
  EFICIENCIA_META_OPS_ANTECIPACAO,
  EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
  EFICIENCIA_META_OPS_FECHAMENTO,
  mesesEfetivosFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type {
  OpsLegaisAntecipacaoMesRow,
  OpsLegaisFechamentoMesRow,
} from '../types/eficiencia.types'
import { serieMensalEfetividade } from './opsEfetividadeCobranca'

export { EFICIENCIA_META_OPS_FECHAMENTO }

export type FinanceiroOpsMesCell = {
  mes: number
  mesLabelLong: string
  valor: number | null
  label: string
  /** null = sem dado (traço neutro). */
  atingiu: boolean | null
}

export type FinanceiroOpsIndicadorRow = {
  id: 'antecipacao' | 'efetividade' | 'fechamento'
  titulo: string
  metaLabel: string
  meta: number
  cells: FinanceiroOpsMesCell[]
  acumValor: number | null
  acumLabel: string
  acumAtingiu: boolean | null
}

export type ApresentacaoFinanceiroOpsData = {
  ano: number
  meses: number[]
  rows: FinanceiroOpsIndicadorRow[]
}

function mesesAtivos(
  mesFiltro: MesFiltroEficiencia,
  ano: number,
  ref = new Date(),
): number[] {
  const efetivos = mesesEfetivosFiltro(mesFiltro, ano, ref)
  if (efetivos && efetivos.length > 0) return efetivos
  if (ano < ref.getFullYear()) return Array.from({ length: 12 }, (_, i) => i + 1)
  if (ano > ref.getFullYear()) return [1]
  return Array.from({ length: ref.getMonth() + 1 }, (_, i) => i + 1)
}

function cellPct(mes: number, valor: number | null, meta: number): FinanceiroOpsMesCell {
  if (valor == null) {
    return {
      mes,
      mesLabelLong: MESES_NOME[mes - 1] ?? String(mes),
      valor: null,
      label: '-',
      atingiu: null,
    }
  }
  return {
    mes,
    mesLabelLong: MESES_NOME[mes - 1] ?? String(mes),
    valor,
    label: formatPercent(valor),
    atingiu: valor >= meta,
  }
}

export function buildApresentacaoFinanceiroOps(
  antecipacao: OpsLegaisAntecipacaoMesRow[],
  fechamento: OpsLegaisFechamentoMesRow[],
  cobrancaRows: CobrancaPainelKpiRow[],
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): ApresentacaoFinanceiroOpsData {
  const meses = mesesAtivos(mesFiltro, ano)
  const antecipByMes = new Map(antecipacao.map((r) => [r.mes, r]))
  const fechamentoByMes = new Map(fechamento.map((r) => [r.mes, r]))
  const efetivByMes = new Map(serieMensalEfetividade(cobrancaRows, ano).map((r) => [r.mes, r]))

  let antecipOk = 0
  let antecipTotal = 0
  const antecipCells = meses.map((mes) => {
    const row = antecipByMes.get(mes)
    const total =
      Number(row?.qtd_dentro_prazo ?? 0) + Number(row?.qtd_fora_prazo ?? 0)
    if (!row || total <= 0) return cellPct(mes, null, EFICIENCIA_META_OPS_ANTECIPACAO)
    antecipOk += Number(row.qtd_dentro_prazo ?? 0)
    antecipTotal += total
    return cellPct(mes, Number(row.pct_antecipacao ?? 0), EFICIENCIA_META_OPS_ANTECIPACAO)
  })
  const antecipAcum = antecipTotal > 0 ? (antecipOk / antecipTotal) * 100 : null

  let efetOk = 0
  let efetTotal = 0
  const efetCells = meses.map((mes) => {
    const row = efetivByMes.get(mes)
    if (!row || row.total <= 0) {
      return cellPct(mes, null, EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA)
    }
    efetOk += row.cobrados_d1
    efetTotal += row.total
    return cellPct(mes, row.pct_efetividade, EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA)
  })
  const efetAcum = efetTotal > 0 ? (efetOk / efetTotal) * 100 : null

  let fechOk = 0
  let fechTotal = 0
  const fechCells = meses.map((mes) => {
    const row = fechamentoByMes.get(mes)
    const total =
      Number(row?.qtd_dentro_prazo ?? 0) + Number(row?.qtd_fora_prazo ?? 0)
    if (!row || total <= 0) return cellPct(mes, null, EFICIENCIA_META_OPS_FECHAMENTO)
    fechOk += Number(row.qtd_dentro_prazo ?? 0)
    fechTotal += total
    return cellPct(mes, Number(row.pct_fechamento ?? 0), EFICIENCIA_META_OPS_FECHAMENTO)
  })
  const fechAcum = fechTotal > 0 ? (fechOk / fechTotal) * 100 : null

  const rows: FinanceiroOpsIndicadorRow[] = [
    {
      id: 'antecipacao',
      titulo: 'Antecipação de faturamento de Honorários',
      metaLabel: `Meta: ${formatPercent(EFICIENCIA_META_OPS_ANTECIPACAO)}`,
      meta: EFICIENCIA_META_OPS_ANTECIPACAO,
      cells: antecipCells,
      acumValor: antecipAcum,
      acumLabel: antecipAcum == null ? '-' : formatPercent(antecipAcum),
      acumAtingiu:
        antecipAcum == null ? null : antecipAcum >= EFICIENCIA_META_OPS_ANTECIPACAO,
    },
    {
      id: 'efetividade',
      titulo: 'Efetividade na cobrança Inicial',
      metaLabel: `Meta: ${formatPercent(EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA)}`,
      meta: EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
      cells: efetCells,
      acumValor: efetAcum,
      acumLabel: efetAcum == null ? '-' : formatPercent(efetAcum),
      acumAtingiu:
        efetAcum == null
          ? null
          : efetAcum >= EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
    },
    {
      id: 'fechamento',
      titulo: 'Fechamento',
      metaLabel: `Meta: ${formatPercent(EFICIENCIA_META_OPS_FECHAMENTO)}`,
      meta: EFICIENCIA_META_OPS_FECHAMENTO,
      cells: fechCells,
      acumValor: fechAcum,
      acumLabel: fechAcum == null ? '-' : formatPercent(fechAcum),
      acumAtingiu:
        fechAcum == null ? null : fechAcum >= EFICIENCIA_META_OPS_FECHAMENTO,
    },
  ]

  return { ano, meses, rows }
}

export async function fetchApresentacaoFinanceiroOps(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): Promise<ApresentacaoFinanceiroOpsData> {
  const [antecipacao, fechamento, cobrancaRows] = await Promise.all([
    eficienciaService.fetchOpsLegaisAntecipacaoMensal(ano),
    eficienciaService.fetchOpsLegaisFechamentoMensal(ano),
    cobrancaService.listPainelKpi(),
  ])
  return buildApresentacaoFinanceiroOps(
    antecipacao,
    fechamento,
    cobrancaRows,
    ano,
    mesFiltro,
  )
}
