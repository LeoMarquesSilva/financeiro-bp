import { supabase } from '@/lib/supabaseClient'
import {
  EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO,
  EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO,
  MES_INICIO_RESULTADO,
  type MesFiltroEficiencia,
} from '../constants'
import type { RacionalColuna, RacionalIndicador, RacionalResultado } from '../types/eficiencia.types'

const RACIONAL_LIMITE = 500

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseQuery = any

export type RacionalFiltro =
  | { tipo: 'eq'; coluna: string; valor: string }
  /** NOT IN estrito — exclui NULL (listas de tarefas, etc.). */
  | { tipo: 'notIn'; coluna: string; valores: string[] }
  /** NULL ou NOT IN — replica `(col IS NULL OR col NOT IN (...))` dos RPCs. */
  | { tipo: 'excludeInAllowNull'; coluna: string; valores: string[] }
  | { tipo: 'notNull'; coluna: string }
  | { tipo: 'orEq'; coluna: string; valores: string[] }
  /** NULL ou <> valor — replica `(col IS NULL OR col <> valor)`. */
  | { tipo: 'distinctFrom'; coluna: string; valor: string }

export type RacionalConfig = {
  tabela: string
  dataColuna: string
  areaColuna: string | null
  colunas: RacionalColuna[]
  filtros?: RacionalFiltro[]
}

type AnyQuery = SupabaseQuery

function quoteInList(valores: string[]): string {
  return `(${valores.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(',')})`
}

export function applyRacionalPeriodo(
  query: AnyQuery,
  dataColuna: string,
  ano: number,
  mes: MesFiltroEficiencia,
): AnyQuery {
  if (mes === 'resultado') {
    const inicio = `${ano}-${String(MES_INICIO_RESULTADO).padStart(2, '0')}-01`
    return query.gte(dataColuna, inicio).lt(dataColuna, `${ano + 1}-01-01`)
  }
  if (typeof mes === 'number' && mes >= 1 && mes <= 12) {
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const fim =
      mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    return query.gte(dataColuna, inicio).lt(dataColuna, fim)
  }
  return query.gte(dataColuna, `${ano}-01-01`).lt(dataColuna, `${ano + 1}-01-01`)
}

export function applyRacionalArea(
  query: AnyQuery,
  areaColuna: string | null,
  area: string | null,
): AnyQuery {
  if (area && areaColuna) return query.eq(areaColuna, area)
  return query
}

export function applyRacionalFiltroNativo(
  query: AnyQuery,
  filtro: RacionalFiltro,
  skip = false,
): AnyQuery {
  if (skip) return query
  switch (filtro.tipo) {
    case 'eq':
      return query.eq(filtro.coluna, filtro.valor)
    case 'notIn':
      return query.not(filtro.coluna, 'in', quoteInList(filtro.valores))
    case 'excludeInAllowNull':
      return query.or(
        `${filtro.coluna}.is.null,${filtro.coluna}.not.in.${quoteInList(filtro.valores)}`,
      )
    case 'notNull':
      return query.not(filtro.coluna, 'is', null)
    case 'orEq':
      return query.in(filtro.coluna, filtro.valores)
    case 'distinctFrom':
      return query.or(`${filtro.coluna}.is.null,${filtro.coluna}.neq.${filtro.valor}`)
    default:
      return query
  }
}

function normalizeNome(nome: string): string {
  return nome.trim().toUpperCase()
}

/** População de treinamentos = join por nome com sp_turnover (mesmos filtros do RPC). */
export async function fetchDesenvolvimentoRacional(
  cfg: RacionalConfig,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
): Promise<RacionalResultado> {
  let turnoverQuery = supabase
    .from('sp_turnover')
    .select('nome')
    .lte('admissao', `${ano}-12-31`)
    .or(`desligamento.is.null,desligamento.gte.${ano}-01-01`)

  if (area) {
    turnoverQuery = turnoverQuery.eq('area', area)
  } else {
    turnoverQuery = turnoverQuery.or('area.is.null,area.neq.Tributário')
  }

  turnoverQuery = turnoverQuery.or(
    `cargo.is.null,cargo.not.in.${quoteInList([...EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO])}`,
  )

  const { data: turnoverRows, error: turnoverError } = await turnoverQuery
  if (turnoverError) throw turnoverError

  const nomesElegiveis = new Set(
    ((turnoverRows ?? []) as Array<{ nome: string | null }>)
      .map((r) => normalizeNome(String(r.nome ?? '')))
      .filter(Boolean),
  )

  let trainingQuery = supabase
    .from('sp_treinamentos_presenca')
    .select(cfg.colunas.map((c) => c.key).join(','))
    .order(cfg.dataColuna, { ascending: false })
    .limit(RACIONAL_LIMITE + 200)

  trainingQuery = applyRacionalPeriodo(trainingQuery, cfg.dataColuna, ano, mes)

  const { data: trainingRows, error: trainingError } = await trainingQuery
  if (trainingError) throw trainingError

  const linhas = ((trainingRows ?? []) as Array<Record<string, unknown>>).filter((row) =>
    nomesElegiveis.has(normalizeNome(String(row.colaborador ?? ''))),
  )

  return {
    colunas: cfg.colunas,
    linhas: linhas.slice(0, RACIONAL_LIMITE),
    truncado: linhas.length > RACIONAL_LIMITE,
  }
}

export function applyRetencaoRacionalPeriodo(
  query: AnyQuery,
  ano: number,
  mes: MesFiltroEficiencia,
): AnyQuery {
  query = query
    .lte('admissao', `${ano}-12-31`)
    .or(`desligamento.is.null,desligamento.gte.${ano}-01-01`)

  if (mes === 'resultado') {
    return query.or(`desligamento.is.null,desligamento.gte.${ano}-06-01`)
  }
  if (typeof mes === 'number' && mes >= 1 && mes <= 12) {
    const fim =
      mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
    return query.or(`desligamento.is.null,desligamento.lt.${fim}`)
  }
  return query
}

