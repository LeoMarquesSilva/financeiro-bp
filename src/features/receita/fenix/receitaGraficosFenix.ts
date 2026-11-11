/**
 * Fênix nos gráficos da Receita: explica o mês (ou a área) sob o mouse, ou o gráfico inteiro.
 *
 * Funções puras. Recebem o mesmo array `data` que o gráfico desenha (e, quando o gráfico
 * está em %, os pontos em R$ do mesmo mês), então os valores da explicação são os da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type {
  FenixExplicacao,
  FenixFiltro,
  FenixLinha,
  FenixPontoGrafico,
} from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'
import { PLANOS_CONTAS_INCLUIDOS_COTA, mesNome } from '../constants.ts'
import type {
  ReceitaAcumuladoChartPoint,
  ReceitaAreaChartSlice,
  ReceitaColunasChartPoint,
  ReceitaMesRow,
} from '../types/receita.types.ts'
import { isMesAtual, isMesFechado, isMesFuturo } from '../utils/receitaMes.ts'
import { periodoMeses, rotuloMesAno } from './receitaFenix.ts'

const moeda = formatCurrency
const pct = formatPercent

function pctBr(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

const PLANOS_COTA_TEXTO = listaComE(
  PLANOS_CONTAS_INCLUIDOS_COTA.map((p) => p.replace(/^HONORÁRIOS\s+(DE\s+|POR\s+)?/i, '').toLowerCase()),
)

const REGRA_COTA = `Só entram os honorários da cota (${PLANOS_COTA_TEXTO}). Parcerias, reembolsos, adiantamentos e outras receitas ficam fora.`

const FONTE_RECEITA = 'Financeiro do VIOS (títulos a receber, sincronizados no SIOE) e Configurações da Receita (metas e projeções).'

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Mesmo texto do rótulo/tooltip dos gráficos em %: valor zero aparece como 0,00%. */
function pctTela(v: number): string {
  return pct(v)
}

function capMes(mes: number): string {
  const n = mesNome(mes)
  return n.charAt(0).toUpperCase() + n.slice(1)
}

function serieSobMouse(ponto: FenixPontoGrafico | null, nomes: Record<string, string>): FenixFiltro[] {
  if (!ponto?.serie) return []
  const nome = nomes[ponto.serie]
  return nome ? [{ rotulo: 'Série sob o mouse', valor: nome }] : []
}

/**
 * Quando as parcelas exibidas (arredondadas a 2 casas) não somam o total exibido,
 * explica a diferença em vez de esconder.
 */
function notaArredondamento(
  parcelas: readonly FenixLinha[],
  totalExato: number,
  formatar: (v: number) => string,
): FenixLinha[] {
  const soma = parcelas.reduce((s, l) => s + Math.round(num(l.numero) * 100), 0)
  const dif = (Math.round(totalExato * 100) - soma) / 100
  if (dif === 0) return []
  return [
    {
      rotulo: 'Arredondamento',
      valor: formatar(Math.abs(dif)),
      numero: dif,
      tipo: 'info',
      detalhe: `as linhas aparecem arredondadas e somam ${formatar(soma / 100)}; o total usa os valores exatos`,
    },
  ]
}

/** Meta do mês: ajustada (a que o gráfico mostra) × original das Configurações. */
function detalheMeta(row: ReceitaMesRow | undefined, ano: number, hoje: Date): string | undefined {
  if (!row || row.metaBase <= 0) return undefined
  const extra = row.meta - row.metaBase
  const ajuste =
    extra > 0.005
      ? `meta original ${moeda(row.metaBase)} + ${moeda(extra)} do que faltou nos meses anteriores`
      : `meta original ${moeda(row.metaBase)}, sem ajuste`
  return isMesFechado(ano, row.mes, hoje) ? `${ajuste} (meta que valia no mês)` : ajuste
}

const DEF = {
  meta: 'Meta: meta mensal das Configurações da Receita, já ajustada. O que faltou num mês fechado é dividido em partes iguais entre os meses seguintes com meta; mês acima da meta não reduz os seguintes. Mês fechado mantém a meta que valia nele.',
  recebido:
    'Recebido: honorários da cota pagos no mês, pela data de pagamento, sem encargos (tarifa de boleto e juros). Mês futuro fica sem valor; o mês em andamento mostra o que foi pago até hoje.',
  previsto:
    'Previsto: soma dos títulos com vencimento no mês, pagos ou não, pelo valor do título. Meses futuros mostram os títulos já lançados no VIOS.',
  inadimplencia:
    'Inadimplência: valor congelado no fechamento de cada mês (o mesmo da tabela Evolução da inadimplência). Mês ainda não congelado fica sem ponto. O % ao lado do ponto é gravado no congelamento, sobre o previsto daquela data; títulos lançados depois mudam o previsto do gráfico, mas não esse %.',
  projetadoBaseAbril:
    'Proj. base abril: valor mensal fixo informado nas Configurações da Receita (projeção feita em abril), igual em todos os meses.',
  projetadoReal: 'Proj. real: valor informado mês a mês nas Configurações da Receita.',
} as const

// ---------------------------------------------------------------------------
// Comparativo mensal (consolidado ou área em % da meta)
// ---------------------------------------------------------------------------

export type ComparativoPonto = {
  mes: number
  mesLabel: string
  meta: number | null
  projetadoBaseAbril: number | null
  projetadoReal: number | null
  recebido: number | null
  previsto: number | null
  inadimplencia: number | null
  inadimplenciaPct?: number | null
}

export type ComparativoSerie = 'meta' | 'projetadoBaseAbril' | 'projetadoReal' | 'recebido' | 'previsto' | 'inadimplencia'

/** Mesma ordem do tooltip (áreas primeiro, depois as linhas). */
const ORDEM_TOOLTIP: ComparativoSerie[] = ['recebido', 'previsto', 'meta', 'projetadoBaseAbril', 'projetadoReal', 'inadimplencia']

const LEGENDA: Record<ComparativoSerie, string> = {
  meta: 'Meta',
  projetadoBaseAbril: 'Proj. base abril',
  projetadoReal: 'Proj. real',
  recebido: 'Recebido',
  previsto: 'Previsto',
  inadimplencia: 'Inadimplência',
}

const LEGENDA_PCT: Record<ComparativoSerie, string> = {
  meta: 'Meta (100%)',
  recebido: 'Recebido (% meta)',
  previsto: 'Previsto (% meta)',
  projetadoBaseAbril: 'Proj. base abril (% meta)',
  projetadoReal: 'Proj. real (% meta)',
  inadimplencia: 'Inadimplência (% previsto)',
}

export type ComparativoFenixContexto = {
  ano: number
  /** Linhas mensais do gráfico (meta ajustada e original). */
  rows: readonly ReceitaMesRow[]
  /** O array `data` do gráfico, como está na tela (R$ ou % da meta). */
  data: readonly ComparativoPonto[]
  /** Pontos em R$ (antes da conversão para %). Procurados pelo mês. */
  baseReais: readonly ComparativoPonto[]
  percentMode: boolean
  resultadoMode: boolean
  /** Séries ligadas na legenda. */
  visiveis: readonly ComparativoSerie[]
  /** Área escolhida (só no modo % da meta). */
  area?: { label: string; pct: number } | null
  /** Gráfico dentro da Apresentação (Bloco Composição). */
  apresentacao?: boolean
  hoje?: Date
}

