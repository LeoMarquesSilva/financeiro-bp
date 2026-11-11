/**
 * Simulador de metas 2027 (funções puras; a tela e o Excel usam as mesmas regras).
 *
 * Base = 2026 por área e mês (realizado até o último mês fechado + Melhor Estimativa/projeção).
 *
 * Por área, mês m:
 *   receita_m   = (receita2026_ano × (1 + crescimento%) + receita_nova) × peso_m
 *                 peso_m = receita2026_m ÷ receita2026_ano (sazonalidade 2026) ou 1/12 (linear)
 *   imposto_m   = receita_m × alíquota 2027
 *   pessoas_m   = pessoas2026_m × (1 + variação pessoas%) × (1 + reajuste%, a partir do mês do reajuste)
 *                 + contratações × custo mensal (a partir do mês de início)
 *   demais_m    = demais2026_m × (1 + variação demais%)
 *   ctrl_m      = controladoria2026_m × (1 + variação Controladoria%)
 *   margem_m    = receita − imposto − pessoas − demais − ctrl   (margem % = margem ÷ receita líquida, como no DL)
 * Área encerrada (ex.: Distressed Deals): sem projeção em 2027 (tudo zero); a receita 2026 dela continua na
 * base do escritório, então o crescimento 27/26 do escritório já reflete a saída.
 * Escritório:
 *   resultado_m = Σ margem − estrutura2026_m × (1 + variação estrutura%) − Controladoria não rateada
 *   faturamento necessário_m = Σ receita ÷ (1 − inadimplência meta%)
 */
import { AREA_KEYS, AREA_KEYS_2027, areaEncerrada, soma, zeros12, type AreaKey } from './areasPlanejamento.ts'
import { controladoriaNaoRateada, type BaseAno } from './planejamentoBase.ts'

export type Distribuicao = 'sazonal' | 'linear'

export type PremissaArea = {
  crescimentoPct: number
  receitaNova: number
  variacaoPessoasPct: number
  variacaoDemaisPct: number
  contratacoes: number
  custoContratacao: number
  mesInicioContratacao: number
}

export type PremissasEscritorio = {
  aliquotaPct: number
  reajustePct: number
  mesReajuste: number
  variacaoControladoriaPct: number
  variacaoEstruturaPct: number
  inadimplenciaMetaPct: number
  distribuicao: Distribuicao
}

export type MetaOperacionalPremissa = {
  /** Meta 2027 do escritório (null = sem meta definida). */
  escritorio: number | null
  /** Meta própria por área (ausente/null = herda a do escritório). */
  areas: Record<string, number | null>
}

export type Premissas = {
  versao: 1
  escritorio: PremissasEscritorio
  areas: Record<AreaKey, PremissaArea>
  operacionais: Record<string, MetaOperacionalPremissa>
}

export const PREMISSA_AREA_PADRAO: PremissaArea = {
  crescimentoPct: 0,
  receitaNova: 0,
  variacaoPessoasPct: 0,
  variacaoDemaisPct: 0,
  contratacoes: 0,
  custoContratacao: 0,
  mesInicioContratacao: 1,
}

export function premissasPadrao(opts: { aliquotaPct: number; inadimplenciaMetaPct: number }): Premissas {
  return {
    versao: 1,
    escritorio: {
      aliquotaPct: arred(opts.aliquotaPct, 2),
      reajustePct: 0,
      mesReajuste: 1,
      variacaoControladoriaPct: 0,
      variacaoEstruturaPct: 0,
      inadimplenciaMetaPct: opts.inadimplenciaMetaPct,
      distribuicao: 'sazonal',
    },
    areas: Object.fromEntries(AREA_KEYS.map((k) => [k, { ...PREMISSA_AREA_PADRAO }])) as Record<AreaKey, PremissaArea>,
    operacionais: {},
  }
}

function num(v: unknown, padrao: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : padrao
}

function mes(v: unknown): number {
  const n = Math.round(num(v, 1))
  return Math.min(12, Math.max(1, n))
}

