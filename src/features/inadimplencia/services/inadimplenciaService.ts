import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/lib/database.types'
import type { InadimplenciaClasse } from '@/lib/database.types'
import { getGestorFilterValues } from '@/lib/teamMembersService'
import { calcularClasse, calcularDiasEmAberto } from './classificacao'
import { logsService } from './logsService'

type ClientInsert = Database['public']['Tables']['clients_inadimplencia']['Insert']
type ClientUpdate = Database['public']['Tables']['clients_inadimplencia']['Update']

export interface CreateClienteInput {
  razao_social: string
  cnpj?: string | null
  /** Vincula ao cliente da base do escritório (clientes_escritorio). */
  cliente_escritorio_id?: string | null
  gestor?: string | null
  area?: string | null
  valor_em_aberto: number
  /** Classificação definida na reunião (caso a caso). Se não informada, usa sugestão por dias. */
  status_classe?: InadimplenciaClasse
  created_by?: string | null
}

function buildListQuery(params: {
  busca?: string
  gestor?: string
  area?: string
  classe?: string
  prioridade?: 'urgente' | 'atencao' | 'controlado'
  page?: number
  pageSize?: number
  orderBy?: 'created_at' | 'dias_em_aberto' | 'valor_em_aberto' | 'razao_social'
  orderDesc?: boolean
}) {
  let query = supabase
    .from('clients_inadimplencia')
    .select('*', { count: 'exact' })
    .is('resolvido_at', null)

  const busca = params.busca?.trim()
  if (busca && busca.length > 0) {
    const safe = busca.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '')
    const term = `%${safe}%`
    query = query.or(`razao_social.ilike.${term},cnpj.ilike.${term}`)
  }

  if (params.gestor) {
    const gestorValues = getGestorFilterValues(params.gestor)
    if (gestorValues.length === 1) query = query.eq('gestor', gestorValues[0])
    else query = query.in('gestor', gestorValues)
  }
  if (params.area) query = query.eq('area', params.area)
  if (params.classe) query = query.eq('status_classe', params.classe)
  if (params.prioridade) query = query.eq('prioridade', params.prioridade)

  const orderBy = params.orderBy ?? 'created_at'
  const orderDesc = params.orderDesc ?? true
  query = query.order(orderBy, { ascending: !orderDesc })

  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  return query
}

const EXPORT_PAGE_SIZE = 10000

function escapeCsvCell(value: string | number | null | undefined | Record<string, unknown> | object): string {
  const s = value == null
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
  const needsQuotes = /[",\n\r]/.test(s)
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s
}

export const inadimplenciaService = {
  async list(params: Parameters<typeof buildListQuery>[0]) {
    const { data, error, count } = await buildListQuery(params)
    return { data: data ?? [], error, total: count ?? 0 }
  },

  /** Lista com mesmo filtro/ordenação para exportação (até EXPORT_PAGE_SIZE itens). */
  async listForExport(params: Omit<Parameters<typeof buildListQuery>[0], 'page' | 'pageSize'>) {
    return this.list({ ...params, page: 1, pageSize: EXPORT_PAGE_SIZE })
  },

  /** Gera CSV da listagem para download. */
  buildExportCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'Razão Social',
      'CNPJ',
      'Gestor',
      'Área',
      'Classe',
      'Valor em aberto',
      'Dias em atraso',
      'Data vencimento',
      'Follow-up',
      'Data follow-up',
      'Valor mensal',
      'Contato',
    ]
    const headerLine = headers.map(escapeCsvCell).join(';')
    const keyMap = [
      'razao_social',
      'cnpj',
      'gestor',
      'area',
      'status_classe',
      'valor_em_aberto',
      'dias_em_aberto',
      'data_vencimento',
      'follow_up',
      'data_follow_up',
      'valor_mensal',
      'contato',
    ] as const
    const lines = rows.map((r) =>
      keyMap.map((k) => escapeCsvCell(r[k] as string | number | null | undefined | Record<string, unknown>)).join(';')
    )
    return ['\uFEFF', headerLine, ...lines].join('\r\n')
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('clients_inadimplencia')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async create(input: CreateClienteInput) {
    const diasEmAberto = 0
    const statusClasse = input.status_classe ?? calcularClasse(diasEmAberto)

    const insert: ClientInsert = {
      razao_social: input.razao_social,
      cnpj: input.cnpj ?? null,
      cliente_escritorio_id: input.cliente_escritorio_id ?? null,
      gestor: input.gestor ?? null,
      area: input.area ?? null,
      valor_em_aberto: input.valor_em_aberto,
      data_vencimento: null,
      dias_em_aberto: diasEmAberto,
      status_classe: statusClasse,
      created_by: input.created_by ?? null,
    }

    const { data: client, error } = await supabase
      .from('clients_inadimplencia')
      .insert(insert as never)
      .select()
      .single()

    if (!error && client) {
      const inserted = client as { id: string }
      await logsService.create({
        client_id: inserted.id,
        descricao: 'Cliente inserido no módulo de inadimplência',
        tipo: 'outro',
      })
    }

    return { data: client, error }
  },

  async update(id: string, input: Partial<CreateClienteInput> & { status_classe?: InadimplenciaClasse; cliente_escritorio_id?: string | null; data_vencimento?: string | null; contato?: string | null; observacoes_gerais?: string; ultima_providencia?: string; data_providencia?: string; follow_up?: string; data_follow_up?: string }) {
    let diasEmAberto: number | undefined
    if (input.data_vencimento !== undefined) {
      diasEmAberto = calcularDiasEmAberto(input.data_vencimento)
    }

    const update: ClientUpdate = {}
    if (input.razao_social !== undefined) update.razao_social = input.razao_social
    if (input.cnpj !== undefined) update.cnpj = input.cnpj
    if (input.cliente_escritorio_id !== undefined) update.cliente_escritorio_id = input.cliente_escritorio_id
    if (input.contato !== undefined) update.contato = input.contato
    if (input.gestor !== undefined) update.gestor = input.gestor
    if (input.area !== undefined) update.area = input.area
    if (input.valor_em_aberto !== undefined) update.valor_em_aberto = input.valor_em_aberto
    if (input.data_vencimento !== undefined) update.data_vencimento = input.data_vencimento
    if (diasEmAberto !== undefined) update.dias_em_aberto = diasEmAberto
    if (input.status_classe !== undefined) update.status_classe = input.status_classe
    if (input.observacoes_gerais !== undefined) update.observacoes_gerais = input.observacoes_gerais
    if (input.ultima_providencia !== undefined) update.ultima_providencia = input.ultima_providencia
    if (input.data_providencia !== undefined) update.data_providencia = input.data_providencia
    if (input.follow_up !== undefined) update.follow_up = input.follow_up
    if (input.data_follow_up !== undefined) update.data_follow_up = input.data_follow_up

    const { data, error } = await supabase
      .from('clients_inadimplencia')
      .update(update as never)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  async marcarComoResolvido(id: string) {
    const { data, error } = await supabase
      .from('clients_inadimplencia')
      .update({ resolvido_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      await logsService.create({
        client_id: id,
        descricao: 'Cliente marcado como resolvido',
        tipo: 'acordo',
      })
    }

    return { data, error }
  },
}
