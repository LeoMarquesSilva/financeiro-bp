import { mesMaxDisponivelInadimplencia } from '@/features/receita/constants'
import { receitaInadimplenciaService } from '@/features/receita/services/receitaInadimplenciaService'
import { receitaMetasService } from '@/features/receita/services/receitaMetasService'
import { receitaService } from '@/features/receita/services/receitaService'
import type {
  GestaoVistaMesRow,
  ReceitaMesRow,
  ReceitaRecebidoDepartamentoRow,
} from '@/features/receita/types/receita.types'
import type {
  ReceitaInadimplenciaDashboard,
  ReceitaInadimplenciaDepartamentoMes,
  ReceitaInadimplenciaEvolucaoMes,
  ReceitaInadimplenciaGrupoDepartamentoPeriodo,
  ReceitaInadimplenciaGrupoMes,
} from '@/features/receita/types/receitaInadimplencia.types'
import { buildReceitaMetaAreaSlices } from '@/features/receita/utils/departamentoAreaCores'
import {
  aplicarFiltroAreaInadimplencia,
  inadimplenciaAreaPeriodo,
} from '@/features/receita/utils/receitaInadimplenciaAreaFilter'
import {
  aplicarSelecaoGrupos,
  type SelecaoGruposPorMes,
  valorExibicaoEvolucao,
} from '@/features/receita/utils/receitaInadimplenciaCalc'
import {
  buildGestaoVistaArea,
  buildGestaoVistaConsolidado,
} from '@/features/receita/utils/receitaGestaoVista'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  isMesesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { atingiuMetaKpi, type MetaComparacaoKpi } from './overviewKpiMeta'
import {
  buildOverviewReceitaBruta,
  receitaBrutaMonetarioAcumulado,
} from './overviewFinanceiroKpis'
import type { ApresentacaoCell, ApresentacaoColunaKey } from './apresentacaoMatrix'
import { receitaAreaKeyFromColuna } from './apresentacaoMatrix'

export type ApresentacaoFinanceiroBundle = {
  rows: ReceitaMesRow[]
  /** chave área meta → meses; consolidado em `null` */
  mesesPorArea: Map<string | null, GestaoVistaMesRow[]>
  inadDashboard: ReceitaInadimplenciaDashboard
  inadDeptPorMes: Record<number, ReceitaInadimplenciaDepartamentoMes[]>
  deptPrevisto: ReceitaRecebidoDepartamentoRow[]
  gruposDeptPeriodo: ReceitaInadimplenciaGrupoDepartamentoPeriodo[]
}

