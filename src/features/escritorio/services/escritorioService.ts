import { supabase } from '@/lib/supabaseClient'
import { collectPaginatedRows } from '@/lib/supabasePaginate'
import type {
  ClienteEscritorioRow,
  ContagemCiPorGrupoRow,
  EscritorioEmpresaRow,
} from '@/lib/database.types'

/** Horas do grupo: total e por ano (extraído da coluna data do timesheets). */
export interface HorasGrupo {
  total: number
  porAno: Record<string, number>
}

export type FiltroFinanceiro = 'todos' | 'em_atraso' | 'a_vencer' | 'em_aberto' | 'com_pago'
export type OrdenacaoEscritorio = 'nome' | 'atraso' | 'a_vencer' | 'aberto' | 'pago'

export interface FinanceiroEmpresaResumo {
  valorAberto: number
  valorPago: number
  valorEmAtraso: number
}

export type OrdenacaoSemGrupoEmpresa = 'nome' | 'valor' | 'valor_aberto' | 'valor_atraso' | 'processos' | 'timesheet'

/** Dados agregados por grupo para o card: empresas do grupo, contagem de CI, horas (timesheets) e totais do relatório financeiro. */
export interface GrupoEscritorio {
  grupo_cliente: string
  empresas: EscritorioEmpresaRow[]
  contagem: ContagemCiPorGrupoRow | null
  horasGrupo: number
  horasPorAno: Record<string, number>
  /** Soma do valor em aberto (relatório financeiro) das empresas do grupo. */
  valorAberto: number
  /** Soma do valor pago (relatório financeiro) das empresas do grupo. */
  valorPago: number
  /** Soma do valor em atraso (parcelas abertas com vencimento < hoje). */
  valorEmAtraso: number
  /** Resumo financeiro por empresa (derivado da view). */
  financeiroPorEmpresa?: Record<string, FinanceiroEmpresaResumo>
}

const ESCRITORIO_EMPRESA_LIST_SELECT =
  'id, grupo_cliente, nome, cpf_cnpj, categoria, ci, qtd_processos, horas_total, valor_aberto, valor_pago, valor_em_atraso, created_at, updated_at'

/** Detalhe da empresa (inclui horas_por_ano — agregação pesada; não usar em listagens). */
const ESCRITORIO_EMPRESA_DETALHE_SELECT =
  'id, grupo_cliente, nome, cpf_cnpj, categoria, ci, qtd_processos, horas_total, horas_por_ano, valor_aberto, valor_pago, valor_em_atraso, created_at, updated_at'

/** PostgREST: sem grupo só traz empresas com processos, timesheet ou valor (sync pode incluir novas depois). */
export const SEM_GRUPO_COM_DADOS_OR_FILTER =
  'qtd_processos.gt.0,horas_total.gt.0,valor_aberto.gt.0,valor_pago.gt.0,valor_em_atraso.gt.0'

/** Empresa do escritório com ao menos processo, timesheet ou movimentação financeira. */
export function empresaTemDadosEscritorio(e: EscritorioEmpresaRow): boolean {
  return (
    (Number(e.qtd_processos) || 0) > 0 ||
    (Number(e.horas_total) || 0) > 0 ||
    temValorFinanceiro(e)
  )
}

/** Extrai resumo financeiro dos campos da view escritorio_empresas_por_grupo. */
export function getFinanceiroEmpresa(e: EscritorioEmpresaRow): FinanceiroEmpresaResumo {
  return {
    valorAberto: Number(e.valor_aberto) || 0,
    valorPago: Number(e.valor_pago) || 0,
    valorEmAtraso: Number(e.valor_em_atraso) || 0,
  }
}

export function temValorFinanceiro(e: EscritorioEmpresaRow): boolean {
  const f = getFinanceiroEmpresa(e)
  return f.valorAberto > 0 || f.valorPago > 0 || f.valorEmAtraso > 0
}

export function valorTotalEmpresa(e: EscritorioEmpresaRow): number {
  const f = getFinanceiroEmpresa(e)
  return f.valorAberto + f.valorPago
}