/** Lê premissas salvas (jsonb) completando o que faltar com o padrão. */
export function normalizarPremissas(raw: unknown, padrao: Premissas): Premissas {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const e = (r.escritorio && typeof r.escritorio === 'object' ? r.escritorio : {}) as Record<string, unknown>
  const areasRaw = (r.areas && typeof r.areas === 'object' ? r.areas : {}) as Record<string, Record<string, unknown>>
  const opsRaw = (r.operacionais && typeof r.operacionais === 'object' ? r.operacionais : {}) as Record<
    string,
    Record<string, unknown>
  >
  const areas = {} as Record<AreaKey, PremissaArea>
  for (const k of AREA_KEYS) {
    const a = areasRaw[k] ?? {}
    const p = padrao.areas[k]
    areas[k] = {
      crescimentoPct: num(a.crescimentoPct, p.crescimentoPct),
      receitaNova: num(a.receitaNova, p.receitaNova),
      variacaoPessoasPct: num(a.variacaoPessoasPct, p.variacaoPessoasPct),
      variacaoDemaisPct: num(a.variacaoDemaisPct, p.variacaoDemaisPct),
      contratacoes: Math.max(0, num(a.contratacoes, p.contratacoes)),
      custoContratacao: Math.max(0, num(a.custoContratacao, p.custoContratacao)),
      mesInicioContratacao: mes(a.mesInicioContratacao ?? p.mesInicioContratacao),
    }
  }
  const operacionais: Record<string, MetaOperacionalPremissa> = {}
  for (const [id, o] of Object.entries(opsRaw)) {
    const areasMeta: Record<string, number | null> = {}
    const ar = (o.areas && typeof o.areas === 'object' ? o.areas : {}) as Record<string, unknown>
    for (const [ak, v] of Object.entries(ar)) {
      areasMeta[ak] = v == null || v === '' ? null : num(v, 0)
    }
    operacionais[id] = {
      escritorio: o.escritorio == null || o.escritorio === '' ? null : num(o.escritorio, 0),
      areas: areasMeta,
    }
  }
  return {
    versao: 1,
    escritorio: {
      aliquotaPct: num(e.aliquotaPct, padrao.escritorio.aliquotaPct),
      reajustePct: num(e.reajustePct, padrao.escritorio.reajustePct),
      mesReajuste: mes(e.mesReajuste ?? padrao.escritorio.mesReajuste),
      variacaoControladoriaPct: num(e.variacaoControladoriaPct, padrao.escritorio.variacaoControladoriaPct),
      variacaoEstruturaPct: num(e.variacaoEstruturaPct, padrao.escritorio.variacaoEstruturaPct),
      inadimplenciaMetaPct: Math.min(99, Math.max(0, num(e.inadimplenciaMetaPct, padrao.escritorio.inadimplenciaMetaPct))),
      distribuicao: e.distribuicao === 'linear' ? 'linear' : 'sazonal',
    },
    areas,
    operacionais,
  }
}

export type ResultadoArea = {
  receita: number[]
  impostos: number[]
  pessoas: number[]
  contratacoes: number[]
  demais: number[]
  controladoria: number[]
  margem: number[]
  pesos: number[]
  /** Receita 2026 do ano (base) e meta 2027 do ano. */
  receitaBaseAno: number
  receitaAno: number
  margemAno: number
  margemPct: number | null
  crescimentoReceitaPct: number | null
}

export type ResultadoEscritorio = {
  receita: number[]
  impostos: number[]
  pessoas: number[]
  demais: number[]
  controladoria: number[]
  margem: number[]
  estrutura: number[]
  controladoriaNaoRateada: number[]
  resultado: number[]
  faturamentoNecessario: number[]
  receitaAno: number
  receitaBaseAno: number
  margemAno: number
  resultadoAno: number
  faturamentoNecessarioAno: number
}

export type ResultadoSimulacao = {
  areas: Record<AreaKey, ResultadoArea>
  escritorio: ResultadoEscritorio
}

/** Peso de cada mês: sazonalidade da receita 2026 da área (ou 1/12). */
export function pesosMensais(receita2026: readonly number[], distribuicao: Distribuicao): number[] {
  const total = soma(receita2026)
  if (distribuicao === 'linear' || total <= 0) return Array.from({ length: 12 }, () => 1 / 12)
  return receita2026.map((v) => v / total)
}