const TELA_COMPARATIVO = 'Receita › Comparativo mensal'

function filtrosComparativo(c: ComparativoFenixContexto, ponto: FenixPontoGrafico | null): FenixFiltro[] {
  const nomes = c.percentMode ? LEGENDA_PCT : LEGENDA
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Modo', valor: c.percentMode ? '% da meta' : 'Valores (R$)' },
    ...(c.area ? [{ rotulo: 'Área', valor: `${c.area.label} (${pctBr(c.area.pct)} da meta)` }] : []),
    ...(c.resultadoMode ? [{ rotulo: 'Resultado', valor: 'ligado: esconde recebido e inadimplência do mês em andamento' }] : []),
    { rotulo: 'Séries ligadas', valor: ORDEM_TOOLTIP.filter((s) => c.visiveis.includes(s)).map((s) => nomes[s]).join(', ') },
    ...(c.apresentacao ? [{ rotulo: 'Contexto', valor: 'Apresentação (Bloco Composição)' }] : []),
    ...serieSobMouse(ponto, nomes),
  ]
}

function regrasComparativo(c: ComparativoFenixContexto): string[] {
  const regras: string[] = ORDEM_TOOLTIP.filter((s) => c.visiveis.includes(s)).map((s) => DEF[s])
  if (c.percentMode) {
    regras.push(
      'Em % da meta, cada série é dividida pela meta do mês (meta = 100%). Mês sem meta usa o previsto como 100%, embora a legenda diga "% meta".',
      'A inadimplência em % é sobre o previsto do mês (a % congelada no fechamento), não sobre a meta.',
    )
  }
  if (c.area) {
    regras.push(
      `Área ${c.area.label}: meta = meta ajustada do escritório × ${pctBr(c.area.pct)}; previsto e recebido dos títulos do departamento da área no VIOS; inadimplência da área só nos meses congelados.`,
    )
  }
  if (c.resultadoMode) {
    regras.push('Modo Resultado: o mês em andamento fica sem recebido e sem inadimplência; meta e previsto não mudam.')
  }
  regras.push(REGRA_COTA)
  return regras
}

function motivoSemValor(c: ComparativoFenixContexto, serie: ComparativoSerie, mes: number, hoje: Date): string | null {
  if (serie === 'meta') return 'mês sem meta'
  if (serie === 'recebido' || serie === 'inadimplencia') {
    if (isMesFuturo(c.ano, mes, hoje)) return 'mês ainda não começou'
    if (c.resultadoMode && isMesAtual(c.ano, mes, hoje)) return 'o modo Resultado esconde o mês em andamento'
    if (serie === 'inadimplencia') return 'mês ainda não congelado (ou sem inadimplência)'
  }
  if (c.percentMode) return 'sem meta nem previsto no mês para servir de base'
  return null
}

function explicarComparativoMes(c: ComparativoFenixContexto, p: ComparativoPonto, ponto: FenixPontoGrafico): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const base = c.baseReais.find((b) => b.mes === p.mes)
  const row = c.rows.find((r) => r.mes === p.mes)
  const nomes = c.percentMode ? LEGENDA_PCT : LEGENDA
  const divisor = base ? (num(base.meta) > 0 ? num(base.meta) : num(base.previsto)) : 0
  const divisorTxt = base && num(base.meta) > 0 ? `meta ${moeda(num(base.meta))}` : `previsto ${moeda(divisor)} (mês sem meta)`

  const conta: FenixLinha[] = []
  for (const s of ORDEM_TOOLTIP.filter((x) => c.visiveis.includes(x))) {
    const v = p[s]
    if (v == null) {
      const motivo = motivoSemValor(c, s, p.mes, hoje)
      conta.push({ rotulo: nomes[s], valor: '—', tipo: 'info', detalhe: motivo ?? 'sem valor no mês' })
      continue
    }
    let detalhe: string | undefined
    if (c.percentMode) {
      if (s === 'meta') detalhe = base ? `meta do mês ${moeda(num(base.meta))}` : undefined
      else if (s === 'inadimplencia')
        detalhe = base?.inadimplencia != null ? `${moeda(base.inadimplencia)} congelado ÷ previsto do mês` : undefined
      else if (base) detalhe = `${moeda(num(base[s]))} ÷ ${divisorTxt} × 100`
    } else if (s === 'meta') {
      detalhe = c.area
        ? `${pctBr(c.area.pct)} da meta do escritório`
        : detalheMeta(row, c.ano, hoje)
    } else if (s === 'recebido' && isMesAtual(c.ano, p.mes, hoje)) {
      detalhe = 'mês em andamento: pago até hoje'
    } else if (s === 'previsto' && isMesFuturo(c.ano, p.mes, hoje)) {
      detalhe = 'mês futuro: títulos já lançados no VIOS'
    } else if (s === 'inadimplencia' && p.inadimplenciaPct != null) {
      // O % é gravado no congelamento, sobre o previsto daquela data. Títulos lançados depois
      // mudam o previsto atual do gráfico, mas não o % congelado.
      const baseCongelamento = p.inadimplenciaPct > 0 && v > 0 ? v / (p.inadimplenciaPct / 100) : null
      const previstoAtual = p.previsto ?? null
      const mudou =
        baseCongelamento != null && previstoAtual != null && previstoAtual > 0 && Math.abs(v / previstoAtual * 100 - p.inadimplenciaPct) >= 0.05
      detalhe = mudou
        ? `${pct(p.inadimplenciaPct)} gravado no congelamento, sobre o previsto daquela data (≈ ${moeda(baseCongelamento!)}). Sobre o previsto atual (${moeda(previstoAtual!)}) seria ${pct((v / previstoAtual!) * 100)}.`
        : `${pct(p.inadimplenciaPct)} do previsto do mês (congelado no fechamento)`
    }
    conta.push({
      rotulo: nomes[s],
      valor: c.percentMode ? pctTela(v) : moeda(v),
      numero: v,
      detalhe,
    })
  }
  if (!c.percentMode && p.meta != null && p.meta > 0 && p.recebido != null) {
    conta.push({
      rotulo: 'Recebido ÷ Meta do mês',
      valor: pct((p.recebido / p.meta) * 100),
      numero: (p.recebido / p.meta) * 100,
      tipo: 'info',
      detalhe: 'quanto da meta do mês já entrou (não aparece no gráfico)',
    })
  }

  const sob = ponto.serie as ComparativoSerie | null
  const principal: ComparativoSerie =
    sob && c.visiveis.includes(sob) && p[sob] != null ? sob : 'recebido'
  const vPrincipal = p[principal]
  return {
    tela: TELA_COMPARATIVO,
    titulo: `Comparativo mensal${c.percentMode ? ' (% da meta)' : ''}${c.area ? ` — ${c.area.label}` : ''} · ${rotuloMesAno(c.ano, p.mes)}`,
    valor: vPrincipal == null ? '—' : c.percentMode ? pctTela(vPrincipal) : moeda(vPrincipal),
    resumo: `Valores de ${capMes(p.mes)}/${c.ano} no gráfico, série a série, como aparecem no tooltip${c.percentMode ? ' (em % da meta do mês)' : ''}.`,
    formula: c.percentMode ? 'Série em % = valor da série ÷ meta do mês × 100 (mês sem meta: ÷ previsto)' : undefined,
    conta,
    filtros: [...filtrosComparativo(c, ponto), { rotulo: 'Mês', valor: `${capMes(p.mes)}/${c.ano}` }],
    regras: regrasComparativo(c),
    fonte: FONTE_RECEITA,
    fonteTecnica:
      'ReceitaComparativoChart · receita_totais_mensais · app_settings.receita_metas (aplicarMetaRebalanceada) · receita_inadimplencia_dashboard (evolução congelada)' +
      (c.area ? ' · buildAreaLinhaData (receitaGestaoVista.ts)' : ''),
    detalhe: 'Fora do Fênix, clique no ponto do Recebido ou do Previsto para ver os títulos do mês.',
  }
}