export function ordenaEmpresasEscritorio(
  lista: EscritorioEmpresaRow[],
  ordenacao: OrdenacaoSemGrupoEmpresa,
): EscritorioEmpresaRow[] {
  const copy = [...lista]
  switch (ordenacao) {
    case 'valor':
      return copy.sort(
        (a, b) => valorTotalEmpresa(b) - valorTotalEmpresa(a) || (a.nome ?? '').localeCompare(b.nome ?? ''),
      )
    case 'valor_aberto':
      return copy.sort(
        (a, b) =>
          getFinanceiroEmpresa(b).valorAberto - getFinanceiroEmpresa(a).valorAberto ||
          (a.nome ?? '').localeCompare(b.nome ?? ''),
      )
    case 'valor_atraso':
      return copy.sort(
        (a, b) =>
          getFinanceiroEmpresa(b).valorEmAtraso - getFinanceiroEmpresa(a).valorEmAtraso ||
          (a.nome ?? '').localeCompare(b.nome ?? ''),
      )
    case 'processos':
      return copy.sort(
        (a, b) =>
          (Number(b.qtd_processos) || 0) - (Number(a.qtd_processos) || 0) ||
          (a.nome ?? '').localeCompare(b.nome ?? ''),
      )
    case 'timesheet':
      return copy.sort(
        (a, b) =>
          (Number(b.horas_total) || 0) - (Number(a.horas_total) || 0) ||
          (a.nome ?? '').localeCompare(b.nome ?? ''),
      )
    default:
      return copy.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''))
  }
}

