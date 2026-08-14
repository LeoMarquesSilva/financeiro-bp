import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  areaEficienciaParam,
  departamentoMatchesAreaKey,
  META_AREAS,
  type RelatorioSecoes,
} from './constants.ts'
import type { IndicadoresOperacionaisInput } from './indicadoresOperacionais.ts'
import { fetchTopGruposInadComVencimento } from './inadGruposTop.ts'
import {
  buildFechamentoPorAreaItens,
  filtrarPrevistoMesItensPorCiItens,
  type ReceitaFechamentoMes,
} from './receitaFechamentoArea.ts'

function rpcError(context: string, error: { message?: string; details?: string; hint?: string; code?: string }): never {
  const parts = [context, error.message, error.details, error.hint, error.code].filter(Boolean)
  throw new Error(parts.join(' | ') || context)
}

export type { ReceitaFechamentoMes }

export type ReceitaMesResumo = {
  mes: number
  recebido: number
  previsto: number
  meta: number
  inadimplencia: number
}

export type HeatCell = { value: number | null; label: string }

export type OverviewHeatRow = {
  title: string
  meta: number
  metaLabel?: string
  metaAcumulado?: number
  lowerIsBetter?: boolean
  cells: HeatCell[]
  acumulado: HeatCell
  modoAnual?: boolean
  anoLabel?: string
}

export type RelatorioDadosBase = {
  ano: number
  mes: number
  /** Dia incluso no recorte parcial (gestão à vista). */
  diaReferencia: number
  /** ISO YYYY-MM-DD — data de corte (ontem no fuso para mês parcial). */
  corteIso: string
  periodoLabel: string
  periodoCurto: string
  parcial: boolean
  indicadores: IndicadoresOperacionaisInput
  fechamento: ReceitaFechamentoMes
  metaMes: number
  inadMes: number
  inadPct: number | null
  topGruposInad: Array<{ grupo: string; valor: number; data_vencimento: string }>
  resumoMensal: ReceitaMesResumo[]
  overviewHeatRows: OverviewHeatRow[]
}

type MetasConfig = {
  ano: number
  meta: number
  meses_meta?: number[]
}

function rowMes<T extends { mes: number }>(rows: T[], mes: number): T | undefined {
  return rows.find((r) => r.mes === mes)
}

function pctInad(inad: number, previsto: number): number | null {
  if (previsto <= 0) return null
  return Math.round((inad / previsto) * 10000) / 100
}

function parseFechamento(raw: unknown): ReceitaFechamentoMes {
  const d = (raw ?? {}) as Record<string, unknown>
  const num = (k: string) => Number(d[k]) || 0
  return {
    previsto: num('previsto'),
    recebido_classificado: num('recebido_classificado'),
    receita_mes_caixa: num('receita_mes_caixa'),
    inad_recebida: num('inad_recebida'),
    novos_vencimento_mes: num('novos_vencimento_mes'),
    novos_vencimento_anterior: num('novos_vencimento_anterior'),
    inadimplencia_kpi: num('inadimplencia_kpi'),
    recebido_previsto_caixa: num('recebido_previsto_caixa'),
  }
}

async function fetchMetas(supabase: SupabaseClient): Promise<MetasConfig> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'receita_metas')
    .maybeSingle()
  if (error) rpcError('fetchMetas', error)
  const v = (data?.value ?? {}) as MetasConfig
  return {
    ano: Number(v.ano) || new Date().getFullYear(),
    meta: Number(v.meta) || 0,
    meses_meta: Array.isArray(v.meses_meta) ? v.meses_meta.map(Number) : undefined,
  }
}

