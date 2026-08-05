import { supabase } from '@/lib/supabaseClient'
import { collectPaginatedRows } from '@/lib/supabasePaginate'
import { startOfMonth, endOfMonth } from 'date-fns'
import { DATA_INICIO_COMITE } from '@/shared/constants/inadimplencia'
import { FINANCEIRO_PARCELAS_SO_RECEBER_OR } from '@/shared/utils/financeiroTitulo'
import { cobrancaSeguimentoService } from '@/features/cobranca/services/cobrancaSeguimentoService'
import type { CobrancaSeguimentoGrupo } from '@/features/cobranca/types/cobrancaSeguimento.types'
import {
  judicializadaService,
} from '@/features/inadimplencia-judicializada/services/judicializadaService'
import {
  fetchInadimplenciaGruposIndex,
  grupoChaveNoComiteInadimplencia,
  type InadimplenciaGruposIndex,
} from '@/features/escritorio/services/inadimplenciaGruposIndex'
import { normalizarNomeGrupo } from '@/features/escritorio/services/escritorioService'

export interface DashboardCarteiraPontual {
  valorEmAberto: number
  qtdGrupos: number
  valorFaixa1_30: number
  valorFaixa31_60: number
  mediaDiasAtraso: number
  classeA: number
  classeB: number
}

export interface DashboardCarteiraRecorrente {
  valorEmAberto: number
  qtdClientes: number
  classeA: number
  classeB: number
  classeC: number
}

export interface DashboardCarteiraJudicializada {
  valorEmAberto: number
  totalValorCausa: number
  totalLancamentoVios: number
  qtdProcessos: number
  qtdGrupos: number
  porArea: { area: string; valor: number; qtd: number }[]
}

export interface DashboardCarteiras {
  pontual: DashboardCarteiraPontual
  recorrente: DashboardCarteiraRecorrente
  judicializada: DashboardCarteiraJudicializada
}

export interface DashboardTotais {
  totalEmAberto: number
  /** Comitê + Pontual (sem judicializada) — base dos KPIs de recuperação. */
  totalEmAbertoOperacional: number
  totalClasseA: number
  totalClasseB: number
  totalClasseC: number
  comiteClasseA: number
  comiteClasseB: number
  comiteClasseC: number
  pontualClasseA: number
  pontualClasseB: number
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
  carteiras: DashboardCarteiras
  taxaRecuperacaoComite: TaxaRecuperacaoComite
  rankingGestores: RankingItem[]
  rankingAreas: RankingItem[]
  valorEmAbertoPorGestor: RankingItem[]
  valorEmAbertoPorArea: RankingItem[]
  tempoMedioRecuperacaoDias: number | null
  followUpAlerts: FollowUpAlerts
}

type ClientListRow = {
  id: string
  valor_em_aberto: number
  status_classe: string
  gestor: string[] | string | null
  area: string[] | string | null
  pessoa_id: string | null
  resolvido_at: string | null
}
type RowPagamentoClient = { client_id: string; valor_pago: number }
type RecuperacaoParcelaRow = {
  pessoa_id: string | null
  cliente: string
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_baixa: string
}
type RecuperacaoMesRaw = {
  pagamentos: RowPagamentoClient[]
  parcelas: RecuperacaoParcelaRow[]
}
type RecuperacaoMesMetrics = {
  total: number
  rankingGestores: RankingItem[]
  rankingAreas: RankingItem[]
}
type RowResolvido = { created_at: string; resolvido_at: string | null }
type ComiteGestorAreaRow = {
  razao_social: string
  pessoa_id: string | null
  gestor: string[] | string | null
  area: string[] | string | null
  resolvido_at: string | null
}
type ProcessoGestorAreaRow = {
  grupo_cliente: string | null
  advogado_responsavel: string | null
  area: string | null
}
type GrupoGestorArea = { gestor: string; area: string }

/** Normaliza gestor/area (array ou string) para string única, evitando chaves duplicadas nas listas. */
function normKey(value: string[] | string | null | undefined): string {
  if (value == null) return 'Não informado'
  return Array.isArray(value) ? (value[0] ?? 'Não informado') : String(value)
}

async function fetchClientListRows(): Promise<ClientListRow[]> {
  const { data, error } = await supabase
    .from('clients_inadimplencia_list')
    .select('id, valor_em_aberto, status_classe, gestor, area, pessoa_id, resolvido_at')
  if (error) return []
  return (data ?? []) as ClientListRow[]
}

