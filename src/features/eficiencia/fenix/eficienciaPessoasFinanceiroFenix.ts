/**
 * Fênix na Eficiência Operacional — abas de pessoas e financeiro:
 * Desenvolvimento Equipe (treinamentos), Retenção de Talentos, Gestão de PDI, NPS,
 * Receita Bruta, Índice de Inadimplência e, em Operações Legais, Desenvolvimento Contínuo.
 *
 * Funções puras. Recebem os mesmos valores que o card mostra (nada é recalculado por outro
 * caminho), então a memória de cálculo fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatDate, formatPercent } from '../../../shared/utils/format.ts'
import type { GestaoVistaMesRow, ReceitaMesRow } from '../../receita/types/receita.types.ts'
import { isMesAtual, isMesFuturo } from '../../receita/utils/receitaMes.ts'
import {
  EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO,
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_NPS,
  EFICIENCIA_META_PDI,
  EFICIENCIA_META_TREINAMENTO_MINUTOS,
  MESES_EFICIENCIA,
  MES_INICIO_RESULTADO,
  OPS_TREINAMENTO_CARGOS_GERENTE,
  OPS_TREINAMENTO_CARGOS_LIDERANCA,
  isDiaFiltro,
  isMesesFiltro,
  isSemanaFiltro,
  mesNoFiltro,
  mesesEfetivosFiltro,
  rangeDiaFiltro,
  rangeSemanaFiltro,
} from '../constants.ts'
import type { MesFiltroEficiencia, OpsTreinamentoCategoria } from '../constants.ts'
import type { GestaoPdiMesRow } from '../types/eficiencia.types.ts'
import { formatPessoaNome } from '../utils/formatPessoaNome.ts'
import { npsZona } from '../utils/npsCalc.ts'
import type { NpsKpi } from '../utils/npsCalc.ts'

// ---------------------------------------------------------------------------
// Telas (para a lista "Já disponível em" do painel)
// ---------------------------------------------------------------------------

export const TELA_EFICIENCIA_PESSOAS = {
  desenvolvimento: 'Eficiência › Desenvolvimento Equipe',
  retencao: 'Eficiência › Retenção de Talentos',
  pdi: 'Eficiência › Gestão de PDI',
  pdiOps: 'Operações Legais › Gestão de PDI',
  nps: 'Eficiência › NPS',
  receitaBruta: 'Eficiência › Receita Bruta',
  inadimplencia: 'Eficiência › Índice de Inadimplência',
  opsTreinamentos: 'Operações Legais › Desenvolvimento Contínuo',
} as const

export const TELAS_EFICIENCIA_PESSOAS_FINANCEIRO: readonly string[] = Object.values(TELA_EFICIENCIA_PESSOAS)

// ---------------------------------------------------------------------------
// Formatação (igual à dos cards)
// ---------------------------------------------------------------------------

const moeda = formatCurrency

/** Igual ao card "Recebido acumulado" / "Saldo inadimplência" (sem centavos). */
function moedaSemCentavos(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

/** Igual aos cards Horas Realizadas e Meta do Desenvolvimento Equipe (ex.: "312:30h"). */
export function horasKpi(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}h`
}

/** Igual aos cards por pessoa e por categoria (ex.: "12h 30min"). */
export function horasMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}h ${String(m).padStart(2, '0')}min`
}

function minutosTxt(min: number): string {
  return `${min.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} min`
}

/** Igual às médias 0–10 do NPS (uma casa). */
function nota10(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function pct2(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function nomeMes(mes: number): string {
  return MESES_EFICIENCIA[mes - 1] ?? String(mes)
}

/** Ex.: "Out/26". */
export function mesAno(ano: number, mes: number): string {
  return `${nomeMes(mes)}/${String(ano).slice(-2)}`
}

/** Ex.: "Jun–Nov/2026" ou "Jun, Ago e Out/2026". */
export function periodoMeses(ano: number, meses: readonly number[]): string {
  const s = [...new Set(meses)].sort((a, b) => a - b)
  if (s.length === 0) return '—'
  if (s.length === 1) return `${nomeMes(s[0])}/${ano}`
  const contiguo = s.every((m, i) => i === 0 || m === s[i - 1] + 1)
  if (contiguo) return `${nomeMes(s[0])}–${nomeMes(s[s.length - 1])}/${ano}`
  return `${listaComE(s.map(nomeMes))}/${ano}`
}

function blocosContiguos(meses: readonly number[]): number[][] {
  const blocos: number[][] = []
  for (const m of [...new Set(meses)].sort((a, b) => a - b)) {
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && m === ultimo[ultimo.length - 1] + 1) ultimo.push(m)
    else blocos.push([m])
  }
  return blocos
}

/** Rótulo do filtro de período do topo da Eficiência. */
export function rotuloPeriodoEficiencia(filtro: MesFiltroEficiencia, ano: number, hoje = new Date()): string {
  if (filtro == null) return `Ano inteiro (${ano})`
  if (isSemanaFiltro(filtro)) return rangeSemanaFiltro(hoje).label
  if (isDiaFiltro(filtro)) return rangeDiaFiltro(filtro).label
  const meses = mesesEfetivosFiltro(filtro, ano, hoje) ?? []
  const p = meses.length > 0 ? periodoMeses(ano, meses) : 'nenhum mês fechado'
  if (filtro === 'resultado') return `Resultado: ${p}`
  if (filtro === 'resultado_ytd') return `Até o último mês fechado: ${p}`
  return p
}

function nomePessoa(nome: string): string {
  return formatPessoaNome(nome) || nome
}

function total(rotulo: string, valor: string, numero: number, detalhe?: string): FenixLinha {
  return { rotulo, valor, numero, operador: '=', tipo: 'total', detalhe }
}

function info(rotulo: string, valor: string, numero?: number, detalhe?: string): FenixLinha {
  return { rotulo, valor, numero, tipo: 'info', detalhe }
}

const quaseIgual = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= tol

// ---------------------------------------------------------------------------
// Desenvolvimento Equipe (treinamentos — Jurídico)
// ---------------------------------------------------------------------------

export type TreinamentoPessoaFenix = {
  colaborador: string
  /** Minutos que o card considera (já no recorte do período). */
  minutos: number
  metaMinutos: number | null
  admissao?: string | null
}

export type TreinamentoItemFenix = {
  colaborador?: string | null
  treinamento: string | null
  data: string | null
  duracao_minutos: number
  duplicado?: boolean
}

export type DesenvolvimentoFenixCtx = {
  ano: number
  area: string | null
  /** Ex.: "Ano inteiro (2026)", "Jun–Out/2026", "Semana passada (06/11–12/11)". */
  periodo: string
  /** Mês, semana ou De/Até recortando as horas. */
  recortePeriodo: boolean
  /** Filtro "Resultado" ativo: nesta aba vale o ano inteiro. */
  resultadoAnoInteiro?: boolean
  /** Nome digitado no filtro de pessoa. */
  responsavel: string | null
  /** Pessoa única encontrada pelo filtro: o card vira individual. */
  pessoa: TreinamentoPessoaFenix | null
  minutos: number | null
  metaMinutos: number | null
  pct: number | null
  /** % da equipe usado na comparação do card individual. */
  pctEquipe: number | null
  pessoasAtivas: number | null
  /** Equipe inteira do indicador (sem filtro de pessoa), com os minutos do período. */
  equipe: readonly TreinamentoPessoaFenix[]
  /** Pessoas cujas horas o card soma (equipe ou recorte do filtro de pessoa). */
  somadas: readonly TreinamentoPessoaFenix[]
  /** Presenças do período das pessoas exibidas (card individual: lançamentos da pessoa). */
  itens?: readonly TreinamentoItemFenix[]
}

type OrigemHoras = 'pessoa' | 'periodo' | 'anual'

function origemHoras(c: DesenvolvimentoFenixCtx): OrigemHoras {
  if (c.pessoa) return 'pessoa'
  return c.recortePeriodo ? 'periodo' : 'anual'
}

const FONTE_TREINAMENTOS =
  'Lista de presença dos treinamentos (SharePoint) e planilha de Turnover do RH (quem está ativo, cargo, área e admissão).'

const REGRA_DEDUP = 'Lançamento repetido (mesma pessoa, treinamento e data) conta uma vez.'

function regrasPopulacaoJuridico(ano: number, area: string | null): string[] {
  return [
    `Entra quem está ativo em ${ano} na planilha de Turnover: admitido até ${ano} e sem desligamento até 31/12/${ano}. Quem saiu no ano fica fora, junto com as horas que fez.`,
    `Cargos de gestão ficam fora: ${listaComE([...EFICIENCIA_CARGOS_EXCLUIDOS_DESENVOLVIMENTO])}.`,
    area
      ? `Só entra quem é da área ${area} no registro mais recente da pessoa na planilha de Turnover.`
      : 'Sem filtro de área entram todas as áreas, menos Tributário.',
  ]
}

const REGRA_META_PROPORCIONAL =
  'Meta individual: 14h no ano. Quem foi admitido no ano tem meta proporcional: 14h × meses no ano ÷ 12. Admissão depois do dia 15 começa a contar no mês seguinte.'
const REGRA_TRANSFERENCIA =
  'Mudança de área (Transferência) não reinicia a contagem: vale a data de entrada no escritório.'

function regrasHorasJuridico(c: DesenvolvimentoFenixCtx): string[] {
  const out = [
    'Horas: soma da duração de cada presença na lista de presença dos treinamentos, pela data do treinamento.',
  ]
  if (c.recortePeriodo) {
    out.push(
      `Com filtro de período (${c.periodo}) entram só as presenças com data no período. A meta continua a do ano inteiro: o percentual mostra quanto da meta anual foi feito nesse período.`,
    )
  } else if (c.resultadoAnoInteiro) {
    out.push('No filtro Resultado este indicador usa o ano inteiro (é um indicador anual).')
  }
  if (origemHoras(c) !== 'anual') out.push(REGRA_DEDUP)
  return out
}

function regrasFiltroPessoa(c: DesenvolvimentoFenixCtx): string[] {
  if (!c.responsavel) return []
  if (c.pessoa) {
    return [`Filtro de pessoa: o card mostra só ${nomePessoa(c.pessoa.colaborador)}, com a meta individual dela.`]
  }
  return [
    `O filtro de pessoa "${c.responsavel}" não encontrou exatamente uma pessoa no indicador; o card continua com a conta da equipe${c.recortePeriodo ? ' (horas das pessoas encontradas)' : ''}.`,
  ]
}

function filtrosDesenvolvimento(c: DesenvolvimentoFenixCtx): FenixFiltro[] {
  const f: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Período das horas', valor: c.periodo },
    { rotulo: 'Área', valor: c.area ?? 'Todas (sem Tributário)' },
  ]
  if (c.pessoa) f.push({ rotulo: 'Pessoa', valor: nomePessoa(c.pessoa.colaborador) })
  else if (c.responsavel) f.push({ rotulo: 'Pessoa', valor: c.responsavel })
  return f
}