function normalizePessoaRow(row: Record<string, unknown>): ClienteEscritorioRow {
  return {
    ...row,
    id: String(row.id ?? ''),
    grupo_cliente: row.grupo_cliente != null ? String(row.grupo_cliente) : null,
    nome: String(row.nome ?? ''),
    cpf_cnpj: row.cpf_cnpj != null ? String(row.cpf_cnpj) : null,
    categoria: row.categoria != null ? String(row.categoria) : null,
    ci: row.ci != null ? String(row.ci) : null,
    qtd_processos: row.qtd_processos != null ? Number(row.qtd_processos) : null,
    horas_total: row.horas_total != null ? Number(row.horas_total) : null,
    horas_por_ano: (row.horas_por_ano as Record<string, number> | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  } as ClienteEscritorioRow
}

function normalizeEscritorioEmpresaRow(row: Record<string, unknown>): EscritorioEmpresaRow {
  return {
    ...normalizePessoaRow(row),
    valor_aberto: row.valor_aberto != null ? Number(row.valor_aberto) : 0,
    valor_pago: row.valor_pago != null ? Number(row.valor_pago) : 0,
    valor_em_atraso: row.valor_em_atraso != null ? Number(row.valor_em_atraso) : 0,
  }
}

function normalizeContagemRow(row: Record<string, unknown>): ContagemCiPorGrupoRow {
  return {
    ...row,
    id: String(row.id ?? ''),
    grupo_cliente: String(row.grupo_cliente ?? ''),
    arquivado: Number(row.arquivado) || 0,
    arquivado_definitivamente: Number(row.arquivado_definitivamente) || 0,
    arquivado_provisoriamente: Number(row.arquivado_provisoriamente) || 0,
    ativo: Number(row.ativo) || 0,
    encerrado: Number(row.encerrado) || 0,
    ex_cliente: Number(row.ex_cliente) || 0,
    suspenso: Number(row.suspenso) || 0,
    outros: Number(row.outros) ?? 0,
    total_geral: Number(row.total_geral) || 0,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  } as ContagemCiPorGrupoRow
}


/** Resumo por grupo (uma linha por grupo): leve para filtros, ordenação e totais. View escritorio_grupos_resumo. */
export const CATEGORIA_CLIENTE_INATIVO = 'Cliente inativo'

export function isClienteInativo(categoria: string | null | undefined): boolean {
  return (categoria ?? '').trim() === CATEGORIA_CLIENTE_INATIVO
}

export interface GrupoResumoRow {
  grupo_cliente: string
  total_empresas: number
  total_geral: number
  horas_total: number
  valor_aberto: number
  valor_pago: number
  valor_em_atraso: number
  /** Valor em atraso desconsiderando empresas inativas e sem grupo_cliente. */
  valor_em_atraso_ativos: number
}

function normalizeResumoRow(row: Record<string, unknown>): GrupoResumoRow {
  return {
    grupo_cliente: String(row.grupo_cliente ?? ''),
    total_empresas: Number(row.total_empresas) || 0,
    total_geral: Number(row.total_geral) || 0,
    horas_total: Number(row.horas_total) || 0,
    valor_aberto: Number(row.valor_aberto) || 0,
    valor_pago: Number(row.valor_pago) || 0,
    valor_em_atraso: Number(row.valor_em_atraso) || 0,
    valor_em_atraso_ativos: Number(row.valor_em_atraso_ativos) || 0,
  }
}

/** Chave exibida para grupo vazio (view usa ''). */
export const GRUPO_SEM_NOME = 'Sem grupo'

/** Lista resumo de todos os grupos (leve: uma linha por grupo). */
export async function fetchGruposResumo(): Promise<GrupoResumoRow[]> {
  const allRows = await collectPaginatedRows<Record<string, unknown>>(async (from, to) =>
    supabase
      .from('escritorio_grupos_resumo')
      .select(
        'grupo_cliente, total_empresas, total_geral, horas_total, valor_aberto, valor_pago, valor_em_atraso, valor_em_atraso_ativos',
      )
      .order('grupo_cliente', { ascending: true })
      .range(from, to),
  )
  return allRows.map(normalizeResumoRow)
}

/** Busca empresas de um grupo (paginado). */
async function fetchEmpresasDeUmGrupo(
  grupoCliente: string | null,
  options?: { semGrupoComDados?: boolean },
): Promise<Record<string, unknown>[]> {
  return collectPaginatedRows(async (from, to) => {
    let query = supabase
      .from('escritorio_empresas_por_grupo')
      .select(ESCRITORIO_EMPRESA_LIST_SELECT)
      .order('nome', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)

    if (grupoCliente === null) {
      query = query.is('grupo_cliente', null)
      if (options?.semGrupoComDados) {
        query = query.or(SEM_GRUPO_COM_DADOS_OR_FILTER)
      }
    } else {
      query = query.eq('grupo_cliente', grupoCliente)
    }

    return await query
  })
}

/** Detalhe de uma empresa (com horas_por_ano). Usar só ao abrir o painel. */
export async function fetchEscritorioEmpresaDetalhe(id: string): Promise<EscritorioEmpresaRow | null> {
  const { data, error } = await supabase
    .from('escritorio_empresas_por_grupo')
    .select(ESCRITORIO_EMPRESA_DETALHE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return normalizeEscritorioEmpresaRow(data as Record<string, unknown>)
}

/** Empresas apenas dos grupos indicados (para a página atual). groupKeys usa '' para "Sem grupo". */
export async function fetchEmpresasPorGrupos(groupKeys: string[]): Promise<EscritorioEmpresaRow[]> {
  if (groupKeys.length === 0) return []
  const hasEmpty = groupKeys.includes('')
  const nonEmpty = groupKeys.filter((g) => g !== '')

  const batches = await Promise.all([
    ...nonEmpty.map((grupo) => fetchEmpresasDeUmGrupo(grupo)),
    ...(hasEmpty ? [fetchEmpresasDeUmGrupo(null, { semGrupoComDados: true })] : []),
  ])
  const allRows = batches.flat()

  return allRows.map((row) => {
    const normalized = normalizeEscritorioEmpresaRow(row)
    if (normalized.grupo_cliente == null || normalized.grupo_cliente.trim() === '') {
      normalized.grupo_cliente = ''
    }
    return normalized
  }).filter((e) => e.grupo_cliente !== '' || empresaTemDadosEscritorio(e))
}

/** Lista empresas por grupo (view escritorio_empresas_por_grupo). Busca em lotes de 1000 para ultrapassar o limite do Supabase. */
export async function fetchClientesEscritorio(): Promise<EscritorioEmpresaRow[]> {
  const allRows = await collectPaginatedRows<Record<string, unknown>>(async (from, to) =>
    supabase
      .from('escritorio_empresas_por_grupo')
      .select(ESCRITORIO_EMPRESA_LIST_SELECT)
      .order('grupo_cliente', { ascending: true, nullsFirst: true })
      .order('nome', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )
  return allRows.map(normalizeEscritorioEmpresaRow)
}

export async function fetchContagemCiPorGrupo(): Promise<ContagemCiPorGrupoRow[]> {
  const { data, error } = await supabase
    .from('contagem_ci_por_grupo')
    .select('*')
    .order('grupo_cliente', { ascending: true })
    .limit(5000)
  if (error) throw error
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.map(normalizeContagemRow)
}

/**
 * Retorna soma de total_horas por grupo_cliente e por ano.
 * Usa a view timesheets_resumo_por_grupo_ano (agregação no banco) para não trazer 150k+ linhas.
 */
export async function fetchHorasPorGrupo(): Promise<Map<string, HorasGrupo>> {
  const { data, error } = await supabase
    .from('timesheets_resumo_por_grupo_ano')
    .select('grupo_cliente, ano, total_horas')
    .limit(10000)
  if (error) throw error
  const rows = (data ?? []) as {
    grupo_cliente: string
    ano: number
    total_horas: number
  }[]
  const map = new Map<string, HorasGrupo>()
  for (const r of rows) {
    const grupo = r.grupo_cliente?.trim() ?? ''
    const horas = Number(r.total_horas) || 0
    const year = String(r.ano ?? '')
    if (!grupo && !year) continue
    if (!map.has(grupo)) {
      map.set(grupo, { total: 0, porAno: {} })
    }
    const entry = map.get(grupo)!
    entry.total += horas
    if (year) {
      entry.porAno[year] = (entry.porAno[year] ?? 0) + horas
    }
  }
  return map
}

export type FinanceiroEmpresaResumoCompleto = FinanceiroEmpresaResumo & {
  parcelasAbertas: number
  parcelasPagas: number
  parcelasEmAtraso: number
}

/** Resumo do relatório financeiro por pessoa_id (valor aberto, pago e em atraso). */
export async function fetchRelatorioFinanceiroResumoPorCliente(): Promise<
  Record<string, FinanceiroEmpresaResumoCompleto>
> {
  type FinanceiroRow = {
    pessoa_id: string
    valor_aberto: number
    valor_pago: number
    valor_em_atraso: number
    parcelas_abertas: number
    parcelas_pagas: number
    parcelas_em_atraso: number
  }
  const allRows = await collectPaginatedRows<FinanceiroRow>(async (from, to) =>
    supabase
      .from('relatorio_financeiro_resumo_por_cliente')
      .select(
        'pessoa_id, valor_aberto, valor_pago, valor_em_atraso, parcelas_abertas, parcelas_pagas, parcelas_em_atraso',
      )
      .order('pessoa_id', { ascending: true })
      .range(from, to),
  )
  const out: Record<string, FinanceiroEmpresaResumoCompleto> = {}
  for (const r of allRows) {
    const id = r.pessoa_id
    if (!id) continue
    out[id] = {
      valorAberto: Number(r.valor_aberto) || 0,
      valorPago: Number(r.valor_pago) || 0,
      valorEmAtraso: Number(r.valor_em_atraso) || 0,
      parcelasAbertas: Number(r.parcelas_abertas) || 0,
      parcelasPagas: Number(r.parcelas_pagas) || 0,
      parcelasEmAtraso: Number(r.parcelas_em_atraso) || 0,
    }
  }
  return out
}

/** Normaliza nome do grupo para comparação: minúsculo, um espaço, sem prefixo "Grupo ", barra com espaços. */
export function normalizarNomeGrupo(nome: string): string {
  return nome
    .replace(/^Grupo\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
}

/**
 * TimeSheets pode ter "Adhemar / Flávio" e "Grupo Adhemar / Flávio" com espaços/caracteres diferentes.
 * Soma horas de todas as chaves do map cujo nome normalizado é igual ao do grupo.
 */
export function getHorasParaGrupo(map: Map<string, HorasGrupo>, grupo: string): HorasGrupo {
  const merged: HorasGrupo = { total: 0, porAno: {} }
  const grupoNorm = normalizarNomeGrupo(grupo)
  for (const [key, h] of map.entries()) {
    if (normalizarNomeGrupo(key) !== grupoNorm) continue
    merged.total += h.total
    for (const [y, val] of Object.entries(h.porAno ?? {})) {
      merged.porAno[y] = (merged.porAno[y] ?? 0) + val
    }
  }
  return merged
}

function buildFinanceiroPorEmpresa(lista: EscritorioEmpresaRow[]): Record<string, FinanceiroEmpresaResumo> | undefined {
  const out: Record<string, FinanceiroEmpresaResumo> = {}
  for (const e of lista) {
    if (temValorFinanceiro(e)) out[e.id] = getFinanceiroEmpresa(e)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Monta GrupoEscritorio[] para a página a partir do resumo, empresas (só da página) e contagem/horas. */
export function buildGruposEscritorioParaPagina(
  resumoPage: GrupoResumoRow[],
  empresas: EscritorioEmpresaRow[],
  contagemByGrupo: Map<string, ContagemCiPorGrupoRow>,
  horasPorGrupo: Map<string, HorasGrupo>,
): GrupoEscritorio[] {
  const keyToDisplay = (k: string) => (k === '' ? GRUPO_SEM_NOME : k)
  const byGrupo = new Map<string, EscritorioEmpresaRow[]>()
  for (const c of empresas) {
    const key = c.grupo_cliente?.trim() ?? ''
    if (!byGrupo.has(key)) byGrupo.set(key, [])
    byGrupo.get(key)!.push(c)
  }

  return resumoPage.map((r) => {
    const key = r.grupo_cliente
    const horas = getHorasParaGrupo(horasPorGrupo, key)
    const lista = (byGrupo.get(key) ?? []).sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''))
    return {
      grupo_cliente: keyToDisplay(key),
      empresas: lista,
      contagem: contagemByGrupo.get(key) ?? null,
      horasGrupo: r.horas_total || horas.total,
      horasPorAno: horas.porAno ?? {},
      valorAberto: r.valor_aberto,
      valorPago: r.valor_pago,
      valorEmAtraso: r.valor_em_atraso,
      financeiroPorEmpresa: buildFinanceiroPorEmpresa(lista),
    }
  })
}

/** Busca clientes, contagem, timesheets e resumo financeiro; agrega por grupo para os cards. */
export async function fetchGruposEscritorio(): Promise<GrupoEscritorio[]> {
  const [clientes, contagens, horasPorGrupo] = await Promise.all([
    fetchClientesEscritorio(),
    fetchContagemCiPorGrupo(),
    fetchHorasPorGrupo(),
  ])

  const byGrupo = new Map<string, { empresas: EscritorioEmpresaRow[] }>()
  for (const c of clientes) {
    const grupo = c.grupo_cliente?.trim() ?? GRUPO_SEM_NOME
    const key = grupo === GRUPO_SEM_NOME ? '' : grupo
    if (!byGrupo.has(key)) byGrupo.set(key, { empresas: [] })
    byGrupo.get(key)!.empresas.push(c)
  }

  const contagemByGrupo = new Map<string, ContagemCiPorGrupoRow>()
  for (const c of contagens) {
    contagemByGrupo.set(c.grupo_cliente.trim(), c)
  }

  const result: GrupoEscritorio[] = []
  for (const [key, { empresas }] of byGrupo.entries()) {
    const grupoDisplay = key === '' ? GRUPO_SEM_NOME : key
    const horas = getHorasParaGrupo(horasPorGrupo, grupoDisplay)
    let valorAberto = 0
    let valorPago = 0
    let valorEmAtraso = 0
    for (const e of empresas) {
      const resumo = getFinanceiroEmpresa(e)
      valorAberto += resumo.valorAberto
      valorPago += resumo.valorPago
      valorEmAtraso += resumo.valorEmAtraso
    }
    result.push({
      grupo_cliente: grupoDisplay,
      empresas: empresas.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '')),
      contagem: contagemByGrupo.get(key) ?? null,
      horasGrupo: horas.total,
      horasPorAno: horas.porAno ?? {},
      valorAberto,
      valorPago,
      valorEmAtraso,
      financeiroPorEmpresa: buildFinanceiroPorEmpresa(empresas),
    })
  }
  result.sort((a, b) => a.grupo_cliente.localeCompare(b.grupo_cliente))
  return result
}

export interface ProcessosPorAreaItem {
  area: string
  situacao_processo: string
  total: number
}

export async function fetchProcessosPorAreaDoGrupo(
  grupoCliente: string
): Promise<ProcessosPorAreaItem[]> {
  const { data, error } = await supabase
    .rpc('processos_por_area_grupo' as never, { p_grupo: grupoCliente } as never)
  if (error) {
    console.error('[escritorioService] fetchProcessosPorAreaDoGrupo:', error)
    return []
  }
  return (data ?? []) as ProcessosPorAreaItem[]
}