async function fetchIndicadores(
  supabase: SupabaseClient,
  ano: number,
  mes: number,
  areaKey: string | null,
  corteIso: string,
): Promise<IndicadoresOperacionaisInput> {
  const area = areaEficienciaParam(areaKey)

  const [
    slaRows,
    efRows,
    agRows,
    vrRows,
    vnRows,
    pdiRows,
    retRows,
    devRows,
  ] = await Promise.all([
    supabase.rpc('eficiencia_sla_protocolo_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_protocolo_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_agendamento_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_sla_vistagem_mensal', { p_ano: ano, p_risco: true, p_area: area }),
    areaKey === 'trabalhista'
      ? Promise.resolve({ data: [], error: null })
      : supabase.rpc('eficiencia_sla_vistagem_mensal', { p_ano: ano, p_risco: false, p_area: area }),
    supabase.rpc('eficiencia_gestao_pdi_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_turnover_anual', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_treinamentos_acumulado_ate', {
      p_ano: ano,
      p_data_corte: corteIso,
      p_area: area,
    }),
  ])

  if (slaRows.error) rpcError('eficiencia_sla_protocolo_mensal', slaRows.error)
  if (efRows.error) rpcError('eficiencia_protocolo_mensal', efRows.error)
  if (agRows.error) rpcError('eficiencia_agendamento_mensal', agRows.error)
  if (vrRows.error) rpcError('eficiencia_sla_vistagem_mensal risco', vrRows.error)
  if (vnRows.error) rpcError('eficiencia_sla_vistagem_mensal normal', vnRows.error)
  if (pdiRows.error) rpcError('eficiencia_gestao_pdi_mensal', pdiRows.error)
  if (retRows.error) rpcError('eficiencia_turnover_anual', retRows.error)
  if (devRows.error) rpcError('eficiencia_treinamentos_acumulado_ate', devRows.error)

  const sla = rowMes((slaRows.data ?? []) as Array<Record<string, unknown>>, mes)
  const ef = rowMes((efRows.data ?? []) as Array<Record<string, unknown>>, mes)
  const ag = rowMes((agRows.data ?? []) as Array<Record<string, unknown>>, mes)
  const vr = rowMes((vrRows.data ?? []) as Array<Record<string, unknown>>, mes)
  const vn = rowMes((vnRows.data ?? []) as Array<Record<string, unknown>>, mes)
  const pdi = rowMes((pdiRows.data ?? []) as Array<Record<string, unknown>>, mes)
  const ret = ((retRows.data ?? []) as Array<Record<string, unknown>>)[0]

  const efTotal = Number(ef?.total) || 0
  const efOk = Number(ef?.sem_inconsistencia) || 0
  const vrTotal = Number(vr?.total) || 0
  const vrD1 = Number(vr?.vistado_d1) || 0
  const vnTotal = Number(vn?.total) || 0
  const vnD1 = Number(vn?.vistado_d1) || 0
  const dev = ((devRows.data ?? []) as Array<Record<string, unknown>>)[0]

  return {
    ano,
    mes,
    slaProtocolo: sla
      ? {
        qtd_d1: Number(sla.qtd_d1) || 0,
        qtd_fatal: Number(sla.qtd_fatal) || 0,
        qtd_excludente: Number(sla.qtd_excludente) || 0,
      }
      : null,
    eficienciaProtocolo: ef
      ? { qtd_eficiencia: efOk, qtd_inconsistencia: efTotal - efOk }
      : null,
    agendamento: ag
      ? {
        dentro: Number(ag.dentro_prazo) || 0,
        fora: Number(ag.fora_prazo) || 0,
      }
      : null,
    vistagemRisco: vr ? { sim: vrD1, nao: vrTotal - vrD1 } : null,
    vistagemNormal: vn ? { sim: vnD1, nao: vnTotal - vnD1 } : null,
    desenvolvimentoEquipe: dev
      ? {
        minutos_lancados: Number(dev.minutos_lancados) || 0,
        meta_minutos: Number(dev.meta_minutos) || 0,
        pct_atingimento: Number(dev.pct_atingimento) || 0,
        pessoas_ativas: Number(dev.pessoas_ativas) || 0,
      }
      : null,
    gestaoPdi: pdi
      ? {
        aptas: Number(pdi.aptas) || 0,
        desvios: Number(pdi.desvios) || 0,
        elegiveis: Number(pdi.elegiveis) || 0,
        pct_aptas: pdi.pct_aptas != null ? Number(pdi.pct_aptas) : null,
      }
      : null,
    retencao: ret
      ? {
        pct_retencao: Number(ret.pct_retencao) || 0,
        funcionarios_ativos: Number(ret.funcionarios_ativos) || 0,
        saidas_voluntarias: Number(ret.saidas_voluntarias) || 0,
        meta_pct_retencao_minima: Number(ret.meta_pct_retencao_minima) || 90,
      }
      : null,
  }
}

