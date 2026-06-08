import { supabase } from '@/lib/supabaseClient'
import { parseEdgeFunctionError, phoneKey, phonesMatch } from '../utils/phone'
import { isInternalContactName, pickContactLabel } from '../utils/contactNames'
import type {
  CobrancaPainelRow,
  CobrancaTituloAbertoRow,
  CobrancaKpiRow,
} from '@/lib/database.types'

/** Subconjunto de colunas do painel usado no dashboard de indicadores. */
export type CobrancaPainelKpiRow = Pick<
  CobrancaPainelRow,
  | 'parcela_id'
  | 'data_vencimento'
  | 'data_prazo_d1'
  | 'valor'
  | 'tem_whatsapp'
  | 'tem_whatsapp_d1'
  | 'tem_email'
  | 'concluido'
  | 'plano_contas'
  | 'grupo_cliente'
  | 'cliente'
  | 'dias_atraso'
>

export interface PainelFiltros {
  busca?: string
  incluirConcluidos?: boolean
  /** Rotina diária D+1: somente títulos cuja data-alvo de cobrança é hoje (data_prazo_d1). */
  rotinaVencidosOntem?: boolean
  mes?: number | null
  ano?: number | null
  planoContas?: string | null
  /** Status da cobrança nos canais. */
  statusCobranca?: StatusCobrancaFiltro | null
  /** Faixa de dias em atraso. */
  faixaAtraso?: FaixaAtrasoFiltro | null
  orderBy?: 'dias_atraso' | 'valor' | 'data_vencimento' | 'cliente' | 'plano_contas'
  orderDesc?: boolean
  page?: number
  pageSize?: number
}

export type StatusCobrancaFiltro = 'falta_whatsapp' | 'concluido'

export type FaixaAtrasoFiltro = '1-7' | '8-30' | '31+'

/** Calcula o intervalo [inicio, fim] (YYYY-MM-DD) de vencimento para mês/ano. */
function buildVencimentoRange(
  mes?: number | null,
  ano?: number | null,
): { inicio: string; fim: string } | null {
  // Se só o mês for informado, assume o ano atual.
  const anoEfetivo = ano ?? (mes ? new Date().getFullYear() : null)
  if (!anoEfetivo) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  if (mes && mes >= 1 && mes <= 12) {
    const ultimoDia = new Date(anoEfetivo, mes, 0).getDate()
    return {
      inicio: `${anoEfetivo}-${pad(mes)}-01`,
      fim: `${anoEfetivo}-${pad(mes)}-${pad(ultimoDia)}`,
    }
  }
  return { inicio: `${anoEfetivo}-01-01`, fim: `${anoEfetivo}-12-31` }
}

/** Data local (YYYY-MM-DD) de hoje, usada na rotina D+1 (data_prazo_d1). */
function todayDateIsoLocal(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface EnvioItemWhatsapp {
  parcela_id: string
  pessoa_id?: string | null
  number: string
  mensagem: string
}

export interface EnvioItemEmail {
  parcela_id: string
  pessoa_id?: string | null
  email: string
  assunto: string
  corpo: string
}

export interface EnvioWhatsappGrupoPayload {
  parcela_ids: string[]
  pessoa_id?: string | null
  number: string
  mensagem: string
}

export interface EnvioResult {
  enviados: number
  total: number
  results: Array<{ parcela_id: string; ok: boolean; erro?: string }>
}

export interface ArquivadoRow {
  parcela_id: string
  motivo: string | null
  arquivado_at: string
  arquivado_by: string | null
  cliente: string | null
  nro_titulo: string | null
  descricao: string | null
  data_vencimento: string | null
  valor: number | null
}

const DEFAULT_PAGE_SIZE = 50

/** Limite de segurança ao agregar o resumo sobre todo o conjunto filtrado. */
const RESUMO_MAX_ROWS = 5000

/** Resumo agregado do painel sobre TODO o conjunto filtrado (não apenas a página atual). */
export interface PainelResumo {
  totalValor: number
  qtd: number
  comWhatsapp: number
}

/** Query base do painel; serve de fonte para o tipo do builder de filtro. */
function basePainelQuery() {
  return supabase.from('cobranca_painel').select('*', { count: 'exact' })
}

/** Builder de filtro sobre a view do painel. */
type PainelFilterBuilder = ReturnType<typeof basePainelQuery>

/**
 * Aplica todos os filtros do painel à query (exceto ordenação e paginação),
 * para que listagem e resumo agregado fiquem sempre consistentes.
 */
function applyPainelFiltros(query: PainelFilterBuilder, params: PainelFiltros): PainelFilterBuilder {
  let q: PainelFilterBuilder = query

  if (!params.incluirConcluidos && params.statusCobranca !== 'concluido') {
    q = q.eq('concluido', false)
  }

  if (params.rotinaVencidosOntem) {
    q = q.eq('data_prazo_d1', todayDateIsoLocal())
  } else {
    const range = buildVencimentoRange(params.mes, params.ano)
    if (range) {
      q = q.gte('data_vencimento', range.inicio).lte('data_vencimento', range.fim)
    }
  }

  if (params.planoContas) {
    q = q.eq('plano_contas', params.planoContas)
  }

  switch (params.statusCobranca) {
    case 'falta_whatsapp':
      q = q.eq('tem_whatsapp', false)
      break
    case 'concluido':
      q = q.eq('tem_whatsapp', true)
      break
  }

  switch (params.faixaAtraso) {
    case '1-7':
      q = q.gte('dias_atraso', 1).lte('dias_atraso', 7)
      break
    case '8-30':
      q = q.gte('dias_atraso', 8).lte('dias_atraso', 30)
      break
    case '31+':
      q = q.gte('dias_atraso', 31)
      break
  }

  const busca = params.busca?.trim()
  if (busca) {
    const safe = busca.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '')
    const term = `%${safe}%`
    q = q.or(`cliente.ilike.${term},pessoa_nome.ilike.${term},nro_titulo.ilike.${term}`)
  }

  return q
}

