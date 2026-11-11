/**
 * Base mensal por área de um ano (2025 ou 2026), montada a partir das RPCs do planejamento.
 *
 * - Margem de contribuição = receita − imposto − pessoas − demais OPEX da área − Controladoria.
 * - 2026: meses depois do último mês fechado são projetados — receita pela Melhor Estimativa,
 *   imposto pela taxa efetiva da área no ano, custos repetindo o último mês fechado.
 * - 2025: o VIOS não tem número de NF em 2025 (99% "N/A"), então o imposto pela regra do DL
 *   sai quase zero. O imposto de 2025 é estimado com a taxa efetiva de 2026 da área
 *   (imposto ÷ receita, meses fechados); o valor pela NF fica guardado em `impostosNf`.
 *
 * Funções puras (imports com .ts) para rodar com `node --test`.
 */
import { AREA_KEYS, SEM_AREA_KEY, soma, zeros12, type AreaKey } from './areasPlanejamento.ts'
import type { PlanMargemRow, PlanOpexBlocosRow } from '../types.ts'

export type BaseArea = {
  receita: number[]
  impostos: number[]
  /** Imposto pela regra do DL (alíquota × receita com NF). */
  impostosNf: number[]
  pessoas: number[]
  demais: number[]
  controladoria: number[]
  /** Folha de 2025 que veio de "Facilities" para a área pelo nome da pessoa. */
  reclassificado: number[]
}

export type BaseAno = {
  ano: number
  areas: Record<AreaKey, BaseArea>
  /** Receita sem área (departamento VIOS fora das áreas e cliente não classificado). */
  semArea: number[]
  /** OPEX de Operações Legais (antes do rateio). */
  controladoriaTotal: number[]
  /** Facilities, Financeiro, Marketing, RH, TI e Comercial. */
  estrutura: number[]
  /** Sócios, conta corrente de clientes e departamentos sem bloco. */
  outros: number[]
  pessoasSemMatch: number[]
  /** Meses projetados (não realizados). */
  projetado: boolean[]
  /** Imposto estimado pela taxa efetiva (2025) em vez da NF. */
  impostoEstimado: boolean
  /** Origem do % da Controladoria por mês (ex.: "legal_ops", "herdado 01/2026"). */
  origemControladoria: string[]
}

function baseAreaVazia(): BaseArea {
  return {
    receita: zeros12(),
    impostos: zeros12(),
    impostosNf: zeros12(),
    pessoas: zeros12(),
    demais: zeros12(),
    controladoria: zeros12(),
    reclassificado: zeros12(),
  }
}

export function montarBaseRealizada(ano: number, margem: readonly PlanMargemRow[], opex: readonly PlanOpexBlocosRow[]): BaseAno {
  const areas = Object.fromEntries(AREA_KEYS.map((k) => [k, baseAreaVazia()])) as Record<AreaKey, BaseArea>
  const semArea = zeros12()
  const origemControladoria = Array.from({ length: 12 }, () => '')
  for (const r of margem) {
    const i = r.mes - 1
    if (i < 0 || i > 11) continue
    if (r.area_key === SEM_AREA_KEY) {
      semArea[i] += Number(r.receita_bruta) || 0
      continue
    }
    const a = areas[r.area_key as AreaKey]
    if (!a) continue
    a.receita[i] += Number(r.receita_bruta) || 0
    a.impostos[i] += Number(r.impostos) || 0
    a.impostosNf[i] += Number(r.impostos) || 0
    a.pessoas[i] += Number(r.desp_pessoas) || 0
    a.demais[i] += Number(r.desp_demais) || 0
    a.controladoria[i] += Number(r.desp_controladoria) || 0
    a.reclassificado[i] += Number(r.pessoas_reclassificadas) || 0
    if (!origemControladoria[i] && r.origem_controladoria) origemControladoria[i] = r.origem_controladoria
  }
  const controladoriaTotal = zeros12()
  const estrutura = zeros12()
  const outros = zeros12()
  const pessoasSemMatch = zeros12()
  for (const r of opex) {
    const i = r.mes - 1
    if (i < 0 || i > 11) continue
    controladoriaTotal[i] = Number(r.controladoria) || 0
    estrutura[i] = Number(r.estrutura) || 0
    outros[i] = Number(r.outros) || 0
    pessoasSemMatch[i] = Number(r.pessoas_sem_match) || 0
  }
  return {
    ano,
    areas,
    semArea,
    controladoriaTotal,
    estrutura,
    outros,
    pessoasSemMatch,
    projetado: Array.from({ length: 12 }, () => false),
    impostoEstimado: false,
    origemControladoria,
  }
}

