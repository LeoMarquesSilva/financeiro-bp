import { supabase } from '@/lib/supabaseClient'
import { startOfMonth, endOfMonth } from 'date-fns'

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

export interface DashboardData {
  totais: DashboardTotais
  rankingGestores: RankingItem[]
  rankingAreas: RankingItem[]
  valorEmAbertoPorGestor: RankingItem[]
  valorEmAbertoPorArea: RankingItem[]
  tempoMedioRecuperacaoDias: number | null
  followUpAlerts: FollowUpAlerts
}

async function getTotalEmAberto(): Promise<number> {
  const { data, error } = await supabase
    .from('clients_inadimplencia')
    .select('valor_em_aberto')
    .is('resolvido_at', null)
  if (error) return 0
  return (data ?? []).reduce((sum, r) => sum + Number(r.valor_em_aberto), 0)
}

async function getTotaisPorClasse(): Promise<{ A: number; B: number; C: number }> {
  const { data, error } = await supabase
    .from('clients_inadimplencia')
    .select('status_classe, valor_em_aberto')
    .is('resolvido_at', null)
  if (error) return { A: 0, B: 0, C: 0 }
  const acc = { A: 0, B: 0, C: 0 }
  for (const r of data ?? []) {
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
  return (data ?? []).reduce((sum, r) => sum + Number(r.valor_pago), 0)
}

async function getRankingGestores(): Promise<RankingItem[]> {
  const start = startOfMonth(new Date()).toISOString().slice(0, 10)
  const end = endOfMonth(new Date()).toISOString().slice(0, 10)
  const { data: pagamentos, error: errP } = await supabase
    .from('inadimplencia_pagamentos')
    .select('client_id, valor_pago')
    .gte('data_pagamento', start)
    .lte('data_pagamento', end)
  if (errP || !pagamentos?.length) return []

  const clientIds = [...new Set(pagamentos.map((p) => p.client_id))]
  const { data: clients, error: errC } = await supabase
    .from('clients_inadimplencia')
    .select('id, gestor')
    .in('id', clientIds)
  if (errC || !clients?.length) return []

  const byGestor = new Map<string, { valor: number; qty: number }>()
  for (const p of pagamentos) {
    const client = clients.find((c) => c.id === p.client_id)
    const gestor = client?.gestor ?? 'Não informado'
    const cur = byGestor.get(gestor) ?? { valor: 0, qty: 0 }
    cur.valor += Number(p.valor_pago)
    cur.qty += 1
    byGestor.set(gestor, cur)
  }

  return Array.from(byGestor.entries())
    .map(([nome, v]) => ({ nome, valor: v.valor, quantidade: v.qty }))
    .sort((a, b) => b.valor - a.valor)
}

async function getValorEmAbertoPorGestor(): Promise<RankingItem[]> {
  const { data, error } = await supabase
    .from('clients_inadimplencia')
    .select('gestor, valor_em_aberto')
    .is('resolvido_at', null)
  if (error || !data?.length) return []
  const byGestor = new Map<string, number>()
  for (const r of data) {
    const nome = r.gestor ?? 'Não informado'
    byGestor.set(nome, (byGestor.get(nome) ?? 0) + Number(r.valor_em_aberto))
  }
  return Array.from(byGestor.entries())
    .map(([nome, valor]) => ({ nome, valor, quantidade: 0 }))
    .sort((a, b) => b.valor - a.valor)
}

async function getValorEmAbertoPorArea(): Promise<RankingItem[]> {
  const { data, error } = await supabase
    .from('clients_inadimplencia')
    .select('area, valor_em_aberto')
    .is('resolvido_at', null)
  if (error || !data?.length) return []
  const byArea = new Map<string, number>()
  for (const r of data) {
    const nome = r.area ?? 'Não informado'
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
  if (errP || !pagamentos?.length) return []

  const clientIds = [...new Set(pagamentos.map((p) => p.client_id))]
  const { data: clients, error: errC } = await supabase
    .from('clients_inadimplencia')
    .select('id, area')
    .in('id', clientIds)
  if (errC || !clients?.length) return []

  const byArea = new Map<string, { valor: number; qty: number }>()
  for (const p of pagamentos) {
    const client = clients.find((c) => c.id === p.client_id)
    const area = client?.area ?? 'Não informado'
    const cur = byArea.get(area) ?? { valor: 0, qty: 0 }
    cur.valor += Number(p.valor_pago)
    cur.qty += 1
    byArea.set(area, cur)
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
  if (errR || !resolvidos?.length) return null

  const dias: number[] = resolvidos.map((r) => {
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

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const [
      emAberto,
      porClasse,
      recuperadoMes,
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
      rankingGestores,
      rankingAreas,
      valorEmAbertoPorGestor: valorPorGestor,
      valorEmAbertoPorArea: valorPorArea,
      tempoMedioRecuperacaoDias: tempoMedio,
      followUpAlerts,
    }
  },
}
