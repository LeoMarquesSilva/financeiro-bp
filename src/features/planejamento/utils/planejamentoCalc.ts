/**
 * Simulador de metas 2027 (funções puras; a tela e o Excel usam as mesmas regras).
 *
 * Base = 2026 por área e mês (realizado até o último mês fechado + Melhor Estimativa/projeção).
 *
 * Desdobramento da meta (desdobrarCrescimento):
 *   meta do escritório = receita 2026 de todas as áreas (inclusive encerradas) × (1 + crescimento do escritório%)
 *   área com % definido: usa o % dela; áreas no automático crescem todas o mesmo % x, que fecha a meta:
 *   x = (meta − Σ metas das áreas com % definido − Σ receita nova das automáticas) ÷ Σ receita 2026 das automáticas − 1
 *   (mínimo −100%). Sem área no automático, a diferença para a meta aparece em `diferenca`.
 *   Sem meta do escritório (cenário antigo): áreas no automático ficam em 0%.
 *
 * Por área, mês m:
 *   receita_m   = (receita2026_ano × (1 + crescimento%) + receita_nova) × peso_m
 *                 peso_m = receita2026_m ÷ receita2026_ano (sazonalidade 2026) ou 1/12 (linear)
 *   imposto_m   = receita_m × alíquota 2027
 *   pessoas_m   = pessoas2026_m × (1 + ajustes na equipe atual%) × (1 + reajuste%, a partir do mês do reajuste)
 *                 + Σ contratações (quantidade × custo mensal por pessoa, a partir do mês de início)
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

export type Contratacao = {
  /** Cargo ou descrição livre (ex.: "Advogado pleno"). */
  descricao: string
  qtd: number
  /** Custo mensal por pessoa (salário, encargos e benefícios), já no valor de 2027. */
  custoMensal: number
  /** Mês de 2027 em que a pessoa começa (1 a 12). */
  mesInicio: number
}

export type PremissaArea = {
  /** Crescimento da receita fixado para a área (%); null = automático (a área se ajusta para fechar a meta do escritório). */
  crescimentoPct: number | null
  receitaNova: number
  /** Ajustes na equipe atual (%): promoções, mérito, saídas — além do reajuste do escritório. */
  variacaoPessoasPct: number
  variacaoDemaisPct: number
  contratacoes: Contratacao[]
}

export type PremissasEscritorio = {
  /** Meta de crescimento da receita do escritório sobre 2026 (%); null = sem meta (total = soma das áreas). */
  crescimentoReceitaPct: number | null
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
  versao: 2
  escritorio: PremissasEscritorio
  areas: Record<AreaKey, PremissaArea>
  operacionais: Record<string, MetaOperacionalPremissa>
}

export const PREMISSA_AREA_PADRAO: PremissaArea = {
  crescimentoPct: null,
  receitaNova: 0,
  variacaoPessoasPct: 0,
  variacaoDemaisPct: 0,
  contratacoes: [],
}

export function novaContratacao(mesInicio = 1): Contratacao {
  return { descricao: '', qtd: 1, custoMensal: 0, mesInicio }
}

