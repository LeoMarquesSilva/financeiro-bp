import type { ReceitaResultadoCaixaMesRow } from '../types/receita.types'

export type ResultadoCaixaTotais = Omit<ReceitaResultadoCaixaMesRow, 'ano' | 'mes'>

const ZERO: ResultadoCaixaTotais = {
  receita: 0,
  opex: 0,
  distribuicao: 0,
  investimentos: 0,
  financeiro: 0,
  deducoes: 0,
  repasses: 0,
  transferencias: 0,
}

/** Último mês com dado para o ano (mês corrente no ano atual, dezembro nos anteriores). */
export function mesAtualResultadoCaixa(ano: number, ref = new Date()): number {
  const y = ref.getFullYear()
  if (ano < y) return 12
  if (ano > y) return 1
  return ref.getMonth() + 1
}

export function somarResultadoCaixa(
  rows: ReceitaResultadoCaixaMesRow[],
  ano: number,
  mesIni: number,
  mesFim: number,
): ResultadoCaixaTotais {
  const out = { ...ZERO }
  for (const r of rows) {
    if (r.ano !== ano || r.mes < mesIni || r.mes > mesFim) continue
    for (const k of Object.keys(out) as Array<keyof ResultadoCaixaTotais>) out[k] += r[k]
  }
  return out
}

/** Variação % sobre o módulo do ano anterior (funciona com resultado negativo). */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return atual === 0 ? 0 : null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

/** Saídas fora do OPEX que entram na cascata. */
export const SAIDAS_NAO_OPEX = [
  {
    key: 'distribuicao',
    label: 'Distribuição de lucros aos sócios',
    descricao: 'Distribuição de lucros, dividendos fixos e retiradas dos sócios',
  },
  {
    key: 'investimentos',
    label: 'Investimentos (CAPEX)',
    descricao: 'Equipamentos, móveis, reformas e melhorias',
  },
  {
    key: 'financeiro',
    label: 'Movimentações financeiras',
    descricao: 'Adiantamentos e devoluções de adiantamentos de clientes',
  },
  {
    key: 'deducoes',
    label: 'Deduções da receita',
    descricao: 'Devoluções de honorários e despesas',
  },
] as const satisfies ReadonlyArray<{
  key: keyof ResultadoCaixaTotais
  label: string
  descricao: string
}>

/** Saídas que não são gasto do escritório — mostradas, mas fora da cascata. */
export const SAIDAS_FORA_CALCULO = [
  {
    key: 'repasses',
    label: 'Repasses a terceiros',
    descricao: 'Repasse de outras receitas: a entrada correspondente não está na Receita Bruta',
  },
  {
    key: 'transferencias',
    label: 'Transferências entre contas',
    descricao: 'Movimento entre contas correntes do próprio escritório',
  },
] as const satisfies ReadonlyArray<{
  key: keyof ResultadoCaixaTotais
  label: string
  descricao: string
}>

export type CascataLinha = {
  key: string
  label: string
  tipo: 'receita' | 'saida' | 'resultado'
  /** Nome da margem quando `tipo === 'resultado'`. */
  margem?: string
  atual: number
  anterior: number
}

/**
 * DRE gerencial base caixa: Receita Bruta − OPEX = Resultado Operacional de Caixa;
 * − CAPEX, movimentações e deduções = Fluxo de Caixa Livre; − distribuição aos sócios
 * = Geração de Caixa Líquida.
 */
export function buildCascataResultado(
  atual: ResultadoCaixaTotais,
  anterior: ResultadoCaixaTotais,
): CascataLinha[] {
  const op = (t: ResultadoCaixaTotais) => t.receita - t.opex
  const fcl = (t: ResultadoCaixaTotais) => op(t) - t.investimentos - t.financeiro - t.deducoes
  const liq = (t: ResultadoCaixaTotais) => fcl(t) - t.distribuicao
  return [
    { key: 'receita', label: 'Receita Bruta', tipo: 'receita', atual: atual.receita, anterior: anterior.receita },
    {
      key: 'opex',
      label: '(−) Despesas operacionais (OPEX)',
      tipo: 'saida',
      atual: atual.opex,
      anterior: anterior.opex,
    },
    {
      key: 'resultado_operacional',
      label: '(=) Resultado Operacional de Caixa',
      tipo: 'resultado',
      margem: 'Margem operacional',
      atual: op(atual),
      anterior: op(anterior),
    },
    {
      key: 'investimentos',
      label: '(−) Investimentos (CAPEX)',
      tipo: 'saida',
      atual: atual.investimentos,
      anterior: anterior.investimentos,
    },
    {
      key: 'financeiro',
      label: '(−) Movimentações financeiras',
      tipo: 'saida',
      atual: atual.financeiro,
      anterior: anterior.financeiro,
    },
    {
      key: 'deducoes',
      label: '(−) Deduções da receita',
      tipo: 'saida',
      atual: atual.deducoes,
      anterior: anterior.deducoes,
    },
    {
      key: 'fluxo_caixa_livre',
      label: '(=) Fluxo de Caixa Livre',
      tipo: 'resultado',
      margem: 'Margem de caixa livre',
      atual: fcl(atual),
      anterior: fcl(anterior),
    },
    {
      key: 'distribuicao',
      label: '(−) Distribuição de lucros aos sócios',
      tipo: 'saida',
      atual: atual.distribuicao,
      anterior: anterior.distribuicao,
    },
    {
      key: 'geracao_caixa_liquida',
      label: '(=) Geração de Caixa Líquida',
      tipo: 'resultado',
      margem: 'Margem líquida de caixa',
      atual: liq(atual),
      anterior: liq(anterior),
    },
  ]
}
