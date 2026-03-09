import { supabase } from '@/lib/supabaseClient'
import { startOfMonth, endOfMonth } from 'date-fns'
import { DATA_INICIO_COMITE } from '@/shared/constants/inadimplencia'

export interface DashboardTotais {
  totalEmAberto: number
  totalClasseA: number
  totalClasseB: number
  totalClasseC: number
  totalRecuperadoMes: number
  percentualRecuperacao: number
}

export interface RankingItem {
  nome: string
  valor: number
  quantidade: number
}

export interface FollowUpAlerts {
  vencidos: number
  aVencerEm7Dias: number
}

/** Taxa de recuperação desde o início do comitê (05/02/2026). Pagamentos a partir dessa data entram na porcentagem. */
export interface TaxaRecuperacaoComite {
  totalRecuperadoDesdeComite: number
  valorTotalEmAbertoInicioComite: number
  percentualRecuperacaoComite: number
  /** Total recuperado desde 05/02 por gestor (nome = gestor key). */
  recuperadoPorGestor: RankingItem[]
  /** Total recuperado desde 05/02 por área. */
  recuperadoPorArea: RankingItem[]
}

export interface DashboardData {
  totais: DashboardTotais
  taxaRecuperacaoComite: TaxaRecuperacaoComite
  rankingGestores: RankingItem[]
  rankingAreas: RankingItem[]
  valorEmAbertoPorGestor: RankingItem[]
  valorEmAbertoPorArea: RankingItem[]
  tempoMedioRecuperacaoDias: number | null
  followUpAlerts: FollowUpAlerts
}

type RowValorEmAberto = { valor_em_aberto: number }
type RowClasseValor = { status_classe: string; valor_em_aberto: number }
type RowValorPago = { valor_pago: number }
type RowPagamentoClient = { client_id: string; valor_pago: number }
type RowClientGestor = { id: string; gestor: string[] | string | null }
type RowClientArea = { id: string; area: string[] | string | null }
type RowResolvido = { created_at: string; resolvido_at: string | null }

/** Normaliza gestor/area (array ou string) para string única, evitando chaves duplicadas nas listas. */
function normKey(value: string[] | string | null | undefined): string {
  if (value == null) return 'Não informado'
  return Array.isArray(value) ? (value[0] ?? 'Não informado') : String(value)
}

async function getTotalEmAberto(): Promise<number> {
  const { data, error } = await supabase
    .from('clients_inadimplencia_list')
    .select('valor_em_aberto')
    .is('resolvido_at', null)
  if (error) return 0
  const rows = (data ?? []) as RowValorEmAberto[]
  return rows.reduce((sum, r) => sum + Number(r.valor_em_aberto), 0)
}

async function getTotaisPorClasse(): Promise<{ A: number; B: number; C: number }> {
  const { data, error } = await supabase
    .from('clients_inadimplencia_list')
    .select('status_classe, valor_em_aberto')
    .is('resolvido_at', null)
  if (error) return { A: 0, B: 0, C: 0 }
  const acc = { A: 0, B: 0, C: 0 }
  const rows = (data ?? []) as RowClasseValor[]
  for (const r of rows) {
    acc[r.status_classe as keyof typeof acc] += Number(r.valor_em_aberto)
  }
  return acc
}

async function getTotalRecuperadoNoMes(): Promise<number> {
  const start = startOfMonth(new Date()).toISOString().slice(0, 10)
  const end = endOfMonth(new Date()).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('inadimplencia_pagamentos')
    .select('valor_pago')
    .gte('data_pagamento', start)
    .lte('data_pagamento', end)
  if (error) return 0
  const rows = (data ?? []) as RowValorPago[]
  return rows.reduce((sum, r) => sum + Number(r.valor_pago), 0)
}

async function getRankingGestores(): Promise<RankingItem[]> {
  const start = startOfMonth(new Date()).toISOString().slice(0, 10)
  const end = endOfMonth(new Date()).toISOString().slice(0, 10)
  const { data: pagamentos, error: errP } = await supabase
    .from('inadimplencia_pagamentos')
    .select('client_id, valor_pago')
    .gte('data_pagamento', start)
    .lte('data_pagamento', end)
  const pagamentosRows = (pagamentos ?? []) as RowPagamentoClient[]
  if (errP || !pagamentosRows.length) return []

  const clientIds = [...new Set(pagamentosRows.map((p) => p.client_id))]
  const { data: clients, error: errC } = await supabase
    .from('clients_inadimplencia')
    .select('id, gestor')
    .in('id', clientIds)
  const clientsRows = (clients ?? []) as RowClientGestor[]
  if (errC || !clientsRows.length) return []

  const byGestor = new Map<string, { valor: number; qty: number }>()
  for (const p of pagamentosRows) {
    const client = clientsRows.find((c) => c.id === p.client_id)
    const gestorKey = normKey(client?.gestor)
    const cur = byGestor.get(gestorKey) ?? { valor: 0, qty: 0 }
    cur.valor += Number(p.valor_pago)
    cur.qty += 1
    byGestor.set(gestorKey, cur)
  }

  return Array.from(byGestor.entries())
    .map(([nome, v]) => ({ nome, valor: v.valor, quantidade: v.qty }))
    .sort((a, b) => b.valor - a.valor)
}