/** Taxa efetiva de imposto da área (imposto ÷ receita) nos meses realizados. */
export function taxaEfetivaImposto(base: BaseAno, area: AreaKey, meses: readonly number[]): number {
  const a = base.areas[area]
  const receita = soma(meses.map((m) => a.receita[m - 1] ?? 0))
  const imposto = soma(meses.map((m) => a.impostosNf[m - 1] ?? 0))
  return receita > 0 ? imposto / receita : 0
}

/** Taxa efetiva do escritório (todas as áreas) nos meses realizados. */
export function taxaEfetivaEscritorio(base: BaseAno, meses: readonly number[]): number {
  let receita = 0
  let imposto = 0
  for (const k of AREA_KEYS) {
    for (const m of meses) {
      receita += base.areas[k].receita[m - 1] ?? 0
      imposto += base.areas[k].impostosNf[m - 1] ?? 0
    }
  }
  return receita > 0 ? imposto / receita : 0
}

/** 2025: imposto = receita × taxa efetiva de 2026 da área (meses fechados de 2026). */
export function estimarImpostoPelaTaxa(base: BaseAno, base2026: BaseAno, mesesFechados2026: readonly number[]): BaseAno {
  const geral = taxaEfetivaEscritorio(base2026, mesesFechados2026)
  const areas = { ...base.areas }
  for (const k of AREA_KEYS) {
    const taxaArea = taxaEfetivaImposto(base2026, k, mesesFechados2026)
    const receita2026 = soma(mesesFechados2026.map((m) => base2026.areas[k].receita[m - 1] ?? 0))
    const taxa = receita2026 > 0 ? taxaArea : geral
    const a = base.areas[k]
    areas[k] = { ...a, impostos: a.receita.map((v) => v * taxa) }
  }
  return { ...base, areas, impostoEstimado: true }
}

/**
 * Melhor Estimativa por área do planejamento a partir da ME por chave da Receita.
 * `outras` (demais departamentos) é dividida entre ADD e Tributário pela receita de cada uma
 * nos meses fechados do ano.
 */
export function mePorAreaPlanejamento(
  mePorReceitaKey: Record<string, Record<number, number>>,
  base: BaseAno,
  mesesFechados: readonly number[],
): Record<AreaKey, Record<number, number>> {
  const out = Object.fromEntries(AREA_KEYS.map((k) => [k, {} as Record<number, number>])) as Record<
    AreaKey,
    Record<number, number>
  >
  const direto: Record<string, AreaKey> = {
    insolvencia: 'insolvencia',
    trabalhista: 'trabalhista',
    civel: 'civel',
    contratos: 'contratos',
    recuperacao_de_credito: 'rec_credito',
  }
  for (const [rk, porMes] of Object.entries(mePorReceitaKey)) {
    const k = direto[rk]
    if (k) {
      for (const [m, v] of Object.entries(porMes)) out[k][Number(m)] = (out[k][Number(m)] ?? 0) + (Number(v) || 0)
    }
  }
  const outras = mePorReceitaKey.outras ?? {}
  const recAdd = soma(mesesFechados.map((m) => base.areas.add.receita[m - 1] ?? 0))
  const recTrib = soma(mesesFechados.map((m) => base.areas.tributario.receita[m - 1] ?? 0))
  const total = recAdd + recTrib
  const pctAdd = total > 0 ? recAdd / total : 0.5
  for (const [m, v] of Object.entries(outras)) {
    const valor = Number(v) || 0
    out.add[Number(m)] = (out.add[Number(m)] ?? 0) + valor * pctAdd
    out.tributario[Number(m)] = (out.tributario[Number(m)] ?? 0) + valor * (1 - pctAdd)
  }
  return out
}