function mesesDaMeta(metaMinutos: number): number {
  return Math.round((metaMinutos * 12) / EFICIENCIA_META_TREINAMENTO_MINUTOS)
}

function linhaMetaPessoa(p: TreinamentoPessoaFenix, fmt: (min: number) => string): FenixLinha[] {
  if (p.metaMinutos == null) return []
  const meses = mesesDaMeta(p.metaMinutos)
  const adm = p.admissao ? formatDate(p.admissao) : null
  return [
    info(
      `Meta = 14h × ${plural(meses, 'mês', 'meses')} ÷ 12`,
      fmt(p.metaMinutos),
      p.metaMinutos,
      adm ? `admissão considerada: ${adm}` : meses === 12 ? 'ano inteiro' : undefined,
    ),
  ]
}

/** Meta da equipe = soma das metas individuais (cheias e proporcionais). */
function linhasComposicaoMeta(
  equipe: readonly TreinamentoPessoaFenix[],
  metaTotal: number,
  fmt: (min: number) => string,
): FenixLinha[] {
  const cheia = equipe.filter((p) => p.metaMinutos != null && p.metaMinutos >= EFICIENCIA_META_TREINAMENTO_MINUTOS - 0.005)
  const prop = equipe.filter((p) => p.metaMinutos != null && p.metaMinutos < EFICIENCIA_META_TREINAMENTO_MINUTOS - 0.005)
  const somaCheia = cheia.reduce((s, p) => s + (p.metaMinutos ?? 0), 0)
  const somaProp = prop.reduce((s, p) => s + (p.metaMinutos ?? 0), 0)
  const out: FenixLinha[] = []
  if (cheia.length > 0) {
    out.push(info(`Meta cheia: ${plural(cheia.length, 'pessoa', 'pessoas')} × 14h`, fmt(somaCheia), somaCheia, 'admitidas antes do ano (ou até 15/jan)'))
  }
  if (prop.length > 0) {
    const nomes =
      prop.length <= 6
        ? prop.map((p) => `${nomePessoa(p.colaborador)} (${plural(mesesDaMeta(p.metaMinutos ?? 0), 'mês', 'meses')})`).join(', ')
        : 'admitidas durante o ano'
    out.push(info(`Meta proporcional: ${plural(prop.length, 'pessoa', 'pessoas')}`, fmt(somaProp), somaProp, nomes))
  }
  const dif = metaTotal - (somaCheia + somaProp)
  if (out.length > 0 && Math.abs(dif) > 0.01) {
    out.push(
      info('Diferença para a meta do card', fmt(Math.abs(dif)), dif, 'a soma das metas por pessoa não fechou com o total; vale conferir'),
    )
  }
  return out
}

const LIMITE_LINHAS_PESSOA = 12

/** Horas por pessoa (maiores primeiro); acima do limite, agrupa o resto numa linha. */
function linhasHorasPorPessoa(
  pessoas: readonly { colaborador: string; minutos: number }[],
  fmt: (min: number) => string,
): { linhas: FenixLinha[]; soma: number; semHoras: number } {
  const com = pessoas
    .filter((p) => p.minutos > 0)
    .sort((a, b) => b.minutos - a.minutos || a.colaborador.localeCompare(b.colaborador, 'pt-BR'))
  const mostrar = com.length > LIMITE_LINHAS_PESSOA + 1 ? com.slice(0, LIMITE_LINHAS_PESSOA) : com
  const resto = com.slice(mostrar.length)
  const linhas: FenixLinha[] = mostrar.map((p, i) => ({
    rotulo: nomePessoa(p.colaborador),
    valor: fmt(p.minutos),
    numero: p.minutos,
    operador: i === 0 ? undefined : '+',
  }))
  if (resto.length > 0) {
    const somaResto = resto.reduce((s, p) => s + p.minutos, 0)
    linhas.push({
      rotulo: `Demais ${plural(resto.length, 'pessoa', 'pessoas')}`,
      valor: fmt(somaResto),
      numero: somaResto,
      operador: '+',
    })
  }
  return {
    linhas,
    soma: com.reduce((s, p) => s + p.minutos, 0),
    semHoras: pessoas.length - com.length,
  }
}

function chavePresenca(i: TreinamentoItemFenix): string {
  return [
    String(i.colaborador ?? '').trim().toLocaleUpperCase('pt-BR'),
    String(i.treinamento ?? '').trim().toLocaleUpperCase('pt-BR'),
    String(i.data ?? '').slice(0, 10),
  ].join('|')
}