export function premissasPadrao(opts: { aliquotaPct: number; inadimplenciaMetaPct: number }): Premissas {
  return {
    versao: 2,
    escritorio: {
      crescimentoReceitaPct: 0,
      aliquotaPct: arred(opts.aliquotaPct, 2),
      reajustePct: 0,
      mesReajuste: 1,
      variacaoControladoriaPct: 0,
      variacaoEstruturaPct: 0,
      inadimplenciaMetaPct: opts.inadimplenciaMetaPct,
      distribuicao: 'sazonal',
    },
    areas: Object.fromEntries(
      AREA_KEYS.map((k): [AreaKey, PremissaArea] => [k, { ...PREMISSA_AREA_PADRAO, contratacoes: [] }]),
    ) as Record<AreaKey, PremissaArea>,
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

/** Número ou null (vazio/null = null; ausente = padrão). */
function numOuNulo(v: unknown, padrao: number | null): number | null {
  if (v === undefined) return padrao
  if (v === null || v === '') return null
  return num(v, padrao ?? 0)
}

function lerContratacoes(a: Record<string, unknown>, padrao: readonly Contratacao[]): Contratacao[] {
  if (Array.isArray(a.contratacoes)) {
    return a.contratacoes
      .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
      .map((c) => ({
        descricao: typeof c.descricao === 'string' ? c.descricao : '',
        qtd: Math.max(0, Math.round(num(c.qtd, 0))),
        custoMensal: Math.max(0, num(c.custoMensal, 0)),
        mesInicio: mes(c.mesInicio),
      }))
  }
  // Formato antigo (versão 1): uma contratação por área (quantidade, custo e mês de início).
  if (a.contratacoes !== undefined || a.custoContratacao !== undefined) {
    const qtd = Math.max(0, Math.round(num(a.contratacoes, 0)))
    return qtd > 0
      ? [{ descricao: '', qtd, custoMensal: Math.max(0, num(a.custoContratacao, 0)), mesInicio: mes(a.mesInicioContratacao) }]
      : []
  }
  return padrao.map((c) => ({ ...c }))
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
      crescimentoPct: numOuNulo(a.crescimentoPct, p.crescimentoPct),
      receitaNova: num(a.receitaNova, p.receitaNova),
      variacaoPessoasPct: num(a.variacaoPessoasPct, p.variacaoPessoasPct),
      variacaoDemaisPct: num(a.variacaoDemaisPct, p.variacaoDemaisPct),
      contratacoes: lerContratacoes(a, p.contratacoes),
    }
  }
  // Cenário antigo (sem meta do escritório) com % por área: o total continua sendo a soma das áreas.
  const temPctArea = Object.values(areasRaw).some((a) => a && a.crescimentoPct != null && a.crescimentoPct !== '')
  const crescimentoReceitaPct =
    e.crescimentoReceitaPct === undefined
      ? temPctArea
        ? null
        : padrao.escritorio.crescimentoReceitaPct
      : numOuNulo(e.crescimentoReceitaPct, null)
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
    versao: 2,
    escritorio: {
      crescimentoReceitaPct,
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
  /** Pessoas contratadas acumuladas no mês (headcount novo). */
  novasPessoas: number[]
  /** Custo de pessoas 2027 aberto: base 2026 + ajustes na equipe + reajuste + contratações = Σ pessoas. */
  pontePessoas: { base: number; ajustes: number; reajuste: number; contratacoes: number }
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
  /** Crescimento usado sobre a receita 2026 (sem a receita nova); null em área encerrada. */
  crescimentoOrganicoPct: number | null
  /** % calculado pelo desdobramento da meta (não fixado na área). */
  automatico: boolean
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

export type Desdobramento = {
  /** Receita 2026 de todas as áreas, inclusive as encerradas. */
  receitaBase: number
  /** Meta de receita do escritório (null = sem meta: total = soma das áreas). */
  metaReceita: number | null
  /** % aplicado às áreas no automático. */
  crescimentoAutomaticoPct: number
  areasAutomaticas: AreaKey[]
  /** Crescimento usado por área ativa. */
  crescimentoPct: Partial<Record<AreaKey, number>>
  /** Soma das metas das áreas − meta do escritório (0 quando as áreas no automático fecham a meta). */
  diferenca: number
}

export type ResultadoSimulacao = {
  areas: Record<AreaKey, ResultadoArea>
  escritorio: ResultadoEscritorio
  desdobramento: Desdobramento
}

/**
 * Desdobra a meta de crescimento do escritório nas áreas: as que têm % fixado ficam com ele; as
 * automáticas crescem o mesmo %, calculado para a soma das áreas bater a meta.
 */
export function desdobrarCrescimento(base2026: BaseAno, premissas: Premissas): Desdobramento {
  const meta0 = premissas.escritorio.crescimentoReceitaPct
  const receitaBase = soma(AREA_KEYS.map((k) => soma(base2026.areas[k].receita)))
  const metaReceita = meta0 == null ? null : receitaBase * (1 + meta0 / 100)
  const p = (k: AreaKey) => premissas.areas[k] ?? PREMISSA_AREA_PADRAO
  const b = (k: AreaKey) => soma(base2026.areas[k].receita)
  const fixas = AREA_KEYS_2027.filter((k) => p(k).crescimentoPct != null)
  const automaticas = AREA_KEYS_2027.filter((k) => p(k).crescimentoPct == null)
  const metaFixas = soma(fixas.map((k) => b(k) * (1 + (p(k).crescimentoPct ?? 0) / 100) + p(k).receitaNova))
  const novaAuto = soma(automaticas.map((k) => p(k).receitaNova))
  const baseAuto = soma(automaticas.map((k) => b(k)))
  let x = 0
  if (metaReceita != null && baseAuto > 0) x = Math.max(-100, ((metaReceita - metaFixas - novaAuto) / baseAuto - 1) * 100)
  const crescimentoPct: Partial<Record<AreaKey, number>> = {}
  for (const k of AREA_KEYS_2027) crescimentoPct[k] = p(k).crescimentoPct ?? x
  const somaAreas = metaFixas + novaAuto + baseAuto * (1 + x / 100)
  return {
    receitaBase,
    metaReceita,
    crescimentoAutomaticoPct: x,
    areasAutomaticas: automaticas,
    crescimentoPct,
    diferenca: metaReceita == null ? 0 : somaAreas - metaReceita,
  }
}

/** Custo e pessoas novas por mês de uma lista de contratações. */
export function contratacoesMensais(lista: readonly Contratacao[]): { custo: number[]; pessoas: number[] } {
  const custo = zeros12()
  const pessoas = zeros12()
  for (const c of lista) {
    for (let m = c.mesInicio; m <= 12; m++) {
      custo[m - 1] += c.qtd * c.custoMensal
      pessoas[m - 1] += c.qtd
    }
  }
  return { custo, pessoas }
}

/** Peso de cada mês: sazonalidade da receita 2026 da área (ou 1/12). */
export function pesosMensais(receita2026: readonly number[], distribuicao: Distribuicao): number[] {
  const total = soma(receita2026)
  if (distribuicao === 'linear' || total <= 0) return Array.from({ length: 12 }, () => 1 / 12)
  return receita2026.map((v) => v / total)
}

export function simular(base2026: BaseAno, premissas: Premissas): ResultadoSimulacao {
  const e = premissas.escritorio
  const desdobramento = desdobrarCrescimento(base2026, premissas)
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
        novasPessoas: zeros12(),
        pontePessoas: { base: 0, ajustes: 0, reajuste: 0, contratacoes: 0 },
        demais: zeros12(),
        controladoria: zeros12(),
        margem: zeros12(),
        pesos: zeros12(),
        receitaBaseAno,
        receitaAno: 0,
        margemAno: 0,
        margemPct: null,
        crescimentoReceitaPct: null,
        crescimentoOrganicoPct: null,
        automatico: false,
      }
      continue
    }
    const pesos = pesosMensais(b.receita, e.distribuicao)
    const crescimentoOrganicoPct = desdobramento.crescimentoPct[k] ?? 0
    const receitaAno = receitaBaseAno * (1 + crescimentoOrganicoPct / 100) + p.receitaNova
    const receita = pesos.map((w) => receitaAno * w)
    const impostos = receita.map((r) => (r * e.aliquotaPct) / 100)
    const { custo: contratacoes, pessoas: novasPessoas } = contratacoesMensais(p.contratacoes)
    const fatorReajuste = (i: number) => (i + 1 >= e.mesReajuste ? 1 + e.reajustePct / 100 : 1)
    const ajustada = b.pessoas.map((v) => v * (1 + p.variacaoPessoasPct / 100))
    const pessoas = ajustada.map((v, i) => v * fatorReajuste(i) + contratacoes[i])
    const pontePessoas = {
      base: soma(b.pessoas),
      ajustes: soma(ajustada) - soma(b.pessoas),
      reajuste: soma(ajustada.map((v, i) => v * (fatorReajuste(i) - 1))),
      contratacoes: soma(contratacoes),
    }
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
      novasPessoas,
      pontePessoas,
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
      crescimentoOrganicoPct,
      automatico: desdobramento.areasAutomaticas.includes(k),
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
    desdobramento,
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