async function getValorEmAbertoPorGestor(): Promise<RankingItem[]> {
  const { data, error } = await supabase
    .from('clients_inadimplencia_list')
    .select('gestor, valor_em_aberto')
    .is('resolvido_at', null)
  const rows = (data ?? []) as { gestor: string[] | string | null; valor_em_aberto: number }[]
  if (error || !rows.length) return []
  const byGestor = new Map<string, number>()
  for (const r of rows) {
    const nome = normKey(r.gestor)
    byGestor.set(nome, (byGestor.get(nome) ?? 0) + Number(r.valor_em_aberto))
  }
  return Array.from(byGestor.entries())
    .map(([nome, valor]) => ({ nome, valor, quantidade: 0 }))
    .sort((a, b) => b.valor - a.valor)
}

async function getValorEmAbertoPorArea(): Promise<RankingItem[]> {
  const { data, error } = await supabase
    .from('clients_inadimplencia_list')
    .select('area, valor_em_aberto')
    .is('resolvido_at', null)
  const rows = (data ?? []) as { area: string[] | string | null; valor_em_aberto: number }[]
  if (error || !rows.length) return []
  const byArea = new Map<string, number>()
  for (const r of rows) {
    const nome = normKey(r.area)
    byArea.set(nome, (byArea.get(nome) ?? 0) + Number(r.valor_em_aberto))
  }
  return Array.from(byArea.entries())
    .map(([nome, valor]) => ({ nome, valor, quantidade: 0 }))
    .sort((a, b) => b.valor - a.valor)
}

async function getRankingAreas(): Promise<RankingItem[]> {
  const start = startOfMonth(new Date()).toISOString().slice(0, 10)
  const end = endOfMonth(new Date()).toISOString().slice(0, 10)
  const { data: pagamentos, error: errP } = await supabase
    .from('inadimplencia_pagamentos')
    .select('client_id, valor_pago')
    .gte('data_pagamento', start)
    .lte('data_pagamento', end)
  const pagamentosRows = (pagamentos ?? []) as RowPagamentoClient[]
  if (errP || !pagamentosRows.length) return []

  const clientIds = [...new Set(pagamentosRows.map((p) => p.client_id))]
  const { data: clients, error: errC } = await supabase
    .from('clients_inadimplencia')
    .select('id, area')
    .in('id', clientIds)
  const clientsRows = (clients ?? []) as RowClientArea[]
  if (errC || !clientsRows.length) return []

  const byArea = new Map<string, { valor: number; qty: number }>()
  for (const p of pagamentosRows) {
    const client = clientsRows.find((c) => c.id === p.client_id)
    const areaKey = normKey(client?.area)
    const cur = byArea.get(areaKey) ?? { valor: 0, qty: 0 }
    cur.valor += Number(p.valor_pago)
    cur.qty += 1
    byArea.set(areaKey, cur)
  }

  return Array.from(byArea.entries())
    .map(([nome, v]) => ({ nome, valor: v.valor, quantidade: v.qty }))
    .sort((a, b) => b.valor - a.valor)
}

async function getTempoMedioRecuperacao(): Promise<number | null> {
  const { data: resolvidos, error: errR } = await supabase
    .from('clients_inadimplencia')
    .select('created_at, resolvido_at')
    .not('resolvido_at', 'is', null)
  const rows = (resolvidos ?? []) as RowResolvido[]
  if (errR || !rows.length) return null

  const dias: number[] = rows.map((r) => {
    const created = new Date(r.created_at).getTime()
    const resolved = new Date(r.resolvido_at!).getTime()
    return Math.round((resolved - created) / (1000 * 60 * 60 * 24))
  })
  const sum = dias.reduce((a, b) => a + b, 0)
  return dias.length ? Math.round(sum / dias.length) : null
}

async function getFollowUpAlerts(): Promise<FollowUpAlerts> {
  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { count: countVencidos } = await supabase
    .from('clients_inadimplencia')
    .select('id', { count: 'exact', head: true })
    .is('resolvido_at', null)
    .not('data_follow_up', 'is', null)
    .lt('data_follow_up', today)
  const { count: countAVencer } = await supabase
    .from('clients_inadimplencia')
    .select('id', { count: 'exact', head: true })
    .is('resolvido_at', null)
    .not('data_follow_up', 'is', null)
    .gte('data_follow_up', today)
    .lte('data_follow_up', in7Days)
  return {
    vencidos: countVencidos ?? 0,
    aVencerEm7Dias: countAVencer ?? 0,
  }
}

/** Taxa de recuperação desde o início do comitê (05/02/2026). Pagamentos a partir dessa data entram na porcentagem.
 * Fontes: inadimplencia_pagamentos (registros manuais) + financeiro_parcelas (parcelas com data_baixa >= 05/02), vinculadas por pessoa_id. */
