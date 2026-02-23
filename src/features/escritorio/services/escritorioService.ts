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

/** Dados agregados por grupo para o card: empresas do grupo, contagem de CI e horas (timesheets). */
export interface GrupoEscritorio {
  grupo_cliente: string
  empresas: ClienteEscritorioRow[]
  contagem: ContagemCiPorGrupoRow | null
  horasGrupo: number
  horasPorAno: Record<string, number>
}

/** Garante que valores numéricos vindos do Supabase (podem vir como string) sejam number. */
function normalizeClienteRow(row: Record<string, unknown>): ClienteEscritorioRow {
  return {
    ...row,
    id: String(row.id ?? ''),
    grupo_cliente: row.grupo_cliente != null ? String(row.grupo_cliente) : null,
    razao_social: String(row.razao_social ?? ''),
    cnpj: row.cnpj != null ? String(row.cnpj) : null,
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

/** Limite alto para não cortar dados (Supabase default é 1000). Ajuste se tiver mais grupos/empresas. */
const MAX_ROWS_ESCRITORIO = 5000

export async function fetchClientesEscritorio(): Promise<ClienteEscritorioRow[]> {
  const { data, error } = await supabase
    .from('clientes_escritorio')
    .select('id, grupo_cliente, razao_social, cnpj, qtd_processos, horas_total, horas_por_ano, created_at, updated_at')
    .order('grupo_cliente', { ascending: true, nullFirst: true })
    .order('razao_social', { ascending: true })
    .limit(MAX_ROWS_ESCRITORIO)
  if (error) throw error
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.map(normalizeClienteRow)
}

export async function fetchContagemCiPorGrupo(): Promise<ContagemCiPorGrupoRow[]> {
  const { data, error } = await supabase
    .from('contagem_ci_por_grupo')
    .select('*')
    .order('grupo_cliente', { ascending: true })
    .limit(MAX_ROWS_ESCRITORIO)
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

/** Busca clientes, contagem e timesheets e agrega por grupo para os cards. */
export async function fetchGruposEscritorio(): Promise<GrupoEscritorio[]> {
  const [clientes, contagens, horasPorGrupo] = await Promise.all([
    fetchClientesEscritorio(),
    fetchContagemCiPorGrupo(),
    fetchHorasPorGrupo(),
  ])

  const byGrupo = new Map<string, { empresas: ClienteEscritorioRow[] }>()
  for (const c of clientes) {
    const grupo = c.grupo_cliente?.trim() ?? 'Sem grupo'
    if (!byGrupo.has(grupo)) byGrupo.set(grupo, { empresas: [] })
    byGrupo.get(grupo)!.empresas.push(c)
  }

  const contagemByGrupo = new Map<string, ContagemCiPorGrupoRow>()
  for (const c of contagens) {
    contagemByGrupo.set(c.grupo_cliente.trim(), c)
  }

  const result: GrupoEscritorio[] = []
  for (const [grupo_cliente, { empresas }] of byGrupo.entries()) {
    const horas = getHorasParaGrupo(horasPorGrupo, grupo_cliente)
    result.push({
      grupo_cliente,
      empresas: empresas.sort((a, b) => a.razao_social.localeCompare(b.razao_social)),
      contagem: contagemByGrupo.get(grupo_cliente) ?? null,
      horasGrupo: horas.total,
      horasPorAno: horas.porAno ?? {},
    })
  }
  result.sort((a, b) => a.grupo_cliente.localeCompare(b.grupo_cliente))
  return result
}