async function fetchFechamentoPorArea(
  supabase: SupabaseClient,
  ano: number,
  mes: number,
  areaKey: string | null,
  ref = new Date(),
  corteIso?: string,
  parcial = false,
): Promise<ReceitaFechamentoMes> {
  type PrevistoRow = {
    ci_item: number
    valor_item: number
    data_vencimento?: string | null
    data_pagamento?: string | null
  }

  type ClassRow = Record<string, unknown>

  const mapClassificacao = (rows: ClassRow[]) =>
    rows.map((i) => ({
      categoria: String(i.categoria ?? ''),
      valor_recebido: Number(i.valor_recebido) || 0,
      data_vencimento: i.data_vencimento != null ? String(i.data_vencimento) : null,
      data_pagamento: i.data_pagamento != null ? String(i.data_pagamento) : null,
    }))

  if (!areaKey) {
    if (!parcial) {
      const { data, error } = await supabase.rpc('receita_previsto_fechamento_mes', {
        p_ano: ano,
        p_mes: mes,
      })
      if (error) rpcError('receita_previsto_fechamento_mes', error)
      return parseFechamento(data)
    }

    const [{ data: prevMesAll, error: e1 }, { data: classAll, error: e2 }] = await Promise.all([
      supabase.rpc('receita_previsto_mes_itens', { p_ano: ano, p_mes: mes }),
      supabase.rpc('receita_recebido_classificacao_mes', { p_ano: ano, p_mes: mes }),
    ])
    if (e1) rpcError('receita_previsto_mes_itens consolidado', e1)
    if (e2) rpcError('receita_recebido_classificacao_mes consolidado', e2)

    return buildFechamentoPorAreaItens(
      (prevMesAll ?? []) as PrevistoRow[],
      mapClassificacao((classAll ?? []) as ClassRow[]),
      ano,
      mes,
      ref,
      corteIso,
    )
  }

  const [{ data: prevMesAll, error: e1 }, { data: prevArea, error: e2 }, { data: classAll, error: e3 }] =
    await Promise.all([
      supabase.rpc('receita_previsto_mes_itens', { p_ano: ano, p_mes: mes }),
      supabase.rpc('receita_previsto_itens_area', {
        p_ano: ano,
        p_mes: mes,
        p_area_key: areaKey,
        p_incluir_inativos: true,
      }),
      supabase.rpc('receita_recebido_classificacao_mes', { p_ano: ano, p_mes: mes }),
    ])
  if (e1) rpcError('receita_previsto_mes_itens area', e1)
  if (e2) rpcError('receita_previsto_itens_area', e2)
  if (e3) rpcError('receita_recebido_classificacao_mes area', e3)

  const previstoItens = filtrarPrevistoMesItensPorCiItens(
    (prevMesAll ?? []) as PrevistoRow[],
    (prevArea ?? []) as Array<{ ci_item: number }>,
  )

  const classFiltrado = ((classAll ?? []) as ClassRow[]).filter(
    (i) => i.departamento && departamentoMatchesAreaKey(String(i.departamento), areaKey),
  )

  return buildFechamentoPorAreaItens(
    previstoItens,
    mapClassificacao(classFiltrado),
    ano,
    mes,
    ref,
    corteIso,
  )
}

async function fetchTopGruposInad(
  supabase: SupabaseClient,
  ano: number,
  mes: number,
  areaKey: string | null,
  ref = new Date(),
  corteIso?: string,
): Promise<Array<{ grupo: string; valor: number; data_vencimento: string }>> {
  return fetchTopGruposInadComVencimento(supabase, ano, mes, areaKey, ref, corteIso)
}

async function fetchResumoMensal(
  supabase: SupabaseClient,
  ano: number,
  mesRef: number,
  metaMensal: number,
  mesesMeta: number[],
): Promise<ReceitaMesResumo[]> {
  const { data, error } = await supabase.rpc('receita_totais_mensais', { p_ano: ano })
  if (error) rpcError('receita_totais_mensais', error)
  const { data: inadDash, error: e2 } = await supabase.rpc('receita_inadimplencia_dashboard', {
    p_ano: ano,
    p_mes_inicio: 1,
    p_mes_fim: 12,
  })
  if (e2) rpcError('receita_inadimplencia_dashboard', e2)
  const evolucao = ((inadDash as Record<string, unknown>)?.evolucao ?? []) as Array<
    Record<string, unknown>
  >

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((r) => Number(r.mes) <= mesRef)
    .map((r) => {
      const mes = Number(r.mes)
      const previsto = Number(r.previsto) || 0
      const recebido = Number(r.recebido) || 0
      const ev = evolucao.find((e) => Number(e.mes) === mes)
      const inad = Number(ev?.valor) || 0
      return {
        mes,
        recebido,
        previsto,
        meta: mesesMeta.includes(mes) ? metaMensal : 0,
        inadimplencia: inad,
      }
    })
}