async function getTaxaRecuperacaoComite(): Promise<TaxaRecuperacaoComite> {
  const [clientsRes, paymentsRes] = await Promise.all([
    supabase
      .from('clients_inadimplencia_list')
      .select('id, valor_em_aberto, pessoa_id, gestor, area'),
    supabase
      .from('inadimplencia_pagamentos')
      .select('client_id, valor_pago')
      .gte('data_pagamento', DATA_INICIO_COMITE),
  ])

  const clients = (clientsRes.data ?? []) as {
    id: string
    valor_em_aberto: number
    pessoa_id: string | null
    gestor: string[] | string | null
    area: string[] | string | null
  }[]
  const payments = (paymentsRes.data ?? []) as { client_id: string; valor_pago: number }[]

  const pessoaIdsComite = [...new Set(clients.map((c) => c.pessoa_id).filter(Boolean))] as string[]
  let parcelas: { pessoa_id: string | null; valor: number; valor_pago: number | null }[] = []
  if (pessoaIdsComite.length > 0) {
    const parcelasRes = await supabase
      .from('financeiro_parcelas')
      .select('pessoa_id, valor, valor_pago')
      .not('data_baixa', 'is', null)
      .gte('data_baixa', DATA_INICIO_COMITE)
      .in('pessoa_id', pessoaIdsComite)
    parcelas = (parcelasRes.data ?? []) as { pessoa_id: string | null; valor: number; valor_pago: number | null }[]
  }

  const pagamentosPorCliente = new Map<string, number>()
  for (const p of payments) {
    const v = Number(p.valor_pago)
    pagamentosPorCliente.set(p.client_id, (pagamentosPorCliente.get(p.client_id) ?? 0) + v)
  }

  const recuperadoPorPessoaId = new Map<string, number>()
  for (const row of parcelas) {
    if (!row.pessoa_id) continue
    const v = Number(row.valor_pago ?? row.valor ?? 0)
    recuperadoPorPessoaId.set(row.pessoa_id, (recuperadoPorPessoaId.get(row.pessoa_id) ?? 0) + v)
  }

  const byGestor = new Map<string, number>()
  const byArea = new Map<string, number>()
  let totalRecuperadoDesdeComite = 0
  let valorTotalEmAbertoInicioComite = 0
  for (const c of clients) {
    const emAberto = Number(c.valor_em_aberto)
    const pagoInadimplencia = pagamentosPorCliente.get(c.id) ?? 0
    const pagoParcelas = (c.pessoa_id ? recuperadoPorPessoaId.get(c.pessoa_id) ?? 0 : 0)
    const pagoDesdeComite = pagoInadimplencia + pagoParcelas
    totalRecuperadoDesdeComite += pagoDesdeComite
    valorTotalEmAbertoInicioComite += emAberto + pagoDesdeComite
    const gKey = normKey(c.gestor)
    const aKey = normKey(c.area)
    byGestor.set(gKey, (byGestor.get(gKey) ?? 0) + pagoDesdeComite)
    byArea.set(aKey, (byArea.get(aKey) ?? 0) + pagoDesdeComite)
  }

  const percentualRecuperacaoComite =
    valorTotalEmAbertoInicioComite > 0
      ? (totalRecuperadoDesdeComite / valorTotalEmAbertoInicioComite) * 100
      : 0

  const recuperadoPorGestor = Array.from(byGestor.entries())
    .map(([nome, valor]) => ({ nome, valor, quantidade: 0 }))
    .sort((a, b) => b.valor - a.valor)
  const recuperadoPorArea = Array.from(byArea.entries())
    .map(([nome, valor]) => ({ nome, valor, quantidade: 0 }))
    .sort((a, b) => b.valor - a.valor)

  return {
    totalRecuperadoDesdeComite,
    valorTotalEmAbertoInicioComite,
    percentualRecuperacaoComite,
    recuperadoPorGestor,
    recuperadoPorArea,
  }
}

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const [
      emAberto,
      porClasse,
      recuperadoMes,
      taxaRecuperacaoComite,
      rankingGestores,
      rankingAreas,
      valorPorGestor,
      valorPorArea,
      tempoMedio,
      followUpAlerts,
    ] = await Promise.all([
      getTotalEmAberto(),
      getTotaisPorClasse(),
      getTotalRecuperadoNoMes(),
      getTaxaRecuperacaoComite(),
      getRankingGestores(),
      getRankingAreas(),
      getValorEmAbertoPorGestor(),
      getValorEmAbertoPorArea(),
      getTempoMedioRecuperacao(),
      getFollowUpAlerts(),
    ])

    const totalInicioMes = emAberto + recuperadoMes
    const percentualRecuperacao =
      totalInicioMes > 0 ? (recuperadoMes / totalInicioMes) * 100 : 0

    return {
      totais: {
        totalEmAberto: emAberto,
        totalClasseA: porClasse.A,
        totalClasseB: porClasse.B,
        totalClasseC: porClasse.C,
        totalRecuperadoMes: recuperadoMes,
        percentualRecuperacao,
      },
      taxaRecuperacaoComite,
      rankingGestores,
      rankingAreas,
      valorEmAbertoPorGestor: valorPorGestor,
      valorEmAbertoPorArea: valorPorArea,
      tempoMedioRecuperacaoDias: tempoMedio,
      followUpAlerts,
    }
  },
}