export function explicarGraficoComparativo(
  c: ComparativoFenixContexto,
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const p = ponto ? c.data[ponto.indice] : undefined
  if (ponto && p) return explicarComparativoMes(c, p, ponto)
  const meses = c.data.map((d) => d.mes)
  return {
    tela: TELA_COMPARATIVO,
    titulo: `Comparativo mensal${c.percentMode ? ' (% da meta)' : ''}${c.area ? ` — ${c.area.label}` : ''}`,
    valor: periodoMeses(c.ano, meses),
    resumo: c.percentMode
      ? 'Mostra mês a mês quanto o recebido, o previsto e as projeções representam da meta do mês, e a inadimplência sobre o previsto.'
      : 'Mostra mês a mês a meta, o previsto, o recebido e a inadimplência congelada, em reais.',
    formula: c.percentMode ? 'Série em % = valor da série ÷ meta do mês × 100 (mês sem meta: ÷ previsto)' : undefined,
    filtros: filtrosComparativo(c, null),
    regras: [...regrasComparativo(c), 'Aponte um mês para ver os valores de cada série naquele mês.'],
    fonte: FONTE_RECEITA,
    fonteTecnica: 'ReceitaComparativoChart · receita_totais_mensais · app_settings.receita_metas · receita_inadimplencia_dashboard',
    detalhe: 'O menu da página abre a tabela de detalhamento mês a mês.',
  }
}

// ---------------------------------------------------------------------------
// Comparativo › Ver por área (barras meta × recebido por área)
// ---------------------------------------------------------------------------

export type AreaGapPonto = {
  key: string
  label: string
  pct: number
  meta: number
  metaGlobal: number
  recebido: number
  gap: number
  pctAtingido: number | null
  pctMetaGlobal: number | null
}

export type ComparativoPorAreaFenixContexto = {
  ano: number
  /** O array `data` do gráfico (uma barra por área). */
  data: readonly AreaGapPonto[]
  /** Ex.: "Acumulado 2026" ou "nov / 2026" (o mesmo dos botões de período). */
  periodo: string
  /** Recebido do Tributário (área sem meta, só na tabela). */
  tributario: number
  /** Valor do aviso "recebido sem departamento", como na tela (0 quando não aparece). */
  semDepartamento: number
  resultadoMode: boolean
  apresentacao?: boolean
}

