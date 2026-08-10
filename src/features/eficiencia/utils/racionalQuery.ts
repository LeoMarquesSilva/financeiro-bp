import { supabase } from '@/lib/supabaseClient'
import {
  EFICIENCIA_AREAS_EXCLUIDAS_RETENCAO,
  EFICIENCIA_NOME_ALIASES_CHAVE,
  areaFiltroParaIndicador,
  MESES_EFICIENCIA,
  isCargoExcluidoDesenvolvimento,
  isMesesFiltro,
  isSemanaFiltro,
  MES_INICIO_RESULTADO,
  mesFimResultado,
  rangeSemanaFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import type {
  RacionalColuna,
  RacionalEscopo,
  RacionalIndicador,
  RacionalResultado,
} from '../types/eficiencia.types'
import { isVistadoD1Sim, isOpsLegaisCadastroDeParaOk } from './racionalFormat'

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
  /** NULL, vazio ou IN valores — filtro Análise/Agendamento PUB. */
  | { tipo: 'nullOrIn'; coluna: string; valores: string[] }
  /**
   * NOT (col1=v1 AND col2=v2 …) — De Morgan via OR de ≠ / NULL.
   * Ex.: excluir Trabalhista + Demanda de Risco = Sim na Análise.
   */
  | { tipo: 'notAllEq'; pares: { coluna: string; valor: string }[] }
  /** OR de ILIKE prefixo% — ex.: controladoria (agendado_por). */
  | { tipo: 'orIlikeStarts'; coluna: string; valores: string[] }

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
  if (isSemanaFiltro(mes)) {
    const { inicio, fimExclusivo } = rangeSemanaFiltro(mes)
    return query.gte(dataColuna, inicio).lt(dataColuna, fimExclusivo)
  }
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
    case 'nullOrIn':
      return query.or(
        `${filtro.coluna}.is.null,${filtro.coluna}.in.${quoteInList(filtro.valores)}`,
      )
    case 'notAllEq': {
      // NOT (a=x AND b=y) ≡ a IS NULL OR a≠x OR b IS NULL OR b≠y
      const parts = filtro.pares.flatMap((p) => [
        `${p.coluna}.is.null`,
        `${p.coluna}.neq.${p.valor}`,
      ])
      return query.or(parts.join(','))
    }
    case 'orIlikeStarts': {
      const parts = filtro.valores.map((v) => {
        const safe = v.replace(/[%*,]/g, '').trim()
        return `${filtro.coluna}.ilike.${safe}*`
      })
      return query.or(parts.join(','))
    }
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

  if (mes === 'resultado' || mes == null || isSemanaFiltro(mes)) {
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

/**
 * Com área já aplicada via `.eq(areaColuna, area)`, filtros OR na mesma coluna
 * (`excludeInAllowNull` / `distinctFrom`) conflitam no PostgREST e podem anular
 * o filtro de área — o racional volta a mostrar todas as áreas.
 */
export function shouldSkipFiltroExclusaoAreaQuandoFiltrado(
  filtro: RacionalFiltro,
  area: string | null,
  areaColuna: string | null,
): boolean {
  if (area == null || !areaColuna) return false
  return (
    (filtro.tipo === 'excludeInAllowNull' || filtro.tipo === 'distinctFrom') &&
    filtro.coluna === areaColuna
  )
}

/** @deprecated Prefer shouldSkipFiltroExclusaoAreaQuandoFiltrado */
export function shouldSkipFiltroRetencaoArea(
  indicador: RacionalIndicador,
  filtro: RacionalFiltro,
  area: string | null,
): boolean {
  return (
    indicador === 'retencao_talentos' &&
    shouldSkipFiltroExclusaoAreaQuandoFiltrado(filtro, area, 'area')
  )
}

export function formatRacionalPeriodoLabel(ano: number, mes: MesFiltroEficiencia): string {
  if (isSemanaFiltro(mes)) return rangeSemanaFiltro(mes).label
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

/** Aplica recorte extra (ex.: só FATAL não-excludente dos gráficos de ranking). */
export function applyRacionalEscopo(
  query: AnyQuery,
  indicador: RacionalIndicador,
  escopo: RacionalEscopo = 'default',
): AnyQuery {
  if (escopo === 'sla_protocolo_fatal' && indicador === 'sla_protocolo') {
    return query.eq('fatal_apos18', 'FATAL').eq('excludente', 'Não')
  }
  return query
}

export function buildRacionalBaseQuery(
  cfg: RacionalConfig,
  indicador: RacionalIndicador,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
  select: string,
  escopo: RacionalEscopo = 'default',
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
    case 'ops_legais_sla_protocolo':
      // PROTOCOLADO NO FATAL antes de D1 (ordem desc).
      query = query
        .order('eficiencia_sla', { ascending: false })
        .order(cfg.dataColuna, { ascending: false })
      break
    case 'ops_legais_eficiencia_protocolo':
      // Preenchidos primeiro (NULLS LAST) — senão o limite de 500 só pega linhas OK.
      query = query
        .order('inconsistencia_controladoria', { ascending: false, nullsFirst: false })
        .order(cfg.dataColuna, { ascending: false })
      break
    case 'ops_legais_pub_analise':
    case 'ops_legais_pub_agendamento':
      query = query
        .order('eficiencia', { ascending: true, nullsFirst: false })
        .order(cfg.dataColuna, { ascending: false })
      break
    case 'ops_legais_cadastro':
      // Inconsistência (Adesão preenchida) antes de OK/nulos.
      query = query
        .order('adesao_indicador', { ascending: false, nullsFirst: false })
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

  const areaEfetiva = areaFiltroParaIndicador(indicador, area)
  query = applyRacionalArea(query, cfg.areaColuna, areaEfetiva)

  for (const f of cfg.filtros ?? []) {
    // No escopo FATAL, o orEq D-1|FATAL é substituído pelo eq FATAL do escopo.
    const skipOrEqFatal =
      escopo === 'sla_protocolo_fatal' &&
      f.tipo === 'orEq' &&
      f.coluna === 'fatal_apos18'
    query = applyRacionalFiltroNativo(
      query,
      f,
      skipOrEqFatal ||
        shouldSkipFiltroExclusaoAreaQuandoFiltrado(f, areaEfetiva, cfg.areaColuna),
    )
  }

  query = applyRacionalEscopo(query, indicador, escopo)

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
  escopo: RacionalEscopo = 'default',
): Promise<Array<Record<string, unknown>>> {
  const linhas: Array<Record<string, unknown>> = []
  let offset = 0

  while (true) {
    const query = buildRacionalBaseQuery(
      cfg,
      indicador,
      ano,
      area,
      mes,
      select,
      escopo,
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

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
  escopo: RacionalEscopo = 'default',
): Promise<RacionalResultado['resumo']> {
  const d1Cis = new Set<string>()
  const fatalCis = new Set<string>()
  const excludenteCis = new Set<string>()
  let offset = 0
  /** Contagem de linhas (não DISTINCT) — alinha com os gráficos de Justificativa/Qtd. */
  let fatalRows = 0

  while (true) {
    const query = buildRacionalBaseQuery(
      cfg,
      'sla_protocolo',
      ano,
      area,
      mes,
      'ci,fatal_apos18,excludente',
      escopo,
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
      if (escopo === 'sla_protocolo_fatal') {
        // Escopo já restringe a FATAL não-excludente.
        fatalCis.add(ci)
        fatalRows += 1
        continue
      }
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

  if (escopo === 'sla_protocolo_fatal') {
    return { qtd_fatal: fatalRows }
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

/** Ops Legais % D1 — COUNT(*) onde eficiencia_sla = 'D1'. */
export async function fetchOpsLegaisSlaProtocoloRacionalResumo(
  cfg: RacionalConfig,
  ano: number,
  area: string | null,
  mes: MesFiltroEficiencia,
): Promise<RacionalResultado['resumo']> {
  let qtd_d1 = 0
  let qtd_total = 0
  let offset = 0

  while (true) {
    const query = buildRacionalBaseQuery(
      cfg,
      'ops_legais_sla_protocolo',
      ano,
      area,
      mes,
      'eficiencia_sla',
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ eficiencia_sla: string | null }>
    for (const row of rows) {
      qtd_total += 1
      if (row.eficiencia_sla === 'D1') qtd_d1 += 1
    }

    if (rows.length < RACIONAL_FETCH_PAGE) break
    offset += RACIONAL_FETCH_PAGE
  }

  return { qtd_d1, qtd_total }
}

/** Ops Legais Eficiência Protocolo — controladoria vazia = eficiência. */
export async function fetchOpsLegaisEficienciaProtocoloRacionalResumo(
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
      'ops_legais_eficiencia_protocolo',
      ano,
      area,
      mes,
      'inconsistencia_controladoria',
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ inconsistencia_controladoria: string | null }>
    for (const row of rows) {
      if (String(row.inconsistencia_controladoria ?? '').trim()) qtd_inconsistencia += 1
      else qtd_eficiencia += 1
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

/** Ops Legais Cadastro — DePara via Adesão ao Indicador (controladoria). */
export async function fetchOpsLegaisCadastroRacionalResumo(
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
      'ops_legais_cadastro',
      ano,
      area,
      mes,
      'adesao_indicador',
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{ adesao_indicador: string | null }>
    for (const row of rows) {
      if (isOpsLegaisCadastroDeParaOk(row.adesao_indicador)) qtd_eficiencia += 1
      else qtd_inconsistencia += 1
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

/** Ops Legais SLA Publicações — EFICIÊNCIA DE PUBLICAÇÃO vs DESVIO. */
export async function fetchOpsLegaisPublicacoesRacionalResumo(
  cfg: RacionalConfig,
  indicador: 'ops_legais_pub_analise' | 'ops_legais_pub_agendamento',
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
      indicador,
      ano,
      area,
      mes,
      'eficiencia,inconsistencias_tipo,inconsistencia_subtipo',
    ).range(offset, offset + RACIONAL_FETCH_PAGE - 1)

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<{
      eficiencia: string | null
      inconsistencias_tipo: string | null
      inconsistencia_subtipo: string | null
    }>
    for (const row of rows) {
      const tipo = String(row.inconsistencias_tipo ?? '').trim()
      const subtipo = String(row.inconsistencia_subtipo ?? '').trim()
      const efic =
        row.eficiencia?.trim() ||
        (!tipo && !subtipo ? 'EFICIÊNCIA DE PUBLICAÇÃO' : 'DESVIO')
      if (efic === 'EFICIÊNCIA DE PUBLICAÇÃO') qtd_eficiencia += 1
      else qtd_inconsistencia += 1
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