/**
 * Projeta os meses depois de `ultimoMesFechado`: receita = ME do mês; imposto = taxa efetiva
 * da área no ano; pessoas, demais, Controladoria, estrutura e outros repetem o último mês fechado.
 */
export function projetarAno(
  base: BaseAno,
  ultimoMesFechado: number,
  mePorArea: Record<AreaKey, Record<number, number>>,
): BaseAno {
  if (ultimoMesFechado >= 12) return base
  const fechados = Array.from({ length: Math.max(0, ultimoMesFechado) }, (_, i) => i + 1)
  const ref = Math.max(1, ultimoMesFechado) - 1
  const repete = (arr: number[]) => arr.map((v, i) => (i + 1 > ultimoMesFechado ? arr[ref] ?? 0 : v))
  const areas = {} as Record<AreaKey, BaseArea>
  for (const k of AREA_KEYS) {
    const a = base.areas[k]
    const taxa = taxaEfetivaImposto(base, k, fechados)
    const receita = a.receita.map((v, i) => (i + 1 > ultimoMesFechado ? mePorArea[k]?.[i + 1] ?? 0 : v))
    areas[k] = {
      receita,
      impostos: a.impostos.map((v, i) => (i + 1 > ultimoMesFechado ? receita[i] * taxa : v)),
      impostosNf: a.impostosNf.map((v, i) => (i + 1 > ultimoMesFechado ? receita[i] * taxa : v)),
      pessoas: repete(a.pessoas),
      demais: repete(a.demais),
      controladoria: repete(a.controladoria),
      reclassificado: a.reclassificado,
    }
  }
  return {
    ...base,
    areas,
    semArea: base.semArea.map((v, i) => (i + 1 > ultimoMesFechado ? 0 : v)),
    controladoriaTotal: repete(base.controladoriaTotal),
    estrutura: repete(base.estrutura),
    outros: repete(base.outros),
    projetado: base.projetado.map((p, i) => p || i + 1 > ultimoMesFechado),
  }
}

export function margemArea(a: BaseArea): number[] {
  return a.receita.map((r, i) => r - a.impostos[i] - a.pessoas[i] - a.demais[i] - a.controladoria[i])
}

export type TotaisArea = {
  receita: number
  impostos: number
  liquida: number
  pessoas: number
  demais: number
  opex: number
  controladoria: number
  margem: number
  margemPct: number | null
}

export function totaisArea(a: BaseArea, meses: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]): TotaisArea {
  const s = (arr: number[]) => soma(meses.map((m) => arr[m - 1] ?? 0))
  const receita = s(a.receita)
  const impostos = s(a.impostos)
  const pessoas = s(a.pessoas)
  const demais = s(a.demais)
  const controladoria = s(a.controladoria)
  const margem = receita - impostos - pessoas - demais - controladoria
  return {
    receita,
    impostos,
    liquida: receita - impostos,
    pessoas,
    demais,
    opex: pessoas + demais,
    controladoria,
    margem,
    // Igual ao DL: margem ÷ receita líquida.
    margemPct: receita - impostos > 0 ? (margem / (receita - impostos)) * 100 : null,
  }
}

/** Soma de várias áreas (ex.: escritório). */
export function somarAreas(base: BaseAno, keys: readonly AreaKey[] = AREA_KEYS): BaseArea {
  const out = baseAreaVazia()
  for (const k of keys) {
    const a = base.areas[k]
    for (let i = 0; i < 12; i++) {
      out.receita[i] += a.receita[i]
      out.impostos[i] += a.impostos[i]
      out.impostosNf[i] += a.impostosNf[i]
      out.pessoas[i] += a.pessoas[i]
      out.demais[i] += a.demais[i]
      out.controladoria[i] += a.controladoria[i]
      out.reclassificado[i] += a.reclassificado[i]
    }
  }
  return out
}

/** Controladoria que não foi rateada para nenhuma área (rateio < 100%). */
export function controladoriaNaoRateada(base: BaseAno): number[] {
  const rateada = somarAreas(base).controladoria
  return base.controladoriaTotal.map((v, i) => Math.max(0, v - rateada[i]))
}
