import { differenceInMonths } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { collectPaginatedRows } from '@/lib/supabasePaginate'
import { parseDateAsLocal } from '@/shared/utils/format'
import { FINANCEIRO_PARCELAS_SO_RECEBER_OR, financeiroTituloEhReceber } from '@/shared/utils/financeiroTitulo'
import { GRUPO_SEM_NOME } from './escritorioService'
import type { GrupoResumoRow } from './escritorioService'

/** Meses consecutivos em atraso para classificar como inadimplente (regra de negócio). */
export const MESES_INADIMPLENTE_ESCRITORIO = 3

export type FiltroAtrasoInadimplencia = 'todos' | 'em_atraso' | 'inadimplentes'

export interface AtrasoGrupoInfo {
  temAtraso: boolean
  maisAntigoVencimento: string | null
  mesesDevendo: number
  /** Atraso recente: devendo, mas há menos de 3 meses. */
  ehEmAtraso: boolean
  /** Inadimplente: devendo há 3 meses ou mais. */
  ehInadimplente: boolean
}

export type EscritorioAtrasoIndex = Map<string, AtrasoGrupoInfo>

type ParcelaAtrasoRow = {
  pessoa_id: string | null
  data_vencimento: string
  tipo: string | null
}

type PessoaGrupoRow = {
  id: string
  grupo_cliente: string | null
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function defaultDataReferenciaEscritorio(): string {
  return toIsoDate(new Date())
}

function calcMesesDevendo(dataReferencia: string, maisAntigoVencimento: string | null): number {
  if (!maisAntigoVencimento) return 0
  const ref = parseDateAsLocal(dataReferencia)
  const venc = parseDateAsLocal(maisAntigoVencimento)
  if (!ref || !venc) return 0
  return Math.max(0, differenceInMonths(ref, venc))
}

function buildAtrasoInfo(maisAntigoVencimento: string | null, dataReferencia: string): AtrasoGrupoInfo {
  const temAtraso = !!maisAntigoVencimento
  const mesesDevendo = calcMesesDevendo(dataReferencia, maisAntigoVencimento)
  const ehInadimplente = temAtraso && mesesDevendo >= MESES_INADIMPLENTE_ESCRITORIO
  const ehEmAtraso = temAtraso && !ehInadimplente
  return {
    temAtraso,
    maisAntigoVencimento,
    mesesDevendo,
    ehEmAtraso,
    ehInadimplente,
  }
}

/** Índice de atraso por grupo (chave = grupo_cliente da view, '' para sem grupo). */
export async function fetchEscritorioAtrasoIndex(dataReferencia: string): Promise<EscritorioAtrasoIndex> {
  const index = new Map<string, AtrasoGrupoInfo>()

  const parcelas = await collectPaginatedRows<ParcelaAtrasoRow>(async (from, to) =>
    supabase
      .from('financeiro_parcelas')
      .select('pessoa_id, data_vencimento, tipo')
      .eq('situacao', 'ABERTO')
      .lt('data_vencimento', dataReferencia)
      .or(FINANCEIRO_PARCELAS_SO_RECEBER_OR)
      .order('pessoa_id', { ascending: true })
      .range(from, to),
  )

  const maisAntigoPorPessoa = new Map<string, string>()
  for (const row of parcelas) {
    if (!row.pessoa_id || !financeiroTituloEhReceber(row.tipo)) continue
    const atual = maisAntigoPorPessoa.get(row.pessoa_id)
    if (!atual || row.data_vencimento < atual) {
      maisAntigoPorPessoa.set(row.pessoa_id, row.data_vencimento)
    }
  }

  if (maisAntigoPorPessoa.size === 0) return index

  const pessoaIds = [...maisAntigoPorPessoa.keys()]
  const pessoaGrupos = new Map<string, string>()

  for (let i = 0; i < pessoaIds.length; i += 500) {
    const chunk = pessoaIds.slice(i, i + 500)
    const { data, error } = await supabase
      .from('pessoas')
      .select('id, grupo_cliente')
      .in('id', chunk)

    if (error) throw error

    for (const row of (data ?? []) as PessoaGrupoRow[]) {
      pessoaGrupos.set(row.id, row.grupo_cliente?.trim() ?? '')
    }
  }

  const maisAntigoPorGrupo = new Map<string, string>()
  for (const [pessoaId, vencimento] of maisAntigoPorPessoa) {
    const grupoKey = pessoaGrupos.get(pessoaId) ?? ''
    const atual = maisAntigoPorGrupo.get(grupoKey)
    if (!atual || vencimento < atual) {
      maisAntigoPorGrupo.set(grupoKey, vencimento)
    }
  }

  for (const [grupoKey, maisAntigo] of maisAntigoPorGrupo) {
    index.set(grupoKey, buildAtrasoInfo(maisAntigo, dataReferencia))
  }

  return index
}

export function getAtrasoInfoForGrupo(
  grupoCliente: string,
  atrasoIndex: EscritorioAtrasoIndex | null,
): AtrasoGrupoInfo | null {
  if (!atrasoIndex) return null
  const key = grupoCliente === GRUPO_SEM_NOME ? '' : grupoCliente
  return atrasoIndex.get(key) ?? null
}

export function resumoMatchesAtrasoInadimplencia(
  r: GrupoResumoRow,
  atrasoIndex: EscritorioAtrasoIndex | null,
  filtro: FiltroAtrasoInadimplencia,
): boolean {
  if (filtro === 'todos') return true
  const info = getAtrasoInfoForGrupo(
    r.grupo_cliente === '' ? GRUPO_SEM_NOME : r.grupo_cliente,
    atrasoIndex,
  )
  if (filtro === 'em_atraso') return info?.ehEmAtraso === true
  if (filtro === 'inadimplentes') return info?.ehInadimplente === true
  return true
}

export function countAtrasoInadimplenciaFromResumo(
  resumo: GrupoResumoRow[],
  atrasoIndex: EscritorioAtrasoIndex | null,
): { emAtraso: number; inadimplentes: number } {
  let emAtraso = 0
  let inadimplentes = 0
  for (const r of resumo) {
    const info = getAtrasoInfoForGrupo(
      r.grupo_cliente === '' ? GRUPO_SEM_NOME : r.grupo_cliente,
      atrasoIndex,
    )
    if (info?.ehEmAtraso) emAtraso++
    if (info?.ehInadimplente) inadimplentes++
  }
  return { emAtraso, inadimplentes }
}