export const cobrancaService = {
  async listPainel(params: PainelFiltros): Promise<{ data: CobrancaPainelRow[]; total: number }> {
    let query = applyPainelFiltros(basePainelQuery(), params)

    const orderBy = params.orderBy ?? 'dias_atraso'
    const orderDesc = params.orderDesc ?? true
    query = query.order(orderBy, { ascending: !orderDesc })

    const page = params.page ?? 1
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, error, count } = await query
    if (error) {
      console.error('[cobrancaService] listPainel', error)
      return { data: [], total: 0 }
    }
    return { data: (data ?? []) as CobrancaPainelRow[], total: count ?? 0 }
  },

  /**
   * Resumo agregado (valor pendente, qtd, cobrados) sobre TODO o conjunto filtrado.
   * Independente da paginação, para que os KPIs reflitam os filtros e não só a página.
   */
  async getPainelResumo(params: PainelFiltros): Promise<PainelResumo> {
    const base = supabase
      .from('cobranca_painel')
      .select('valor, tem_whatsapp') as unknown as PainelFilterBuilder
    const query = applyPainelFiltros(base, params).limit(RESUMO_MAX_ROWS)

    const { data, error } = await query
    if (error) {
      console.error('[cobrancaService] getPainelResumo', error)
      return { totalValor: 0, qtd: 0, comWhatsapp: 0 }
    }

    const rows = (data ?? []) as Array<Pick<CobrancaPainelRow, 'valor' | 'tem_whatsapp'>>
    return rows.reduce<PainelResumo>(
      (acc, r) => {
        acc.totalValor += Number(r.valor ?? 0)
        acc.qtd += 1
        if (r.tem_whatsapp) acc.comWhatsapp += 1
        return acc
      },
      { totalValor: 0, qtd: 0, comWhatsapp: 0 },
    )
  },

  /** Todas as parcelas do painel que possuem telefone (para cruzar com conversas do WhatsApp). */
  async listPainelComContato(): Promise<CobrancaPainelRow[]> {
    const { data, error } = await supabase
      .from('cobranca_painel')
      .select('*')
      .not('pessoa_telefone', 'is', null)
      .order('dias_atraso', { ascending: false })
      .limit(2000)
    if (error) {
      console.error('[cobrancaService] listPainelComContato', error)
      return []
    }
    return (data ?? []) as CobrancaPainelRow[]
  },

  /**
   * Títulos em aberto (vencidos e a vencer) de um cliente, casando pelo telefone
   * da conversa. Filtra no servidor pelos 8 últimos dígitos e refina no cliente
   * por DDD + 8 dígitos (tolerante a DDI/9º dígito).
   */
  async listTitulosPorTelefone(numero: string): Promise<CobrancaTituloAbertoRow[]> {
    const sub8 = numero.replace(/\D/g, '').slice(-8)
    if (sub8.length < 8) return []
    const { data, error } = await supabase
      .from('cobranca_titulos_abertos')
      .select('*')
      .eq('arquivado', false)
      .like('telefone_digits', `%${sub8}`)
      .order('data_vencimento', { ascending: true })
      .limit(300)
    if (error) {
      console.error('[cobrancaService] listTitulosPorTelefone', error)
      return []
    }
    return ((data ?? []) as CobrancaTituloAbertoRow[]).filter((r) =>
      phonesMatch(numero, r.pessoa_telefone),
    )
  },

  /** Nomes de clientes por telefone (para identificar conversas do WhatsApp). */
  async listContatoNomes(): Promise<{ telefone: string; nome: string }[]> {
    const map = new Map<string, string>()

    const registrar = (
      telefone: string | null | undefined,
      pessoaNome: string | null | undefined,
      cliente: string | null | undefined,
      grupoCliente?: string | null,
    ) => {
      const key = phoneKey(telefone)
      const label = pickContactLabel(pessoaNome, cliente, grupoCliente)
      if (!key || !label || map.has(key)) return
      map.set(key, label)
    }

    const [{ data: painel }, { data: titulos }, { data: pessoas, error }] = await Promise.all([
      supabase
        .from('cobranca_painel')
        .select('pessoa_telefone, pessoa_nome, cliente, grupo_cliente')
        .not('pessoa_telefone', 'is', null)
        .limit(5000),
      supabase
        .from('cobranca_titulos_abertos')
        .select('pessoa_telefone, pessoa_nome, cliente, grupo_cliente')
        .eq('arquivado', false)
        .not('pessoa_telefone', 'is', null)
        .limit(5000),
      supabase.from('pessoas').select('nome, grupo_cliente, telefone').not('telefone', 'is', null).limit(5000),
    ])

    if (error) {
      console.error('[cobrancaService] listContatoNomes', error)
    }

    for (const r of (painel ?? []) as {
      pessoa_telefone: string | null
      pessoa_nome: string | null
      cliente: string | null
      grupo_cliente: string | null
    }[]) {
      registrar(r.pessoa_telefone, r.pessoa_nome, r.cliente, r.grupo_cliente)
    }
    for (const r of (titulos ?? []) as {
      pessoa_telefone: string | null
      pessoa_nome: string | null
      cliente: string | null
      grupo_cliente: string | null
    }[]) {
      registrar(r.pessoa_telefone, r.pessoa_nome, r.cliente, r.grupo_cliente)
    }
    for (const r of (pessoas ?? []) as {
      telefone: string | null
      nome: string | null
      grupo_cliente: string | null
    }[]) {
      const nome = pickContactLabel(r.nome, r.nome, r.grupo_cliente)
      if (!nome || isInternalContactName(nome)) continue
      registrar(r.telefone, r.nome, r.nome, r.grupo_cliente)
    }

    return Array.from(map.entries()).map(([telefone, nome]) => ({ telefone, nome }))
  },

  /** Indicador de Efetividade na Cobrança Inicial (D+1). */
  async getKpi(): Promise<CobrancaKpiRow | null> {
    const { data, error } = await supabase.from('cobranca_kpi').select('*').single()
    if (error || !data) {
      console.error('[cobrancaService] getKpi', error)
      return null
    }
    return data as CobrancaKpiRow
  },

  /**
   * Linhas-base do painel para o dashboard de indicadores. Escopo: títulos
   * vencidos em aberto com vencimento >= 2026-05-01. A agregação/filtros
   * (mês/ano, plano de contas, grupo) são aplicados no cliente.
   */
  async listPainelKpi(): Promise<CobrancaPainelKpiRow[]> {
    const { data, error } = await supabase
      .from('cobranca_painel')
      .select('parcela_id, data_vencimento, data_prazo_d1, valor, tem_whatsapp, tem_whatsapp_d1, tem_email, concluido, plano_contas, grupo_cliente, cliente, dias_atraso')
      .gte('data_vencimento', '2026-05-01')
      .limit(10000)
    if (error || !data) {
      console.error('[cobrancaService] listPainelKpi', error)
      return []
    }
    return data as CobrancaPainelKpiRow[]
  },

  /** Planos de conta distintos no painel (parcelas vencidas em aberto). */
  async listPlanoContasOpcoes(): Promise<string[]> {
    const { data, error } = await supabase
      .from('cobranca_painel')
      .select('plano_contas')
      .not('plano_contas', 'is', null)
      .order('plano_contas')

    if (error || !data) {
      console.error('[cobrancaService] listPlanoContasOpcoes', error)
      return []
    }

    const set = new Set<string>()
    for (const row of data as Array<{ plano_contas: string | null }>) {
      const v = row.plano_contas?.trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  },

  async listArquivados(): Promise<ArquivadoRow[]> {
    const { data, error } = await supabase
      .from('cobranca_arquivamentos')
      .select(
        'parcela_id, motivo, arquivado_at, arquivado_by, financeiro_parcelas!inner(cliente, nro_titulo, descricao, data_vencimento, valor)',
      )
      .order('arquivado_at', { ascending: false })

    if (error || !data) {
      console.error('[cobrancaService] listArquivados', error)
      return []
    }

    return (data as Array<Record<string, unknown>>).map((r) => {
      const fp = (r.financeiro_parcelas ?? {}) as Record<string, unknown>
      return {
        parcela_id: r.parcela_id as string,
        motivo: (r.motivo as string) ?? null,
        arquivado_at: r.arquivado_at as string,
        arquivado_by: (r.arquivado_by as string) ?? null,
        cliente: (fp.cliente as string) ?? null,
        nro_titulo: (fp.nro_titulo as string) ?? null,
        descricao: (fp.descricao as string) ?? null,
        data_vencimento: (fp.data_vencimento as string) ?? null,
        valor: (fp.valor as number) ?? null,
      }
    })
  },

  async arquivar(parcela_id: string, motivo: string | null, arquivado_by: string | null): Promise<void> {
    const { error } = await supabase
      .from('cobranca_arquivamentos')
      .upsert({ parcela_id, motivo, arquivado_by } as never, { onConflict: 'parcela_id' })
    if (error) throw error
  },

  async desarquivar(parcela_id: string): Promise<void> {
    const { error } = await supabase
      .from('cobranca_arquivamentos')
      .delete()
      .eq('parcela_id', parcela_id)
    if (error) throw error
  },

  /** Atualiza telefone/e-mail da pessoa vinculada (para permitir cobrança). */
  async updateContato(
    pessoa_id: string,
    contato: { telefone?: string | null; email?: string | null },
  ): Promise<void> {
    const update: Record<string, string | null> = {}
    if (contato.telefone !== undefined) update.telefone = contato.telefone
    if (contato.email !== undefined) update.email = contato.email
    const { error } = await supabase.from('pessoas').update(update as never).eq('id', pessoa_id)
    if (error) throw error
  },

  async enviarWhatsapp(itens: EnvioItemWhatsapp[], created_by?: string | null): Promise<EnvioResult> {
    const { data, error } = await supabase.functions.invoke('cobranca-enviar-whatsapp', {
      body: { itens, created_by },
    })
    if (error) {
      throw new Error(await parseEdgeFunctionError(error))
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error))
    }
    return data as EnvioResult
  },

  async enviarEmail(itens: EnvioItemEmail[], created_by?: string | null): Promise<EnvioResult> {
    const { data, error } = await supabase.functions.invoke('cobranca-enviar-email', {
      body: { itens, created_by },
    })
    if (error) {
      throw new Error(await parseEdgeFunctionError(error))
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error))
    }
    return data as EnvioResult
  },

  /**
   * Envia uma única mensagem de WhatsApp para um grupo e marca todas as parcelas
   * como cobradas. Tenta edge function dedicada e usa fallback local se ela não existir.
   */
  async enviarWhatsappGrupo(
    payload: EnvioWhatsappGrupoPayload,
    created_by?: string | null,
  ): Promise<EnvioResult> {
    const parcela_ids = Array.from(new Set(payload.parcela_ids.filter(Boolean)))
    if (parcela_ids.length === 0) {
      return { enviados: 0, total: 0, results: [] }
    }

    const tryEdge = await supabase.functions.invoke('cobranca-enviar-whatsapp-grupo', {
      body: { ...payload, parcela_ids, created_by },
    })

    if (!tryEdge.error && tryEdge.data) {
      return tryEdge.data as EnvioResult
    }

    // Fallback: envia 1 mensagem via gateway WhatsApp e registra eventos por parcela.
    const { error: sendError } = await supabase.functions.invoke('whatsapp-send', {
      body: { number: payload.number, text: payload.mensagem },
    })
    if (sendError) {
      throw new Error(await parseEdgeFunctionError(sendError))
    }

    const eventos = parcela_ids.map((parcela_id) => ({
      parcela_id,
      pessoa_id: payload.pessoa_id ?? null,
      canal: 'whatsapp' as const,
      status: 'enviado' as const,
      destino: payload.number,
      mensagem: payload.mensagem,
      created_by: created_by ?? null,
    }))

    const { error: eventosError } = await supabase.from('cobranca_eventos').insert(eventos as never)
    if (eventosError) {
      throw eventosError
    }

    return {
      enviados: parcela_ids.length,
      total: parcela_ids.length,
      results: parcela_ids.map((parcela_id) => ({ parcela_id, ok: true })),
    }
  },
}