export function shouldSkipFiltroRetencaoArea(
  indicador: RacionalIndicador,
  filtro: RacionalFiltro,
  area: string | null,
): boolean {
  return (
    indicador === 'retencao_talentos' &&
    filtro.tipo === 'excludeInAllowNull' &&
    filtro.coluna === 'area' &&
    area != null
  )
}

export function formatRacionalPeriodoLabel(ano: number, mes: MesFiltroEficiencia): string {
  if (mes === 'resultado') return `resultado (jun–dez/${ano})`
  if (typeof mes === 'number') return `${String(mes).padStart(2, '0')}/${ano}`
  return String(ano)
}

export function buildRacionalBaseQuery(
  cfg: RacionalConfig,
  indicador: RacionalIndicador,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
  select: string,
): AnyQuery {
  let query = supabase.from(cfg.tabela as never).select(select)

  switch (indicador) {
    case 'sla_protocolo':
      // F antes de D em ordem desc → FATAL, depois D-1.
      query = query
        .order('fatal_apos18', { ascending: false })
        .order(cfg.dataColuna, { ascending: false })
      break
    case 'eficiencia_protocolo':
      // I antes de E em ordem desc → INCONSISTÊNCIA, depois EFICIÊNCIA.
      query = query
        .order('status_inconsistencia', { ascending: false })
        .order(cfg.dataColuna, { ascending: false })
      break
    case 'sla_ciencia_agendamentos':
      // F antes de D em ordem desc → Fora do Prazo, depois Dentro do prazo.
      query = query
        .order('fatal_sem18_d1', { ascending: false })
        .order(cfg.dataColuna, { ascending: false })
      break
    default:
      query = query.order(cfg.dataColuna, { ascending: false })
  }

  if (indicador === 'retencao_talentos') {
    query = applyRetencaoRacionalPeriodo(query, ano, mes)
  } else {
    query = applyRacionalPeriodo(query, cfg.dataColuna, ano, mes)
  }

  query = applyRacionalArea(query, cfg.areaColuna, area)

  for (const f of cfg.filtros ?? []) {
    query = applyRacionalFiltroNativo(
      query,
      f,
      shouldSkipFiltroRetencaoArea(indicador, f, area),
    )
  }

  return query
}

const RACIONAL_FETCH_PAGE = 1000

export async function fetchRacionalLinhasCompletas(
  cfg: RacionalConfig,
  indicador: RacionalIndicador,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
  select: string,
): Promise<Array<Record<string, unknown>>> {
  const linhas: Array<Record<string, unknown>> = []
  let offset = 0

  while (true) {
    const query = buildRacionalBaseQuery(cfg, indicador, ano, area, mes, select).range(
      offset,
      offset + RACIONAL_FETCH_PAGE - 1,
    )

    const { data, error } = await query
    if (error) throw error

    const batch = (data ?? []) as Array<Record<string, unknown>>
    linhas.push(...batch)

    if (batch.length < RACIONAL_FETCH_PAGE) break
    offset += RACIONAL_FETCH_PAGE
  }

  return linhas
}

/** COUNT(DISTINCT ci) por fatal_apos18 — mesmos filtros do racional/KPI. */
export async function fetchSlaProtocoloRacionalResumo(
  cfg: RacionalConfig,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
): Promise<RacionalResultado['resumo']> {
  const d1Cis = new Set<string>()
  const fatalCis = new Set<string>()
  let offset = 0

  while (true) {
    const query = buildRacionalBaseQuery(cfg, 'sla_protocolo', ano, area, mes, 'ci,fatal_apos18').range(
      offset,
      offset + RACIONAL_FETCH_PAGE - 1,
    )

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ ci: string | null; fatal_apos18: string | null }>
    for (const row of rows) {
      const ci = String(row.ci ?? '').trim()
      if (!ci) continue
      if (row.fatal_apos18 === 'D-1') d1Cis.add(ci)
      if (row.fatal_apos18 === 'FATAL') fatalCis.add(ci)
    }

    if (rows.length < RACIONAL_FETCH_PAGE) break
    offset += RACIONAL_FETCH_PAGE
  }

  return {
    qtd_d1: d1Cis.size,
    qtd_fatal: fatalCis.size,
  }
}

/** COUNT(*) por status_inconsistencia — mesmos filtros do racional/KPI. */
export async function fetchEficienciaProtocoloRacionalResumo(
  cfg: RacionalConfig,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
): Promise<RacionalResultado['resumo']> {
  let qtd_eficiencia = 0
  let qtd_inconsistencia = 0
  let offset = 0

  while (true) {
    const query = buildRacionalBaseQuery(
      cfg,
      'eficiencia_protocolo',
      ano,
      area,
      mes,
      'status_inconsistencia',
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ status_inconsistencia: string | null }>
    for (const row of rows) {
      if (row.status_inconsistencia === 'EFICIÊNCIA') qtd_eficiencia += 1
      else if (row.status_inconsistencia === 'INCONSISTÊNCIA') qtd_inconsistencia += 1
    }

    if (rows.length < RACIONAL_FETCH_PAGE) break
    offset += RACIONAL_FETCH_PAGE
  }

  return {
    qtd_eficiencia,
    qtd_inconsistencia,
    qtd_total: qtd_eficiencia + qtd_inconsistencia,
  }
}

export { RACIONAL_LIMITE, EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO }
