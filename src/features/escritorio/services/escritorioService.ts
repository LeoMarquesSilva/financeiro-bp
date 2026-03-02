import { supabase } from '@/lib/supabaseClient'
import type {
  ClienteEscritorioRow,
  ContagemCiPorGrupoRow,
} from '@/lib/database.types'

/** Horas do grupo: total e por ano (extraído da coluna data do timesheets). */
export interface HorasGrupo {
  total: number
  porAno: Record<string, number>
}

export type FiltroFinanceiro = 'todos' | 'em_atraso' | 'a_vencer' | 'em_aberto' | 'com_pago'
export type OrdenacaoEscritorio = 'nome' | 'atraso' | 'a_vencer' | 'aberto' | 'pago'

/** Dados agregados por grupo para o card: empresas do grupo, contagem de CI, horas (timesheets) e totais do relatório financeiro. */
export interface GrupoEscritorio {
  grupo_cliente: string
  empresas: ClienteEscritorioRow[]
  contagem: ContagemCiPorGrupoRow | null
  horasGrupo: number
  horasPorAno: Record<string, number>
  /** Soma do valor em aberto (relatório financeiro) das empresas do grupo. */
  valorAberto: number
  /** Soma do valor pago (relatório financeiro) das empresas do grupo. */
  valorPago: number
  /** Soma do valor em atraso (parcelas abertas com vencimento < hoje). */
  valorEmAtraso: number
}

/** Garante que valores numéricos vindos do Supabase (podem vir como string) sejam number. */
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

/** Tamanho do lote (Supabase/PostgREST limitam a 1000 por requisição). */
const PAGE_SIZE = 1000

/** Resumo por grupo (uma linha por grupo): leve para filtros, ordenação e totais. View escritorio_grupos_resumo. */
export interface GrupoResumoRow {
  grupo_cliente: string
  total_empresas: number
  total_geral: number
  horas_total: number
  valor_aberto: number
  valor_pago: number
  valor_em_atraso: number
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
  }
}

/** Chave exibida para grupo vazio (view usa ''). */
export const GRUPO_SEM_NOME = 'Sem grupo'

/** Lista resumo de todos os grupos (leve: uma linha por grupo). */
export async function fetchGruposResumo(): Promise<GrupoResumoRow[]> {
  const allRows: Record<string, unknown>[] = []
  let from = 0
  let hasMore = true
  while (hasMore) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('escritorio_grupos_resumo')
      .select('grupo_cliente, total_empresas, total_geral, horas_total, valor_aberto, valor_pago, valor_em_atraso')
      .order('grupo_cliente', { ascending: true })
      .range(from, to)
    if (error) throw error
    const chunk = (data ?? []) as Record<string, unknown>[]
    allRows.push(...chunk)
    hasMore = chunk.length === PAGE_SIZE
    from += PAGE_SIZE
  }
  return allRows.map(normalizeResumoRow)
}

/** Empresas apenas dos grupos indicados (para a página atual). groupKeys usa '' para "Sem grupo". */
export async function fetchEmpresasPorGrupos(groupKeys: string[]): Promise<ClienteEscritorioRow[]> {
  if (groupKeys.length === 0) return []
  const hasEmpty = groupKeys.includes('')
  const nonEmpty = groupKeys.filter((g) => g !== '')
  const allRows: Record<string, unknown>[] = []

  if (nonEmpty.length > 0) {
    let from = 0
    let hasMore = true
    while (hasMore) {
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('escritorio_empresas_por_grupo')
        .select('id, grupo_cliente, nome, cpf_cnpj, categoria, ci, qtd_processos, horas_total, horas_por_ano, created_at, updated_at')
        .in('grupo_cliente', nonEmpty)
        .order('grupo_cliente', { ascending: true })
        .order('nome', { ascending: true })
        .range(from, to)
      if (error) throw error
      const chunk = (data ?? []) as Record<string, unknown>[]
      allRows.push(...chunk)
      hasMore = chunk.length === PAGE_SIZE
      from += PAGE_SIZE
    }
  }

  if (hasEmpty) {
    let from = 0
    let hasMore = true
    while (hasMore) {
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('escritorio_empresas_por_grupo')
        .select('id, grupo_cliente, nome, cpf_cnpj, categoria, ci, qtd_processos, horas_total, horas_por_ano, created_at, updated_at')
        .is('grupo_cliente', null)
        .order('nome', { ascending: true })
        .range(from, to)
      if (error) throw error
      const chunk = (data ?? []) as Record<string, unknown>[]
      allRows.push(...chunk)
      hasMore = chunk.length === PAGE_SIZE
      from += PAGE_SIZE
    }
  }

  return allRows.map((row) => {
    const normalized = normalizePessoaRow(row)
    if (normalized.grupo_cliente == null || normalized.grupo_cliente.trim() === '') {
      normalized.grupo_cliente = ''
    }
    return normalized
  })
}

/** Lista empresas por grupo (view escritorio_empresas_por_grupo). Busca em lotes de 1000 para ultrapassar o limite do Supabase. */
export async function fetchClientesEscritorio(): Promise<ClienteEscritorioRow[]> {
  const allRows: Record<string, unknown>[] = []
  let from = 0
  let hasMore = true
  while (hasMore) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('escritorio_empresas_por_grupo')
      .select('id, grupo_cliente, nome, cpf_cnpj, categoria, ci, qtd_processos, horas_total, horas_por_ano, created_at, updated_at')
      .order('grupo_cliente', { ascending: true, nullsFirst: true })
      .order('nome', { ascending: true })
      .range(from, to)
    if (error) throw error
    const chunk = (data ?? []) as Record<string, unknown>[]
    allRows.push(...chunk)
    hasMore = chunk.length === PAGE_SIZE
    from += PAGE_SIZE
  }
  return allRows.map(normalizePessoaRow)
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

/** Resumo do relatório financeiro por pessoa_id (valor aberto, pago e em atraso). */
export async function fetchRelatorioFinanceiroResumoPorCliente(): Promise<
  Map<string, { valorAberto: number; valorPago: number; valorEmAtraso: number; parcelasAbertas: number; parcelasPagas: number; parcelasEmAtraso: number }>
> {
  const { data, error } = await supabase
    .from('relatorio_financeiro_resumo_por_cliente')
    .select('pessoa_id, valor_aberto, valor_pago, valor_em_atraso, parcelas_abertas, parcelas_pagas, parcelas_em_atraso')
    .limit(10000)
  if (error) throw error
  const map = new Map<string, { valorAberto: number; valorPago: number; valorEmAtraso: number; parcelasAbertas: number; parcelasPagas: number; parcelasEmAtraso: number }>()
  for (const r of data ?? []) {
    const id = r.pessoa_id
    if (id) {
      map.set(id, {
        valorAberto: Number(r.valor_aberto) || 0,
        valorPago: Number(r.valor_pago) || 0,
        valorEmAtraso: Number(r.valor_em_atraso) || 0,
        parcelasAbertas: Number(r.parcelas_abertas) || 0,
        parcelasPagas: Number(r.parcelas_pagas) || 0,
        parcelasEmAtraso: Number(r.parcelas_em_atraso) || 0,
      })
    }
  }
  return map
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

/** Monta GrupoEscritorio[] para a página a partir do resumo, empresas (só da página) e contagem/horas. */
export function buildGruposEscritorioParaPagina(
  resumoPage: GrupoResumoRow[],
  empresas: ClienteEscritorioRow[],
  contagemByGrupo: Map<string, ContagemCiPorGrupoRow>,
  horasPorGrupo: Map<string, HorasGrupo>,
): GrupoEscritorio[] {
  const keyToDisplay = (k: string) => (k === '' ? GRUPO_SEM_NOME : k)
  const byGrupo = new Map<string, ClienteEscritorioRow[]>()
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
    }
  })
}

/** Busca clientes, contagem, timesheets e resumo financeiro; agrega por grupo para os cards. */
export async function fetchGruposEscritorio(): Promise<GrupoEscritorio[]> {
  const [clientes, contagens, horasPorGrupo, financeiroResumo] = await Promise.all([
    fetchClientesEscritorio(),
    fetchContagemCiPorGrupo(),
    fetchHorasPorGrupo(),
    fetchRelatorioFinanceiroResumoPorCliente(),
  ])

  const byGrupo = new Map<string, { empresas: ClienteEscritorioRow[] }>()
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
      const resumo = financeiroResumo.get(e.id)
      if (resumo) {
        valorAberto += resumo.valorAberto
        valorPago += resumo.valorPago
        valorEmAtraso += resumo.valorEmAtraso
      }
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
    })
  }
  result.sort((a, b) => a.grupo_cliente.localeCompare(b.grupo_cliente))
  return result
}