function getActiveClients(rows: ClientListRow[]): ClientListRow[] {
  return rows.filter((r) => r.resolvido_at == null)
}

function getTotalEmAbertoFromRows(rows: ClientListRow[]): number {
  return getActiveClients(rows).reduce((sum, r) => sum + Number(r.valor_em_aberto), 0)
}

function getTotaisPorClasseFromRows(rows: ClientListRow[]): { A: number; B: number; C: number } {
  const acc = { A: 0, B: 0, C: 0 }
  for (const r of getActiveClients(rows)) {
    acc[r.status_classe as keyof typeof acc] += Number(r.valor_em_aberto)
  }
  return acc
}

function calcularCarteiraPontual(
  grupos: CobrancaSeguimentoGrupo[],
  index: InadimplenciaGruposIndex,
): DashboardCarteiraPontual {
  let valorEmAberto = 0
  let valorFaixa1_30 = 0
  let valorFaixa31_60 = 0
  let classeA = 0
  let classeB = 0
  let qtdGrupos = 0
  let somaMediaDias = 0

  for (const g of grupos) {
    if (grupoChaveNoComiteInadimplencia(g.grupo_chave, index)) continue
    qtdGrupos += 1
    valorEmAberto += g.valor_total
    somaMediaDias += g.media_dias_atraso ?? 0
    if (g.max_dias_atraso <= 30) {
      valorFaixa1_30 += g.valor_total
      classeA += g.valor_total
    } else {
      valorFaixa31_60 += g.valor_total
      classeB += g.valor_total
    }
  }

  return {
    valorEmAberto,
    qtdGrupos,
    valorFaixa1_30,
    valorFaixa31_60,
    mediaDiasAtraso: qtdGrupos > 0 ? Math.round(somaMediaDias / qtdGrupos) : 0,
    classeA,
    classeB,
  }
}

function rankingFromMap(byKey: Map<string, number>): RankingItem[] {
  return Array.from(byKey.entries())
    .map(([nome, valor]) => ({ nome, valor, quantidade: 0 }))
    .sort((a, b) => b.valor - a.valor)
}

async function fetchPessoaGrupos(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (ids.length === 0) return map

  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const { data, error } = await supabase
      .from('pessoas')
      .select('id, grupo_cliente')
      .in('id', chunk)
    if (error) return map
    for (const row of (data ?? []) as { id: string; grupo_cliente: string | null }[]) {
      if (row.grupo_cliente?.trim()) map.set(row.id, row.grupo_cliente.trim())
    }
  }
  return map
}

/** Histórico do comitê (ativo ou resolvido) → gestor/área por grupo normalizado. */
async function fetchGestorAreaHistoricoPorGrupo(): Promise<Map<string, GrupoGestorArea>> {
  const rows = await collectPaginatedRows<ComiteGestorAreaRow>(async (from, to) =>
    supabase
      .from('clients_inadimplencia')
      .select('razao_social, pessoa_id, gestor, area, resolvido_at')
      .order('id', { ascending: true })
      .range(from, to),
  )

  const pessoaGrupos = await fetchPessoaGrupos(
    [...new Set(rows.map((r) => r.pessoa_id).filter(Boolean))] as string[],
  )

  const map = new Map<string, GrupoGestorArea & { ativo: boolean }>()

  for (const row of rows) {
    const gestor = normKey(row.gestor)
    const area = normKey(row.area)
    const ativo = row.resolvido_at == null

    const upsert = (grupoNorm: string) => {
      if (!grupoNorm) return
      const cur = map.get(grupoNorm)
      if (!cur || (ativo && !cur.ativo)) {
        map.set(grupoNorm, { gestor, area, ativo })
      }
    }

    upsert(normalizarNomeGrupo(row.razao_social))
    if (row.pessoa_id) {
      const grupoCliente = pessoaGrupos.get(row.pessoa_id)
      if (grupoCliente) upsert(normalizarNomeGrupo(grupoCliente))
    }
  }

  return new Map([...map.entries()].map(([k, v]) => [k, { gestor: v.gestor, area: v.area }]))
}

