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
}

export interface ParcelasPorCliente {
  pagas: ParcelaRow[]
  emAtraso: ParcelaRow[]
  aVencer: ParcelaRow[]
}

const HOJE = new Date().toISOString().slice(0, 10)

/**
 * Busca parcelas do cliente inadimplente.
 * Prioridade: pessoa_id (vinculado à base pessoas). Fallback: cliente ilike razao_social.
 */
export async function fetchParcelasPorCliente(params: {
  pessoa_id: string | null
  razao_social: string
}): Promise<ParcelasPorCliente> {
  const { pessoa_id, razao_social } = params

  let query = supabase
    .from('financeiro_parcelas')
    .select('id, pessoa_id, nro_titulo, parcela, parcelas, data_vencimento, data_baixa, situacao, valor, valor_pago, descricao, competencia, tipo, forma, cliente')

  if (pessoa_id) {
    query = query.eq('pessoa_id', pessoa_id)
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