async function fetchOverviewHeatRows(
  supabase: SupabaseClient,
  ano: number,
  mesRef: number,
  areaKey: string | null,
  resumoMensal: ReceitaMesResumo[],
): Promise<OverviewHeatRow[]> {
  const area = areaEficienciaParam(areaKey)
  const pctFmt = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

  const [
    slaRows,
    efRows,
    agRows,
    vrRows,
    vnRows,
    pdiRows,
    retRows,
    treRows,
  ] = await Promise.all([
    supabase.rpc('eficiencia_sla_protocolo_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_protocolo_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_agendamento_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_sla_vistagem_mensal', { p_ano: ano, p_risco: true, p_area: area }),
    areaKey === 'trabalhista'
      ? Promise.resolve({ data: [], error: null })
      : supabase.rpc('eficiencia_sla_vistagem_mensal', { p_ano: ano, p_risco: false, p_area: area }),
    supabase.rpc('eficiencia_gestao_pdi_mensal', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_turnover_anual', { p_ano: ano, p_area: area }),
    supabase.rpc('eficiencia_treinamentos_mensal', { p_ano: ano, p_area: area }),
  ])

  if (slaRows.error) rpcError('eficiencia_sla_protocolo_mensal overview', slaRows.error)
  if (efRows.error) rpcError('eficiencia_protocolo_mensal overview', efRows.error)
  if (agRows.error) rpcError('eficiencia_agendamento_mensal overview', agRows.error)
  if (vrRows.error) rpcError('eficiencia_sla_vistagem_mensal risco overview', vrRows.error)
  if (vnRows.error) rpcError('eficiencia_sla_vistagem_mensal normal overview', vnRows.error)
  if (pdiRows.error) rpcError('eficiencia_gestao_pdi_mensal overview', pdiRows.error)
  if (retRows.error) rpcError('eficiencia_turnover_anual overview', retRows.error)
  if (treRows.error) rpcError('eficiencia_treinamentos_mensal overview', treRows.error)

  const byMes = <T extends { mes: number }>(rows: T[]) => {
    const map = new Map<number, T>()
    for (const r of rows) map.set(r.mes, r)
    return map
  }

  const buildPctCells = (
    map: Map<number, Record<string, unknown>>,
    getter: (r: Record<string, unknown>) => number | null,
  ): { cells: HeatCell[]; acumulado: HeatCell } => {
    const cells: HeatCell[] = []
    for (let m = 1; m <= 12; m++) {
      const r = map.get(m)
      const v = r ? getter(r) : null
      cells.push({ value: v, label: v != null ? pctFmt(v) : '-' })
    }
    const slice = cells.slice(0, mesRef).filter((c) => c.value != null)
    if (slice.length === 0) return { cells, acumulado: { value: null, label: '-' } }
    const avg = slice.reduce((s, c) => s + (c.value ?? 0), 0) / slice.length
    return { cells, acumulado: { value: avg, label: pctFmt(avg) } }
  }

  const slaMap = byMes((slaRows.data ?? []) as Array<Record<string, unknown> & { mes: number }>)
  const slaCells = buildPctCells(slaMap, (r) => {
    const pct = Number(r.pct_eficiencia)
    if (Number.isFinite(pct)) return pct
    const d1 = Number(r.qtd_d1) || 0
    const fatal = Number(r.qtd_fatal) || 0
    const den = d1 + fatal
    return den > 0 ? Math.round((d1 / den) * 10000) / 100 : null
  })

  const efMap = byMes((efRows.data ?? []) as Array<Record<string, unknown> & { mes: number }>)
  const efCells = buildPctCells(efMap, (r) => {
    const v = Number(r.pct_eficiencia)
    return Number.isFinite(v) ? v : null
  })

  const rows: OverviewHeatRow[] = [
    { title: 'SLA Protocolo', meta: 90, ...slaCells },
    { title: 'Eficiência Protocolo', meta: 95, ...efCells },
  ]

  if (areaKey !== 'operacoes_legais') {
    const agMap = byMes((agRows.data ?? []) as Array<Record<string, unknown> & { mes: number }>)
    rows.push({
      title: 'SLA Ciência Agendamentos',
      meta: 95,
      ...buildPctCells(agMap, (r) => {
        const v = Number(r.pct_dentro_prazo)
        return Number.isFinite(v) ? v : null
      }),
    })

    const vrMap = byMes((vrRows.data ?? []) as Array<Record<string, unknown> & { mes: number }>)
    rows.push({
      title: 'SLA Vistagem Risco',
      meta: 98,
      ...buildPctCells(vrMap, (r) => {
        const v = Number(r.pct_d1)
        return Number.isFinite(v) ? v : null
      }),
    })
  }

  if (areaKey !== 'trabalhista' && areaKey !== 'operacoes_legais') {
    const vnMap = byMes((vnRows.data ?? []) as Array<Record<string, unknown> & { mes: number }>)
    rows.push({
      title: 'SLA Vistagem Normal',
      meta: 98,
      ...buildPctCells(vnMap, (r) => {
        const v = Number(r.pct_d1)
        return Number.isFinite(v) ? v : null
      }),
    })
  }

  const treMap = byMes((treRows.data ?? []) as Array<Record<string, unknown> & { mes: number }>)
  rows.push({
    title: 'Desenvolvimento Equipe',
    meta: 100,
    metaLabel: 'Meta 14h/pessoa/ano',
    ...buildPctCells(treMap, (r) => {
      const v = Number(r.pct_atingimento)
      return Number.isFinite(v) ? v : null
    }),
  })

  const ret = ((retRows.data ?? []) as Array<Record<string, unknown>>)[0]
  if (ret) {
    const pct = Number(ret.pct_retencao) || 0
    const metaRet = Number(ret.meta_pct_retencao_minima) || 90
    rows.push({
      title: 'Retenção de Talentos',
      meta: metaRet,
      modoAnual: true,
      anoLabel: String(ano),
      cells: [],
      acumulado: { value: pct, label: pctFmt(pct) },
    })
  }

  const pdiMap = byMes((pdiRows.data ?? []) as Array<Record<string, unknown> & { mes: number }>)
  rows.push({
    title: 'Gestão de PDI',
    meta: 100,
    ...buildPctCells(pdiMap, (r) => {
      const v = r.pct_aptas != null ? Number(r.pct_aptas) : null
      return v != null && Number.isFinite(v) ? v : null
    }),
  })

  if (!areaKey) {
    const fullResumo: ReceitaMesResumo[] = []
    for (let m = 1; m <= 12; m++) {
      fullResumo.push(resumoMensal.find((r) => r.mes === m) ?? {
        mes: m,
        recebido: 0,
        previsto: 0,
        meta: 0,
        inadimplencia: 0,
      })
    }
    const metaCells: HeatCell[] = []
    const inadCells: HeatCell[] = []
    for (let m = 1; m <= 12; m++) {
      const row = fullResumo[m - 1]!
      if (m > mesRef) {
        metaCells.push({ value: null, label: '-' })
        inadCells.push({ value: null, label: '-' })
        continue
      }
      const pctMeta = row.meta > 0 ? Math.round((row.recebido / row.meta) * 10000) / 100 : null
      metaCells.push({ value: pctMeta, label: pctMeta != null ? pctFmt(pctMeta) : '-' })
      const pctInad = row.previsto > 0
        ? Math.round((row.inadimplencia / row.previsto) * 10000) / 100
        : null
      inadCells.push({ value: pctInad, label: pctInad != null ? pctFmt(pctInad) : '-' })
    }
    const acumMeta = metaCells.slice(0, mesRef).filter((c) => c.value != null)
    const acumInad = inadCells.slice(0, mesRef).filter((c) => c.value != null)
    rows.push({
      title: 'Receita Bruta',
      meta: 100,
      cells: metaCells,
      acumulado: acumMeta.length
        ? {
          value: acumMeta.reduce((s, c) => s + (c.value ?? 0), 0) / acumMeta.length,
          label: pctFmt(acumMeta.reduce((s, c) => s + (c.value ?? 0), 0) / acumMeta.length),
        }
        : { value: null, label: '-' },
    })
    rows.push({
      title: 'Índice de Inadimplência',
      meta: 10,
      metaLabel: 'Meta 10,00%',
      lowerIsBetter: true,
      cells: inadCells,
      acumulado: acumInad.length
        ? {
          value: acumInad.reduce((s, c) => s + (c.value ?? 0), 0) / acumInad.length,
          label: pctFmt(acumInad.reduce((s, c) => s + (c.value ?? 0), 0) / acumInad.length),
        }
        : { value: null, label: '-' },
    })
  }

  return rows
}

export async function fetchRelatorioDados(
  supabase: SupabaseClient,
  ano: number,
  mes: number,
  areaKey: string | null,
  periodo: Pick<
    RelatorioDadosBase,
    'diaReferencia' | 'periodoLabel' | 'periodoCurto' | 'parcial' | 'corteIso'
  >,
): Promise<RelatorioDadosBase> {
  const metas = await fetchMetas(supabase)
  const mesesMeta = metas.meses_meta ?? [6, 7, 8, 9, 10, 11, 12]
  let metaMes = mesesMeta.includes(mes) ? metas.meta : 0
  if (areaKey) {
    const slice = META_AREAS.find((a) => a.key === areaKey)
    if (slice) metaMes = Math.round(metas.meta * (slice.pct / 100) * 100) / 100
  }

  const refCorte = new Date(`${periodo.corteIso}T12:00:00`)

  const [indicadores, fechamento, topGruposInad, resumoMensal] = await Promise.all([
    fetchIndicadores(supabase, ano, mes, areaKey, periodo.corteIso),
    fetchFechamentoPorArea(supabase, ano, mes, areaKey, refCorte, periodo.corteIso, periodo.parcial),
    fetchTopGruposInad(supabase, ano, mes, areaKey, refCorte, periodo.corteIso),
    fetchResumoMensal(supabase, ano, mes, metas.meta, mesesMeta),
  ])

  if (!areaKey) {
    const mesResumo = resumoMensal.find((r) => r.mes === mes)
    if (mesResumo) {
      indicadores.receitaBruta = {
        pct_meta:
          mesResumo.meta > 0
            ? Math.round((mesResumo.recebido / mesResumo.meta) * 10000) / 100
            : null,
        recebido: mesResumo.recebido,
        meta: mesResumo.meta,
      }
      indicadores.indiceInadimplencia = {
        pct:
          mesResumo.previsto > 0
            ? Math.round((mesResumo.inadimplencia / mesResumo.previsto) * 10000) / 100
            : null,
        inadimplencia: mesResumo.inadimplencia,
        previsto: mesResumo.previsto,
      }
    }
  }

  const inadMes = fechamento.inadimplencia_kpi
  const inadPct = pctInad(inadMes, fechamento.previsto)
  const overviewHeatRows = await fetchOverviewHeatRows(supabase, ano, mes, areaKey, resumoMensal)

  return {
    ano,
    mes,
    diaReferencia: periodo.diaReferencia,
    corteIso: periodo.corteIso,
    periodoLabel: periodo.periodoLabel,
    periodoCurto: periodo.periodoCurto,
    parcial: periodo.parcial,
    indicadores,
    fechamento,
    metaMes,
    inadMes,
    inadPct,
    topGruposInad,
    resumoMensal,
    overviewHeatRows,
  }
}

export type RelatorioMensalConfig = {
  enabled: boolean
  hora_local: string
  timezone: string
  mes_referencia: 'anterior' | 'corrente'
  secoes: RelatorioSecoes
}

export type RelatorioDestinatario = {
  id: string
  nome: string
  email: string
  area_key: string | null
  ativo: boolean
}

/** @deprecated Gestão à vista usa sempre o mês corrente — ver resolverPeriodoGestaoVista. */
export function resolverMesReferencia(
  _mesReferencia: 'anterior' | 'corrente',
  ref = new Date(),
): { ano: number; mes: number } {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  return { ano: y, mes: m }
}

export function horaLocalAtual(timezone: string, ref = new Date()): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(ref)
  } catch {
    return `${String(ref.getHours()).padStart(2, '0')}:${String(ref.getMinutes()).padStart(2, '0')}`
  }
}

export function horaConfigMatches(horaLocal: string, timezone: string, ref = new Date()): boolean {
  const atual = horaLocalAtual(timezone, ref)
  const cfg = horaLocal.slice(0, 5)
  return atual === cfg
}