/** Processos VIOS → gestor/área dominantes por grupo_cliente normalizado. */
async function fetchGestorAreaProcessosPorGrupo(): Promise<Map<string, GrupoGestorArea>> {
  const rows = await collectPaginatedRows<ProcessoGestorAreaRow>(async (from, to) =>
    supabase
      .from('processos_completo')
      .select('grupo_cliente, advogado_responsavel, area')
      .order('id', { ascending: true })
      .range(from, to),
  )

  const gestorCount = new Map<string, Map<string, number>>()
  const areaCount = new Map<string, Map<string, number>>()

  for (const row of rows) {
    const grupoNorm = normalizarNomeGrupo(row.grupo_cliente ?? '')
    if (!grupoNorm) continue

    const gestor = row.advogado_responsavel?.trim() || 'Não informado'
    const area = row.area?.trim() || 'Não informado'

    if (!gestorCount.has(grupoNorm)) gestorCount.set(grupoNorm, new Map())
    if (!areaCount.has(grupoNorm)) areaCount.set(grupoNorm, new Map())

    const gMap = gestorCount.get(grupoNorm)!
    const aMap = areaCount.get(grupoNorm)!
    gMap.set(gestor, (gMap.get(gestor) ?? 0) + 1)
    aMap.set(area, (aMap.get(area) ?? 0) + 1)
  }

  const result = new Map<string, GrupoGestorArea>()
  for (const grupoNorm of gestorCount.keys()) {
    const topGestor = [...(gestorCount.get(grupoNorm)?.entries() ?? [])].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0]
    const topArea = [...(areaCount.get(grupoNorm)?.entries() ?? [])].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0]
    result.set(grupoNorm, {
      gestor: topGestor ?? 'Não informado',
      area: topArea ?? 'Não informado',
    })
  }
  return result
}

function resolveGestorAreaGrupoPontual(
  grupoChave: string,
  historico: Map<string, GrupoGestorArea>,
  processos: Map<string, GrupoGestorArea>,
  grupo?: CobrancaSeguimentoGrupo,
): GrupoGestorArea {
  const norm = normalizarNomeGrupo(grupoChave)
  const hist = historico.get(norm)
  const proc = processos.get(norm)
  const gestor = hist?.gestor ?? proc?.gestor ?? 'Não informado'
  let area = hist?.area ?? proc?.area ?? 'Não informado'

  if (area === 'Não informado' && grupo?.departamentos?.length) {
    const topDept = [...grupo.departamentos].sort((a, b) => b.valor - a.valor)[0]
    if (topDept?.departamento) area = topDept.departamento
  }

  return { gestor, area }
}

function getValorEmAbertoPorGestorRecorrentePontual(
  rows: ClientListRow[],
  pontualGrupos: CobrancaSeguimentoGrupo[],
  index: InadimplenciaGruposIndex,
  historico: Map<string, GrupoGestorArea>,
  processos: Map<string, GrupoGestorArea>,
): RankingItem[] {
  const byGestor = new Map<string, number>()

  for (const r of getActiveClients(rows)) {
    const nome = normKey(r.gestor)
    byGestor.set(nome, (byGestor.get(nome) ?? 0) + Number(r.valor_em_aberto))
  }

  for (const g of pontualGrupos) {
    if (grupoChaveNoComiteInadimplencia(g.grupo_chave, index)) continue
    const { gestor } = resolveGestorAreaGrupoPontual(g.grupo_chave, historico, processos, g)
    byGestor.set(gestor, (byGestor.get(gestor) ?? 0) + g.valor_total)
  }

  return rankingFromMap(byGestor)
}

function getValorEmAbertoPorAreaRecorrentePontual(
  rows: ClientListRow[],
  pontualGrupos: CobrancaSeguimentoGrupo[],
  index: InadimplenciaGruposIndex,
  historico: Map<string, GrupoGestorArea>,
  processos: Map<string, GrupoGestorArea>,
): RankingItem[] {
  const byArea = new Map<string, number>()

  for (const r of getActiveClients(rows)) {
    const nome = normKey(r.area)
    byArea.set(nome, (byArea.get(nome) ?? 0) + Number(r.valor_em_aberto))
  }

  for (const g of pontualGrupos) {
    if (grupoChaveNoComiteInadimplencia(g.grupo_chave, index)) continue
    const { area } = resolveGestorAreaGrupoPontual(g.grupo_chave, historico, processos, g)
    byArea.set(area, (byArea.get(area) ?? 0) + g.valor_total)
  }

  return rankingFromMap(byArea)
}

function getIntervaloMesCorrente(): { start: string; end: string } {
  return {
    start: startOfMonth(new Date()).toISOString().slice(0, 10),
    end: endOfMonth(new Date()).toISOString().slice(0, 10),
  }
}

