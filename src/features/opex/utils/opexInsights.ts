import type { OpexGrupoRow, OpexMesRow } from '../types/opex.types'

export type OpexInsightLinha = {
  nome: string
  realizado: number
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

function toLinha(g: OpexGrupoRow): OpexInsightLinha {
  return {
    nome: g.grupo_conta,
    realizado: g.realizado_ytd,
    previsto: g.previsto_ano,
    variacao: g.realizado_ytd - g.previsto_ano,
  }
}

export function buildOpexInsights(grupos: OpexGrupoRow[], evolucao: OpexMesRow[]): OpexInsightsModel {
  const linhas = grupos.map(toLinha)
  const realizadoTotal = linhas.reduce((s, g) => s + g.realizado, 0)

  const topGastos = [...linhas].sort((a, b) => b.realizado - a.realizado).slice(0, 3)
  const concentracaoTop3Pct =
    realizadoTotal > 0 ? (topGastos.reduce((s, g) => s + g.realizado, 0) / realizadoTotal) * 100 : 0

  const maioresEstouros = linhas
    .filter((g) => g.variacao > 0)
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
    .filter((g) => g.previsto <= 0 && g.realizado > 0)
    .sort((a, b) => b.realizado - a.realizado)
    .slice(0, 3)

  const orcadoNaoRealizado = linhas
    .filter((g) => g.previsto > 0 && g.realizado <= 0)
    .sort((a, b) => b.previsto - a.previsto)
    .slice(0, 3)

  const mesesComDado = evolucao.filter((m) => m.previsto > 0 || m.realizado > 0)
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
