import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import { receitaInadimplenciaService } from '@/features/receita/services/receitaInadimplenciaService'
import { receitaMetasService } from '@/features/receita/services/receitaMetasService'
import { receitaService } from '@/features/receita/services/receitaService'
import type { GestaoVistaMesRow, ReceitaMesRow } from '@/features/receita/types/receita.types'
import type { ReceitaInadimplenciaDepartamentoMes } from '@/features/receita/types/receitaInadimplencia.types'
import { buildReceitaMetaAreaSlices } from '@/features/receita/utils/departamentoAreaCores'
import { inadimplenciaAreaPeriodo } from '@/features/receita/utils/receitaInadimplenciaAreaFilter'
import {
  buildGestaoVistaArea,
  buildGestaoVistaConsolidado,
} from '@/features/receita/utils/receitaGestaoVista'
import { formatPercent } from '@/shared/utils/format'
import type { MesFiltroEficiencia } from '../constants'
import { atingiuMetaKpi } from './overviewKpiMeta'
import {
  buildOverviewInadimplencia,
  buildOverviewReceitaBruta,
} from './overviewFinanceiroKpis'
import type { ApresentacaoCell, ApresentacaoColunaKey } from './apresentacaoMatrix'
import { receitaAreaKeyFromColuna } from './apresentacaoMatrix'

export type ApresentacaoFinanceiroBundle = {
  rows: ReceitaMesRow[]
  /** chave área meta → meses; consolidado em `null` */
  mesesPorArea: Map<string | null, GestaoVistaMesRow[]>
}

export async function fetchApresentacaoFinanceiroBundle(
  ano: number,
): Promise<ApresentacaoFinanceiroBundle> {
  const metas = await receitaMetasService.getMetas()
  const { rows } = await receitaService.buildDashboard(metas)
  const mesMax = mesMaxDisponivelInadimplencia(ano)
  const meses = rows.map((r) => r.mes)

  const [deptRecebido, deptPrevisto, inadDashboard, gruposDeptPeriodo, ...deptMesEntries] =
    await Promise.all([
      receitaService.fetchRecebidoPorDepartamento(ano),
      receitaService.fetchPrevistoPorDepartamento(ano),
      receitaInadimplenciaService.fetchDashboard({
        ano,
        mesInicio: 1,
        mesFim: mesMax > 0 ? mesMax : 12,
      }),
      mesMax > 0
        ? receitaInadimplenciaService.fetchGruposDepartamentoPeriodo(ano, 1, mesMax, true)
        : Promise.resolve([]),
      ...meses.map(async (mes) => {
        const deptRows = await receitaInadimplenciaService.fetchDepartamentosMes(ano, mes)
        return [mes, deptRows] as const
      }),
    ])

  const inadDeptPorMes = Object.fromEntries(deptMesEntries) as Record<
    number,
    ReceitaInadimplenciaDepartamentoMes[]
  >

  const mesesCongelados = new Set<number>()
  for (const m of inadDashboard.evolucao) {
    if (m.congelado) mesesCongelados.add(m.mes)
  }

  const mesesPorArea = new Map<string | null, GestaoVistaMesRow[]>()
  const previstoPeriodo = inadDashboard.evolucao
    .filter((m) => m.mes <= mesMax)
    .reduce((s, m) => s + (m.previsto ?? 0), 0)

  const consolidado = buildGestaoVistaConsolidado(
    rows,
    inadDashboard.evolucao,
    inadDashboard.valor_total_periodo,
    previstoPeriodo,
    ano,
  )
  mesesPorArea.set(null, consolidado.meses)

  const slices = buildReceitaMetaAreaSlices()
  for (const slice of slices) {
    const inadPeriodo = inadimplenciaAreaPeriodo(gruposDeptPeriodo, slice.key)
    const built = buildGestaoVistaArea(
      rows,
      deptRecebido,
      deptPrevisto,
      inadDeptPorMes,
      mesesCongelados,
      slice.key,
      slice.pct,
      inadPeriodo,
      ano,
    )
    mesesPorArea.set(slice.key, built.meses)
  }

  return { rows, mesesPorArea }
}

function cellVazio(): ApresentacaoCell {
  return { label: '-', value: null, atingiu: null }
}

function fromHeat(
  value: number | null,
  label: string,
  meta: number | null,
): ApresentacaoCell {
  if (value == null) return cellVazio()
  const atingiu =
    meta == null || !Number.isFinite(meta) ? null : atingiuMetaKpi(value, meta)
  return {
    value,
    label: label.includes('%') ? formatPercent(value) : label,
    atingiu,
  }
}

export function cellApresentacaoCrescimentoReceita(
  colKey: ApresentacaoColunaKey,
  bundle: ApresentacaoFinanceiroBundle | null | undefined,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): ApresentacaoCell {
  if (!bundle) return cellVazio()
  const areaKey = receitaAreaKeyFromColuna(colKey)
  if (areaKey === null) return cellVazio()
  const meses = bundle.mesesPorArea.get(areaKey === undefined ? null : areaKey)
  if (!meses?.length) return cellVazio()
  const { acumulado } = buildOverviewReceitaBruta(
    meses,
    bundle.rows,
    ano,
    mesFiltro,
  )
  return fromHeat(acumulado.value, acumulado.label, 100)
}

export function cellApresentacaoIndiceInadimplencia(
  colKey: ApresentacaoColunaKey,
  bundle: ApresentacaoFinanceiroBundle | null | undefined,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): ApresentacaoCell {
  if (!bundle) return cellVazio()
  const areaKey = receitaAreaKeyFromColuna(colKey)
  if (areaKey === null) return cellVazio()
  const meses = bundle.mesesPorArea.get(areaKey === undefined ? null : areaKey)
  if (!meses?.length) return cellVazio()
  const { acumulado } = buildOverviewInadimplencia(meses, mesFiltro, ano)
  // Sem meta numérica definida no BI ("Meta x") — só exibe o valor.
  return fromHeat(acumulado.value, acumulado.label, null)
}