function formatGap(v: number): string {
  const sinal = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sinal}${moeda(Math.abs(v))}`
}

const REGRAS_POR_AREA = [
  'Recebido da área: títulos do departamento da área no VIOS, pagos nos meses do período que têm meta (pela data de pagamento, sem encargos).',
  'Meta da área: soma da meta ajustada do escritório nos meses do período × % de contribuição da área.',
  'Meta global da área: meta original do ano inteiro (sem ajuste) × % da área.',
  'Gap = recebido − meta da área. Positivo: acima da meta.',
  'Tributário não tem meta de área: aparece só na tabela, com N/A.',
]

export function explicarGraficoComparativoPorArea(
  c: ComparativoPorAreaFenixContexto,
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Visão', valor: 'Ver por área' },
    { rotulo: 'Período', valor: c.periodo },
    ...(c.resultadoMode ? [{ rotulo: 'Resultado', valor: 'ligado: mês em andamento fora do recebido' }] : []),
    ...(c.apresentacao ? [{ rotulo: 'Contexto', valor: 'Apresentação (Bloco Composição)' }] : []),
  ]
  const a = ponto ? c.data[ponto.indice] : undefined
  if (ponto && a) {
    const metaEscritorio = a.pct > 0 ? (a.meta * 100) / a.pct : 0
    const metaAnual = a.pct > 0 ? (a.metaGlobal * 100) / a.pct : 0
    return {
      tela: TELA_COMPARATIVO,
      titulo: `Meta vs. recebido por área · ${a.label} · ${c.periodo}`,
      valor: moeda(a.recebido),
      resumo: `Quanto ${a.label} recebeu em ${c.periodo} contra a parte dela na meta (${pctBr(a.pct)}).`,
      formula: 'Gap = Recebido da área − Meta da área; Atingido = Recebido ÷ Meta da área × 100',
      conta: [
        { rotulo: 'Recebido da área', valor: moeda(a.recebido), numero: a.recebido },
        {
          rotulo: 'Meta da área',
          valor: moeda(a.meta),
          numero: a.meta,
          operador: '−',
          detalhe: `${pctBr(a.pct)} de ${moeda(metaEscritorio)} (meta ajustada do escritório no período)`,
        },
        { rotulo: 'Gap', valor: formatGap(a.gap), numero: a.gap, operador: '=', tipo: 'total' },
        ...(a.pctAtingido != null
          ? [{ rotulo: 'Atingido (período)', valor: pct(a.pctAtingido), numero: a.pctAtingido, tipo: 'info' as const, detalhe: 'recebido ÷ meta da área × 100' }]
          : []),
        {
          rotulo: 'Meta global da área',
          valor: moeda(a.metaGlobal),
          numero: a.metaGlobal,
          tipo: 'info',
          detalhe: `${pctBr(a.pct)} de ${moeda(metaAnual)} (meta original do ano)`,
        },
        ...(a.pctMetaGlobal != null
          ? [{ rotulo: '% da meta global', valor: pct(a.pctMetaGlobal), numero: a.pctMetaGlobal, tipo: 'info' as const, detalhe: 'recebido ÷ meta global da área × 100' }]
          : []),
      ],
      filtros: [...filtros, { rotulo: 'Área', valor: a.label }],
      regras: REGRAS_POR_AREA,
      fonte: FONTE_RECEITA,
      fonteTecnica: 'buildAreaGapData (ReceitaComparativoChart) · receita_recebido_por_departamento_mensal · RECEITA_META_CONTRIBUICAO_AREA',
      detalhe: 'A tabela abaixo do gráfico mostra todas as áreas lado a lado.',
    }
  }

  const parcelas: FenixLinha[] = c.data.map((x, i) => ({
    rotulo: x.label,
    valor: moeda(x.recebido),
    numero: x.recebido,
    operador: i === 0 ? undefined : '+',
  }))
  parcelas.push({ rotulo: 'Tributário (sem meta de área)', valor: moeda(c.tributario), numero: c.tributario, operador: '+' })
  const totalRecebido = c.data.reduce((s, x) => s + x.recebido, 0) + c.tributario
  const metaTotal = c.data.reduce((s, x) => s + x.meta, 0)
  return {
    tela: TELA_COMPARATIVO,
    titulo: `Meta vs. recebido por área · ${c.periodo}`,
    valor: moeda(totalRecebido),
    resumo: `Uma barra por área: o recebido de ${c.periodo} ao lado da meta da área. O total confere com a linha Total da tabela.`,
    formula: 'Total = soma do recebido de cada área (inclui Tributário)',
    conta: [
      ...parcelas,
      { rotulo: 'Recebido das áreas', valor: moeda(totalRecebido), numero: totalRecebido, operador: '=', tipo: 'total' },
      ...notaArredondamento(parcelas, totalRecebido, moeda),
      { rotulo: 'Meta das áreas no período', valor: moeda(metaTotal), numero: metaTotal, tipo: 'info' },
      ...(c.semDepartamento > 1
        ? [
            {
              rotulo: 'Recebido sem departamento',
              valor: moeda(c.semDepartamento),
              numero: c.semDepartamento,
              tipo: 'info' as const,
              detalhe: 'recebido do escritório nos meses do período (inclusive os sem meta) − recebido das áreas; não entra no rateio',
            },
          ]
        : []),
    ],
    filtros,
    regras: [...REGRAS_POR_AREA, 'Aponte a barra de uma área para ver a conta dela.'],
    fonte: FONTE_RECEITA,
    fonteTecnica: 'buildAreaGapData (ReceitaComparativoChart) · receita_recebido_por_departamento_mensal',
  }
}

// ---------------------------------------------------------------------------
// Comparativo › área escolhida (linhas em R$)
// ---------------------------------------------------------------------------

export type AreaLinhaPonto = {
  mes: number
  mesLabel: string
  meta: number | null
  previsto: number
  recebido: number | null
  inadimplencia: number | null
  inadimplenciaPct: number | null
}

export type ComparativoAreaLinhaFenixContexto = {
  ano: number
  area: { label: string; pct: number }
  /** O array `data` do gráfico da área. */
  data: readonly AreaLinhaPonto[]
  /** Linhas mensais do escritório (meta ajustada de onde sai a meta da área). */
  rows: readonly ReceitaMesRow[]
  periodo: string
  resultadoMode: boolean
  apresentacao?: boolean
  hoje?: Date
}

const REGRAS_AREA_LINHA = (c: ComparativoAreaLinhaFenixContexto) => [
  `Meta da área: meta do mês do escritório (já ajustada) × ${pctBr(c.area.pct)}.`,
  'Previsto e recebido: títulos do departamento da área no VIOS (previsto pelo vencimento; recebido pela data de pagamento, sem encargos).',
  'Inadimplência da área: só aparece nos meses já congelados no escritório. O valor é a parte da área na inadimplência do mês (rateio por departamento do VIOS), calculada na hora da consulta.',
  REGRA_COTA,
]

export function explicarGraficoComparativoAreaLinha(
  c: ComparativoAreaLinhaFenixContexto,
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Área', valor: `${c.area.label} (${pctBr(c.area.pct)} da meta)` },
    { rotulo: 'Período', valor: c.periodo },
    ...(c.resultadoMode ? [{ rotulo: 'Resultado', valor: 'ligado: mês em andamento sem recebido' }] : []),
    ...(c.apresentacao ? [{ rotulo: 'Contexto', valor: 'Apresentação (Bloco Composição)' }] : []),
  ]
  const p = ponto ? c.data[ponto.indice] : undefined
  if (ponto && p) {
    const row = c.rows.find((r) => r.mes === p.mes)
    const metaEscritorio = row ? (row.meta > 0 ? row.meta : row.metaBase) : 0
    const conta: FenixLinha[] = [
      {
        rotulo: 'Meta da área',
        valor: p.meta == null ? '—' : moeda(p.meta),
        numero: p.meta ?? undefined,
        detalhe: p.meta == null ? 'mês sem meta' : `${pctBr(c.area.pct)} de ${moeda(metaEscritorio)} (meta do escritório no mês)`,
      },
      {
        rotulo: 'Previsto',
        valor: moeda(p.previsto),
        numero: p.previsto,
        detalhe: isMesFuturo(c.ano, p.mes, hoje) ? 'mês futuro: títulos já lançados no VIOS' : undefined,
      },
      {
        rotulo: 'Recebido',
        valor: p.recebido == null ? '—' : moeda(p.recebido),
        numero: p.recebido ?? undefined,
        detalhe:
          p.recebido == null
            ? isMesFuturo(c.ano, p.mes, hoje)
              ? 'mês ainda não começou'
              : 'o modo Resultado esconde o mês em andamento'
            : isMesAtual(c.ano, p.mes, hoje)
              ? 'mês em andamento: pago até hoje'
              : undefined,
      },
      {
        rotulo: 'Inadimplência',
        valor: p.inadimplencia == null ? 'não congelado' : moeda(p.inadimplencia),
        numero: p.inadimplencia ?? undefined,
      },
    ]
    if (p.inadimplencia != null && p.inadimplenciaPct != null) {
      conta.push({
        rotulo: '% inadimplência',
        valor: pct(p.inadimplenciaPct),
        numero: p.inadimplenciaPct,
        tipo: 'info',
        detalhe: `${moeda(p.inadimplencia)} ÷ previsto da área ${moeda(p.previsto)} × 100`,
      })
    }
    if (p.meta != null && p.meta > 0 && p.recebido != null) {
      conta.push({
        rotulo: 'Recebido ÷ Meta da área',
        valor: pct((p.recebido / p.meta) * 100),
        numero: (p.recebido / p.meta) * 100,
        tipo: 'info',
        detalhe: 'não aparece no gráfico',
      })
    }
    return {
      tela: TELA_COMPARATIVO,
      titulo: `Comparativo mensal — ${c.area.label} · ${rotuloMesAno(c.ano, p.mes)}`,
      valor: p.recebido == null ? '—' : moeda(p.recebido),
      resumo: `Meta, previsto, recebido e inadimplência de ${c.area.label} em ${capMes(p.mes)}/${c.ano}, como no tooltip.`,
      conta,
      filtros: [...filtros, { rotulo: 'Mês', valor: `${capMes(p.mes)}/${c.ano}` }],
      regras: REGRAS_AREA_LINHA(c),
      fonte: FONTE_RECEITA,
      fonteTecnica:
        'buildAreaLinhaData (receitaGestaoVista.ts) · receita_recebido_por_departamento_mensal · receita_previsto_por_departamento_mensal · receita_inadimplencia_departamento_mes',
      detalhe: 'Fora do Fênix, clique no ponto do Recebido ou do Previsto para ver por grupo.',
    }
  }
  return {
    tela: TELA_COMPARATIVO,
    titulo: `Comparativo mensal — ${c.area.label}`,
    valor: periodoMeses(c.ano, c.data.map((d) => d.mes)),
    resumo: `Meta, previsto, recebido e inadimplência de ${c.area.label}, mês a mês.`,
    filtros,
    regras: [...REGRAS_AREA_LINHA(c), 'Aponte um mês para ver os valores da área naquele mês.'],
    fonte: FONTE_RECEITA,
    fonteTecnica: 'buildAreaLinhaData (receitaGestaoVista.ts)',
  }
}

// ---------------------------------------------------------------------------
// Recebido mês a mês (colunas por área / plano / consolidado)
// ---------------------------------------------------------------------------

export type ColunasMetrica = 'meta' | 'projetadoBaseAbril' | 'projetadoReal' | 'previsto'

const LEGENDA_COLUNAS: Record<ColunasMetrica, string> = {
  meta: 'Meta',
  projetadoBaseAbril: 'Proj. base abril',
  projetadoReal: 'Proj. real',
  previsto: 'Previsto',
}

export type ColunasFenixContexto = {
  ano: number
  /** O array `data` do gráfico, como está na tela (R$ ou % da meta). */
  data: readonly ReceitaColunasChartPoint[]
  /** Mesmos pontos em R$ (mesmo índice). */
  baseReais: readonly ReceitaColunasChartPoint[]
  /** Fatias empilhadas (áreas, planos ou a área escolhida). */
  slices: readonly ReceitaAreaChartSlice[]
  /** Linhas mensais do escritório (meta original × ajustada). */
  rows: readonly ReceitaMesRow[]
  planoMode: boolean
  percentMetaMode: boolean
  /** Barras quebradas por área/plano (false = coluna única consolidada). */
  porArea: boolean
  mostrarRecebido: boolean
  /** Área escolhida nos botões (só em R$ por área). */
  area?: { label: string; pct: number } | null
  metricasVisiveis: readonly ColunasMetrica[]
  hoje?: Date
}

const TELA_COLUNAS = 'Receita › Recebido mês a mês'

function tituloColunas(c: ColunasFenixContexto): string {
  if (c.percentMetaMode) {
    if (!c.porArea) return 'Recebido consolidado (% da meta)'
    return c.planoMode ? 'Recebido por plano (% da meta)' : 'Recebido por área (% da meta)'
  }
  if (c.planoMode) return 'Recebido por plano de contas'
  if (!c.porArea) return 'Recebido consolidado'
  return c.area ? c.area.label : 'Recebido por área'
}

function filtrosColunas(c: ColunasFenixContexto, ponto: FenixPontoGrafico | null): FenixFiltro[] {
  const nomesSlices = Object.fromEntries(c.slices.map((s) => [s.dataKey, s.departamento]))
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Modo', valor: c.percentMetaMode ? '% da meta' : 'Valores (R$)' },
    {
      rotulo: 'Quebra do recebido',
      valor: !c.mostrarRecebido
        ? 'recebido escondido'
        : !c.porArea
          ? 'consolidado (uma coluna)'
          : c.planoMode
            ? 'por plano de contas'
            : c.area
              ? `só ${c.area.label}`
              : 'por área (departamento)',
    },
    ...(c.area ? [{ rotulo: 'Área', valor: `${c.area.label} (${pctBr(c.area.pct)} da meta)` }] : []),
    {
      rotulo: 'Linhas ligadas',
      valor: c.metricasVisiveis.map((m) => LEGENDA_COLUNAS[m]).join(', ') || 'nenhuma',
    },
    ...serieSobMouse(ponto, { ...nomesSlices, recebidoTotal: 'Recebido', ...LEGENDA_COLUNAS }),
  ]
}

function regrasColunas(c: ColunasFenixContexto): string[] {
  const regras = [
    c.planoMode
      ? 'Cada pedaço da coluna é um plano de contas da cota; o rótulo mostra a participação no recebido do mês.'
      : 'Cada pedaço da coluna é um departamento do VIOS (área do título).',
    'Recebido: honorários da cota pagos no mês, pela data de pagamento, sem encargos. Mês futuro fica sem coluna.',
    ...c.metricasVisiveis.map((m) => DEF[m]),
  ]
  if (c.percentMetaMode) {
    regras.push(
      'Em % da meta, cada valor é dividido pela meta do mês. Mês sem meta continua em reais (não há meta para dividir).',
    )
  }
  if (c.area) {
    regras.push(
      `Área ${c.area.label}: meta = meta ajustada do escritório × ${pctBr(c.area.pct)}; previsto só dos títulos do departamento da área.`,
    )
  }
  if (!c.area && c.porArea && !c.percentMetaMode) {
    regras.push('Recebido sem departamento no VIOS não entra no rateio por área; aparece à parte no detalhe do mês.')
  }
  regras.push(REGRA_COTA)
  return regras
}

function explicarColunasMes(c: ColunasFenixContexto, i: number, ponto: FenixPontoGrafico): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const p = c.data[i]!
  const b = c.baseReais[i] ?? p
  const row = c.rows.find((r) => r.mes === p.mes)
  const metaReais = num(b.meta)
  const emPct = c.percentMetaMode && metaReais > 0
  const fmt = (v: number) => (emPct ? pctTela(v) : moeda(v))
  const recebidoOficial = typeof p.recebidoTotal === 'number' ? p.recebidoTotal : 0
  const somaSlices = c.slices.reduce((s, sl) => s + num(p[sl.dataKey]), 0)
  const recebidoMes = somaSlices > 0 ? somaSlices : recebidoOficial
  const somaSlicesReais = c.slices.reduce((s, sl) => s + num(b[sl.dataKey]), 0)
  const recebidoOficialReais = typeof b.recebidoTotal === 'number' ? b.recebidoTotal : 0
  const semDepartamento = recebidoOficialReais - somaSlicesReais > 1 ? recebidoOficialReais - somaSlicesReais : 0

  const conta: FenixLinha[] = []
  if (c.mostrarRecebido && !isMesFuturo(c.ano, p.mes, hoje)) {
    if (c.area) {
      const sl = c.slices[0]
      const v = sl ? num(p[sl.dataKey]) : 0
      conta.push({
        rotulo: 'Recebido da área',
        valor: fmt(v),
        numero: v,
        detalhe: emPct && sl ? `${moeda(num(b[sl.dataKey]))} ÷ meta da área ${moeda(metaReais)} × 100` : undefined,
      })
    } else {
      const itens = c.slices
        .map((sl) => ({ sl, v: num(p[sl.dataKey]), vReais: num(b[sl.dataKey]) }))
        .filter((x) => x.v > 0)
        .sort((x, y) => y.v - x.v)
      const parcelas: FenixLinha[] = itens.map((x, idx) => ({
        rotulo: x.sl.departamento,
        valor: fmt(x.v),
        numero: x.v,
        operador: idx === 0 ? undefined : '+',
        detalhe: emPct
          ? `${moeda(x.vReais)} ÷ meta ${moeda(metaReais)} × 100`
          : c.planoMode && recebidoMes > 0
            ? `${pct((x.v / recebidoMes) * 100)} do recebido do mês`
            : metaReais > 0
              ? `${pct((x.v / metaReais) * 100)} da meta`
              : undefined,
      }))
      conta.push(
        ...parcelas,
        {
          rotulo: 'Total recebido',
          valor: fmt(recebidoMes),
          numero: recebidoMes,
          operador: parcelas.length > 0 ? '=' : undefined,
          tipo: 'total',
          detalhe: somaSlices > 0 ? `soma ${c.planoMode ? 'dos planos' : 'das áreas'}` : 'recebido do mês',
        },
        ...notaArredondamento(parcelas, recebidoMes, fmt),
      )
      if (!c.porArea && Math.abs(recebidoOficial - recebidoMes) >= 0.01) {
        conta.push({
          rotulo: 'Altura da coluna',
          valor: fmt(recebidoOficial),
          numero: recebidoOficial,
          tipo: 'info',
          detalhe: `a coluna usa o recebido oficial do mês; o total da legenda soma só o que tem ${c.planoMode ? 'plano' : 'departamento'}`,
        })
      }
      if (semDepartamento > 0) {
        conta.push({
          rotulo: c.planoMode ? 'Recebido fora dos planos' : 'Recebido sem departamento',
          valor: moeda(semDepartamento),
          numero: semDepartamento,
          tipo: 'info',
          detalhe: `recebido oficial ${moeda(recebidoOficialReais)} − soma ${c.planoMode ? 'dos planos' : 'das áreas'}; não entra no rateio`,
        })
      }
    }
  } else if (c.mostrarRecebido) {
    conta.push({ rotulo: 'Recebido', valor: '—', tipo: 'info', detalhe: 'mês ainda não começou' })
  }

  if (!c.percentMetaMode && metaReais > 0) {
    conta.push({
      rotulo: c.area ? 'Meta da área' : 'Meta',
      valor: moeda(metaReais),
      numero: metaReais,
      tipo: 'info',
      detalhe: c.area ? `${pctBr(c.area.pct)} da meta ajustada do escritório` : detalheMeta(row, c.ano, hoje),
    })
    if (c.mostrarRecebido && recebidoMes > 0) {
      const at = (recebidoMes / metaReais) * 100
      conta.push({ rotulo: 'Atingido', valor: pct(at), numero: at, tipo: 'info', detalhe: 'total recebido ÷ meta do mês × 100' })
    }
  }
  for (const m of c.metricasVisiveis) {
    const v = num(p[m])
    if (v <= 0) continue
    conta.push({
      rotulo: emPct ? `${LEGENDA_COLUNAS[m]} (% da meta)` : LEGENDA_COLUNAS[m],
      valor: fmt(v),
      numero: v,
      tipo: 'info',
      detalhe:
        emPct
          ? `${moeda(num(b[m]))} ÷ meta ${moeda(metaReais)} × 100`
          : m === 'previsto' && c.area
            ? `previsto dos títulos de ${c.area.label}`
            : undefined,
    })
  }
  if (c.percentMetaMode && metaReais <= 0) {
    conta.push({ rotulo: 'Mês sem meta', valor: '—', tipo: 'info', detalhe: 'os valores deste mês continuam em reais' })
  }

  return {
    tela: TELA_COLUNAS,
    titulo: `${tituloColunas(c)} · ${rotuloMesAno(c.ano, p.mes)}`,
    valor: c.mostrarRecebido && !isMesFuturo(c.ano, p.mes, hoje) ? fmt(recebidoMes) : '—',
    resumo: `O que entrou no caixa em ${capMes(p.mes)}/${c.ano}${c.area ? ` em ${c.area.label}` : ''}, ${c.planoMode ? 'por plano de contas' : c.porArea && !c.area ? 'por área' : 'no total'}, com as linhas ligadas do mês.`,
    formula: emPct ? 'Valor em % = valor do mês ÷ meta do mês × 100' : 'Total recebido = soma dos pedaços da coluna',
    conta,
    filtros: [...filtrosColunas(c, ponto), { rotulo: 'Mês', valor: `${capMes(p.mes)}/${c.ano}` }],
    regras: regrasColunas(c),
    fonte: FONTE_RECEITA,
    fonteTecnica: c.planoMode
      ? 'buildColunasChartDataPorPlano (receitaColunasChart.ts) · receita_recebido_por_plano_mensal'
      : 'buildColunasChartData (receitaColunasChart.ts) · receita_recebido_por_departamento_mensal' +
        (c.area ? ' · applyAreaScopeToColunasData · receita_previsto_por_departamento_mensal' : ''),
    detalhe: 'Fora do Fênix, clique na coluna para fixar o detalhe do mês (por plano, grupo ou novos).',
  }
}

export function explicarGraficoColunas(c: ColunasFenixContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  if (ponto && c.data[ponto.indice]) return explicarColunasMes(c, ponto.indice, ponto)
  return {
    tela: TELA_COLUNAS,
    titulo: tituloColunas(c),
    valor: periodoMeses(c.ano, c.data.map((d) => d.mes)),
    resumo: c.planoMode
      ? 'Colunas mês a mês com o recebido quebrado por plano de contas, e as linhas de meta, previsto e projeções.'
      : c.porArea
        ? 'Colunas mês a mês com o recebido quebrado por área (departamento do VIOS), e as linhas de meta, previsto e projeções.'
        : 'Uma coluna por mês com o recebido total, e as linhas de meta, previsto e projeções.',
    filtros: filtrosColunas(c, null),
    regras: [...regrasColunas(c), 'Aponte um mês para ver a composição da coluna.'],
    fonte: FONTE_RECEITA,
    fonteTecnica: 'ReceitaComparativoColunasChart · receitaColunasChart.ts',
  }
}

// ---------------------------------------------------------------------------
// Valores acumulados
// ---------------------------------------------------------------------------

export type AcumuladoSerie = 'recebidoAcumulado' | 'previstoAcumulado' | 'metaAcumulada'

export type AcumuladoFenixContexto = {
  ano: number
  rows: readonly ReceitaMesRow[]
  /** O array `data` do gráfico, como está na tela (R$, % ou % por área). */
  data: readonly ReceitaAcumuladoChartPoint[]
  /** Pontos em R$ (mesmo índice). */
  baseReais: readonly ReceitaAcumuladoChartPoint[]
  percentMode: boolean
  /** Recebido quebrado por área (só em % da meta). */
  porArea: boolean
  slices: readonly ReceitaAreaChartSlice[]
  visiveis: readonly AcumuladoSerie[]
  hoje?: Date
}

const TELA_ACUMULADO = 'Receita › Valores acumulados'

function tituloAcumulado(c: AcumuladoFenixContexto): string {
  if (!c.percentMode) return 'Valores acumulados'
  return c.porArea ? 'Atingimento acumulado por área (% da meta)' : 'Atingimento acumulado (% da meta)'
}

function regrasAcumulado(c: AcumuladoFenixContexto): string[] {
  return [
    'Só os meses com meta entram na soma (o acumulado começa no primeiro mês com meta).',
    'Recebido acumulado: honorários da cota pagos de mês em mês, pela data de pagamento, sem encargos; para no mês em andamento.',
    'Previsto acumulado: soma dos títulos com vencimento nos meses com meta, pagos ou não; inclui meses futuros.',
    'Meta acumulada: nos meses fechados, a soma da meta original. Do mês em andamento em diante, o recebido dos meses fechados mais a meta ajustada dos meses seguintes; por isso a linha termina na meta do ano.',
    ...(c.percentMode ? ['Em % da meta, cada barra é dividida pela meta acumulada do mesmo mês (meta = 100%).'] : []),
    ...(c.porArea
      ? ['Por área: o recebido acumulado de cada departamento do VIOS, em % da meta acumulada; os pedaços somam o total.']
      : []),
    REGRA_COTA,
  ]
}

function filtrosAcumulado(c: AcumuladoFenixContexto): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Modo', valor: c.percentMode ? (c.porArea ? '% da meta, por área' : '% da meta') : 'Valores (R$)' },
    {
      rotulo: 'Séries ligadas',
      valor: c.visiveis
        .map((s) => ({ recebidoAcumulado: 'Recebido', previstoAcumulado: 'Previsto', metaAcumulada: 'Meta' })[s])
        .join(', '),
    },
  ]
}

function explicarAcumuladoMes(c: AcumuladoFenixContexto, i: number, ponto: FenixPontoGrafico): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const p = c.data[i]!
  const b = c.baseReais[i] ?? p
  const metaAcum = num(b.metaAcumulada)
  const comMeta = [...c.rows].filter((r) => r.metaBase > 0 && r.mes <= p.mes).sort((x, y) => x.mes - y.mes)
  const periodo = periodoMeses(c.ano, comMeta.map((r) => r.mes))
  const futuro = isMesFuturo(c.ano, p.mes, hoje)
  const conta: FenixLinha[] = []

  if (c.visiveis.includes('recebidoAcumulado')) {
    if (futuro || b.recebidoAcumulado == null) {
      conta.push({ rotulo: 'Recebido acumulado', valor: '—', tipo: 'info', detalhe: 'mês ainda não começou' })
    } else if (!c.percentMode) {
      const parcelas: FenixLinha[] = comMeta
        .filter((r) => !isMesFuturo(c.ano, r.mes, hoje))
        .map((r, idx) => ({
          rotulo: rotuloMesAno(c.ano, r.mes),
          valor: moeda(r.recebido),
          numero: r.recebido,
          operador: idx === 0 ? undefined : '+',
          detalhe: isMesAtual(c.ano, r.mes, hoje) ? 'mês em andamento: pago até hoje' : undefined,
        }))
      conta.push(
        ...parcelas,
        total('Recebido real acumulado', num(b.recebidoAcumulado)),
        ...notaArredondamento(parcelas, num(b.recebidoAcumulado), moeda),
      )
    } else if (c.porArea) {
      const itens = c.slices
        .map((sl) => ({ sl, v: num(p[sl.dataKey]) }))
        .filter((x) => x.v > 0)
        .sort((x, y) => y.v - x.v)
      const parcelas: FenixLinha[] = itens.map((x, idx) => ({
        rotulo: x.sl.departamento,
        valor: pctTela(x.v),
        numero: x.v,
        operador: idx === 0 ? undefined : '+',
        detalhe: `${moeda((x.v * metaAcum) / 100)} acumulados até ${capMes(p.mes)}`,
      }))
      const totalPct = itens.reduce((s, x) => s + x.v, 0)
      conta.push(
        ...parcelas,
        { rotulo: 'Total recebido (% da meta)', valor: pctTela(totalPct), numero: totalPct, operador: '=', tipo: 'total' },
        ...notaArredondamento(parcelas, totalPct, pctTela),
        { rotulo: 'Meta acumulada (100%)', valor: moeda(metaAcum), numero: metaAcum, tipo: 'info', detalhe: 'base do %' },
      )
    } else {
      const v = num(p.recebidoAcumulado)
      conta.push(
        { rotulo: 'Recebido acumulado', valor: moeda(num(b.recebidoAcumulado)), numero: num(b.recebidoAcumulado), detalhe: `pagos em ${periodo}` },
        { rotulo: 'Meta acumulada', valor: moeda(metaAcum), numero: metaAcum, operador: '÷' },
        { rotulo: 'Recebido acumulado (% da meta)', valor: pctTela(v), numero: v, operador: '=', tipo: 'total', detalhe: '× 100' },
      )
    }
  }

  if (c.visiveis.includes('previstoAcumulado')) {
    const v = num(p.previstoAcumulado)
    conta.push({
      rotulo: c.percentMode ? 'Previsto acumulado (% da meta)' : 'Previsto acumulado',
      valor: c.percentMode ? pctTela(v) : moeda(v),
      numero: v,
      tipo: 'info',
      detalhe: c.percentMode
        ? `${moeda(num(b.previstoAcumulado))} ÷ meta acumulada ${moeda(metaAcum)} × 100`
        : `soma do previsto de ${periodo} (pelo vencimento)`,
    })
  }

  if (!c.percentMode && c.visiveis.includes('metaAcumulada') && metaAcum > 0) {
    const fechado = isMesFechado(c.ano, p.mes, hoje)
    const recebidoFechado = comMeta
      .filter((r) => isMesFechado(c.ano, r.mes, hoje))
      .reduce((s, r) => s + r.recebido, 0)
    conta.push({
      rotulo: 'Meta acumulada',
      valor: moeda(metaAcum),
      numero: metaAcum,
      tipo: 'info',
      detalhe: fechado
        ? `soma da meta original de ${periodo}`
        : `recebido dos meses fechados ${moeda(recebidoFechado)} + meta ajustada do mês em andamento até ${capMes(p.mes)} ${moeda(metaAcum - recebidoFechado)}`,
    })
    if (!futuro && b.recebidoAcumulado != null) {
      const at = (num(b.recebidoAcumulado) / metaAcum) * 100
      conta.push({ rotulo: 'Recebido ÷ meta acumulada', valor: pct(at), numero: at, tipo: 'info', detalhe: 'não aparece no gráfico' })
    }
  }
  if (metaAcum <= 0) {
    conta.push({ rotulo: 'Mês sem meta', valor: '—', tipo: 'info', detalhe: 'fora do acumulado' })
  }

  const v = c.percentMode ? num(p.recebidoAcumulado) : num(b.recebidoAcumulado)
  return {
    tela: TELA_ACUMULADO,
    titulo: `${tituloAcumulado(c)} · ${rotuloMesAno(c.ano, p.mes)}`,
    valor: futuro || p.recebidoAcumulado == null ? '—' : c.percentMode ? pctTela(v) : moeda(v),
    resumo: `Acumulado de ${periodo || `${capMes(p.mes)}/${c.ano}`}: quanto já entrou, quanto estava previsto e a meta até ${capMes(p.mes)}.`,
    formula: c.percentMode
      ? 'Valor em % = acumulado até o mês ÷ meta acumulada até o mês × 100'
      : 'Recebido acumulado = soma do recebido de cada mês com meta até o mês',
    conta,
    filtros: [...filtrosAcumulado(c), { rotulo: 'Até o mês', valor: `${capMes(p.mes)}/${c.ano}` }, ...serieSobMouse(ponto, Object.fromEntries(c.slices.map((s) => [s.dataKey, s.departamento])))],
    regras: regrasAcumulado(c),
    fonte: FONTE_RECEITA,
    fonteTecnica: c.porArea
      ? 'buildAcumuladoAreaPercentData (receitaAcumuladoChart.ts) · receita_recebido_por_departamento_mensal'
      : 'buildAcumuladoChartData / metaAcumuladaPorMes (receitaAcumuladoChart.ts) · receita_totais_mensais',
  }
}

function total(rotulo: string, v: number): FenixLinha {
  return { rotulo, valor: moeda(v), numero: v, operador: '=', tipo: 'total' }
}

export function explicarGraficoAcumulado(c: AcumuladoFenixContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  if (ponto && c.data[ponto.indice]) return explicarAcumuladoMes(c, ponto.indice, ponto)
  return {
    tela: TELA_ACUMULADO,
    titulo: tituloAcumulado(c),
    valor: periodoMeses(c.ano, c.rows.filter((r) => r.metaBase > 0).map((r) => r.mes)),
    resumo: c.percentMode
      ? 'Mostra, mês a mês, quanto o recebido e o previsto acumulados representam da meta acumulada.'
      : 'Mostra, mês a mês, o recebido e o previsto acumulados contra a meta acumulada, em reais.',
    filtros: filtrosAcumulado(c),
    regras: [...regrasAcumulado(c), 'Aponte um mês para ver a soma até ele.'],
    fonte: FONTE_RECEITA,
    fonteTecnica: 'ReceitaAcumuladoChart · receitaAcumuladoChart.ts',
  }
}

// ---------------------------------------------------------------------------
// Custos e resultado › OPEX mês a mês
// ---------------------------------------------------------------------------

export type OpexGraficoPonto = { mes: number; label: string; anterior: number; atual: number; varPct: number | null }

export type OpexGraficoFenixContexto = {
  ano: number
  data: readonly OpexGraficoPonto[]
  /** Totais do cabeçalho do gráfico (mesmo recorte de meses). */
  totalAtual: number
  totalAnterior: number
  /** O último mês ainda está em andamento (marcado com *). */
  parcial: boolean
  tela?: string
}

function formatVar(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${pct(v)}`
}

