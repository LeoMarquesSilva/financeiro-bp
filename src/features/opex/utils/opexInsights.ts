import type { OpexGrupoRow, OpexMesRow } from '../types/opex.types'

export type OpexInsightLinha = {
  nome: string
  realizado: number
  compromisso: number
  previsto: number
  variacao: number
}

export type OpexInsightsModel = {
  topGastos: OpexInsightLinha[]
  maioresEstouros: OpexInsightLinha[]
  maioresEconomias: OpexInsightLinha[]
  concentracaoTop3Pct: number
  realizadoFixas: number
  realizadoVariaveis: number
  pctFixas: number
  semOrcamento: OpexInsightLinha[]
  orcadoNaoRealizado: OpexInsightLinha[]
  mesMaisPressionado: OpexMesRow | null
  mesMaisFolgado: OpexMesRow | null
}

/** Ano inteiro, ou filtro que inclui mês futuro: soma VIOS a vencer. */
export function insightUsaCompromissoVios(mesesFiltro: number[], mesAtual: number): boolean {
  if (!mesesFiltro.length) return true
  return mesesFiltro.some((mes) => mes > mesAtual)
}

export function compromissoGrupo(g: OpexGrupoRow, usaCompromissoVios: boolean): number {
  return g.realizado_ytd + (usaCompromissoVios ? g.previsto_vios_futuro : 0)
}

export function variacaoGrupo(g: OpexGrupoRow, usaCompromissoVios: boolean): number {
  return compromissoGrupo(g, usaCompromissoVios) - g.previsto_ano
}

/** Mês futuro no recorte anual: o que o VIOS ainda tem. Mês fechado: o que já saiu. */
export function compromissoMes(
  m: OpexMesRow,
  mesAtual: number,
  usaCompromissoVios: boolean,
): number {
  if (usaCompromissoVios && m.mes > mesAtual) return m.previsto_vios
  return m.realizado
}

export function variacaoMesInsight(
  m: OpexMesRow,
  mesAtual: number,
  usaCompromissoVios: boolean,
): number {
  return compromissoMes(m, mesAtual, usaCompromissoVios) - m.previsto
}

function mesesParaInsight(
  evolucao: OpexMesRow[],
  mesAtual: number,
  usaCompromissoVios: boolean,
  mesesFiltro: number[],
): OpexMesRow[] {
  return evolucao
    .filter((m) => {
      if (mesesFiltro.length && !mesesFiltro.includes(m.mes)) return false
      if (usaCompromissoVios && mesAtual > 0 && m.mes === mesAtual) return false
      return m.previsto > 0 || m.realizado > 0 || m.previsto_vios > 0
    })
    .map((m) => ({
      ...m,
      variacao: variacaoMesInsight(m, mesAtual, usaCompromissoVios),
    }))
}

function toLinha(g: OpexGrupoRow, usaCompromissoVios: boolean): OpexInsightLinha {
  const compromisso = compromissoGrupo(g, usaCompromissoVios)
  return {
    nome: g.grupo_conta,
    realizado: g.realizado_ytd,
    compromisso,
    previsto: g.previsto_ano,
    variacao: compromisso - g.previsto_ano,
  }
}

export function buildOpexInsights(
  grupos: OpexGrupoRow[],
  evolucao: OpexMesRow[],
  usaCompromissoVios = false,
  mesAtual = 0,
  mesesFiltro: number[] = [],
): OpexInsightsModel {
  const linhas = grupos.map((g) => toLinha(g, usaCompromissoVios))
  const realizadoTotal = linhas.reduce((s, g) => s + g.realizado, 0)

  const topGastos = [...linhas].sort((a, b) => b.realizado - a.realizado).slice(0, 3)
  const concentracaoTop3Pct =
    realizadoTotal > 0 ? (topGastos.reduce((s, g) => s + g.realizado, 0) / realizadoTotal) * 100 : 0

  const maioresEstouros = linhas
    .filter((g) => g.variacao > 0 && g.previsto > 0)
    .sort((a, b) => b.variacao - a.variacao)
    .slice(0, 3)

  const maioresEconomias = linhas
    .filter((g) => g.variacao < 0 && g.previsto > 0)
    .sort((a, b) => a.variacao - b.variacao)
    .slice(0, 3)

  const realizadoFixas = grupos.filter((g) => g.fixo).reduce((s, g) => s + g.realizado_ytd, 0)
  const realizadoVariaveis = realizadoTotal - realizadoFixas
  const pctFixas = realizadoTotal > 0 ? (realizadoFixas / realizadoTotal) * 100 : 0

  const semOrcamento = linhas
    .filter((g) => g.previsto <= 0 && g.compromisso > 0)
    .sort((a, b) => b.compromisso - a.compromisso)
    .slice(0, 3)

  const orcadoNaoRealizado = linhas
    .filter((g) => g.previsto > 0 && g.compromisso <= 0)
    .sort((a, b) => b.previsto - a.previsto)
    .slice(0, 3)

  const mesesComDado = mesesParaInsight(evolucao, mesAtual, usaCompromissoVios, mesesFiltro)
  const mesMaisPressionado =
    mesesComDado.length > 0
      ? mesesComDado.reduce((acc, m) => (m.variacao > acc.variacao ? m : acc), mesesComDado[0])
      : null
  const mesMaisFolgado =
    mesesComDado.length > 0
      ? mesesComDado.reduce((acc, m) => (m.variacao < acc.variacao ? m : acc), mesesComDado[0])
      : null

  return {
    topGastos,
    maioresEstouros,
    maioresEconomias,
    concentracaoTop3Pct,
    realizadoFixas,
    realizadoVariaveis,
    pctFixas,
    semOrcamento,
    orcadoNaoRealizado,
    mesMaisPressionado: mesMaisPressionado && mesMaisPressionado.variacao > 0 ? mesMaisPressionado : null,
    mesMaisFolgado: mesMaisFolgado && mesMaisFolgado.variacao < 0 ? mesMaisFolgado : null,
  }
}