/** Uma linha por treinamento (sem repetição), em ordem de data. */
function itensUnicos(itens: readonly TreinamentoItemFenix[]): TreinamentoItemFenix[] {
  const map = new Map<string, TreinamentoItemFenix>()
  for (const it of itens) {
    const k = chavePresenca(it)
    if (!map.has(k)) map.set(k, it)
  }
  return [...map.values()].sort((a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')))
}

const LIMITE_LINHAS_ITENS = 25

function linhasItens(
  itens: readonly TreinamentoItemFenix[],
  fmt: (min: number) => string,
): { linhas: FenixLinha[]; soma: number; repetidos: number } {
  const unicos = itensUnicos(itens).filter((i) => Number(i.duracao_minutos) > 0)
  const mostrar = unicos.length > LIMITE_LINHAS_ITENS + 1 ? unicos.slice(0, LIMITE_LINHAS_ITENS) : unicos
  const resto = unicos.slice(mostrar.length)
  const linhas: FenixLinha[] = mostrar.map((it, idx) => ({
    rotulo: it.treinamento?.trim() || 'Treinamento sem nome',
    valor: fmt(Number(it.duracao_minutos)),
    numero: Number(it.duracao_minutos),
    operador: idx === 0 ? undefined : '+',
    detalhe: it.data ? formatDate(it.data) : 'sem data',
  }))
  if (resto.length > 0) {
    const s = resto.reduce((acc, it) => acc + Number(it.duracao_minutos), 0)
    linhas.push({ rotulo: `Demais ${plural(resto.length, 'treinamento', 'treinamentos')}`, valor: fmt(s), numero: s, operador: '+' })
  }
  return {
    linhas,
    soma: unicos.reduce((acc, it) => acc + Number(it.duracao_minutos), 0),
    repetidos: itens.length - itensUnicos(itens).length,
  }
}

export function explicarTreinamentosDesenvolvimento(c: DesenvolvimentoFenixCtx): FenixExplicacao {
  const valor = c.pct != null ? formatPercent(c.pct) : '—'
  const conta: FenixLinha[] = []
  if (c.minutos != null && c.metaMinutos != null && c.metaMinutos > 0 && c.pct != null) {
    conta.push(
      {
        rotulo: c.pessoa ? `Horas de ${nomePessoa(c.pessoa.colaborador)}` : 'Horas realizadas',
        valor: horasKpi(c.minutos),
        numero: c.minutos,
        detalhe: `${minutosTxt(c.minutos)} · ${c.periodo}`,
      },
      {
        rotulo: c.pessoa ? 'Meta individual do ano' : 'Meta de horas da equipe no ano',
        valor: horasKpi(c.metaMinutos),
        numero: c.metaMinutos,
        operador: '÷',
        detalhe: minutosTxt(c.metaMinutos),
      },
      total('Desenvolvimento', valor, c.pct, '× 100'),
    )
    if (c.pessoa) {
      conta.push(...linhaMetaPessoa({ ...c.pessoa, metaMinutos: c.metaMinutos }, horasKpi))
      if (c.pctEquipe != null) {
        conta.push(info('Equipe (ano inteiro)', formatPercent(c.pctEquipe), c.pctEquipe, 'comparação "vs equipe" do card'))
      }
    } else {
      conta.push(...linhasComposicaoMeta(c.equipe, c.metaMinutos, horasKpi))
    }
  } else {
    conta.push(info('Sem meta para comparar', '—', undefined, 'nenhuma pessoa elegível no recorte'))
  }

  return {
    tela: TELA_EFICIENCIA_PESSOAS.desenvolvimento,
    titulo: 'Desenvolvimento Contínuo da Equipe',
    valor,
    resumo: c.pessoa
      ? `Quanto da meta individual de treinamento de ${nomePessoa(c.pessoa.colaborador)} foi cumprido (${c.periodo}).`
      : `Quanto da meta anual de horas de treinamento ${c.area ? `da área ${c.area}` : 'do Jurídico'} foi cumprido (${c.periodo}).`,
    formula: 'Desenvolvimento = Horas realizadas ÷ Meta de horas × 100',
    conta,
    filtros: filtrosDesenvolvimento(c),
    regras: [
      ...regrasFiltroPessoa(c),
      ...(c.pessoa ? [] : regrasPopulacaoJuridico(c.ano, c.area)),
      REGRA_META_PROPORCIONAL,
      REGRA_TRANSFERENCIA,
      c.pessoa ? 'A meta é a do ano inteiro, mesmo com filtro de período.' : 'Meta da equipe = soma das metas individuais.',
      ...regrasHorasJuridico(c),
      'Meta do indicador: 100%.',
    ],
    fonte: FONTE_TREINAMENTOS,
    fonteTecnica: c.pessoa
      ? 'Supabase › eficiencia_treinamentos_por_pessoa (meta por pessoa) · sp_treinamentos_presenca'
      : c.recortePeriodo
        ? 'Supabase › eficiencia_treinamentos_anual (meta) · horas: sp_treinamentos_presenca no período (aplicarMinutosTreinamentoPeriodo)'
        : 'Supabase › eficiencia_treinamentos_anual sobre sp_treinamentos_presenca e sp_turnover',
    detalhe: 'Os cards de cada pessoa ficam abaixo (Visão Equipe). Para a lista lançamento a lançamento, feche o Fênix e clique em Racional.',
  }
}

export function explicarTreinamentosHoras(c: DesenvolvimentoFenixCtx): FenixExplicacao {
  const origem = origemHoras(c)
  const valor = c.minutos != null ? horasKpi(c.minutos) : '—'
  const conta: FenixLinha[] = []

  if (c.minutos != null) {
    if (origem === 'pessoa') {
      const itens = c.itens ?? []
      const { linhas, soma, repetidos } = linhasItens(itens, horasKpi)
      if (linhas.length > 0 && quaseIgual(soma, c.minutos, 0.5)) {
        conta.push(...linhas, total('Horas realizadas', valor, c.minutos, minutosTxt(c.minutos)))
        if (repetidos > 0) conta.push(info(`${plural(repetidos, 'lançamento repetido', 'lançamentos repetidos')}`, 'contam uma vez', repetidos))
      } else {
        conta.push(total('Horas realizadas', valor, c.minutos, minutosTxt(c.minutos)))
      }
    } else {
      const { linhas, soma, semHoras } = linhasHorasPorPessoa(c.somadas, horasKpi)
      const dif = c.minutos - soma
      if (linhas.length > 0 && (quaseIgual(dif, 0, 0.5) || (origem === 'anual' && dif > 0))) {
        conta.push(...linhas)
        if (!quaseIgual(dif, 0, 0.5)) {
          conta.push({
            rotulo: 'Lançamentos repetidos na lista de presença',
            valor: horasKpi(dif),
            numero: dif,
            operador: '+',
            detalhe: 'o total do ano soma de novo; nos cards por pessoa contam uma vez',
          })
        }
        conta.push(total('Horas realizadas', valor, c.minutos, minutosTxt(c.minutos)))
      } else {
        conta.push(total('Horas realizadas', valor, c.minutos, minutosTxt(c.minutos)))
        if (linhas.length > 0) {
          conta.push(info('Soma das horas dos cards por pessoa', horasKpi(soma), soma, 'diferente do total; vale conferir'))
        }
      }
      if (semHoras > 0) conta.push(info(`${plural(semHoras, 'pessoa', 'pessoas')} sem horas no período`, horasKpi(0), 0))
    }
    if (c.metaMinutos != null && c.metaMinutos > 0) {
      conta.push(
        info(c.pessoa ? 'Meta individual do ano' : 'Meta da equipe no ano', horasKpi(c.metaMinutos), c.metaMinutos, 'aparece no rodapé do card'),
      )
    }
  }

  return {
    tela: TELA_EFICIENCIA_PESSOAS.desenvolvimento,
    titulo: 'Horas Realizadas',
    valor,
    resumo: c.pessoa
      ? `Horas de treinamento de ${nomePessoa(c.pessoa.colaborador)} em ${c.periodo}.`
      : `Total de horas de treinamento ${c.area ? `da área ${c.area}` : 'do Jurídico'} em ${c.periodo}: soma das horas de cada pessoa do indicador.`,
    formula: 'Horas realizadas = soma da duração das presenças em treinamento',
    conta,
    filtros: filtrosDesenvolvimento(c),
    regras: [
      ...regrasFiltroPessoa(c),
      ...(c.pessoa ? [] : regrasPopulacaoJuridico(c.ano, c.area)),
      ...regrasHorasJuridico(c),
      'Horas aparecem no formato horas:minutos.',
    ],
    fonte: FONTE_TREINAMENTOS,
    fonteTecnica:
      origem === 'anual'
        ? 'Supabase › eficiencia_treinamentos_anual (minutos_lancados) · por pessoa: eficiencia_treinamentos_por_pessoa'
        : 'sp_treinamentos_presenca no período · eficiencia_treinamentos_por_pessoa (aplicarMinutosTreinamentoPeriodo)',
    detalhe: 'Cada pessoa tem um card abaixo; clique no card (com o Fênix fechado) para ver os treinamentos dela.',
  }
}

export function explicarTreinamentosAtivos(c: DesenvolvimentoFenixCtx): FenixExplicacao {
  const valor = c.pessoasAtivas != null ? String(c.pessoasAtivas) : '—'
  const conta: FenixLinha[] = []
  if (c.pessoa) {
    conta.push(total(nomePessoa(c.pessoa.colaborador), '1', 1, 'filtro de pessoa'))
  } else if (c.pessoasAtivas != null) {
    const cheia = c.equipe.filter((p) => p.metaMinutos != null && p.metaMinutos >= EFICIENCIA_META_TREINAMENTO_MINUTOS - 0.005).length
    const prop = c.equipe.length - cheia
    if (c.equipe.length > 0) {
      conta.push({ rotulo: 'Com meta cheia (14h)', valor: String(cheia), numero: cheia, detalhe: 'admitidas antes do ano (ou até 15/jan)' })
      if (prop > 0) {
        conta.push({ rotulo: 'Admitidas no ano (meta proporcional)', valor: String(prop), numero: prop, operador: '+' })
      }
    }
    conta.push(total('Colaboradores ativos', valor, c.pessoasAtivas))
    if (c.equipe.length > 0 && c.equipe.length !== c.pessoasAtivas) {
      conta.push(info('Pessoas na lista por pessoa', String(c.equipe.length), c.equipe.length, 'diferente do card; vale conferir'))
    }
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.desenvolvimento,
    titulo: 'Colaboradores Ativos',
    valor,
    resumo: c.pessoa
      ? 'Com filtro de pessoa, o card conta só a pessoa filtrada.'
      : `Quantas pessoas entram no indicador de treinamentos em ${c.ano}${c.area ? ` na área ${c.area}` : ''}: cada uma tem a sua meta, que somadas dão a meta da equipe.`,
    formula: 'Colaboradores ativos = pessoas ativas no ano, fora os cargos de gestão',
    conta,
    filtros: filtrosDesenvolvimento(c),
    regras: [
      ...regrasFiltroPessoa(c),
      ...regrasPopulacaoJuridico(c.ano, c.area),
      'Cada pessoa conta uma vez, mesmo com mais de um registro na planilha de Turnover.',
      REGRA_META_PROPORCIONAL,
      'O filtro de período não muda este card.',
    ],
    fonte: 'Planilha de Turnover do RH (SharePoint): nome, cargo, área, admissão e desligamento.',
    fonteTecnica: 'Supabase › eficiencia_treinamentos_anual (pessoas_ativas) sobre sp_turnover',
    detalhe: 'A lista com cada pessoa e a meta dela está nos cards abaixo (Visão Equipe).',
  }
}

/** Regras do card por pessoa no Desenvolvimento Equipe (Jurídico). */
export function regrasPessoaJuridico(recortePeriodo: boolean): string[] {
  return [
    recortePeriodo
      ? 'Com filtro de período entram só as presenças com data no período; a meta continua a do ano inteiro.'
      : 'Horas do ano inteiro.',
    REGRA_TRANSFERENCIA,
  ]
}

/** Card de uma pessoa (Visão Equipe) — Jurídico e Operações Legais. */
export type TreinamentoPessoaCardFenix = {
  tela: string
  ano: number
  /** Período das horas, quando conhecido. */
  periodo?: string
  /** Nome como aparece no card. */
  colaborador: string
  minutos: number
  /** Meta usada pelo card (null = card sem meta). */
  metaMinutos: number | null
  admissao?: string | null
  /** Rótulo fixo no lugar do % (ex.: "Total", "Equipe"). */
  badge?: string | null
  itens: readonly TreinamentoItemFenix[]
  regras?: readonly string[]
  fonteTecnica?: string
}

export function explicarTreinamentoPessoa(i: TreinamentoPessoaCardFenix): FenixExplicacao {
  const temMeta = i.metaMinutos != null
  const meta = i.metaMinutos ?? 0
  const pctReal = temMeta ? (i.minutos / (meta || 1)) * 100 : null
  const atingiu = temMeta && i.minutos >= meta
  const faltam = temMeta ? Math.max(0, meta - i.minutos) : 0
  const valor = !temMeta
    ? horasMin(i.minutos)
    : atingiu
      ? 'Meta atingida'
      : i.badge
        ? `Faltam ${horasMin(faltam)}`
        : formatPercent(Math.min(100, pctReal ?? 0))

  const conta: FenixLinha[] = []
  const { linhas, soma, repetidos } = linhasItens(i.itens, horasMin)
  if (linhas.length > 0 && quaseIgual(soma, i.minutos, 0.5)) {
    conta.push(...linhas, total('Horas realizadas', horasMin(i.minutos), i.minutos, minutosTxt(i.minutos)))
  } else {
    conta.push(total('Horas realizadas', horasMin(i.minutos), i.minutos, minutosTxt(i.minutos)))
    if (linhas.length > 0) {
      conta.push(info('Treinamentos listados no card somam', horasMin(soma), soma, 'diferente do total da pessoa; vale conferir'))
    }
  }
  if (repetidos > 0) {
    conta.push(info(plural(repetidos, 'lançamento repetido', 'lançamentos repetidos'), 'conta uma vez', repetidos, 'aparece em vermelho no card'))
  }
  if (temMeta && pctReal != null) {
    conta.push(
      { rotulo: 'Meta individual do ano', valor: horasMin(meta), numero: meta, operador: '÷', detalhe: minutosTxt(meta) },
      total(
        '% da meta',
        formatPercent(pctReal),
        pctReal,
        atingiu ? '× 100 · passou de 100%: o card mostra "Meta"' : '× 100',
      ),
      ...linhaMetaPessoa({ colaborador: i.colaborador, minutos: i.minutos, metaMinutos: meta, admissao: i.admissao }, horasMin),
    )
    if (!atingiu) conta.push(info('Faltam para a meta', horasMin(faltam), faltam))
  }

  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(i.ano) },
    { rotulo: 'Pessoa', valor: i.colaborador },
  ]
  if (i.periodo) filtros.splice(1, 0, { rotulo: 'Período das horas', valor: i.periodo })

  return {
    tela: i.tela,
    titulo: `Treinamentos · ${i.colaborador}`,
    valor,
    resumo: temMeta
      ? `Horas de treinamento de ${i.colaborador} comparadas com a meta individual do ano.`
      : `Horas de treinamento de ${i.colaborador}. Este card não tem meta.`,
    formula: temMeta ? '% da meta = Horas realizadas ÷ Meta individual × 100' : 'Horas = soma da duração dos treinamentos',
    conta,
    filtros,
    regras: [
      ...(i.regras ?? []),
      REGRA_DEDUP,
      ...(temMeta ? [REGRA_META_PROPORCIONAL, 'A barra e o % do card param em 100%; acima disso aparece "Meta".'] : []),
    ],
    fonte: FONTE_TREINAMENTOS,
    fonteTecnica: i.fonteTecnica ?? 'sp_treinamentos_presenca · meta: eficiencia_treinamentos_por_pessoa',
    detalhe: 'Clique no card (com o Fênix fechado) para abrir a lista de treinamentos da pessoa.',
  }
}