/** Pagamentos manuais do mês + parcelas VIOS baixadas no mês após o vencimento. */
async function fetchRecuperacaoMesRawData(): Promise<RecuperacaoMesRaw> {
  const { start, end } = getIntervaloMesCorrente()

  const [pagamentosRes, parcelas] = await Promise.all([
    supabase
      .from('inadimplencia_pagamentos')
      .select('client_id, valor_pago')
      .gte('data_pagamento', start)
      .lte('data_pagamento', end),
    collectPaginatedRows<RecuperacaoParcelaRow>(async (from, to) =>
      supabase
        .from('financeiro_parcelas')
        .select('pessoa_id, cliente, valor, valor_pago, data_vencimento, data_baixa')
        .or(FINANCEIRO_PARCELAS_SO_RECEBER_OR)
        .not('data_baixa', 'is', null)
        .gte('data_baixa', start)
        .lte('data_baixa', end)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ])

  const pagamentos = pagamentosRes.error ? [] : ((pagamentosRes.data ?? []) as RowPagamentoClient[])
  const parcelasRecuperadas = parcelas.filter(
    (p) => p.data_baixa > p.data_vencimento,
  )

  return { pagamentos, parcelas: parcelasRecuperadas }
}

function buildPessoaGestorAreaMap(clients: ClientListRow[]): Map<string, GrupoGestorArea> {
  const map = new Map<string, GrupoGestorArea>()
  for (const c of clients) {
    if (!c.pessoa_id) continue
    map.set(c.pessoa_id, { gestor: normKey(c.gestor), area: normKey(c.area) })
  }
  return map
}

function resolveGestorAreaRecuperacaoParcela(
  parcela: RecuperacaoParcelaRow,
  pessoaMap: Map<string, GrupoGestorArea>,
  historico: Map<string, GrupoGestorArea>,
  processos: Map<string, GrupoGestorArea>,
): GrupoGestorArea {
  if (parcela.pessoa_id) {
    const fromClient = pessoaMap.get(parcela.pessoa_id)
    if (fromClient) return fromClient
  }
  const norm = normalizarNomeGrupo(parcela.cliente)
  return historico.get(norm) ?? processos.get(norm) ?? { gestor: 'Não informado', area: 'Não informado' }
}

function buildRecuperacaoMesMetrics(
  raw: RecuperacaoMesRaw,
  clients: ClientListRow[],
  historico: Map<string, GrupoGestorArea>,
  processos: Map<string, GrupoGestorArea>,
): RecuperacaoMesMetrics {
  const pessoaMap = buildPessoaGestorAreaMap(clients)
  const clientById = new Map(clients.map((c) => [c.id, c]))
  const byGestor = new Map<string, { valor: number; qty: number }>()
  const byArea = new Map<string, { valor: number; qty: number }>()
  let total = 0

  const addToRankings = (gestor: string, area: string, valor: number) => {
    if (valor <= 0) return
    total += valor
    const g = byGestor.get(gestor) ?? { valor: 0, qty: 0 }
    g.valor += valor
    g.qty += 1
    byGestor.set(gestor, g)
    const a = byArea.get(area) ?? { valor: 0, qty: 0 }
    a.valor += valor
    a.qty += 1
    byArea.set(area, a)
  }

  for (const p of raw.pagamentos) {
    const client = clientById.get(p.client_id)
    addToRankings(normKey(client?.gestor), normKey(client?.area), Number(p.valor_pago))
  }

  for (const p of raw.parcelas) {
    const valor = Number(p.valor_pago ?? p.valor ?? 0)
    const { gestor, area } = resolveGestorAreaRecuperacaoParcela(p, pessoaMap, historico, processos)
    addToRankings(gestor, area, valor)
  }

  return {
    total,
    rankingGestores: Array.from(byGestor.entries())
      .map(([nome, v]) => ({ nome, valor: v.valor, quantidade: v.qty }))
      .sort((a, b) => b.valor - a.valor),
    rankingAreas: Array.from(byArea.entries())
      .map(([nome, v]) => ({ nome, valor: v.valor, quantidade: v.qty }))
      .sort((a, b) => b.valor - a.valor),
  }
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
async function getTaxaRecuperacaoComite(clients: ClientListRow[]): Promise<TaxaRecuperacaoComite> {
  const paymentsRes = await supabase
    .from('inadimplencia_pagamentos')
    .select('client_id, valor_pago')
    .gte('data_pagamento', DATA_INICIO_COMITE)

  const payments = (paymentsRes.data ?? []) as { client_id: string; valor_pago: number }[]

  const pessoaIdsComite = [...new Set(clients.map((c) => c.pessoa_id).filter(Boolean))] as string[]
  let parcelas: { pessoa_id: string | null; valor: number; valor_pago: number | null }[] = []
  if (pessoaIdsComite.length > 0) {
    const parcelasRes = await supabase
      .from('financeiro_parcelas')
      .select('pessoa_id, valor, valor_pago')
      .or(FINANCEIRO_PARCELAS_SO_RECEBER_OR)
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
      clientListRows,
      recuperacaoMesRaw,
      tempoMedio,
      followUpAlerts,
      seguimentoDashboard,
      gruposIndex,
      judicializadaRows,
      gestorAreaHistorico,
      gestorAreaProcessos,
    ] = await Promise.all([
      fetchClientListRows(),
      fetchRecuperacaoMesRawData(),
      getTempoMedioRecuperacao(),
      getFollowUpAlerts(),
      cobrancaSeguimentoService.fetchDashboard(),
      fetchInadimplenciaGruposIndex(),
      judicializadaService.fetchJudicializadaList(false),
      fetchGestorAreaHistoricoPorGrupo(),
      fetchGestorAreaProcessosPorGrupo(),
    ])

    const {
      total: recuperadoMes,
      rankingGestores,
      rankingAreas,
    } = buildRecuperacaoMesMetrics(
      recuperacaoMesRaw,
      clientListRows,
      gestorAreaHistorico,
      gestorAreaProcessos,
    )

    const pontualCarteira = calcularCarteiraPontual(seguimentoDashboard.grupos, gruposIndex)
    const pontualPorClasse = { A: pontualCarteira.classeA, B: pontualCarteira.classeB }

    const activeClients = getActiveClients(clientListRows)
    const emAbertoComite = getTotalEmAbertoFromRows(clientListRows)
    const porClasse = getTotaisPorClasseFromRows(clientListRows)
    const pontualEmAberto = pontualCarteira.valorEmAberto
    const judicializadaKpis = judicializadaService.calcularKpis(judicializadaRows)
    const emAbertoOperacional = emAbertoComite + pontualEmAberto
    const emAberto = emAbertoOperacional + judicializadaKpis.totalEmAberto

    const carteiras: DashboardCarteiras = {
      pontual: pontualCarteira,
      recorrente: {
        valorEmAberto: emAbertoComite,
        qtdClientes: activeClients.length,
        classeA: porClasse.A,
        classeB: porClasse.B,
        classeC: porClasse.C,
      },
      judicializada: {
        valorEmAberto: judicializadaKpis.totalEmAberto,
        totalValorCausa: judicializadaKpis.totalValorCausa,
        totalLancamentoVios: judicializadaKpis.totalLancamentoVios,
        qtdProcessos: judicializadaKpis.qtdProcessos,
        qtdGrupos: judicializadaKpis.qtdGrupos,
        porArea: judicializadaKpis.porArea.slice(0, 3),
      },
    }

    const valorPorGestor = getValorEmAbertoPorGestorRecorrentePontual(
      clientListRows,
      seguimentoDashboard.grupos,
      gruposIndex,
      gestorAreaHistorico,
      gestorAreaProcessos,
    )
    const valorPorArea = getValorEmAbertoPorAreaRecorrentePontual(
      clientListRows,
      seguimentoDashboard.grupos,
      gruposIndex,
      gestorAreaHistorico,
      gestorAreaProcessos,
    )
    const taxaRecuperacaoComite = await getTaxaRecuperacaoComite(clientListRows)

    const totalInicioMes = emAbertoOperacional + recuperadoMes
    const percentualRecuperacao =
      totalInicioMes > 0 ? (recuperadoMes / totalInicioMes) * 100 : 0

    return {
      totais: {
        totalEmAberto: emAberto,
        totalEmAbertoOperacional: emAbertoOperacional,
        totalClasseA: porClasse.A + pontualPorClasse.A,
        totalClasseB: porClasse.B + pontualPorClasse.B,
        totalClasseC: porClasse.C,
        comiteClasseA: porClasse.A,
        comiteClasseB: porClasse.B,
        comiteClasseC: porClasse.C,
        pontualClasseA: pontualPorClasse.A,
        pontualClasseB: pontualPorClasse.B,
        totalRecuperadoMes: recuperadoMes,
        percentualRecuperacao,
      },
      carteiras,
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