export function simular(base2026: BaseAno, premissas: Premissas): ResultadoSimulacao {
  const e = premissas.escritorio
  const areas = {} as Record<AreaKey, ResultadoArea>
  for (const k of AREA_KEYS) {
    const b = base2026.areas[k]
    const p = premissas.areas[k] ?? PREMISSA_AREA_PADRAO
    const receitaBaseAno = soma(b.receita)
    if (areaEncerrada(k)) {
      areas[k] = {
        receita: zeros12(),
        impostos: zeros12(),
        pessoas: zeros12(),
        contratacoes: zeros12(),
        demais: zeros12(),
        controladoria: zeros12(),
        margem: zeros12(),
        pesos: zeros12(),
        receitaBaseAno,
        receitaAno: 0,
        margemAno: 0,
        margemPct: null,
        crescimentoReceitaPct: null,
      }
      continue
    }
    const pesos = pesosMensais(b.receita, e.distribuicao)
    const receitaAno = receitaBaseAno * (1 + p.crescimentoPct / 100) + p.receitaNova
    const receita = pesos.map((w) => receitaAno * w)
    const impostos = receita.map((r) => (r * e.aliquotaPct) / 100)
    const contratacoes = Array.from({ length: 12 }, (_, i) =>
      i + 1 >= p.mesInicioContratacao ? p.contratacoes * p.custoContratacao : 0,
    )
    const pessoas = b.pessoas.map(
      (v, i) =>
        v * (1 + p.variacaoPessoasPct / 100) * (i + 1 >= e.mesReajuste ? 1 + e.reajustePct / 100 : 1) + contratacoes[i],
    )
    const demais = b.demais.map((v) => v * (1 + p.variacaoDemaisPct / 100))
    const controladoria = b.controladoria.map((v) => v * (1 + e.variacaoControladoriaPct / 100))
    const margem = receita.map((r, i) => r - impostos[i] - pessoas[i] - demais[i] - controladoria[i])
    const margemAno = soma(margem)
    const liquidaAno = receitaAno - soma(impostos)
    areas[k] = {
      receita,
      impostos,
      pessoas,
      contratacoes,
      demais,
      controladoria,
      margem,
      pesos,
      receitaBaseAno,
      receitaAno,
      margemAno,
      // Igual ao DL: margem ÷ receita líquida.
      margemPct: liquidaAno > 0 ? (margemAno / liquidaAno) * 100 : null,
      crescimentoReceitaPct: receitaBaseAno > 0 ? ((receitaAno - receitaBaseAno) / receitaBaseAno) * 100 : null,
    }
  }
  const somaMes = (campo: keyof Pick<ResultadoArea, 'receita' | 'impostos' | 'pessoas' | 'demais' | 'controladoria' | 'margem'>) =>
    Array.from({ length: 12 }, (_, i) => soma(AREA_KEYS.map((k) => areas[k][campo][i])))
  const receita = somaMes('receita')
  const margem = somaMes('margem')
  const estrutura = base2026.estrutura.map((v) => v * (1 + e.variacaoEstruturaPct / 100))
  const naoRateada = controladoriaNaoRateada(base2026).map((v) => v * (1 + e.variacaoControladoriaPct / 100))
  const resultado = margem.map((m, i) => m - estrutura[i] - naoRateada[i])
  const fator = 1 - e.inadimplenciaMetaPct / 100
  const faturamentoNecessario = receita.map((r) => (fator > 0 ? r / fator : r))
  return {
    areas,
    escritorio: {
      receita,
      impostos: somaMes('impostos'),
      pessoas: somaMes('pessoas'),
      demais: somaMes('demais'),
      controladoria: somaMes('controladoria'),
      margem,
      estrutura,
      controladoriaNaoRateada: naoRateada,
      resultado,
      faturamentoNecessario,
      receitaAno: soma(receita),
      receitaBaseAno: soma(AREA_KEYS.map((k) => areas[k].receitaBaseAno)),
      margemAno: soma(margem),
      resultadoAno: soma(resultado),
      faturamentoNecessarioAno: soma(faturamentoNecessario),
    },
  }
}

/** Linhas para `planejamento_metas_oficiais` (uma por área e mês). */
export function linhasMetasOficiais(r: ResultadoSimulacao, inadimplenciaMetaPct: number) {
  const linhas: {
    mes: number
    area_key: string
    receita_bruta: number
    impostos: number
    opex_area: number
    controladoria: number
    margem: number
    inadimplencia_pct: number
  }[] = []
  for (const k of AREA_KEYS_2027) {
    const a = r.areas[k]
    for (let i = 0; i < 12; i++) {
      linhas.push({
        mes: i + 1,
        area_key: k,
        receita_bruta: arred(a.receita[i], 2),
        impostos: arred(a.impostos[i], 2),
        opex_area: arred(a.pessoas[i] + a.demais[i], 2),
        controladoria: arred(a.controladoria[i], 2),
        margem: arred(a.margem[i], 2),
        inadimplencia_pct: inadimplenciaMetaPct,
      })
    }
  }
  return linhas
}

function arred(v: number, casas: number): number {
  const f = 10 ** casas
  return Math.round((v + Number.EPSILON) * f) / f
}