// ---------------------------------------------------------------------------
// Operações Legais › Desenvolvimento Contínuo (categorias Equipe / Liderança / Gerente)
// ---------------------------------------------------------------------------

export type OpsTreinamentoCategoriaFenix = {
  ano: number
  categoria: OpsTreinamentoCategoria
  /** Visão "Pessoas": o card mostra % de pessoas que bateram a meta individual. */
  visaoPessoas: boolean
  qtdPessoas: number
  minutos: number
  metaMinutos: number | null
  pctAtingimento: number | null
  pctProjetado: number | null
  /** O card mostra a linha "Projeção c/ agendados". */
  mostraProjecao: boolean
  qtdMetaAtingida: number
  pctPessoasMeta: number | null
  /** Pessoas da categoria, com minutos e meta individual. */
  pessoas: readonly { colaborador: string; minutos: number; metaMinutos: number | null; admissao?: string | null }[]
  /** Treinamentos já agendados (data futura) no período. */
  sessoesFuturas: readonly { duracao_minutos: number | null }[]
}

export const REGRAS_OPS_TREINAMENTOS_POPULACAO: readonly string[] = [
  'Entra quem está ativo no ano na área Operações Legais na planilha de Turnover (uma pessoa por nome, com o registro mais recente).',
  `Categoria pelo cargo: Gerente = ${listaComE([...OPS_TREINAMENTO_CARGOS_GERENTE])} (ou cargo com "Sócio"); Liderança = ${listaComE([...OPS_TREINAMENTO_CARGOS_LIDERANCA])} (ou cargo com "Coordenador" ou "Supervisor"); os demais são Equipe.`,
  'Horas: todos os treinamentos da pessoa (não só os de Liderança), pelas presenças com data no período do filtro da página.',
]

const REGRA_OPS_META =
  'Meta individual: 14h no ano, proporcional à admissão registrada na planilha de Turnover (14h × meses ÷ 12; admissão depois do dia 15 conta a partir do mês seguinte). A meta é sempre a do ano inteiro, mesmo com filtro de meses.'

export function explicarOpsTreinamentoCategoria(c: OpsTreinamentoCategoriaFenix): FenixExplicacao {
  const gerente = c.categoria === 'Gerente'
  const tituloCat = gerente ? 'Gerente' : `${c.categoria} (${plural(c.qtdPessoas, 'pessoa', 'pessoas')})`
  const conta: FenixLinha[] = []
  let valor: string
  let titulo: string
  let resumo: string
  let formula: string
  const regras: string[] = [...REGRAS_OPS_TREINAMENTOS_POPULACAO, REGRA_DEDUP]

  if (gerente) {
    valor = horasMin(c.minutos)
    titulo = `Total de horas realizadas · ${tituloCat}`
    resumo = 'Soma das horas de treinamento dos gerentes de Operações Legais no período. A categoria não tem meta.'
    formula = 'Total = soma das horas de cada gerente'
    const { linhas, semHoras } = linhasHorasPorPessoa(c.pessoas, horasMin)
    conta.push(...linhas, total('Total de horas realizadas', valor, c.minutos, `${Math.round(c.minutos)} minutos no total`))
    if (semHoras > 0) conta.push(info(`${plural(semHoras, 'gerente', 'gerentes')} sem horas no período`, horasMin(0), 0))
    regras.push('Gerente não tem meta de horas; o card mostra só o total.')
  } else if (c.visaoPessoas) {
    const pct = c.pctPessoasMeta
    valor = pct != null ? formatPercent(pct) : '—'
    titulo = `% concluíram a meta individual · ${tituloCat}`
    resumo = `Quantas pessoas da categoria ${c.categoria} já bateram a meta individual de horas do ano.`
    formula = '% = Pessoas que bateram a meta ÷ Pessoas na categoria × 100'
    if (pct != null) {
      conta.push(
        { rotulo: 'Pessoas que bateram a meta individual', valor: String(c.qtdMetaAtingida), numero: c.qtdMetaAtingida },
        { rotulo: 'Pessoas na categoria', valor: String(c.qtdPessoas), numero: c.qtdPessoas, operador: '÷' },
        total('Concluíram a meta', valor, pct, '× 100'),
      )
    }
    if (c.pctAtingimento != null) {
      conta.push(info('Horas ÷ meta total da categoria', formatPercent(c.pctAtingimento), c.pctAtingimento, `${horasMin(c.minutos)} de ${horasMin(c.metaMinutos ?? 0)}`))
    }
    regras.push(REGRA_OPS_META, 'Bater a meta = horas da pessoa maiores ou iguais à meta individual dela.')
  } else {
    const pct = c.pctAtingimento
    valor = pct != null ? formatPercent(pct) : '—'
    titulo = `Meta proporcional à admissão · ${tituloCat}`
    resumo = `Quanto da meta de horas de treinamento da categoria ${c.categoria} foi cumprido no período.`
    formula = '% = Horas realizadas ÷ Meta da categoria × 100'
    if (pct != null && c.metaMinutos != null) {
      conta.push(
        { rotulo: 'Horas realizadas', valor: horasMin(c.minutos), numero: c.minutos, detalhe: minutosTxt(c.minutos) },
        { rotulo: 'Meta da categoria', valor: horasMin(c.metaMinutos), numero: c.metaMinutos, operador: '÷', detalhe: 'soma das metas individuais' },
        total('Atingimento', valor, pct, '× 100'),
        ...linhasComposicaoMeta(c.pessoas, c.metaMinutos, horasMin),
      )
      if (c.mostraProjecao && c.pctProjetado != null) {
        const minutosAgendados = c.sessoesFuturas.reduce((s, x) => s + Math.max(0, Number(x.duracao_minutos ?? 0)), 0)
        conta.push(
          info(
            'Projeção c/ agendados',
            formatPercent(c.pctProjetado),
            c.pctProjetado,
            `(horas + ${plural(c.sessoesFuturas.length, 'treinamento agendado', 'treinamentos agendados')} de ${horasMin(minutosAgendados)} × ${plural(c.qtdPessoas, 'pessoa', 'pessoas')}) ÷ meta`,
          ),
        )
      }
    }
    regras.push(
      REGRA_OPS_META,
      'Meta da categoria = soma das metas individuais. No card, "Meta: Xh" aparece arredondada para horas inteiras.',
    )
    if (c.mostraProjecao) {
      regras.push('A projeção supõe que todos da categoria participem de todos os treinamentos já agendados no período.')
    }
  }

  return {
    tela: TELA_EFICIENCIA_PESSOAS.opsTreinamentos,
    titulo,
    valor,
    resumo,
    formula,
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(c.ano) },
      { rotulo: 'Área', valor: 'Operações Legais' },
      { rotulo: 'Categoria', valor: c.categoria },
      ...(gerente ? [] : [{ rotulo: 'Visão', valor: c.visaoPessoas ? 'Pessoas' : 'Equipe' }]),
    ],
    regras,
    fonte: FONTE_TREINAMENTOS,
    fonteTecnica:
      'buildOpsTreinamentosCategorias (eficiencia/utils/opsTreinamentosCategorias.ts) · sp_treinamentos_presenca · sp_turnover (fetchTurnoverAtivosAreaDetalhe)',
    detalhe: 'Clique na categoria (com o Fênix fechado) para ver as pessoas dela logo abaixo.',
  }
}

// ---------------------------------------------------------------------------
// Retenção de Talentos (Turnover)
// ---------------------------------------------------------------------------

export type RetencaoFenixCtx = {
  ano: number
  area: string | null
  funcionariosAtivos: number | null
  saidasVoluntarias: number | null
  pctRetencao: number | null
  metaMinima: number | null
  /** Desligamentos do ano já filtrados pela área (sem filtro de pessoa). */
  desligamentos: readonly { tipo_desligamento: string | null }[]
  /** Nomes na lista "Colaboradores ativos" abaixo dos cards (sem filtro de pessoa). */
  qtdListaAtivos?: number | null
  hoje?: Date
}

const TIPO_VOLUNTARIO = 'Voluntário'

function contarPorTipo(desligamentos: RetencaoFenixCtx['desligamentos']): { tipo: string; qtd: number }[] {
  const map = new Map<string, number>()
  for (const d of desligamentos) {
    const tipo = d.tipo_desligamento?.trim() || 'Sem tipo'
    map.set(tipo, (map.get(tipo) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([tipo, qtd]) => ({ tipo, qtd }))
    .sort((a, b) => Number(b.tipo === TIPO_VOLUNTARIO) - Number(a.tipo === TIPO_VOLUNTARIO) || b.qtd - a.qtd)
}

function filtrosRetencao(c: RetencaoFenixCtx): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Área', valor: c.area ?? 'Todas' },
  ]
}

function regrasRetencao(c: RetencaoFenixCtx): string[] {
  const anoCorrente = c.ano === (c.hoje ?? new Date()).getFullYear()
  return [
    `Funcionários ativos: registros da planilha de Turnover com admissão até ${c.ano} e sem desligamento até 31/12/${c.ano}${anoCorrente ? ' (no ano corrente, quem está ativo hoje)' : ''}.`,
    `Saídas voluntárias: desligamentos em ${c.ano} com tipo "${TIPO_VOLUNTARIO}". Involuntário, Transferência e os demais tipos não contam.`,
    'Quem saiu no ano não está nos ativos: a conta compara as saídas voluntárias com quem ficou até o fim do ano.',
    c.area ? `Só registros da área ${c.area}.` : 'Sem filtro de área entram todas as áreas da planilha, inclusive Tributário.',
    'Indicador anual: os filtros de mês e de pessoa não mudam estes cards.',
  ]
}

const FONTE_TURNOVER = 'Planilha de Turnover do RH (SharePoint): admissão, desligamento, tipo de desligamento e área de cada registro.'

export function explicarRetencao(c: RetencaoFenixCtx): FenixExplicacao {
  const pct = c.pctRetencao
  const valor = pct != null ? formatPercent(pct) : '—'
  const conta: FenixLinha[] = []
  if (pct != null && c.saidasVoluntarias != null && c.funcionariosAtivos != null) {
    const taxa = 100 - pct
    conta.push(
      { rotulo: 'Ponto de partida', valor: formatPercent(100), numero: 100 },
      {
        rotulo: 'Taxa de saída voluntária',
        valor: formatPercent(taxa),
        numero: taxa,
        operador: '−',
        detalhe: `${plural(c.saidasVoluntarias, 'saída voluntária', 'saídas voluntárias')} ÷ ${c.funcionariosAtivos} funcionários ativos × 100`,
      },
      total('Retenção', valor, pct),
    )
    if (c.metaMinima != null) {
      conta.push(info('Meta', `mín. ${formatPercent(c.metaMinima)}`, c.metaMinima, pct >= c.metaMinima ? 'atingida' : 'abaixo da meta'))
    }
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.retencao,
    titulo: 'Retenção de talentos',
    valor,
    resumo: `Quanto da equipe${c.area ? ` de ${c.area}` : ''} o escritório reteve em ${c.ano}: 100% menos a taxa de saídas voluntárias.`,
    formula: 'Retenção = 100% − Saídas voluntárias ÷ Funcionários ativos × 100',
    conta,
    filtros: filtrosRetencao(c),
    regras: [...regrasRetencao(c), `Meta: no mínimo ${formatPercent(c.metaMinima ?? 90)}.`],
    fonte: FONTE_TURNOVER,
    fonteTecnica: 'Supabase › eficiencia_turnover_anual (pct_retencao) sobre sp_turnover',
    detalhe: 'Os desligamentos do ano estão na tabela abaixo dos cards. Para a base pessoa a pessoa, feche o Fênix e clique em Racional.',
  }
}

export function explicarFuncionariosAtivos(c: RetencaoFenixCtx): FenixExplicacao {
  const valor = c.funcionariosAtivos != null ? String(c.funcionariosAtivos) : '—'
  const conta: FenixLinha[] = []
  if (c.funcionariosAtivos != null) {
    conta.push(total('Funcionários ativos', valor, c.funcionariosAtivos, `admitidos até ${c.ano} e sem desligamento no ano`))
    if (c.desligamentos.length > 0) {
      conta.push(
        info(
          `Registros com desligamento em ${c.ano}`,
          String(c.desligamentos.length),
          c.desligamentos.length,
          'não contam como ativos (inclui transferências de área)',
        ),
      )
    }
    if (c.qtdListaAtivos != null && c.qtdListaAtivos !== c.funcionariosAtivos) {
      conta.push(
        info(
          'Nomes na lista "Colaboradores ativos"',
          String(c.qtdListaAtivos),
          c.qtdListaAtivos,
          'a lista mostra um nome por pessoa (inclusive sem data de admissão); o card conta cada registro com admissão até o ano',
        ),
      )
    }
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.retencao,
    titulo: 'Funcionários ativos',
    valor,
    resumo: `Quantos funcionários${c.area ? ` de ${c.area}` : ''} estavam ativos em ${c.ano}. É o divisor da Retenção de talentos.`,
    formula: 'Funcionários ativos = registros com admissão até o ano e sem desligamento no ano',
    conta,
    filtros: filtrosRetencao(c),
    regras: [...regrasRetencao(c), 'Conta cada registro ativo da planilha de Turnover.'],
    fonte: FONTE_TURNOVER,
    fonteTecnica: 'Supabase › eficiencia_turnover_anual (funcionarios_ativos = COUNT de sp_turnover)',
    detalhe: 'A lista "Colaboradores ativos", abaixo dos cards, mostra cada pessoa com o tempo de casa.',
  }
}

export function explicarSaidasVoluntarias(c: RetencaoFenixCtx): FenixExplicacao {
  const valor = c.saidasVoluntarias != null ? String(c.saidasVoluntarias) : '—'
  const conta: FenixLinha[] = []
  if (c.saidasVoluntarias != null) {
    const tipos = contarPorTipo(c.desligamentos)
    const voluntarios = tipos.find((t) => t.tipo === TIPO_VOLUNTARIO)?.qtd ?? 0
    conta.push(
      { rotulo: `Desligamentos "${TIPO_VOLUNTARIO}" em ${c.ano}`, valor: String(voluntarios), numero: voluntarios },
      total('Saídas voluntárias', valor, c.saidasVoluntarias),
    )
    for (const t of tipos.filter((x) => x.tipo !== TIPO_VOLUNTARIO)) {
      conta.push(info(t.tipo, String(t.qtd), t.qtd, 'não conta'))
    }
    if (voluntarios !== c.saidasVoluntarias) {
      conta.push(info('Diferença entre a tabela e o card', String(c.saidasVoluntarias - voluntarios), c.saidasVoluntarias - voluntarios, 'vale conferir o tipo de desligamento na planilha'))
    }
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.retencao,
    titulo: 'Saídas voluntárias no ano',
    valor,
    resumo: `Quantos funcionários${c.area ? ` de ${c.area}` : ''} pediram para sair em ${c.ano}. É o que reduz a Retenção de talentos.`,
    formula: `Saídas voluntárias = desligamentos no ano com tipo "${TIPO_VOLUNTARIO}"`,
    conta,
    filtros: filtrosRetencao(c),
    regras: regrasRetencao(c),
    fonte: FONTE_TURNOVER,
    fonteTecnica: 'Supabase › eficiencia_turnover_anual (saidas_voluntarias) · eficiencia_turnover_desligamentos',
    detalhe: 'A tabela "Desligamentos no ano", abaixo, lista cada desligamento com o tipo.',
  }
}

// ---------------------------------------------------------------------------
// Gestão de PDI
// ---------------------------------------------------------------------------

export type GestaoPdiFenixCtx = {
  tela: string
  ano: number
  area: string | null
  /** Rótulo dos meses do card (ex.: "Jun–Nov/2026"). */
  periodo: string
  /** Linhas mensais que o card soma (área já aplicada). */
  meses: readonly GestaoPdiMesRow[]
  pct: number | null
  aptas: number
  desvios: number
  /** Filtro de pessoa: aptas e desvios da pessoa (sem quebra mensal). */
  pessoa?: string | null
}

const PDI_MES_BASE = 6

function regrasPdi(c: GestaoPdiFenixCtx): string[] {
  return [
    'Cada linha é uma pessoa elegível em um mês, na aba Elegíveis da planilha de Gestão de PDI.',
    'Junho é a base do indicador: todos contam como aptos (100%).',
    'De julho em diante, apta = o progresso do PDI mudou em relação ao mês anterior, evidência de execução = "Sim" e pelo menos um 1:1 no mês.',
    'Só entra na conta quem tem evidência, 1:1, progresso e progresso do mês anterior preenchidos. Um desvio só conta quando o critério de apuração também está preenchido na aba de desvios.',
    ...(c.ano >= 2026 ? ['Uma colaboradora em licença-maternidade fica fora a partir de set/2026.'] : []),
    c.area ? `Só pessoas da área ${c.area}.` : 'Todas as áreas.',
  ]
}

const FONTE_PDI =
  'Planilha de Gestão de PDI (SharePoint): aba Elegíveis (progresso, evidências de execução e 1:1) e aba de desvios (critério de apuração).'

function filtrosPdi(c: GestaoPdiFenixCtx): FenixFiltro[] {
  const f: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Meses', valor: c.periodo },
    { rotulo: 'Área', valor: c.area ?? 'Todas' },
  ]
  if (c.pessoa) f.push({ rotulo: 'Pessoa', valor: c.pessoa })
  return f
}

function mesesPdiOrdenados(c: GestaoPdiFenixCtx): GestaoPdiMesRow[] {
  return [...c.meses].sort((a, b) => a.mes - b.mes)
}

function linhasPdiMensal(c: GestaoPdiFenixCtx, campo: 'aptas' | 'desvios'): FenixLinha[] {
  return mesesPdiOrdenados(c).map((m, i) => ({
    rotulo: mesAno(c.ano, m.mes),
    valor: campo === 'aptas' ? `${m.aptas} de ${m.elegiveis}` : String(m.desvios),
    numero: m[campo],
    operador: i === 0 ? undefined : '+',
    detalhe:
      m.mes === PDI_MES_BASE
        ? 'junho é a base: todos contam como aptos'
        : campo === 'aptas'
          ? m.pct_aptas != null
            ? `${formatPercent(m.pct_aptas)} no mês`
            : undefined
          : `de ${m.elegiveis} avaliações`,
  }))
}

function explicarPdiPercentual(c: GestaoPdiFenixCtx, gestaoVista: boolean): FenixExplicacao {
  const valor = c.pct != null ? formatPercent(c.pct) : '—'
  const conta: FenixLinha[] = []
  const pessoa = !gestaoVista && c.pessoa ? c.pessoa : null
  if (c.pct != null) {
    if (pessoa) {
      const totalAval = c.aptas + c.desvios
      conta.push(
        { rotulo: `Aptas de ${pessoa}`, valor: String(c.aptas), numero: c.aptas },
        { rotulo: 'Avaliações da pessoa (aptas + desvios)', valor: String(totalAval), numero: totalAval, operador: '÷' },
        total('Gestão de PDI', valor, c.pct, '× 100'),
      )
    } else {
      const meses = mesesPdiOrdenados(c)
      const aptas = meses.reduce((s, m) => s + m.aptas, 0)
      const elegiveis = meses.reduce((s, m) => s + m.elegiveis, 0)
      conta.push(
        ...linhasPdiMensal(c, 'aptas'),
        total('Aptas', String(aptas), aptas),
        { rotulo: 'Avaliações (aptas + desvios)', valor: String(elegiveis), numero: elegiveis, operador: '÷', detalhe: 'soma de cada mês' },
        total('Gestão de PDI', valor, c.pct, '× 100'),
      )
    }
  }
  return {
    tela: c.tela,
    titulo: gestaoVista ? 'Gestão de PDI Gestão a Vista' : 'Gestão de PDI no período selecionado',
    valor,
    resumo: pessoa
      ? `Em quantos meses ${pessoa} cumpriu os critérios do PDI (${c.periodo}).`
      : `Quanto das avaliações mensais de PDI ficou apta ${gestaoVista ? 'de junho até o mês atual' : `em ${c.periodo}`}.`,
    formula: 'Gestão de PDI = Aptas ÷ (Aptas + Desvios) × 100, somando os meses',
    conta,
    filtros: filtrosPdi({ ...c, pessoa }),
    regras: [
      ...regrasPdi(c),
      gestaoVista
        ? 'Gestão a Vista: sempre de junho até o mês atual (o mês atual entra com o que já foi lançado), sem olhar o filtro de meses nem o de pessoa.'
        : pessoa
          ? 'Com filtro de pessoa, conta só as avaliações dessa pessoa nos meses do filtro.'
          : 'Soma as aptas e as avaliações de todos os meses do filtro antes de dividir (não é média dos percentuais).',
      `Meta: ${EFICIENCIA_META_PDI}%.`,
    ],
    fonte: FONTE_PDI,
    fonteTecnica: pessoa
      ? 'Racional gestao_pdi da pessoa (eficiencia_gestao_pdi_detalhe) · acumularEvolucaoPorResponsavel'
      : 'Supabase › eficiencia_gestao_pdi_mensal (eficiencia_gestao_pdi_avaliacao) sobre sp_gestao_pdi_elegiveis e sp_gestao_pdi_desvios · acumuladoGestaoPdi',
    detalhe: 'A grade por pessoa mostra mês a mês quem ficou apta; a tabela "Desvios no período selecionado" lista cada desvio.',
  }
}

export function explicarGestaoPdiGestaoVista(c: GestaoPdiFenixCtx): FenixExplicacao {
  return explicarPdiPercentual(c, true)
}

export function explicarGestaoPdiPeriodo(c: GestaoPdiFenixCtx): FenixExplicacao {
  return explicarPdiPercentual(c, false)
}

function explicarPdiContagem(c: GestaoPdiFenixCtx, campo: 'aptas' | 'desvios'): FenixExplicacao {
  const n = campo === 'aptas' ? c.aptas : c.desvios
  const conta: FenixLinha[] = []
  if (c.pessoa) {
    conta.push(total(campo === 'aptas' ? `Aptas de ${c.pessoa}` : `Desvios de ${c.pessoa}`, String(n), n))
  } else {
    conta.push(...linhasPdiMensal(c, campo), total(campo === 'aptas' ? 'Aptas' : 'Desvios', String(n), n))
  }
  return {
    tela: c.tela,
    titulo: campo === 'aptas' ? 'Aptas' : 'Desvios',
    valor: String(n),
    resumo:
      campo === 'aptas'
        ? `Quantas avaliações mensais de PDI cumpriram os três critérios em ${c.periodo}${c.pessoa ? ` (${c.pessoa})` : ''}.`
        : `Quantas avaliações mensais de PDI tinham os critérios preenchidos e falharam em pelo menos um em ${c.periodo}${c.pessoa ? ` (${c.pessoa})` : ''}.`,
    formula:
      campo === 'aptas'
        ? 'Aptas = progresso mudou + evidência "Sim" + 1:1 no mês (junho: todos)'
        : 'Desvios = avaliações com critérios preenchidos − aptas',
    conta,
    filtros: filtrosPdi(c),
    regras: [
      ...regrasPdi(c),
      'Uma pessoa conta uma vez por mês: em 5 meses, aparece até 5 vezes.',
      ...(c.pessoa ? ['Com filtro de pessoa, conta só as avaliações dessa pessoa.'] : []),
    ],
    fonte: FONTE_PDI,
    fonteTecnica: 'Supabase › eficiencia_gestao_pdi_mensal (aptas, desvios) sobre sp_gestao_pdi_elegiveis',
    detalhe:
      campo === 'desvios'
        ? 'A tabela "Desvios no período selecionado" lista cada desvio com o critério; o botão Excel baixa a lista.'
        : 'A grade por pessoa mostra mês a mês quem ficou apta.',
  }
}

export function explicarGestaoPdiAptas(c: GestaoPdiFenixCtx): FenixExplicacao {
  return explicarPdiContagem(c, 'aptas')
}

export function explicarGestaoPdiDesvios(c: GestaoPdiFenixCtx): FenixExplicacao {
  return explicarPdiContagem(c, 'desvios')
}

// ---------------------------------------------------------------------------
// NPS
// ---------------------------------------------------------------------------

export type NpsFenixCtx = { ano: number; kpi: NpsKpi | null }

const FONTE_NPS = 'Pesquisa de NPS de clientes no OrqestrAI (Meus Clientes).'
const FONTE_NPS_TEC = 'Edge function nps-orquestrai › nps_campaigns e nps_responses (OrqestrAI)'

function campanhaNps(c: NpsFenixCtx): string {
  return c.kpi?.campaignName?.trim() || `NPS ${c.ano}`
}

function regrasNps(c: NpsFenixCtx): string[] {
  return [
    `Pesquisa ${campanhaNps(c)}: avaliação única no ano. Vale a campanha com o ano no nome ou que começa no ano; havendo mais de uma, a ativa. Entram todas as respostas dela.`,
    'Cada cliente dá uma nota de 0 a 10 para "recomendaria o escritório?": 9 e 10 = promotor, 7 e 8 = neutro, 0 a 6 = detrator.',
    'Os filtros de mês, área e pessoa não mudam o NPS.',
  ]
}

function filtrosNps(c: NpsFenixCtx): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Campanha', valor: campanhaNps(c) },
  ]
}

function npsSemDados(c: NpsFenixCtx): string | null {
  if (c.kpi?.unavailable) return 'A fonte do OrqestrAI estava indisponível quando a tela carregou.'
  if (!c.kpi || c.kpi.total <= 0) return `Ainda não há respostas na campanha de ${c.ano}.`
  return null
}

export function explicarNps(c: NpsFenixCtx): FenixExplicacao {
  const k = c.kpi
  const nps = k?.nps ?? null
  const valor = nps == null ? '—' : formatPercent(nps)
  const conta: FenixLinha[] = []
  if (k && k.total > 0 && nps != null) {
    const pPro = (k.promoters / k.total) * 100
    const pDet = (k.detractors / k.total) * 100
    const bruto = ((k.promoters - k.detractors) / k.total) * 100
    conta.push(
      { rotulo: 'Promotores (notas 9 e 10)', valor: String(k.promoters), numero: k.promoters },
      { rotulo: 'Neutros (notas 7 e 8)', valor: String(k.passives), numero: k.passives, operador: '+' },
      { rotulo: 'Detratores (notas 0 a 6)', valor: String(k.detractors), numero: k.detractors, operador: '+' },
      total('Respostas', String(k.total), k.total),
      { rotulo: '% de promotores', valor: formatPercent(pPro), numero: pPro, detalhe: `${k.promoters} ÷ ${k.total} × 100` },
      { rotulo: '% de detratores', valor: formatPercent(pDet), numero: pDet, operador: '−', detalhe: `${k.detractors} ÷ ${k.total} × 100` },
      total(
        'NPS',
        valor,
        nps,
        quaseIgual(bruto, nps, 1e-9) ? undefined : `(${k.promoters} − ${k.detractors}) ÷ ${k.total} × 100 = ${pct2(bruto)}, arredondado para ${nps}`,
      ),
    )
    const zona = npsZona(nps)
    if (zona) conta.push(info('Faixa', zona, nps))
  } else {
    const motivo = npsSemDados(c)
    if (motivo) conta.push(info('Sem NPS', '—', undefined, motivo))
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.nps,
    titulo: 'NPS',
    valor,
    resumo: 'Net Promoter Score dos clientes: quanto os promotores superam os detratores na pesquisa do ano.',
    formula: 'NPS = % de promotores − % de detratores (arredondado para número inteiro)',
    conta,
    filtros: filtrosNps(c),
    regras: [
      ...regrasNps(c),
      'Neutros contam no total de respostas, mas não somam nem subtraem.',
      'O NPS vai de −100 a 100. O card mostra o número com o símbolo de % (ex.: 72 aparece como 72,00%).',
      'Faixas: 75 ou mais = Zona de Excelência; 50 a 74 = Zona de Qualidade; 0 a 49 = Zona de Aperfeiçoamento; abaixo de 0 = Zona Crítica.',
      `Meta: ${EFICIENCIA_META_NPS}.`,
    ],
    fonte: FONTE_NPS,
    fonteTecnica: FONTE_NPS_TEC,
  }
}

export type NpsGrupo = 'promotores' | 'neutros' | 'detratores'

const NPS_GRUPOS: Record<NpsGrupo, { titulo: string; faixa: string; campo: 'promoters' | 'passives' | 'detractors'; efeito: string }> = {
  promotores: { titulo: 'Promotores (9–10)', faixa: 'notas 9 e 10', campo: 'promoters', efeito: 'Somam no NPS.' },
  neutros: { titulo: 'Neutros (7–8)', faixa: 'notas 7 e 8', campo: 'passives', efeito: 'Contam no total de respostas, mas não somam nem subtraem no NPS.' },
  detratores: { titulo: 'Detratores (0–6)', faixa: 'notas de 0 a 6', campo: 'detractors', efeito: 'Subtraem do NPS.' },
}

