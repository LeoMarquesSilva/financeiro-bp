/**
 * Peças comuns às explicações do Fênix em Cobrança, Inadimplência e Judicializada.
 * Funções puras; imports com extensão `.ts` para rodar com `node --test`.
 */
import type { FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'

export const moeda = formatCurrency
/** Percentual com 2 casas, igual aos cards. */
export const pct = formatPercent

export function inteiro(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${inteiro(n)} ${n === 1 ? singular : pluralForm}`
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_NOME = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Ex.: "Nov/2026". */
export function mesAno(mes: number, ano: number): string {
  return `${MESES[mes - 1] ?? mes}/${ano}`
}

export function nomeMes(mes: number): string {
  return MESES_NOME[mes - 1] ?? String(mes)
}

/** "2026-11-11" → "11/11/2026". */
export function dataBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/** Data local de hoje como "YYYY-MM-DD". */
export function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

export function totalMoeda(rotulo: string, v: number, detalhe?: string): FenixLinha {
  return { rotulo, valor: moeda(v), numero: v, operador: '=', tipo: 'total', detalhe }
}

export function totalInteiro(rotulo: string, v: number, detalhe?: string): FenixLinha {
  return { rotulo, valor: inteiro(v), numero: v, operador: '=', tipo: 'total', detalhe }
}

export function parcelaMoeda(rotulo: string, v: number, primeira: boolean, detalhe?: string): FenixLinha {
  return { rotulo, valor: moeda(v), numero: v, operador: primeira ? undefined : '+', detalhe }
}

export function parcelaInteiro(rotulo: string, v: number, primeira: boolean, detalhe?: string): FenixLinha {
  return { rotulo, valor: inteiro(v), numero: v, operador: primeira ? undefined : '+', detalhe }
}

export function info(rotulo: string, valor: string, detalhe?: string, numero?: number): FenixLinha {
  return { rotulo, valor, numero, tipo: 'info', detalhe }
}

/**
 * Linhas "numerador ÷ denominador = %". O percentual vem pronto (o mesmo do card);
 * aqui só se mostra de onde ele sai.
 */
export function linhasPercentual(o: {
  numerador: { rotulo: string; valor: string; numero: number }
  denominador: { rotulo: string; valor: string; numero: number }
  resultado: { rotulo: string; pct: number; valorExibido?: string }
}): FenixLinha[] {
  return [
    { rotulo: o.numerador.rotulo, valor: o.numerador.valor, numero: o.numerador.numero },
    { rotulo: o.denominador.rotulo, valor: o.denominador.valor, numero: o.denominador.numero, operador: '÷' },
    {
      rotulo: o.resultado.rotulo,
      valor: o.resultado.valorExibido ?? pct(o.resultado.pct),
      numero: o.resultado.pct,
      operador: '=',
      tipo: 'total',
      detalhe: '× 100',
    },
  ]
}

const centavos = (v: number) => Math.round(v * 100)

/**
 * As linhas aparecem arredondadas em centavos. Se a soma do que está na tela não bate
 * com o total do card, mostra a diferença em uma linha própria.
 */
export function notaCentavos(parcelas: readonly number[], totalExato: number): FenixLinha[] {
  const somaExibida = parcelas.reduce((s, p) => s + centavos(p), 0)
  const dif = (centavos(totalExato) - somaExibida) / 100
  if (dif === 0) return []
  return [
    info(
      'Arredondamento de centavos',
      moeda(Math.abs(dif)),
      `as linhas aparecem arredondadas e somam ${moeda(somaExibida / 100)}; o total usa os valores exatos`,
      dif,
    ),
  ]
}

/**
 * Parcelas em valor: as `max` maiores aparecem uma a uma e o resto vira "demais".
 * A soma das linhas é sempre a soma de todos os itens.
 */
export function linhasMaioresMoeda<T>(
  itens: readonly T[],
  o: {
    valor: (t: T) => number
    rotulo: (t: T) => string
    detalhe?: (t: T) => string | undefined
    max?: number
    rotuloDemais: (qtd: number) => string
  },
): { linhas: FenixLinha[]; parcelas: number[] } {
  const max = o.max ?? 8
  const ordenados = [...itens].sort((a, b) => o.valor(b) - o.valor(a))
  const topo = ordenados.slice(0, max)
  const resto = ordenados.slice(max)
  const linhas: FenixLinha[] = topo.map((t, i) => parcelaMoeda(o.rotulo(t), o.valor(t), i === 0, o.detalhe?.(t)))
  const parcelas = topo.map((t) => o.valor(t))
  if (resto.length > 0) {
    const somaResto = resto.reduce((s, t) => s + o.valor(t), 0)
    linhas.push(parcelaMoeda(o.rotuloDemais(resto.length), somaResto, linhas.length === 0))
    parcelas.push(somaResto)
  }
  return { linhas, parcelas }
}

export const FONTE_FINANCEIRO_VIOS = 'Financeiro do VIOS: títulos a receber, sincronizados no SIOE.'
export const FONTE_ENVIOS_COBRANCA =
  'Cobranças enviadas pelo SIOE (WhatsApp e e-mail), registradas a cada envio.'
