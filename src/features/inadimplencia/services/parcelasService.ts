import { supabase } from '@/lib/supabaseClient'

export interface ParcelaRow {
  id: string
  pessoa_id: string | null
  nro_titulo: string
  parcela: string | null
  parcelas: string | null
  data_vencimento: string
  data_baixa: string | null
  situacao: string
  valor: number
  valor_pago: number | null
  descricao: string | null
  competencia: string | null
  tipo: string | null
  forma: string | null
  cliente: string
  plano_contas: string | null
}

export interface ParcelasPorCliente {
  pagas: ParcelaRow[]
  emAtraso: ParcelaRow[]
  aVencer: ParcelaRow[]
}

const HOJE = new Date().toISOString().slice(0, 10)

/**
 * Busca parcelas do cliente inadimplente.
 * Aceita múltiplos pessoa_ids (para grupos com várias empresas).
 * Fallback: cliente ilike razao_social.
 */
export async function fetchParcelasPorCliente(params: {
  pessoa_id: string | null
  pessoa_ids?: string[]
  razao_social: string
}): Promise<ParcelasPorCliente> {
  const { pessoa_id, pessoa_ids, razao_social } = params

  const ids = pessoa_ids && pessoa_ids.length > 0
    ? pessoa_ids
    : pessoa_id
      ? [pessoa_id]
      : []

  let query = supabase
    .from('financeiro_parcelas')
    .select('id, pessoa_id, nro_titulo, parcela, parcelas, data_vencimento, data_baixa, situacao, valor, valor_pago, descricao, competencia, tipo, forma, cliente, plano_contas')

  if (ids.length > 0) {
    query = query.in('pessoa_id', ids)
  } else if (razao_social?.trim()) {
    const term = `%${razao_social.trim().replace(/%/g, '\\%')}%`
    query = query.ilike('cliente', term)
  } else {
    return { pagas: [], emAtraso: [], aVencer: [] }
  }

  const { data: rows, error } = await query

  if (error) {
    console.error('[parcelasService] fetchParcelasPorCliente:', error)
    return { pagas: [], emAtraso: [], aVencer: [] }
  }

  const parcelas = (rows ?? []) as ParcelaRow[]

  const pagas = parcelas
    .filter((p) => (p.situacao ?? '').toUpperCase() === 'PAGO')
    .sort((a, b) => (b.data_baixa ?? '').localeCompare(a.data_baixa ?? ''))
    .slice(0, 10)

  const abertas = parcelas.filter((p) => (p.situacao ?? '').toUpperCase() === 'ABERTO')
  const emAtraso = abertas
    .filter((p) => p.data_vencimento && p.data_vencimento < HOJE)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  const aVencer = abertas
    .filter((p) => p.data_vencimento && p.data_vencimento >= HOJE)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))

  return { pagas, emAtraso, aVencer }
}

function valorParcelaPaga(p: ParcelaRow): number {
  return Number(p.valor_pago ?? p.valor ?? 0)
}

/** Pagamentos (parcelas baixadas) de um ou mais clientes em um período. */
export async function fetchPagamentosPorPeriodo(params: {
  pessoa_ids: string[]
  dataInicio: string
  dataFim: string
  clienteNome?: string
}): Promise<{ parcelas: ParcelaRow[]; totalPago: number }> {
  const { pessoa_ids, dataInicio, dataFim, clienteNome } = params
  if (!dataInicio || !dataFim || dataInicio > dataFim) {
    return { parcelas: [], totalPago: 0 }
  }

  let query = supabase
    .from('financeiro_parcelas')
    .select('id, pessoa_id, nro_titulo, parcela, parcelas, data_vencimento, data_baixa, situacao, valor, valor_pago, descricao, competencia, tipo, forma, cliente, plano_contas')
    .not('data_baixa', 'is', null)
    .gte('data_baixa', dataInicio)
    .lte('data_baixa', dataFim)

  if (pessoa_ids.length > 0) {
    query = query.in('pessoa_id', pessoa_ids)
  } else if (clienteNome?.trim()) {
    const term = `%${clienteNome.trim().replace(/%/g, '\\%')}%`
    query = query.ilike('cliente', term)
  } else {
    return { parcelas: [], totalPago: 0 }
  }

  const { data: rows, error } = await query

  if (error) {
    console.error('[parcelasService] fetchPagamentosPorPeriodo:', error)
    return { parcelas: [], totalPago: 0 }
  }

  const parcelas = ((rows ?? []) as ParcelaRow[])
    .filter((p) => (p.situacao ?? '').toUpperCase() === 'PAGO' || p.data_baixa)
    .sort((a, b) => (b.data_baixa ?? '').localeCompare(a.data_baixa ?? ''))

  const totalPago = parcelas.reduce((sum, p) => sum + valorParcelaPaga(p), 0)
  return { parcelas, totalPago }
}