export function explicarNpsGrupo(c: NpsFenixCtx, grupo: NpsGrupo): FenixExplicacao {
  const g = NPS_GRUPOS[grupo]
  const n = c.kpi?.[g.campo] ?? 0
  const totalResp = c.kpi?.total ?? 0
  const conta: FenixLinha[] = [total(g.titulo, String(n), n, `respostas com ${g.faixa}`)]
  if (totalResp > 0) {
    const share = (n / totalResp) * 100
    conta.push(info('Participação nas respostas', formatPercent(share), share, `${n} de ${totalResp}`))
  } else {
    const motivo = npsSemDados(c)
    if (motivo) conta.push(info('Sem respostas', '—', undefined, motivo))
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.nps,
    titulo: g.titulo,
    valor: String(n),
    resumo: `Quantos clientes deram ${g.faixa} para "recomendaria o escritório?" na pesquisa de ${c.ano}.`,
    formula: `${g.titulo.split(' ')[0]} = respostas com ${g.faixa}`,
    conta,
    filtros: filtrosNps(c),
    regras: [...regrasNps(c), g.efeito],
    fonte: FONTE_NPS,
    fonteTecnica: FONTE_NPS_TEC,
  }
}

export type NpsDimensao = 'availability' | 'communication' | 'innovation' | 'technical'

const NPS_DIMENSOES: Record<NpsDimensao, string> = {
  availability: 'Disponibilidade',
  communication: 'Comunicação',
  innovation: 'Inovação',
  technical: 'Competência técnica',
}

export function explicarNpsDimensao(c: NpsFenixCtx, dim: NpsDimensao): FenixExplicacao {
  const titulo = NPS_DIMENSOES[dim]
  const media = c.kpi?.dimensions?.[dim] ?? null
  const valor = media == null || !Number.isFinite(media) ? '—' : nota10(media)
  const conta: FenixLinha[] = []
  const totalResp = c.kpi?.total ?? 0
  if (media != null && totalResp > 0) {
    conta.push(
      info('Respostas com nota para esta pergunta', String(totalResp), totalResp, 'cada resposta dá uma nota de 0 a 10'),
      total('Média das notas', valor, media, 'soma das notas ÷ respostas, com uma casa decimal'),
    )
  } else {
    const motivo = npsSemDados(c)
    if (motivo) conta.push(info('Sem média', '—', undefined, motivo))
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.nps,
    titulo,
    valor,
    resumo: `Nota média que os clientes deram para ${titulo.toLocaleLowerCase('pt-BR')} na pesquisa de ${c.ano}, de 0 a 10.`,
    formula: `${titulo} = soma das notas ÷ número de respostas`,
    conta,
    filtros: filtrosNps(c),
    regras: [
      `Pesquisa ${campanhaNps(c)}: entram todas as respostas da campanha do ano.`,
      'Média simples das notas desta pergunta, arredondada para uma casa decimal. Não entra no cálculo do NPS.',
    ],
    fonte: FONTE_NPS,
    fonteTecnica: FONTE_NPS_TEC,
  }
}

// ---------------------------------------------------------------------------
// Receita Bruta
// ---------------------------------------------------------------------------

export type ReceitaBrutaModo = 'mes' | 'meses' | 'ano'

/**
 * Mesmo desvio de `buildOverviewReceitaBruta`: um mês → % do mês; vários meses ou
 * Resultado → recebido ÷ meta dos meses (jun+); demais filtros → recebido ÷ meta do ano.
 */
export function modoReceitaBruta(
  filtro: MesFiltroEficiencia,
  ano: number,
  meses: readonly { mes: number }[],
): { modo: ReceitaBrutaModo; meses: number[] } {
  if (isMesesFiltro(filtro) && filtro.length === 1) return { modo: 'mes', meses: [filtro[0]] }
  if ((isMesesFiltro(filtro) && filtro.length > 1) || filtro === 'resultado') {
    return {
      modo: 'meses',
      meses: meses.filter((m) => m.mes >= MES_INICIO_RESULTADO && mesNoFiltro(m.mes, filtro, ano)).map((m) => m.mes),
    }
  }
  return { modo: 'ano', meses: [] }
}

export type ReceitaBrutaFenixCtx = {
  ano: number
  escopo: 'gestao_vista' | 'periodo'
  /** Valor exibido no card (%). */
  pct: number | null
  /** Recebido e meta da conta do card (receitaBrutaMonetarioAcumulado). */
  recebido: number | null
  meta: number | null
  modo: ReceitaBrutaModo
  /** Meses da conta nos modos "mes" e "meses". */
  mesesConta: readonly number[]
  meses: readonly GestaoVistaMesRow[]
  rows: readonly ReceitaMesRow[]
  /** Rótulo do filtro do topo (ex.: "Ano inteiro (2026)"). */
  periodo: string
  hoje?: Date
}

const REGRA_RECEBIDO =
  'Recebido: honorários da cota que entraram no caixa, pela data de pagamento e sem encargos — o mesmo do card Recebido da Receita.'
const REGRA_META_AJUSTADA =
  'A meta de cada mês é a meta ajustada da Receita: a meta original mais a parte do que faltou nos meses já fechados, dividida entre os meses seguintes.'
const FONTE_RECEITA = 'Financeiro do VIOS (títulos a receber) e Configurações da Receita (meta mensal e meses com meta).'

function detalheMesAndamento(ano: number, mes: number, hoje: Date): string | undefined {
  return isMesAtual(ano, mes, hoje) ? 'mês em andamento: pago até hoje' : undefined
}

export function explicarReceitaBrutaPct(c: ReceitaBrutaFenixCtx): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const valor = c.pct != null ? formatPercent(c.pct) : '—'
  const conta: FenixLinha[] = []
  const regras: string[] = [REGRA_RECEBIDO, `Só conta de junho em diante (início do Resultado ${c.ano}).`]
  let formula: string
  let periodoConta: string

  if (c.modo === 'ano') {
    const recebidos = c.rows
      .filter((r) => r.metaBase > 0 && r.mes >= MES_INICIO_RESULTADO && !isMesFuturo(c.ano, r.mes, hoje))
      .sort((a, b) => a.mes - b.mes)
    const comMeta = c.rows.filter((r) => r.metaBase > 0).sort((a, b) => a.mes - b.mes)
    const periodoMeta = periodoMeses(c.ano, comMeta.map((r) => r.mes))
    periodoConta = periodoMeses(c.ano, recebidos.map((r) => r.mes))
    formula = 'Receita Bruta = Recebido de junho até hoje ÷ Meta do ano × 100'
    if (c.pct != null && c.recebido != null && c.meta != null) {
      conta.push(
        ...recebidos.map((r, i) => ({
          rotulo: mesAno(c.ano, r.mes),
          valor: moeda(r.recebido),
          numero: r.recebido,
          operador: i === 0 ? undefined : ('+' as const),
          detalhe: detalheMesAndamento(c.ano, r.mes, hoje),
        })),
        total('Recebido', moeda(c.recebido), c.recebido),
      )
      const bases = new Set(comMeta.map((r) => Math.round(r.metaBase * 100)))
      conta.push(
        {
          rotulo: `Meta do ano (${periodoMeta})`,
          valor: moeda(c.meta),
          numero: c.meta,
          operador: '÷',
          detalhe:
            bases.size === 1 && comMeta.length > 0
              ? `${moeda(comMeta[0].metaBase)} × ${plural(comMeta.length, 'mês', 'meses')} (meta original)`
              : 'soma da meta original de cada mês com meta',
        },
        total('Receita Bruta', valor, c.pct, '× 100'),
      )
      const somaRec = recebidos.reduce((s, r) => s + r.recebido, 0)
      if (!quaseIgual(somaRec, c.recebido, 0.01)) {
        conta.push(info('Soma dos meses listados', moeda(somaRec), somaRec, 'diferente do recebido da conta; vale conferir'))
      }
    }
    regras.push(
      `O divisor é a meta do ano inteiro (${periodoMeta}), com a meta original de cada mês — como no card Atingimento da meta da Receita. Por isso o percentual cresce ao longo do ano.`,
      'O mês em andamento entra com o que foi pago até hoje.',
    )
    if (c.escopo === 'periodo' && !c.periodo.startsWith('Ano inteiro')) {
      regras.push(`Com o filtro "${c.periodo}" este card usa a conta do ano (o recorte só vale para um mês, vários meses ou Resultado).`)
    }
  } else {
    const linhas = [...c.meses].filter((m) => c.mesesConta.includes(m.mes)).sort((a, b) => a.mes - b.mes)
    periodoConta = periodoMeses(c.ano, c.mesesConta)
    formula =
      c.modo === 'mes'
        ? 'Receita Bruta = Recebido do mês ÷ Meta ajustada do mês × 100'
        : 'Receita Bruta = Recebido dos meses ÷ Soma da meta ajustada dos meses × 100'
    if (c.pct != null && c.recebido != null && c.meta != null) {
      if (c.modo === 'mes') {
        const m = linhas[0]
        conta.push(
          {
            rotulo: `Recebido em ${mesAno(c.ano, m?.mes ?? c.mesesConta[0])}`,
            valor: moeda(c.recebido),
            numero: c.recebido,
            detalhe: m ? detalheMesAndamento(c.ano, m.mes, hoje) : undefined,
          },
          { rotulo: 'Meta ajustada do mês', valor: moeda(c.meta), numero: c.meta, operador: '÷' },
          total('Receita Bruta', valor, c.pct, '× 100'),
        )
        const base = c.rows.find((r) => r.mes === m?.mes)?.metaBase
        if (base != null && base > 0 && !quaseIgual(base, c.meta, 0.01)) {
          conta.push(info('Meta original do mês', moeda(base), base, `${moeda(c.meta - base)} do que faltou antes`))
        }
      } else {
        conta.push(
          ...linhas.map((m, i) => ({
            rotulo: mesAno(c.ano, m.mes),
            valor: moeda(m.recebido ?? 0),
            numero: m.recebido ?? 0,
            operador: i === 0 ? undefined : ('+' as const),
            detalhe: [
              `meta ${moeda(m.meta ?? 0)}${m.pctMeta != null ? ` · ${formatPercent(m.pctMeta)}` : ''}`,
              detalheMesAndamento(c.ano, m.mes, hoje),
            ]
              .filter(Boolean)
              .join(' · '),
          })),
          total('Recebido', moeda(c.recebido), c.recebido),
          { rotulo: `Meta ajustada de ${periodoConta}`, valor: moeda(c.meta), numero: c.meta, operador: '÷', detalhe: 'soma da meta de cada mês' },
          total('Receita Bruta', valor, c.pct, '× 100'),
        )
      }
    }
    regras.push(REGRA_META_AJUSTADA)
    if (c.modo === 'meses') {
      regras.push('Soma o recebido e a meta de todos os meses antes de dividir (não é média dos percentuais).')
    }
    if (c.escopo === 'gestao_vista') {
      regras.push('Gestão a Vista: sempre de junho até o mês atual, sem olhar o filtro de meses. O mês atual entra com o que foi pago até hoje e com a meta do mês inteiro.')
    } else if (c.mesesConta.some((m) => isMesAtual(c.ano, m, hoje))) {
      regras.push('O mês em andamento entra com o que foi pago até hoje e com a meta do mês inteiro.')
    }
  }
  regras.push('Meta do indicador: 100%.')

  return {
    tela: TELA_EFICIENCIA_PESSOAS.receitaBruta,
    titulo: c.escopo === 'gestao_vista' ? 'Receita Bruta Gestão a Vista' : 'Receita Bruta no período selecionado',
    valor,
    resumo:
      c.modo === 'ano'
        ? `Quanto da meta de receita do ano já entrou no caixa (recebido de ${periodoConta}).`
        : `Quanto da meta de receita de ${periodoConta} entrou no caixa.`,
    formula,
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(c.ano) },
      { rotulo: c.escopo === 'gestao_vista' ? 'Meses (fixo)' : 'Filtro', valor: c.escopo === 'gestao_vista' ? periodoConta : c.periodo },
      { rotulo: 'Clientes', valor: 'ativos e inativos' },
    ],
    regras,
    fonte: FONTE_RECEITA,
    fonteTecnica:
      c.modo === 'ano'
        ? 'buildOverviewReceitaBruta → calcularAtingimentoMetaKpi · receita_totais_mensais · app_settings.receita_metas'
        : 'buildOverviewReceitaBruta (eficiencia/utils/overviewFinanceiroKpis.ts) · buildGestaoVistaConsolidado · receita_totais_mensais',
    detalhe: 'Para ver título a título, feche o Fênix e clique em Racional (no gráfico) ou abra o card Recebido na Receita.',
  }
}

