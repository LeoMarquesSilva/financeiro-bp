import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { MESES_ABREV, MESES_NOME } from '@/features/receita/constants'

export type CarteiraSaldoDevedor = 'pontual' | 'recorrente' | 'judicializada'

export type ClassificacaoSaldoDevedor =
  | 'sem_perspectiva'
  | 'pagamento_parcial'
  | 'atraso_pontual'
  | 'corrente_em_dia'

export type MesFluxoSaldoDevedor = {
  mes: number
  faturado: number
  recebido: number
  inadimplencia: number
}

export type ClienteSaldoDevedor = {
  grupoNorm: string
  nome: string
  carteira: CarteiraSaldoDevedor
  classificacao: ClassificacaoSaldoDevedor
  saldoAnterior: number
  geradoAno: number
  acumulado: number
}

export type EvolucaoSaldoDevedorData = {
  ano: number
  anoAnterior: number
  mesInicio: number
  mesFim: number
  clientes: ClienteSaldoDevedor[]
  totais: {
    acumulado: number
    saldoAnterior: number
    geradoAno: number
    qtd: number
    qtdCresceram: number
    qtdReduziram: number
    dividaNova: number
    amortizado: number
  }
}

export const CLASSIFICACAO_SALDO_DEVEDOR: Record<
  ClassificacaoSaldoDevedor,
  { label: string; color: string }
> = {
  sem_perspectiva: { label: 'Sem perspectiva', color: '#dc2626' },
  pagamento_parcial: { label: 'Pagamento parcial', color: '#0284c7' },
  atraso_pontual: { label: 'Atraso pontual', color: '#1d4ed8' },
  corrente_em_dia: { label: 'Corrente em dia', color: '#16a34a' },
}

const EPS = 0.5

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatSaldoDevedorInt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

export function nomeExibicaoGrupo(nome: string): string {
  const stripped = nome.replace(/^Grupo\s+/i, '').trim()
  return stripped || nome
}

export function periodoPosicaoLabel(ano: number, mesInicio: number, mesFim: number): string {
  const ini = MESES_NOME[mesInicio - 1]?.toLowerCase() ?? String(mesInicio)
  const fim = MESES_NOME[mesFim - 1]?.toLowerCase() ?? String(mesFim)
  if (mesInicio === mesFim) return `${ini} de ${ano}`
  return `${ini} a ${fim} de ${ano}`
}

export function periodoAbrevLabel(mesInicio: number, mesFim: number): string {
  const ini = (MESES_ABREV[mesInicio - 1] ?? String(mesInicio)).toUpperCase()
  const fim = (MESES_ABREV[mesFim - 1] ?? String(mesFim)).toUpperCase()
  return ini === fim ? ini : `${ini}-${fim}`
}

export function classificarSaldoDevedor(input: {
  carteira: CarteiraSaldoDevedor
  saldoAnterior: number
  geradoAno: number
  acumulado: number
  meses: MesFluxoSaldoDevedor[]
  mesCorrente: number
}): ClassificacaoSaldoDevedor {
  const { carteira, saldoAnterior, geradoAno, acumulado, meses, mesCorrente } = input

  const recebidoYtd = meses.reduce((s, m) => s + m.recebido, 0)
  const faturadoYtd = meses.reduce((s, m) => s + m.faturado, 0)
  const mesesComInad = meses.filter((m) => m.inadimplencia > EPS).map((m) => m.mes)
  const mesAtual = meses.find((m) => m.mes === mesCorrente)

  const correntePago =
    mesAtual != null &&
    (mesAtual.faturado <= EPS ||
      mesAtual.inadimplencia <= EPS ||
      mesAtual.recebido + EPS >= mesAtual.faturado)

  const olhoNoOlho =
    faturadoYtd > EPS &&
    Math.abs(faturadoYtd - recebidoYtd) / faturadoYtd <= 0.2 &&
    saldoAnterior > EPS &&
    acumulado > EPS

  const saldoNaoDiminuiu = geradoAno >= -EPS && saldoAnterior > EPS

  if (correntePago && acumulado > EPS && (saldoNaoDiminuiu || olhoNoOlho)) {
    return 'corrente_em_dia'
  }

  const recebidoRecente = meses
    .filter((m) => m.mes >= Math.max(1, mesCorrente - 2) && m.mes <= mesCorrente)
    .reduce((s, m) => s + m.recebido, 0)

  const soAtrasoRecente =
    mesesComInad.length > 0 &&
    mesesComInad.every((mes) => mes === mesCorrente || mes === mesCorrente - 1)
  const umMesSo = mesesComInad.length <= 1

  if (carteira === 'pontual') return 'atraso_pontual'
  // "Vem pagando" = caixa recente (3 meses). Pagamento antigo no ano não tira de sem perspectiva.
  if (recebidoRecente > EPS && (umMesSo || soAtrasoRecente)) return 'atraso_pontual'
  if (recebidoRecente > EPS) return 'pagamento_parcial'
  return 'sem_perspectiva'
}

