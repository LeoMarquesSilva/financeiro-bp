import { supabase } from '@/lib/supabaseClient'
import {
  EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO,
  EFICIENCIA_NOME_ALIASES_CHAVE,
  areaFiltroParaIndicador,
  MESES_EFICIENCIA,
  isCargoExcluidoDesenvolvimento,
  isMesesFiltro,
  MES_INICIO_RESULTADO,
  mesFimResultado,
  type MesFiltroEficiencia,
} from '../constants'
import type { RacionalColuna, RacionalIndicador, RacionalResultado } from '../types/eficiencia.types'
import { isVistadoD1Sim } from './racionalFormat'

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

function rangeMes(ano: number, mes: number): { inicio: string; fim: string } {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim =
    mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
  return { inicio, fim }
}

export function applyRacionalPeriodo(
  query: AnyQuery,
  dataColuna: string,
  ano: number,
  mes: MesFiltroEficiencia,
): AnyQuery {
  if (mes === 'resultado') {
    const inicio = `${ano}-${String(MES_INICIO_RESULTADO).padStart(2, '0')}-01`
    const fimMes = mesFimResultado(ano)
    // Sem mês fechado no período (ex.: ainda em jun): intervalo vazio.
    if (fimMes < MES_INICIO_RESULTADO) {
      return query.gte(dataColuna, inicio).lt(dataColuna, inicio)
    }
    const fim =
      fimMes === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(fimMes + 1).padStart(2, '0')}-01`
    return query.gte(dataColuna, inicio).lt(dataColuna, fim)
  }
  if (isMesesFiltro(mes) && mes.length > 0) {
    if (mes.length === 1) {
      const { inicio, fim } = rangeMes(ano, mes[0]!)
      return query.gte(dataColuna, inicio).lt(dataColuna, fim)
    }
    const parts = mes.map((m) => {
      const { inicio, fim } = rangeMes(ano, m)
      return `and(${dataColuna}.gte.${inicio},${dataColuna}.lt.${fim})`
    })
    return query.or(parts.join(','))
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

/** Chave de match com turnover: sem acento, caixa alta, espaços colapsados (+ aliases AD). */
export function normalizeNomeChave(nome: string): string {
  const key = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
  return EFICIENCIA_NOME_ALIASES_CHAVE[key] ?? key
}

/**
 * População de treinamentos = join por nome com sp_turnover (mesmos filtros do RPC).
 * Usa o vínculo ativo atual (área “de agora”); match sem acento (ex.: Vinicius/VÍNICIUS).
 */
export async function fetchDesenvolvimentoRacional(
  cfg: RacionalConfig,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
): Promise<RacionalResultado> {
  // Indicador anual: filtro Resultado = ano todo (mesmos minutos/meta do KPI).
  const mesPeriodo: MesFiltroEficiencia = mes === 'resultado' ? null : mes

  // Ativo no ano: desligamento nulo ou a partir de 1/jan do ano seguinte (equiv. year > ano).
  const turnoverQuery = supabase
    .from('sp_turnover')
    .select('nome, area, cargo, admissao, desligamento')
    .lte('admissao', `${ano}-12-31`)
    .or(`desligamento.is.null,desligamento.gte.${ano + 1}-01-01`)

  const { data: turnoverRows, error: turnoverError } = await turnoverQuery
  if (turnoverError) throw turnoverError

  // Um nome → vínculo mais recente ativo (mudança de área não duplica).
  type TvRow = {
    nome: string | null
    area: string | null
    cargo: string | null
    admissao: string | null
  }
  const porNome = new Map<string, TvRow>()
  for (const row of (turnoverRows ?? []) as TvRow[]) {
    if (isCargoExcluidoDesenvolvimento(row.cargo)) continue
    const key = normalizeNomeChave(String(row.nome ?? ''))
    if (!key) continue
    const prev = porNome.get(key)
    if (!prev || String(row.admissao ?? '') > String(prev.admissao ?? '')) {
      porNome.set(key, row)
    }
  }

  const nomesElegiveis = new Set<string>()
  for (const [key, row] of porNome) {
    if (area) {
      if (row.area === area) nomesElegiveis.add(key)
    } else if (row.area == null || row.area !== 'Tributário') {
      nomesElegiveis.add(key)
    }
  }

  let trainingQuery = supabase
    .from('sp_treinamentos_presenca')
    .select(cfg.colunas.map((c) => c.key).join(','))
    .order(cfg.dataColuna, { ascending: false })
    .limit(RACIONAL_LIMITE + 200)

  trainingQuery = applyRacionalPeriodo(trainingQuery, cfg.dataColuna, ano, mesPeriodo)

  const { data: trainingRows, error: trainingError } = await trainingQuery
  if (trainingError) throw trainingError

  const linhas = ((trainingRows ?? []) as Array<Record<string, unknown>>)
    .filter((row) => nomesElegiveis.has(normalizeNomeChave(String(row.colaborador ?? ''))))
    .map((row) => {
      const tv = porNome.get(normalizeNomeChave(String(row.colaborador ?? '')))
      return { ...row, area: tv?.area ?? null }
    })

  return {
    colunas: [
      { key: 'area', label: 'Área' },
      ...cfg.colunas,
    ],
    linhas: linhas.slice(0, RACIONAL_LIMITE),
    truncado: linhas.length > RACIONAL_LIMITE,
  }
}

export function applyRetencaoRacionalPeriodo(
  query: AnyQuery,
  ano: number,
  mes: MesFiltroEficiencia,
): AnyQuery {
  // Base do ano: admitidos até 31/12 e (ativos ou desligados no ano).
  // Resultado = ano todo (indicador anual — não recorta jun–dez).
  query = query
    .lte('admissao', `${ano}-12-31`)
    .or(`desligamento.is.null,desligamento.gte.${ano}-01-01`)

  if (mes === 'resultado' || mes == null) {
    return query
  }
  if (isMesesFiltro(mes) && mes.length > 0) {
    const maxMes = Math.max(...mes)
    const fim =
      maxMes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(maxMes + 1).padStart(2, '0')}-01`
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
  if (mes === 'resultado') {
    const fim = mesFimResultado(ano)
    if (fim < MES_INICIO_RESULTADO) return `resultado (sem mês fechado/${ano})`
    const iniLabel = MESES_EFICIENCIA[MES_INICIO_RESULTADO - 1]
    const fimLabel = MESES_EFICIENCIA[fim - 1]
    return fim === MES_INICIO_RESULTADO
      ? `resultado (${iniLabel}/${ano})`
      : `resultado (${iniLabel}–${fimLabel}/${ano})`
  }
  if (isMesesFiltro(mes) && mes.length === 1) {
    return `${String(mes[0]).padStart(2, '0')}/${ano}`
  }
  if (isMesesFiltro(mes) && mes.length > 1) {
    return `${mes.map((m) => MESES_EFICIENCIA[m - 1]).join('+')}/${ano}`
  }
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
    case 'sla_vistagem_risco':
    case 'sla_vistagem_normal':
      // Não antes de Sim (asc) → falhas no topo; depois mais recentes.
      query = query
        .order('vistado_d1', { ascending: true })
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

  query = applyRacionalArea(query, cfg.areaColuna, areaFiltroParaIndicador(indicador, area))

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

/**
 * COUNT(DISTINCT ci) por fatal_apos18 — mesma base do KPI (Excludente fora da %).
 * O racional lista Excludentes; o resumo/métrica os ignora.
 */
export async function fetchSlaProtocoloRacionalResumo(
  cfg: RacionalConfig,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
): Promise<RacionalResultado['resumo']> {
  const d1Cis = new Set<string>()
  const fatalCis = new Set<string>()
  const excludenteCis = new Set<string>()
  let offset = 0

  while (true) {
    const query = buildRacionalBaseQuery(
      cfg,
      'sla_protocolo',
      ano,
      area,
      mes,
      'ci,fatal_apos18,excludente',
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{
      ci: string | null
      fatal_apos18: string | null
      excludente: string | null
    }>
    for (const row of rows) {
      const ci = String(row.ci ?? '').trim()
      if (!ci) continue
      if (row.excludente === 'Excludente') {
        excludenteCis.add(ci)
        continue
      }
      if (row.fatal_apos18 === 'D-1') d1Cis.add(ci)
      if (row.fatal_apos18 === 'FATAL') fatalCis.add(ci)
    }

    if (rows.length < RACIONAL_FETCH_PAGE) break
    offset += RACIONAL_FETCH_PAGE
  }

  return {
    qtd_d1: d1Cis.size,
    qtd_fatal: fatalCis.size,
    qtd_excludente: excludenteCis.size,
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

/** COUNT(*) por vistado_d1 — mesmos filtros do KPI. */
export async function fetchSlaVistagemRacionalResumo(
  cfg: RacionalConfig,
  indicador: 'sla_vistagem_risco' | 'sla_vistagem_normal',
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
): Promise<RacionalResultado['resumo']> {
  let qtd_vistado_sim = 0
  let qtd_vistado_nao = 0
  let offset = 0

  while (true) {
    const query = buildRacionalBaseQuery(
      cfg,
      indicador,
      ano,
      area,
      mes,
      'vistado_d1',
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ vistado_d1: string | null }>
    for (const row of rows) {
      if (isVistadoD1Sim(row.vistado_d1)) qtd_vistado_sim += 1
      else qtd_vistado_nao += 1
    }

    if (rows.length < RACIONAL_FETCH_PAGE) break
    offset += RACIONAL_FETCH_PAGE
  }

  return {
    qtd_vistado_sim,
    qtd_vistado_nao,
    qtd_total: qtd_vistado_sim + qtd_vistado_nao,
  }
}

export { RACIONAL_LIMITE, EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO }
