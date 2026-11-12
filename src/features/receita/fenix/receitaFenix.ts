/**
 * Fênix na Receita: memória de cálculo de cada número do Resumo e da Melhor estimativa.
 *
 * Funções puras. Recebem os mesmos valores que o card mostra (nada é recalculado
 * por outro caminho), então a explicação sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'
import {
  mesAbrev,
  PLANOS_CONTAS_INCLUIDOS_COTA,
  RECEITA_DEPARTAMENTO_LABELS,
  RECEITA_META_CONTRIBUICAO_AREA,
} from '../constants.ts'
import type { ReceitaMesRow } from '../types/receita.types.ts'
import type { ReceitaMeGapMeta, ReceitaMeMesAMes } from '../utils/receitaMeCalc.ts'
import { isMesAtual, isMesFechado, isMesFuturo } from '../utils/receitaMes.ts'

const moeda = formatCurrency

function pct1(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function pctBr(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function capMes(mes: number): string {
  const a = mesAbrev(mes)
  return `${a.charAt(0).toUpperCase()}${a.slice(1)}`
}

/** Ex.: "Out/26". */
export function rotuloMesAno(ano: number, mes: number): string {
  return `${capMes(mes)}/${String(ano).slice(-2)}`
}

/** Ex.: "Jun–Dez/2026" (mesmo formato dos cards do Resumo). */
export function periodoMeses(ano: number, meses: readonly number[]): string {
  const s = [...meses].sort((a, b) => a - b)
  if (s.length === 0) return String(ano)
  if (s.length === 1) return `${capMes(s[0])}/${ano}`
  return `${capMes(s[0])}–${capMes(s[s.length - 1])}/${ano}`
}

function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

/** Ex.: "mensais, spot, sucumbência, ... e advocatícios". */
const PLANOS_COTA_TEXTO = listaComE(
  PLANOS_CONTAS_INCLUIDOS_COTA.map((p) => p.replace(/^HONORÁRIOS\s+(DE\s+|POR\s+)?/i, '').toLowerCase()),
)

const REGRA_COTA = `Só entram os honorários da cota (${PLANOS_COTA_TEXTO}). Parcerias, reembolsos, adiantamentos e outras receitas ficam fora.`

const FONTE_FINANCEIRO = 'Financeiro do VIOS: itens dos títulos a receber, sincronizados no SIOE.'

function total(rotulo: string, v: number): FenixLinha {
  return { rotulo, valor: moeda(v), numero: v, operador: '=', tipo: 'total' }
}

function linhasMensais(
  ano: number,
  itens: readonly { mes: number; valor: number }[],
  detalhe?: (mes: number) => string | undefined,
): FenixLinha[] {
  return itens.map((it, i) => ({
    rotulo: rotuloMesAno(ano, it.mes),
    valor: moeda(it.valor),
    numero: it.valor,
    operador: i === 0 ? undefined : '+',
    detalhe: detalhe?.(it.mes),
  }))
}

function regraMesesDoPainel(ano: number, rows: readonly ReceitaMesRow[]): string[] {
  if (rows.length === 0 || rows.length >= 12) return []
  return [
    `Só entram os meses exibidos no painel (${periodoMeses(ano, rows.map((r) => r.mes))}), definidos nas Configurações da Receita.`,
  ]
}

// ---------------------------------------------------------------------------
// Receita › Resumo do ano
// ---------------------------------------------------------------------------

type ResumoInput = {
  ano: number
  rows: readonly ReceitaMesRow[]
  /** Valor exibido no card. */
  total: number
  /** Período exibido no card (ex.: "Jan–Nov/2026"). */
  periodo: string
  hoje?: Date
}

export function explicarReceitaRecebido(i: ResumoInput): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const meses = i.rows
    .filter((r) => !isMesFuturo(i.ano, r.mes, hoje) && r.recebido !== 0)
    .map((r) => ({ mes: r.mes, valor: r.recebido }))
  return {
    tela: `Receita › Resumo ${i.ano}`,
    titulo: 'Recebido',
    valor: moeda(i.total),
    resumo: `Honorários que entraram no caixa em ${i.periodo}, sem os encargos de boleto e juros.`,
    formula: 'Recebido = soma dos honorários pagos em cada mês (pela data de pagamento), sem encargos',
    conta: [
      ...linhasMensais(i.ano, meses, (m) =>
        isMesAtual(i.ano, m, hoje) ? 'mês em andamento: pago até hoje' : undefined,
      ),
      total('Recebido no período', i.total),
    ],
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Meses', valor: i.periodo },
      { rotulo: 'Clientes', valor: 'ativos e inativos' },
    ],
    regras: [
      'Conta pela data de pagamento: o que foi pago em março entra em março, mesmo que tenha vencido antes.',
      REGRA_COTA,
      'Encargos ficam fora: quando o valor pago passa do valor do título, a diferença vai para o card Encargos e aqui entra só o valor do título.',
      'Meses que ainda não começaram não entram. O mês em andamento entra com o que foi pago até hoje.',
      ...regraMesesDoPainel(i.ano, i.rows),
    ],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: 'Supabase › receita_totais_mensais (receita_item_recebido_liquido) sobre financeiro_parcelas_itens',
    detalhe: 'Para ver título a título, feche o Fênix e clique no card Recebido.',
  }
}

export function explicarReceitaEncargos(i: ResumoInput): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const meses = i.rows
    .filter((r) => !isMesFuturo(i.ano, r.mes, hoje) && r.encargos !== 0)
    .map((r) => ({ mes: r.mes, valor: r.encargos }))
  return {
    tela: `Receita › Resumo ${i.ano}`,
    titulo: 'Encargos',
    valor: moeda(i.total),
    resumo:
      'Valor pago acima do título: tarifa de boleto e juros por atraso. Fica separado para não inflar a receita de honorários.',
    formula: 'Encargos = valor pago − valor do título, quando o pago é maior',
    conta: [
      ...linhasMensais(i.ano, meses, (m) =>
        isMesAtual(i.ano, m, hoje) ? 'mês em andamento: pago até hoje' : undefined,
      ),
      total('Encargos no período', i.total),
    ],
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Meses', valor: i.periodo },
    ],
    regras: [
      'Só existe encargo quando o valor pago é maior que o valor do título (fluxo). Pagamento igual ou menor não gera encargo.',
      'Conta pela data de pagamento.',
      REGRA_COTA,
      'Encargos + Recebido = tudo o que foi pago nos honorários da cota.',
      ...regraMesesDoPainel(i.ano, i.rows),
    ],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: 'Supabase › receita_totais_mensais (receita_item_encargos: valor_pago_item − valor_fluxo_item)',
    detalhe: 'Para ver título a título, feche o Fênix e clique no card Encargos.',
  }
}

export function explicarReceitaPrevisto(i: ResumoInput): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const meses = i.rows.filter((r) => r.previsto !== 0).map((r) => ({ mes: r.mes, valor: r.previsto }))
  return {
    tela: `Receita › Resumo ${i.ano}`,
    titulo: 'Previsto',
    valor: moeda(i.total),
    resumo: `Quanto estava programado para vencer em ${i.periodo}: soma dos títulos pela data de vencimento, pagos ou não.`,
    formula: 'Previsto = soma do valor dos títulos com vencimento em cada mês',
    conta: [
      ...linhasMensais(i.ano, meses, (m) =>
        isMesFuturo(i.ano, m, hoje)
          ? 'mês futuro: títulos já lançados no VIOS'
          : isMesAtual(i.ano, m, hoje)
            ? 'mês em andamento: inclui o que ainda vai vencer'
            : undefined,
      ),
      total('Previsto no período', i.total),
    ],
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Meses', valor: i.periodo },
      { rotulo: 'Clientes', valor: 'ativos e inativos' },
    ],
    regras: [
      'Conta pela data de vencimento, esteja o título pago ou não.',
      REGRA_COTA,
      'Meses futuros entram com os títulos já lançados no VIOS. Contrato que ainda não virou título não aparece.',
      'É o valor do título, sem encargos de boleto e juros.',
      ...regraMesesDoPainel(i.ano, i.rows),
    ],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: 'Supabase › receita_totais_mensais (valor_item por data_vencimento) sobre financeiro_parcelas_itens',
    detalhe: 'Para ver título a título, feche o Fênix e clique no card Previsto.',
  }
}

export function explicarReceitaMetaAcumulada(i: {
  ano: number
  rows: readonly ReceitaMesRow[]
  metaAnual: number
  /** Meta ajustada mostrada no card ("R$ X/mês"). */
  metaMensal: number
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const comMeta = [...i.rows].filter((r) => r.metaBase > 0).sort((a, b) => a.mes - b.mes)
  const periodo = periodoMeses(i.ano, comMeta.map((r) => r.mes))
  const bases = new Set(comMeta.map((r) => Math.round(r.metaBase * 100)))

  const conta: FenixLinha[] =
    bases.size === 1
      ? [
          { rotulo: 'Meta mensal (Configurações da Receita)', valor: moeda(comMeta[0].metaBase), numero: comMeta[0].metaBase },
          { rotulo: `Meses com meta (${periodo})`, valor: String(comMeta.length), numero: comMeta.length, operador: '×' },
        ]
      : linhasMensais(
          i.ano,
          comMeta.map((r) => ({ mes: r.mes, valor: r.metaBase })),
        )
  conta.push(total('Meta acumulada', i.metaAnual))

  // Meta ajustada só importa do mês atual em diante (os fechados já passaram).
  for (const r of comMeta.filter((r) => !isMesFechado(i.ano, r.mes, hoje))) {
    const extra = r.meta - r.metaBase
    conta.push({
      rotulo: `Meta ajustada de ${rotuloMesAno(i.ano, r.mes)}`,
      valor: moeda(r.meta),
      numero: r.meta,
      tipo: 'info',
      detalhe: extra > 0.005 ? `${moeda(r.metaBase)} + ${moeda(extra)} do que faltou antes` : 'sem ajuste',
    })
  }

  const semMeta = i.rows.filter((r) => r.metaBase <= 0).map((r) => r.mes)
  return {
    tela: `Receita › Resumo ${i.ano}`,
    titulo: 'Meta acumulada',
    valor: moeda(i.metaAnual),
    resumo: `Meta de receita de ${periodo}: a meta mensal das Configurações da Receita somada nos meses que têm meta.`,
    formula: 'Meta acumulada = meta mensal × meses com meta',
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Meses com meta', valor: periodo },
    ],
    regras: [
      'A meta acumulada é fixa: não muda quando um mês fica abaixo ou acima da meta.',
      `O valor por mês do card (${moeda(i.metaMensal)}) é a meta ajustada do mês atual: o que faltou nos meses já fechados é dividido em partes iguais entre os meses seguintes com meta. Mês que passou da meta não reduz a meta dos seguintes.`,
      ...(semMeta.length > 0 ? [`Meses sem meta (${periodoMeses(i.ano, semMeta)}) não entram.`] : []),
    ],
    fonte: 'Configurações da Receita: meta mensal e meses com meta.',
    fonteTecnica: 'app_settings.receita_metas · aplicarMetaRebalanceada (receita/utils/receitaMes.ts)',
  }
}

export function explicarReceitaAtingimento(i: {
  ano: number
  rows: readonly ReceitaMesRow[]
  recebidoAcumulado: number
  metaAnual: number
  pct: number
  mesesSelecionados: readonly number[]
  mesesMetaDecorridos: readonly number[]
  hoje?: Date
}): FenixExplicacao {
  const hoje = i.hoje ?? new Date()
  const porMes = new Map(i.rows.map((r) => [r.mes, r]))
  const selecionados = [...i.mesesSelecionados].sort((a, b) => a - b)
  const periodoSel = periodoMeses(i.ano, selecionados)
  const mesesMeta = i.rows.filter((r) => r.metaBase > 0).map((r) => r.mes)
  const periodoMeta = periodoMeses(i.ano, mesesMeta)
  const metaDecorrida = selecionados.reduce((s, m) => s + (porMes.get(m)?.metaBase ?? 0), 0)
  const manual = selecionados.length < i.mesesMetaDecorridos.length

  const conta: FenixLinha[] = [
    ...linhasMensais(
      i.ano,
      selecionados.map((m) => ({ mes: m, valor: porMes.get(m)?.recebido ?? 0 })),
      (m) => (isMesAtual(i.ano, m, hoje) ? 'mês em andamento: pago até hoje' : undefined),
    ),
    total('Recebido nos meses considerados', i.recebidoAcumulado),
    { rotulo: `Meta do ano (${periodoMeta})`, valor: moeda(i.metaAnual), numero: i.metaAnual, operador: '÷' },
    { rotulo: 'Atingimento', valor: formatPercent(i.pct), numero: i.pct, operador: '=', tipo: 'total', detalhe: '× 100' },
  ]
  if (metaDecorrida > 0 && metaDecorrida < i.metaAnual) {
    conta.push({
      rotulo: `Referência: meta só de ${periodoSel}`,
      valor: moeda(metaDecorrida),
      numero: metaDecorrida,
      tipo: 'info',
      detalhe: `o recebido equivale a ${formatPercent((i.recebidoAcumulado / metaDecorrida) * 100)} dela`,
    })
  }

  return {
    tela: `Receita › Resumo ${i.ano}`,
    titulo: 'Atingimento da meta',
    valor: formatPercent(i.pct),
    resumo: `Quanto da meta do ano (${periodoMeta}) já entrou no caixa.`,
    formula: 'Atingimento = Recebido nos meses com meta ÷ Meta do ano × 100',
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Meses considerados', valor: periodoSel },
      { rotulo: 'Meta', valor: periodoMeta },
    ],
    regras: [
      `O divisor é a meta do ano inteiro (${periodoMeta}), não só a dos meses que já passaram. Por isso o percentual cresce ao longo do ano e só chega a 100% quando a meta anual é batida.`,
      'Só entram os meses com meta que já começaram. O mês em andamento entra com o que foi pago até hoje.',
      'Usa a meta original de cada mês, sem o ajuste do que faltou.',
      'O recebido segue as regras do card Recebido: data de pagamento, só honorários da cota e sem encargos.',
      ...(manual
        ? [
            `Os meses foram escolhidos à mão no detalhe do card (${selecionados.map((m) => rotuloMesAno(i.ano, m)).join(', ')}). Os demais meses com meta ficaram fora da conta.`,
          ]
        : []),
    ],
    fonte: `${FONTE_FINANCEIRO} Meta: Configurações da Receita.`,
    fonteTecnica: 'calcularAtingimentoMetaKpi (receita/utils/receitaAcumuladoChart.ts) · receita_totais_mensais',
    detalhe: 'Para escolher os meses da conta, feche o Fênix e clique no card Atingimento da meta.',
  }
}

// ---------------------------------------------------------------------------
// Receita › Melhor estimativa
// ---------------------------------------------------------------------------

export type ReceitaMeFenixComposicao = {
  recebido: number
  aberto: number
  fora: number
  foraAtraso: number
  foraNaoPaga: number
  novas: number
  potencial: number
  me: number
}

export type ReceitaMeFenixContexto = {
  ano: number
  /** "Escritório" ou o nome da área. */
  escopo: string
  /** Contribuição da área na meta (%), só na visão por área. */
  pctArea?: number
  linhas: readonly ReceitaMeMesAMes[]
  gap: ReceitaMeGapMeta
  composicao: ReceitaMeFenixComposicao
  /** Ex.: "Jun/26–Dez/26". */
  periodoMeta: string
  /** Ex.: "Nov/26–Dez/26". */
  periodoMe: string
  mesCorrente: number | null
}

function telaMe(c: ReceitaMeFenixContexto): string {
  return `Melhor estimativa › ${c.escopo}`
}

function filtrosMe(c: ReceitaMeFenixContexto): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    c.pctArea != null ? { rotulo: 'Área', valor: c.escopo } : { rotulo: 'Visão', valor: c.escopo },
    { rotulo: 'Meta', valor: c.periodoMeta },
    { rotulo: 'ME', valor: c.periodoMe || 'sem meses em aberto' },
  ]
}

const REGRA_REALIZADO =
  'Mês fechado entra pelo que de fato entrou no caixa (realizado), pela área do título no VIOS, com as regras do Recebido: data de pagamento, só honorários da cota e sem encargos.'

/** Meta original de cada mês (diferença da meta acumulada). */
function metaBaseMensal(linhas: readonly ReceitaMeMesAMes[]): { mes: number; valor: number }[] {
  let anterior = 0
  return linhas.map((l) => {
    const valor = l.metaAcumulada - anterior
    anterior = l.metaAcumulada
    return { mes: l.mes, valor }
  })
}

const centavos = (v: number) => Math.round(v * 100)

/**
 * Valores com fração de centavo (ex.: meta × 46,85%) aparecem arredondados linha a linha;
 * a soma do que está na tela pode não bater com o total. Quando isso acontece, avisa.
 */
function notaCentavos(parcelas: readonly { valor: number }[], totalExato: number): FenixLinha[] {
  const somaExibida = parcelas.reduce((s, p) => s + centavos(p.valor), 0)
  const dif = (centavos(totalExato) - somaExibida) / 100
  if (dif === 0) return []
  return [
    {
      rotulo: 'Frações de centavo',
      valor: moeda(Math.abs(dif)),
      numero: dif,
      tipo: 'info',
      detalhe: `as linhas aparecem arredondadas e somam ${moeda(somaExibida / 100)}; o total usa os valores exatos`,
    },
  ]
}

export function explicarMeMeta(c: ReceitaMeFenixContexto): FenixExplicacao {
  const area = c.pctArea != null
  const mensal = metaBaseMensal(c.linhas)
  const conta: FenixLinha[] = [
    ...linhasMensais(c.ano, mensal),
    total('Meta do período', c.gap.metaTotal),
    ...notaCentavos(mensal, c.gap.metaTotal),
  ]
  if (area && c.pctArea! > 0) {
    conta.push({
      rotulo: 'Meta do escritório no mesmo período',
      valor: moeda((c.gap.metaTotal * 100) / c.pctArea!),
      numero: (c.gap.metaTotal * 100) / c.pctArea!,
      tipo: 'info',
      detalhe: `× ${pctBr(c.pctArea!)} = meta da área`,
    })
  }
  const percentuais = RECEITA_META_CONTRIBUICAO_AREA.map(
    (a) => `${RECEITA_DEPARTAMENTO_LABELS[a.key] ?? a.key} ${pctBr(a.pct)}`,
  )
  return {
    tela: telaMe(c),
    titulo: `Meta ${c.periodoMeta}`,
    valor: moeda(c.gap.metaTotal),
    resumo: area
      ? `Parte da meta do escritório que cabe a ${c.escopo}: ${pctBr(c.pctArea!)} da meta de ${c.periodoMeta}.`
      : `Meta de receita do escritório de ${c.periodoMeta}, a mesma do painel da Receita.`,
    formula: area
      ? `Meta da área = meta mensal do escritório × ${pctBr(c.pctArea!)}, somada nos meses com meta`
      : 'Meta = soma da meta mensal de cada mês com meta',
    conta,
    filtros: filtrosMe(c),
    regras: [
      'Usa a meta original de cada mês, sem o ajuste do que faltou, para não contar o mesmo gap duas vezes.',
      ...(area ? [`Contribuição de cada área na meta do escritório: ${listaComE(percentuais)}.`] : []),
    ],
    fonte: area
      ? 'Meta mensal das Configurações da Receita × percentual de contribuição da área.'
      : 'Meta mensal das Configurações da Receita.',
    fonteTecnica: 'app_settings.receita_metas · RECEITA_META_CONTRIBUICAO_AREA (receita/constants.ts) · montarMesAMes',
  }
}

export function explicarMeProjecao(c: ReceitaMeFenixContexto): FenixExplicacao {
  const conta: FenixLinha[] = c.linhas.map((l, i) => ({
    rotulo: `${rotuloMesAno(c.ano, l.mes)} · ${l.base === 'realizado' ? 'realizado' : 'melhor estimativa'}`,
    valor: moeda(l.valor),
    numero: l.valor,
    operador: i === 0 ? undefined : '+',
  }))
  conta.push(total('Projeção', c.gap.projecao))
  conta.push(
    { rotulo: 'Realizado (meses fechados)', valor: moeda(c.gap.realizadoFechado), numero: c.gap.realizadoFechado, tipo: 'info' },
    { rotulo: 'Melhor estimativa (meses em aberto)', valor: moeda(c.gap.meAberto), numero: c.gap.meAberto, tipo: 'info' },
  )
  return {
    tela: telaMe(c),
    titulo: `Projeção ${c.periodoMeta}`,
    valor: moeda(c.gap.projecao),
    resumo: `Quanto deve entrar em ${c.periodoMeta} se a melhor estimativa se confirmar: o realizado dos meses fechados mais a ME dos meses em aberto.`,
    formula: 'Projeção = Realizado (meses fechados) + Melhor estimativa (mês atual em diante)',
    conta,
    filtros: filtrosMe(c),
    regras: [
      REGRA_REALIZADO,
      `De ${c.periodoMe || 'o mês atual'} em diante entra a melhor estimativa: recebido do mês atual + em aberto − fora da estimativa + novas receitas.`,
      'Quando um mês fecha, a estimativa dele é trocada pelo realizado.',
    ],
    fonte: 'Caixa do Financeiro do VIOS (realizado) e melhor estimativa montada no SIOE.',
    fonteTecnica: 'receita_recebido_por_departamento_mensal (realizado) · calcularAreaMe / montarMesAMes (receitaMeCalc.ts)',
  }
}

export function explicarMeAtingimento(c: ReceitaMeFenixContexto): FenixExplicacao {
  return {
    tela: telaMe(c),
    titulo: 'Atingimento projetado',
    valor: pct1(c.gap.atingimentoPct),
    resumo: `Quanto da meta de ${c.periodoMeta} a projeção cobre.`,
    formula: 'Atingimento projetado = Projeção ÷ Meta × 100',
    conta: [
      { rotulo: `Projeção ${c.periodoMeta}`, valor: moeda(c.gap.projecao), numero: c.gap.projecao },
      { rotulo: `Meta ${c.periodoMeta}`, valor: moeda(c.gap.metaTotal), numero: c.gap.metaTotal, operador: '÷' },
      { rotulo: 'Atingimento projetado', valor: pct1(c.gap.atingimentoPct), numero: c.gap.atingimentoPct, operador: '=', tipo: 'total', detalhe: '× 100' },
    ],
    filtros: filtrosMe(c),
    regras: [
      'Usa a mesma meta e a mesma projeção dos cards ao lado.',
      'A partir de 100%, a projeção cobre a meta.',
    ],
    fonte: 'Cards Meta e Projeção desta tela.',
    fonteTecnica: 'calcularGapMeta (receitaMeCalc.ts)',
  }
}

export function explicarMeGap(c: ReceitaMeFenixContexto): FenixExplicacao {
  const g = c.gap
  const sobra = g.gap <= 0
  const conta: FenixLinha[] = [
    { rotulo: `Meta ${c.periodoMeta}`, valor: moeda(g.metaTotal), numero: g.metaTotal },
    { rotulo: `Projeção ${c.periodoMeta}`, valor: moeda(g.projecao), numero: g.projecao, operador: '−' },
    sobra
      ? { rotulo: 'Sobra (projeção acima da meta)', valor: moeda(-g.gap), numero: g.gap, operador: '=', tipo: 'total' }
      : total('Gap para a meta', g.gap),
  ]
  if (g.mesesAbertos > 0) {
    conta.push(
      {
        rotulo: `Receita necessária em ${c.periodoMe}`,
        valor: moeda(g.necessarioAberto),
        numero: g.necessarioAberto,
        tipo: 'info',
        detalhe: 'meta − realizado dos meses fechados',
      },
      {
        rotulo: `Necessário por mês (${g.mesesAbertos} ${g.mesesAbertos === 1 ? 'mês' : 'meses'})`,
        valor: moeda(g.necessarioPorMes),
        numero: g.necessarioPorMes,
        tipo: 'info',
      },
      { rotulo: 'Melhor estimativa média por mês', valor: moeda(g.meMediaPorMes), numero: g.meMediaPorMes, tipo: 'info' },
    )
    if (g.adicionalPorMes > 0) {
      conta.push({
        rotulo: 'Falta por mês além da ME',
        valor: moeda(g.adicionalPorMes),
        numero: g.adicionalPorMes,
        tipo: 'info',
      })
    }
  }
  return {
    tela: telaMe(c),
    titulo: 'Gap para a meta',
    valor: moeda(Math.max(0, g.gap)),
    resumo: sobra
      ? `A projeção cobre a meta de ${c.periodoMeta} e sobra ${moeda(-g.gap)}.`
      : `Quanto falta para a projeção chegar à meta de ${c.periodoMeta}.`,
    formula: 'Gap = Meta − Projeção',
    conta,
    filtros: filtrosMe(c),
    regras: [
      'Quando a projeção passa da meta, o card mostra R$ 0 e "Meta coberta pela projeção".',
      'Usa a meta original de cada mês (sem o ajuste do que faltou).',
    ],
    fonte: 'Cards Meta e Projeção desta tela.',
    fonteTecnica: 'calcularGapMeta (receitaMeCalc.ts)',
  }
}

export function explicarMeFora(c: ReceitaMeFenixContexto): FenixExplicacao {
  const k = c.composicao
  return {
    tela: telaMe(c),
    titulo: '(−) Fora da estimativa',
    valor: moeda(k.fora),
    resumo: `Títulos em aberto de ${c.periodoMe} que não entram na melhor estimativa.`,
    formula: 'Fora da estimativa = Em atraso (inadimplência) + Não deve pagar',
    conta: [
      { rotulo: 'Em atraso (vencido sem pagamento)', valor: moeda(k.foraAtraso), numero: k.foraAtraso },
      { rotulo: 'Não deve pagar (marcado pelo gerente)', valor: moeda(k.foraNaoPaga), numero: k.foraNaoPaga, operador: '+' },
      total('Fora da estimativa', k.fora),
    ],
    filtros: filtrosMe(c),
    regras: [
      'Título vencido e não pago fica fora da ME por padrão, como nas planilhas das áreas. O gerente pode marcar "vai pagar" para trazê-lo de volta.',
      '"Não deve pagar" é marcado pelo gerente na matriz, por grupo e mês.',
      'Saldo em aberto de até R$ 1 é arredondamento do VIOS e conta como quitado.',
    ],
    fonte: 'Carteira de títulos do VIOS e marcações dos gerentes no SIOE.',
    fonteTecnica: 'estadoCelula / calcularAreaMe (receitaMeCalc.ts) · tabela receita_me_ajustes',
    detalhe: 'Na aba Por área, a matriz mostra cada grupo × mês com o estado: conta, em atraso, vai pagar ou não paga.',
  }
}