export function explicarReceitaBrutaRecebido(c: {
  ano: number
  /** Meses que o card soma (jun+ dentro do filtro). */
  meses: readonly GestaoVistaMesRow[]
  /** Valor somado pelo card. */
  total: number
  periodo: string
  hoje?: Date
}): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const linhas = [...c.meses].filter((m) => (m.recebido ?? 0) !== 0).sort((a, b) => a.mes - b.mes)
  const conta: FenixLinha[] = [
    ...linhas.map((m, i) => ({
      rotulo: mesAno(c.ano, m.mes),
      valor: moeda(m.recebido ?? 0),
      numero: m.recebido ?? 0,
      operador: i === 0 ? undefined : ('+' as const),
      detalhe: detalheMesAndamento(c.ano, m.mes, hoje),
    })),
    total('Recebido no período', moeda(c.total), c.total),
  ]
  if (Math.round(c.total) !== c.total) {
    conta.push(info('No card', moedaSemCentavos(c.total), c.total, 'o card mostra o valor sem centavos'))
  }
  const mesesSemValor = c.meses.filter((m) => (m.recebido ?? 0) === 0).map((m) => m.mes)
  return {
    tela: TELA_EFICIENCIA_PESSOAS.receitaBruta,
    titulo: 'Recebido acumulado (período selecionado)',
    valor: moedaSemCentavos(c.total),
    resumo: `Honorários que entraram no caixa nos meses do filtro (${c.periodo}), de junho em diante.`,
    formula: 'Recebido acumulado = soma do recebido de cada mês do filtro (junho em diante)',
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(c.ano) },
      { rotulo: 'Filtro', valor: c.periodo },
      { rotulo: 'Meses somados', valor: periodoMeses(c.ano, c.meses.map((m) => m.mes)) },
    ],
    regras: [
      REGRA_RECEBIDO,
      'Só entram os meses de junho em diante que estão no filtro de meses.',
      'Meses que ainda não começaram entram com zero. O mês em andamento entra com o que foi pago até hoje.',
      ...(mesesSemValor.length > 0 ? [`Sem recebido: ${periodoMeses(c.ano, mesesSemValor)}.`] : []),
    ],
    fonte: FONTE_RECEITA,
    fonteTecnica: 'buildGestaoVistaConsolidado (receita/utils/receitaGestaoVista.ts) · receita_totais_mensais',
    detalhe: 'Para ver título a título, abra o card Recebido no painel da Receita.',
  }
}

// ---------------------------------------------------------------------------
// Índice de Inadimplência
// ---------------------------------------------------------------------------

export type InadimplenciaFenixCtx = {
  ano: number
  escopo: 'gestao_vista' | 'periodo'
  /** Meses consultados (jun+ dentro do filtro, até o mês atual). */
  meses: readonly number[]
  aoVivo: { valor: number; previsto: number; pct: number } | null | undefined
  /** Rótulo do filtro do topo. */
  periodo: string
}

const FONTE_INAD = 'Financeiro do VIOS (títulos a receber da cota), consultado na hora — o mesmo saldo da tela de Inadimplência da Receita.'

function regrasInadimplencia(c: InadimplenciaFenixCtx): string[] {
  const blocos = blocosContiguos(c.meses)
  return [
    'Saldo em aberto: para cada grupo de clientes, o valor dos títulos com vencimento nos meses do período (até ontem) menos os pagamentos — os recebidos no período e os desses títulos feitos antes ou depois (baixa posterior). Grupo com saldo negativo conta zero.',
    'Desconto concedido em título quitado não conta como inadimplência.',
    'Previsto: soma dos títulos da cota com vencimento nos meses do período (mês inteiro), clientes ativos e inativos.',
    'Só conta de junho em diante, até o mês atual. No mês em andamento o previsto é o mês inteiro e o saldo só tem o que venceu até ontem.',
    ...(blocos.length > 1
      ? [`Meses não seguidos: o saldo e o previsto são calculados em cada bloco (${blocos.map((b) => periodoMeses(c.ano, b)).join('; ')}) e somados.`]
      : []),
    'É o saldo de hoje, não a foto congelada no fechamento de cada mês (essa é a do gráfico).',
    c.escopo === 'gestao_vista'
      ? 'Gestão a Vista: sempre de junho até o mês atual, sem olhar o filtro de meses.'
      : 'Período: meses do filtro da página, de junho em diante.',
  ]
}

function filtrosInad(c: InadimplenciaFenixCtx): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: c.escopo === 'gestao_vista' ? 'Meses (fixo)' : 'Meses', valor: periodoMeses(c.ano, c.meses) },
    { rotulo: 'Clientes', valor: 'ativos e inativos' },
  ]
}

export function explicarInadimplenciaIndice(c: InadimplenciaFenixCtx): FenixExplicacao {
  const a = c.aoVivo
  const valor = a ? formatPercent(a.pct) : '—'
  const conta: FenixLinha[] = []
  if (a) {
    conta.push(
      { rotulo: 'Saldo em aberto (ao vivo)', valor: moeda(a.valor), numero: a.valor },
      { rotulo: 'Previsto do período', valor: moeda(a.previsto), numero: a.previsto, operador: '÷' },
      total('Índice de inadimplência', valor, a.pct, '× 100'),
      info('Meta', `máx. ${EFICIENCIA_META_INDICE_INADIMPLENCIA}%`, EFICIENCIA_META_INDICE_INADIMPLENCIA, a.pct <= EFICIENCIA_META_INDICE_INADIMPLENCIA ? 'dentro da meta' : 'acima da meta'),
    )
  } else if (c.meses.length === 0) {
    conta.push(info('Sem meses no período', '—', undefined, 'o índice só conta de junho até o mês atual'))
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.inadimplencia,
    titulo: c.escopo === 'gestao_vista' ? 'Índice de Inadimplência Gestão a Vista' : 'Índice de Inadimplência no período selecionado',
    valor,
    resumo: `Quanto do que venceu em ${periodoMeses(c.ano, c.meses)} ainda está em aberto, em relação ao previsto do período. Menor é melhor.`,
    formula: 'Índice = Saldo em aberto ÷ Previsto × 100',
    conta,
    filtros: filtrosInad(c),
    regras: [...regrasInadimplencia(c), `Meta: no máximo ${EFICIENCIA_META_INDICE_INADIMPLENCIA}% (menor é melhor).`],
    fonte: FONTE_INAD,
    fonteTecnica: 'Supabase › receita_inadimplencia_dashboard (valor_total_periodo, previsto) · consolidarInadimplenciaAoVivo',
    detalhe: 'Para ver cliente a cliente, feche o Fênix e clique em Racional (no gráfico) ou abra a Inadimplência na Receita.',
  }
}

export function explicarInadimplenciaSaldo(c: InadimplenciaFenixCtx): FenixExplicacao {
  const a = c.aoVivo
  const valor = a ? moedaSemCentavos(a.valor) : '—'
  const conta: FenixLinha[] = []
  if (a) {
    conta.push(total('Saldo em aberto', moeda(a.valor), a.valor, 'soma do saldo de cada grupo de clientes'))
    if (Math.round(a.valor) !== a.valor) {
      conta.push(info('No card', moedaSemCentavos(a.valor), a.valor, 'o card mostra o valor sem centavos'))
    }
    conta.push(info('Previsto do período', moeda(a.previsto), a.previsto, `saldo ÷ previsto = ${formatPercent(a.pct)} (card do índice)`))
  }
  return {
    tela: TELA_EFICIENCIA_PESSOAS.inadimplencia,
    titulo: 'Saldo inadimplência (período selecionado)',
    valor,
    resumo: `Quanto dos títulos que venceram em ${periodoMeses(c.ano, c.meses)} ainda não foi pago, consultado agora.`,
    formula: 'Saldo = Títulos vencidos no período − Pagamentos desses títulos, por grupo de clientes',
    conta,
    filtros: filtrosInad(c),
    regras: regrasInadimplencia(c),
    fonte: FONTE_INAD,
    fonteTecnica: 'Supabase › receita_inadimplencia_dashboard › receita_inadimplencia_grupos_periodo (com inativos, baixa posterior)',
    detalhe: 'Para ver cliente a cliente, abra a Inadimplência no painel da Receita.',
  }
}