const REGRAS_OPEX = [
  'Base caixa: cada pagamento entra no mês em que foi pago, pelo valor pago.',
  'Mesma regra do painel OPEX: entra todo pagamento de conta a pagar, exceto os grupos Distribuição de lucros, Sócios, Investimentos, Saídas - empréstimos e devoluções, Deduções da receita e Outras receitas operacionais.',
  'O % acima da barra é a variação contra o mesmo mês do ano anterior: (atual − anterior) ÷ |anterior| × 100. Despesa subindo aparece em vermelho.',
]

export function explicarGraficoOpex(c: OpexGraficoFenixContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const tela = c.tela ?? 'Receita › Custos e resultado'
  const p = ponto ? c.data[ponto.indice] : undefined
  if (ponto && p) {
    const parcialMes = c.parcial && p.label.endsWith('*')
    const dif = p.atual - p.anterior
    return {
      tela,
      titulo: `OPEX mês a mês · ${rotuloMesAno(c.ano, p.mes)}`,
      valor: moeda(p.atual),
      resumo: `Despesas operacionais pagas em ${capMes(p.mes)}/${c.ano} comparadas com ${capMes(p.mes)}/${c.ano - 1}.`,
      formula: 'Variação = (OPEX do mês − OPEX do mesmo mês do ano anterior) ÷ |ano anterior| × 100',
      conta: [
        { rotulo: `OPEX ${rotuloMesAno(c.ano, p.mes)}`, valor: moeda(p.atual), numero: p.atual, detalhe: parcialMes ? 'mês em andamento: pago até hoje' : undefined },
        { rotulo: `OPEX ${rotuloMesAno(c.ano - 1, p.mes)}`, valor: moeda(p.anterior), numero: p.anterior, operador: '−' },
        { rotulo: 'Diferença', valor: moeda(dif), numero: dif, operador: '=', tipo: 'total' },
        { rotulo: 'Variação', valor: formatVar(p.varPct), numero: p.varPct ?? undefined, tipo: 'info', detalhe: p.varPct == null ? 'sem OPEX no mesmo mês do ano anterior' : 'diferença ÷ |ano anterior| × 100' },
      ],
      filtros: [
        { rotulo: 'Mês', valor: `${capMes(p.mes)}/${c.ano}` },
        { rotulo: 'Comparação', valor: `${capMes(p.mes)}/${c.ano - 1}` },
      ],
      regras: [...REGRAS_OPEX, ...(parcialMes ? ['O mês em andamento (*) só tem o que foi pago até hoje; o ano anterior tem o mês inteiro.'] : [])],
      fonte: 'Financeiro do VIOS: títulos a pagar, sincronizados no SIOE.',
      fonteTecnica: 'receita_resultado_caixa_mensal (coluna opex) · ReceitaResultadoCaixaSection',
    }
  }
  const parcelas: FenixLinha[] = c.data
    .filter((d) => d.atual !== 0)
    .map((d, idx) => ({
      rotulo: rotuloMesAno(c.ano, d.mes),
      valor: moeda(d.atual),
      numero: d.atual,
      operador: idx === 0 ? undefined : '+',
    }))
  const v = c.totalAnterior === 0 ? (c.totalAtual === 0 ? 0 : null) : ((c.totalAtual - c.totalAnterior) / Math.abs(c.totalAnterior)) * 100
  const meses = c.data.map((d) => d.mes)
  return {
    tela,
    titulo: 'OPEX mês a mês',
    valor: moeda(c.totalAtual),
    resumo: `Despesas operacionais pagas a cada mês de ${periodoMeses(c.ano, meses)}, ao lado do mesmo mês de ${c.ano - 1}.`,
    formula: 'Total = soma do OPEX de cada mês do recorte',
    conta: [
      ...parcelas,
      total(`OPEX ${periodoMeses(c.ano, meses)}`, c.totalAtual),
      ...notaArredondamento(parcelas, c.totalAtual, moeda),
      { rotulo: `OPEX ${periodoMeses(c.ano - 1, meses)}`, valor: moeda(c.totalAnterior), numero: c.totalAnterior, tipo: 'info' },
      { rotulo: `Variação vs ${c.ano - 1}`, valor: formatVar(v), numero: v ?? undefined, tipo: 'info' },
    ],
    filtros: [
      { rotulo: 'Período', valor: periodoMeses(c.ano, meses) },
      { rotulo: 'Comparação', valor: periodoMeses(c.ano - 1, meses) },
    ],
    regras: [...REGRAS_OPEX, 'Aponte um mês para ver a comparação dele.'],
    fonte: 'Financeiro do VIOS: títulos a pagar, sincronizados no SIOE.',
    fonteTecnica: 'receita_resultado_caixa_mensal (coluna opex) · ReceitaResultadoCaixaSection',
  }
}