export async function fetchApresentacaoFinanceiroBundle(
  ano: number,
): Promise<ApresentacaoFinanceiroBundle> {
  const metas = await receitaMetasService.getMetas()
  const { rows } = await receitaService.buildDashboard(metas)
  const mesMax = mesMaxDisponivelInadimplencia(ano)
  const meses = rows.map((r) => r.mes)

  const [deptRecebido, deptPrevisto, inadDashboardRaw, gruposDeptPeriodo, ...deptMesEntries] =
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

  /** Mesma base da Evolução na Receita: aplica seleção salva de grupos (mês ajustado). */
  let inadDashboard = inadDashboardRaw
  if (mesMax > 0) {
    try {
      const selecoes = await receitaInadimplenciaService.fetchSelecoesMesPeriodo(ano, 1, mesMax)
      if (selecoes.length > 0) {
        const selecaoPorMes: SelecaoGruposPorMes = {}
        const gruposPorMes: Record<number, ReceitaInadimplenciaGrupoMes[]> = {}
        await Promise.all(
          selecoes.map(async ({ mes, grupos_incluidos }) => {
            const grupos = await receitaInadimplenciaService.fetchGruposMes(ano, mes)
            gruposPorMes[mes] = grupos
            selecaoPorMes[mes] = new Set(grupos_incluidos)
          }),
        )
        inadDashboard = aplicarSelecaoGrupos(inadDashboardRaw, gruposPorMes, selecaoPorMes)
      }
    } catch {
      // Sem tabela de seleção / falha — mantém dashboard do servidor.
    }
  }

  const inadDeptPorMes = Object.fromEntries(deptMesEntries) as Record<
    number,
    ReceitaInadimplenciaDepartamentoMes[]
  >

  const mesesCongelados = new Set<number>()
  for (const m of inadDashboard.evolucao) {
    if (m.congelado) mesesCongelados.add(m.mes)
  }

  const mesesPorArea = new Map<string | null, GestaoVistaMesRow[]>()
  const consolidado = buildGestaoVistaConsolidado(
    rows,
    inadDashboard.evolucao,
    inadDashboard.valor_total_periodo,
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

  return {
    rows,
    mesesPorArea,
    inadDashboard,
    inadDeptPorMes,
    deptPrevisto,
    gruposDeptPeriodo,
  }
}

/** Mês de referência da evolução — último congelado no filtro (evita mês corrente ao vivo). */
function mesReferenciaInadEvolucao(
  evolucao: ReceitaInadimplenciaEvolucaoMes[],
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): number | null {
  if (isMesesFiltro(mesFiltro) && mesFiltro.length === 1) {
    return mesFiltro[0]!
  }

  const noEscopo = evolucao.filter((m) => mesNoFiltro(m.mes, mesFiltro, ano))
  if (noEscopo.length === 0) return null

  const congelados = noEscopo.filter((m) => m.congelado)
  const pool = congelados.length > 0 ? congelados : noEscopo
  return pool.reduce((best, m) => (m.mes > best.mes ? m : best)).mes
}

function dashboardInadParaColuna(
  bundle: ApresentacaoFinanceiroBundle,
  areaKey: string | null | undefined,
): ReceitaInadimplenciaDashboard {
  if (areaKey === undefined || areaKey === null) {
    return bundle.inadDashboard
  }
  const meses = bundle.inadDashboard.evolucao.map((m) => m.mes)
  return aplicarFiltroAreaInadimplencia(
    bundle.inadDashboard,
    areaKey,
    bundle.inadDeptPorMes,
    bundle.deptPrevisto,
    {},
    {},
    meses,
    bundle.gruposDeptPeriodo,
  )
}

/** Snapshot da Evolução da Inadimplência (mesma base do módulo Receita). */
export function valorInadEvolucaoApresentacao(
  bundle: ApresentacaoFinanceiroBundle,
  areaKey: string | null | undefined,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): { valor: number; pct: number } | null {
  const mesRef = mesReferenciaInadEvolucao(bundle.inadDashboard.evolucao, mesFiltro, ano)
  if (mesRef == null) return null

  const dash = dashboardInadParaColuna(bundle, areaKey)
  const row = dash.evolucao.find((m) => m.mes === mesRef)
  if (!row) return null

  const { valor, pct } = valorExibicaoEvolucao(row)
  if (valor <= 0 && pct <= 0) return null
  return { valor, pct }
}

function cellVazio(): ApresentacaoCell {
  return { label: '-', value: null, atingiu: null }
}

function fromHeat(
  value: number | null,
  label: string,
  meta: number | null,
  comparacao: MetaComparacaoKpi = 'minimo',
  valorDetalhe?: string | null,
): ApresentacaoCell {
  if (value == null) return cellVazio()
  const atingiu =
    meta == null || !Number.isFinite(meta)
      ? null
      : atingiuMetaKpi(value, meta, comparacao)
  return {
    value,
    label: label.includes('%') ? formatPercent(value) : label,
    atingiu,
    valorDetalhe: valorDetalhe ?? null,
  }
}

function labelReceitaMonetario(
  monetario: { recebido: number; meta: number } | null,
): string | null {
  if (!monetario) return null
  const rec = formatCurrencyCompact(monetario.recebido)
  const meta = formatCurrencyCompact(monetario.meta)
  return `${rec}\nMeta ${meta}`
}

function labelInadMonetario(valor: number | null): string | null {
  if (valor == null || valor <= 0) return null
  return formatCurrency(valor)
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
  const monetario = receitaBrutaMonetarioAcumulado(
    meses,
    bundle.rows,
    ano,
    mesFiltro,
  )
  return fromHeat(
    acumulado.value,
    acumulado.label,
    100,
    'minimo',
    labelReceitaMonetario(monetario),
  )
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
  const evolucao = valorInadEvolucaoApresentacao(bundle, areaKey, mesFiltro, ano)
  if (!evolucao) return cellVazio()
  return fromHeat(
    evolucao.pct,
    formatPercent(evolucao.pct),
    EFICIENCIA_META_INDICE_INADIMPLENCIA,
    'maximo',
    labelInadMonetario(evolucao.valor),
  )
}