export function montarTotaisSaldoDevedor(clientes: ClienteSaldoDevedor[]) {
  let acumulado = 0
  let saldoAnterior = 0
  let geradoAno = 0
  let qtdCresceram = 0
  let qtdReduziram = 0
  let dividaNova = 0
  let amortizado = 0

  for (const c of clientes) {
    acumulado += c.acumulado
    saldoAnterior += c.saldoAnterior
    geradoAno += c.geradoAno
    const delta = c.acumulado - c.saldoAnterior
    if (delta > EPS) {
      qtdCresceram += 1
      dividaNova += delta
    } else if (delta < -EPS) {
      qtdReduziram += 1
      amortizado += Math.abs(delta)
    }
  }

  return {
    acumulado: roundMoney(acumulado),
    saldoAnterior: roundMoney(saldoAnterior),
    geradoAno: roundMoney(geradoAno),
    qtd: clientes.length,
    qtdCresceram,
    qtdReduziram,
    dividaNova: roundMoney(dividaNova),
    amortizado: roundMoney(amortizado),
  }
}

export function buildLeituraSaldoDevedor(data: EvolucaoSaldoDevedorData): string[] {
  const { ano, anoAnterior, mesInicio, mesFim, clientes, totais } = data
  const nMeses = mesFim - mesInicio + 1
  const mesesLabel = nMeses === 1 ? '1 mês' : `${nMeses} meses`
  const variacao = totais.acumulado - totais.saldoAnterior
  const pctEstoque =
    totais.saldoAnterior > 0 ? (variacao / totais.saldoAnterior) * 100 : 0

  const nomesReduziram = clientes
    .filter((c) => c.acumulado - c.saldoAnterior < -EPS)
    .sort((a, b) => a.acumulado - a.saldoAnterior - (b.acumulado - b.saldoAnterior))
    .slice(0, 8)
    .map((c) => nomeExibicaoGrupo(c.nome))

  const top5 = clientes.slice(0, 5)
  const top5Total = top5.reduce((s, c) => s + c.acumulado, 0)
  const pctTop5 = totais.acumulado > 0 ? (top5Total / totais.acumulado) * 100 : 0

  const linha1 =
    variacao >= 0
      ? `Em ${mesesLabel} de ${ano}, o saldo em aberto subiu ${formatCurrency(variacao)} (${formatPercent(pctEstoque)} sobre o fechamento de ${anoAnterior}).`
      : `Em ${mesesLabel} de ${ano}, a carteira amortizou ${formatCurrency(Math.abs(variacao))} sobre o fechamento de ${anoAnterior}.`

  let linha2 = `${totais.qtdCresceram} de ${totais.qtd} clientes aumentaram o saldo`
  if (totais.qtdReduziram > 0) {
    const nomes =
      totais.qtdReduziram <= 5 && nomesReduziram.length > 0
        ? ` (${nomesReduziram.join(', ')})`
        : ''
    linha2 += `; ${totais.qtdReduziram} reduziram${nomes}`
    if (totais.amortizado > EPS) {
      linha2 += `, somando ${formatCurrency(totais.amortizado)} amortizados`
    }
  }
  linha2 += '.'

  const linha3 = `Os cinco maiores concentram ${formatCurrency(top5Total)} (${formatPercent(pctTop5)} do saldo acumulado).`

  return [linha1, linha2, linha3]
}