export function explicarMeComposicao(c: ReceitaMeFenixContexto): FenixExplicacao {
  const k = c.composicao
  const conta: FenixLinha[] = []
  if (c.mesCorrente != null) {
    conta.push({ rotulo: `Recebido em ${rotuloMesAno(c.ano, c.mesCorrente)}`, valor: moeda(k.recebido), numero: k.recebido, detalhe: 'caixa do mês atual' })
  }
  conta.push(
    {
      rotulo: 'Em aberto',
      valor: moeda(k.aberto),
      numero: k.aberto,
      operador: conta.length > 0 ? '+' : undefined,
      detalhe: `títulos com vencimento em ${c.periodoMe} ainda não pagos`,
    },
    { rotulo: 'Fora da estimativa', valor: moeda(k.fora), numero: k.fora, operador: '−' },
    { rotulo: 'Novas receitas', valor: moeda(k.novas), numero: k.novas, operador: '+', detalhe: 'chance alta e média' },
  )
  // Cada parcela é arredondada em centavos; saldo de até R$ 1 numa célula conta como quitado.
  const diferenca = Math.round((k.me - (k.recebido + k.aberto - k.fora + k.novas)) * 100) / 100
  if (Math.abs(diferenca) >= 0.01) {
    conta.push({
      rotulo: 'Arredondamento',
      valor: moeda(Math.abs(diferenca)),
      numero: diferenca,
      operador: diferenca < 0 ? '−' : '+',
      detalhe:
        Math.abs(diferenca) < 0.05
          ? 'centavos: cada parcela é arredondada separadamente'
          : 'saldos em aberto de até R$ 1 contam como quitados',
    })
  }
  conta.push(total('Melhor estimativa', k.me))
  if (k.potencial > 0) {
    conta.push({ rotulo: 'Potencial com chance baixa', valor: moeda(k.potencial), numero: k.potencial, tipo: 'info', detalhe: 'não entra na ME' })
  }
  return {
    tela: telaMe(c),
    titulo: `Melhor estimativa ${c.periodoMe}`,
    valor: moeda(k.me),
    resumo: `Receita que ${c.pctArea != null ? 'a área' : 'o escritório'} espera receber de ${c.periodoMe}: carteira do VIOS, ajustes do gerente e novas receitas.`,
    formula: 'ME = Recebido no mês atual + Em aberto − Fora da estimativa + Novas receitas',
    conta,
    filtros: filtrosMe(c),
    regras: [
      `Em aberto: títulos do VIOS com vencimento em ${c.periodoMe} que ainda não foram pagos.`,
      'Recebido: só o caixa do mês atual. Meses já fechados entram pelo realizado, na Projeção.',
      'Fora da estimativa: vencido sem pagamento (fora por padrão) e o que o gerente marcou como "não deve pagar".',
      'Novas receitas: lançadas pelo gerente. Chance alta e média entram na ME; chance baixa fica só como potencial.',
      'Quando uma nova receita vira título no VIOS (mesmo grupo e mês), o valor do título novo é descontado da nova receita automaticamente, até o valor estimado, para não contar duas vezes. "São receitas diferentes" desfaz o desconto.',
    ],
    fonte: 'Carteira de títulos do VIOS, caixa do mês atual e lançamentos dos gerentes no SIOE.',
    fonteTecnica: 'calcularAreaMe (receitaMeCalc.ts) · tabelas receita_me_ajustes e receita_me_novas_receitas',
  }
}
