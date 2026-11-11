/**
 * Fênix no OPEX: memória de cálculo dos cards do topo e da projeção de despesas fixas.
 *
 * Funções puras. Recebem os mesmos valores que o card mostra (KPIs e evolução mensal do
 * `opex_dashboard`), então a conta sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'
import type { OpexGrupoRow, OpexKpis, OpexMesRow } from '../types/opex.types.ts'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const moeda = formatCurrency

function rotuloMes(ano: number, mes: number): string {
  return `${MESES[mes - 1] ?? mes}/${String(ano).slice(-2)}`
}

function faixaMeses(ano: number, meses: readonly number[]): string {
  const s = [...meses].sort((a, b) => a - b)
  if (s.length === 0) return String(ano)
  if (s.length === 1) return rotuloMes(ano, s[0]!)
  const consecutivo = s[s.length - 1]! - s[0]! + 1 === s.length
  if (consecutivo) return `${MESES[s[0]! - 1]}–${MESES[s[s.length - 1]! - 1]}/${ano}`
  return `${s.map((m) => MESES[m - 1]).join(', ')}/${ano}`
}

const centavos = (v: number) => Math.round(v * 100)

function linhaTotal(rotulo: string, v: number, valor = moeda(v)): FenixLinha {
  return { rotulo, valor, numero: v, operador: '=', tipo: 'total' }
}

function notaCentavos(parcelas: readonly number[], totalExato: number): FenixLinha[] {
  const somaExibida = parcelas.reduce((s, v) => s + centavos(v), 0)
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

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

export const REGRA_FORA_OPEX =
  'Ficam fora do OPEX: distribuição de lucros, sócios, investimentos, empréstimos e devoluções, deduções da receita e outras receitas operacionais.'
export const REGRA_REALIZADO =
  'Realizado = valor pago de cada título a pagar, no mês da data de pagamento.'
export const REGRA_FOLHA =
  'A folha é paga entre os dias 4 e 7 do mês seguinte, então entra no realizado do mês em que foi paga, não no mês trabalhado.'
export const REGRA_PREVISTO_VIOS =
  'Previsto VIOS = valor dos títulos a pagar lançados no VIOS, no mês do vencimento, pagos ou não.'
export const GRUPOS_FIXOS = [
  'Remuneração fixa',
  'Aluguéis',
  'Encargos sociais',
  'Benefícios',
  'Despesas da sede',
  'Despesas com pessoal',
  'Tecnologia e sistemas',
  'Impostos, taxas e seguros',
  'Despesas de infraestrutura',
  'Despesas administrativas',
  'Despesas de manutenção',
  'Material de consumo, limpeza e segurança',
  'Despesas de T.I.',
  'Despesas de copa e cozinha',
]

export function regraOrcamento(importado: boolean): string {
  return importado
    ? 'Orçamento = previsão orçamentária congelada do ano (importada ou editada no painel Orçamento), mês a mês.'
    : 'Sem orçamento importado para o ano: o painel usa como orçamento os títulos lançados no VIOS, pelo vencimento.'
}

const FONTE = 'Financeiro do VIOS: títulos a pagar sincronizados no SIOE.'
const FONTE_TECNICA = 'Supabase › opex_dashboard (opex_item_no_painel, opex_valor_pago, opex_valor_item) sobre financeiro_parcelas_itens'
const FONTE_ORCAMENTO = 'Orçamento congelado do ano (painel Orçamento) e títulos a pagar do VIOS.'
const FONTE_TECNICA_ORCAMENTO =
  'Supabase › opex_dashboard (opex_orcamento_linha quando há orçamento; senão opex_valor_item por data_vencimento)'

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

export type OpexFenixContexto = {
  ano: number
  /** `mes_atual` do opex_dashboard: 12 em ano passado, 0 em ano futuro, senão o mês de hoje. */
  mesAtual: number
  mesesFiltro: readonly number[]
  /** Período exibido no card (ex.: "jan–nov / 2026"). */
  periodo: string
  orcamentoImportado: boolean
  /** Evolução mensal do mesmo opex_dashboard (para abrir mês a mês). */
  evolucao?: readonly OpexMesRow[]
  planoFiltro?: { gruposExcluidos: readonly string[]; planosExcluidos: readonly string[] }
  hoje?: Date
}

/** Mesmo recorte de `opex_mes_no_kpi`: meses escolhidos, ou o ano até o mês atual (0 = ano todo). */
export function mesesNoKpiOpex(ctx: Pick<OpexFenixContexto, 'mesesFiltro' | 'mesAtual'>): number[] {
  if (ctx.mesesFiltro.length > 0) return [...ctx.mesesFiltro].sort((a, b) => a - b)
  const ate = ctx.mesAtual === 0 ? 12 : ctx.mesAtual
  return Array.from({ length: ate }, (_, i) => i + 1)
}

function mesEmAndamento(ctx: OpexFenixContexto): number | null {
  const hoje = ctx.hoje ?? new Date()
  if (ctx.ano !== hoje.getFullYear() || ctx.mesAtual < 1 || ctx.mesAtual > 12) return null
  return ctx.mesAtual
}

function filtrosOpex(ctx: OpexFenixContexto): FenixFiltro[] {
  const f: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(ctx.ano) },
    { rotulo: 'Período', valor: ctx.periodo },
  ]
  const g = ctx.planoFiltro?.gruposExcluidos.length ?? 0
  const p = ctx.planoFiltro?.planosExcluidos.length ?? 0
  f.push({
    rotulo: 'Plano de contas',
    valor: g + p === 0 ? 'todos' : [g > 0 ? `${g} grupo(s) oculto(s)` : '', p > 0 ? `${p} plano(s) oculto(s)` : ''].filter(Boolean).join(' · '),
  })
  return f
}

export function regraPlanoFiltro(ctx: Pick<OpexFenixContexto, 'planoFiltro'>): string[] {
  const g = ctx.planoFiltro?.gruposExcluidos ?? []
  const p = ctx.planoFiltro?.planosExcluidos ?? []
  if (g.length + p.length === 0) return []
  const partes: string[] = []
  if (g.length > 0) partes.push(`grupos ${g.join(', ')}`)
  if (p.length > 0) partes.push(`${p.length} plano(s) de contas`)
  return [`O filtro de plano de contas está ocultando ${partes.join(' e ')}: esses valores não entram.`]
}

function regraMesAndamento(ctx: OpexFenixContexto, meses: readonly number[]): string[] {
  const m = mesEmAndamento(ctx)
  if (m == null || !meses.includes(m)) return []
  return [`${rotuloMes(ctx.ano, m)} está em andamento: entra só o que já foi pago até hoje.`]
}

function linhasMes(
  ctx: OpexFenixContexto,
  meses: readonly number[],
  campo: 'realizado' | 'previsto' | 'previsto_vios',
  rotulo?: (mes: number) => string,
): FenixLinha[] {
  const evo = ctx.evolucao ?? []
  const andamento = mesEmAndamento(ctx)
  return meses.map((mes, i) => {
    const v = evo.find((e) => e.mes === mes)?.[campo] ?? 0
    return {
      rotulo: rotulo ? rotulo(mes) : rotuloMes(ctx.ano, mes),
      valor: moeda(v),
      numero: v,
      operador: i === 0 ? undefined : ('+' as const),
      detalhe: campo === 'realizado' && andamento === mes ? 'mês em andamento: pago até hoje' : undefined,
    }
  })
}

function contaMensal(
  ctx: OpexFenixContexto,
  meses: readonly number[],
  campo: 'realizado' | 'previsto' | 'previsto_vios',
  rotuloTotal: string,
  total: number,
): FenixLinha[] {
  if (!ctx.evolucao || ctx.evolucao.length === 0) return [linhaTotal(rotuloTotal, total)]
  const linhas = linhasMes(ctx, meses, campo)
  return [
    ...linhas,
    linhaTotal(rotuloTotal, total),
    ...notaCentavos(
      linhas.map((l) => l.numero ?? 0),
      total,
    ),
  ]
}

const DETALHE_MES = 'Para ver por grupo de conta, clique num mês no gráfico Previsto x Realizado; "Exportar Excel" traz título a título.'

// ---------------------------------------------------------------------------
// Cards do topo
// ---------------------------------------------------------------------------

export function explicarOpexRealizado(kpis: OpexKpis, ctx: OpexFenixContexto, titulo = 'Realizado no período'): FenixExplicacao {
  const meses = mesesNoKpiOpex(ctx)
  return {
    tela: `OPEX › ${ctx.ano}`,
    titulo,
    valor: moeda(kpis.realizado_ytd),
    resumo: `Despesas operacionais efetivamente pagas em ${ctx.periodo}.`,
    formula: 'Realizado = soma do valor pago dos títulos a pagar, pela data de pagamento',
    conta: contaMensal(ctx, meses, 'realizado', 'Realizado no período', kpis.realizado_ytd),
    filtros: filtrosOpex(ctx),
    regras: [
      REGRA_REALIZADO,
      REGRA_FORA_OPEX,
      ctx.mesesFiltro.length > 0
        ? `Só entram os meses escolhidos no painel (${faixaMeses(ctx.ano, meses)}).`
        : 'Sem meses escolhidos, o período vai de janeiro até o mês atual.',
      ...regraMesAndamento(ctx, meses),
      REGRA_FOLHA,
      ...regraPlanoFiltro(ctx),
    ],
    fonte: FONTE,
    fonteTecnica: FONTE_TECNICA,
    detalhe: DETALHE_MES,
  }
}

export function explicarOpexOrcamentoPeriodo(
  kpis: OpexKpis,
  ctx: OpexFenixContexto,
  titulo = 'Orçamento no período',
): FenixExplicacao {
  const meses = mesesNoKpiOpex(ctx)
  const conta = contaMensal(ctx, meses, 'previsto', 'Orçamento no período', kpis.previsto_ytd)
  if (ctx.orcamentoImportado) {
    conta.push({
      rotulo: 'Previsto VIOS no mesmo período',
      valor: moeda(kpis.previsto_vios_ytd),
      numero: kpis.previsto_vios_ytd,
      tipo: 'info',
      detalhe: 'títulos lançados no VIOS por vencimento, só para comparar',
    })
  }
  return {
    tela: `OPEX › ${ctx.ano}`,
    titulo,
    valor: moeda(kpis.previsto_ytd),
    resumo: ctx.orcamentoImportado
      ? `Quanto o orçamento congelado do ano previa gastar em ${ctx.periodo}.`
      : `Sem orçamento importado: soma dos títulos a pagar do VIOS com vencimento em ${ctx.periodo}.`,
    formula: ctx.orcamentoImportado
      ? 'Orçamento no período = soma do orçamento congelado de cada mês'
      : 'Orçamento no período = soma dos títulos a pagar com vencimento em cada mês',
    conta,
    filtros: filtrosOpex(ctx),
    regras: [
      regraOrcamento(ctx.orcamentoImportado),
      ...(ctx.orcamentoImportado ? [REGRA_PREVISTO_VIOS] : []),
      REGRA_FORA_OPEX,
      'Usa os mesmos meses do card Realizado.',
      ...regraPlanoFiltro(ctx),
    ],
    fonte: FONTE_ORCAMENTO,
    fonteTecnica: FONTE_TECNICA_ORCAMENTO,
    detalhe: 'Para ver as linhas do orçamento, abra o painel Orçamento no topo da página.',
  }
}

/** Card "Projeção até dez" (sem filtro de meses). */
export function explicarOpexProjecao(kpis: OpexKpis, ctx: OpexFenixContexto): FenixExplicacao {
  const evo = ctx.evolucao ?? []
  const passados = evo.filter((e) => e.mes <= ctx.mesAtual)
  const futuros = evo.filter((e) => e.mes > ctx.mesAtual).sort((a, b) => a.mes - b.mes)
  const realizadoAte = passados.reduce((s, e) => s + e.realizado, 0)
  let conta: FenixLinha[]
  if (evo.length === 0) {
    conta = [
      { rotulo: 'Realizado até o mês atual', valor: moeda(kpis.realizado_ytd), numero: kpis.realizado_ytd },
      {
        rotulo: 'Orçamento dos meses seguintes',
        valor: moeda(kpis.projetado_ano - kpis.realizado_ytd),
        numero: kpis.projetado_ano - kpis.realizado_ytd,
        operador: '+',
      },
      linhaTotal('Projeção até dezembro', kpis.projetado_ano),
    ]
  } else {
    const parcelas: FenixLinha[] = []
    if (ctx.mesAtual > 0) {
      parcelas.push({
        rotulo: `Realizado ${faixaMeses(ctx.ano, passados.map((e) => e.mes))}`,
        valor: moeda(realizadoAte),
        numero: realizadoAte,
        detalhe: 'pago, pela data de pagamento',
      })
    }
    for (const e of futuros) {
      parcelas.push({
        rotulo: `Orçamento ${rotuloMes(ctx.ano, e.mes)}`,
        valor: moeda(e.previsto),
        numero: e.previsto,
        operador: parcelas.length === 0 ? undefined : '+',
      })
    }
    conta = [
      ...parcelas,
      linhaTotal('Projeção até dezembro', kpis.projetado_ano),
      ...notaCentavos(
        parcelas.map((p) => p.numero ?? 0),
        kpis.projetado_ano,
      ),
    ]
  }
  const andamento = mesEmAndamento(ctx)
  return {
    tela: `OPEX › ${ctx.ano}`,
    titulo: 'Projeção até dez',
    valor: moeda(kpis.projetado_ano),
    resumo: `Quanto o OPEX de ${ctx.ano} deve fechar: o que já foi pago até o mês atual mais o orçamento dos meses que faltam.`,
    formula: 'Projeção = realizado de janeiro até o mês atual + orçamento dos meses seguintes',
    conta,
    filtros: filtrosOpex(ctx),
    regras: [
      ctx.mesAtual === 0
        ? 'Ano que ainda não começou: a projeção é o orçamento dos 12 meses.'
        : ctx.mesAtual >= 12
          ? 'Ano encerrado: a projeção é o realizado dos 12 meses.'
          : 'Meses até o atual entram pelo realizado; meses seguintes entram pelo orçamento.',
      ...(andamento != null
        ? [
            `${rotuloMes(ctx.ano, andamento)} entra só com o que já foi pago: o que ainda vai ser pago neste mês não aparece na projeção.`,
          ]
        : []),
      regraOrcamento(ctx.orcamentoImportado),
      REGRA_REALIZADO,
      REGRA_FORA_OPEX,
      ...regraPlanoFiltro(ctx),
    ],
    fonte: FONTE_ORCAMENTO,
    fonteTecnica: FONTE_TECNICA,
    detalhe: DETALHE_MES,
  }
}

/** Card "Orçamento no ano" (com filtro de meses). */
export function explicarOpexOrcamentoAno(kpis: OpexKpis, ctx: OpexFenixContexto): FenixExplicacao {
  const meses = Array.from({ length: 12 }, (_, i) => i + 1)
  const conta = contaMensal(ctx, meses, 'previsto', 'Orçamento no ano', kpis.previsto_ano)
  if (ctx.orcamentoImportado) {
    conta.push({
      rotulo: 'Previsto VIOS no ano',
      valor: moeda(kpis.previsto_vios_ano),
      numero: kpis.previsto_vios_ano,
      tipo: 'info',
      detalhe: 'títulos lançados no VIOS por vencimento, só para comparar',
    })
  }
  return {
    tela: `OPEX › ${ctx.ano}`,
    titulo: 'Orçamento no ano',
    valor: moeda(kpis.previsto_ano),
    resumo: `Orçamento dos 12 meses de ${ctx.ano}, independente dos meses escolhidos no painel.`,
    formula: 'Orçamento no ano = soma do orçamento de janeiro a dezembro',
    conta,
    filtros: filtrosOpex(ctx),
    regras: [regraOrcamento(ctx.orcamentoImportado), REGRA_FORA_OPEX, ...regraPlanoFiltro(ctx)],
    fonte: FONTE_ORCAMENTO,
    fonteTecnica: FONTE_TECNICA_ORCAMENTO,
    detalhe: 'Para ver as linhas do orçamento, abra o painel Orçamento no topo da página.',
  }
}

/** Card de variação: (realizado − orçamento) ÷ orçamento, arredondado a 1 casa no banco. */
export function explicarOpexVariacao(kpis: OpexKpis, ctx: OpexFenixContexto, titulo = 'Variação YTD'): FenixExplicacao {
  const dif = kpis.realizado_ytd - kpis.previsto_ytd
  const exato = kpis.previsto_ytd > 0 ? (dif / kpis.previsto_ytd) * 100 : 0
  const v = kpis.variancia_ytd_pct
  const conta: FenixLinha[] = [
    { rotulo: 'Realizado no período', valor: moeda(kpis.realizado_ytd), numero: kpis.realizado_ytd },
    { rotulo: 'Orçamento no período', valor: moeda(kpis.previsto_ytd), numero: kpis.previsto_ytd, operador: '−' },
    { rotulo: 'Diferença', valor: moeda(dif), numero: dif, operador: '=', tipo: 'info' },
    { rotulo: 'Orçamento no período', valor: moeda(kpis.previsto_ytd), numero: kpis.previsto_ytd, operador: '÷' },
    linhaTotal('Variação', v, formatPercent(v)),
  ]
  if (kpis.previsto_ytd > 0 && formatPercent(exato) !== formatPercent(v)) {
    conta.push({
      rotulo: 'Conta sem arredondar',
      valor: formatPercent(exato),
      numero: exato,
      tipo: 'info',
      detalhe: 'o painel arredonda a variação para uma casa decimal',
    })
  }
  return {
    tela: `OPEX › ${ctx.ano}`,
    titulo,
    valor: formatPercent(Math.abs(v)),
    resumo:
      kpis.previsto_ytd <= 0
        ? 'Sem orçamento no período: não há base para comparar, então a variação fica em 0%.'
        : v > 0
          ? `O realizado ficou ${formatPercent(Math.abs(v))} acima do orçamento em ${ctx.periodo} (seta vermelha).`
          : v < 0
            ? `O realizado ficou ${formatPercent(Math.abs(v))} abaixo do orçamento em ${ctx.periodo} (seta verde).`
            : `O realizado ficou igual ao orçamento em ${ctx.periodo}.`,
    formula: 'Variação = (Realizado − Orçamento) ÷ Orçamento × 100',
    conta,
    filtros: filtrosOpex(ctx),
    regras: [
      'Positivo (vermelho) = gastou mais que o orçado; negativo (verde) = gastou menos. O card mostra o número sem sinal, com a seta.',
      'Realizado e orçamento usam os mesmos meses.',
      ...regraMesAndamento(ctx, mesesNoKpiOpex(ctx)),
      regraOrcamento(ctx.orcamentoImportado),
      ...regraPlanoFiltro(ctx),
    ],
    fonte: FONTE_ORCAMENTO,
    fonteTecnica: FONTE_TECNICA,
    detalhe: DETALHE_MES,
  }
}

/** Card "Vs. ano anterior": realizado do período × mesmo período do ano anterior. */
export function explicarOpexVsAnoAnterior(i: {
  ctx: OpexFenixContexto
  atual: number
  anterior: number
  /** Variação exibida (null = sem base). */
  yoy: number | null
  periodoAnterior: string
}): FenixExplicacao {
  const { ctx } = i
  const anoAnt = ctx.ano - 1
  const dif = i.atual - i.anterior
  const regras = [
    'Compara os mesmos meses nos dois anos: os meses escolhidos no painel ou, sem escolha, de janeiro até o mês atual.',
    ...(mesEmAndamento(ctx) != null && ctx.mesesFiltro.length === 0
      ? [
          `${rotuloMes(ctx.ano, ctx.mesAtual)} ainda está em andamento em ${ctx.ano}, mas já está completo em ${anoAnt}: isso puxa a variação para baixo até o mês fechar.`,
        ]
      : []),
    'Os dois anos usam o mesmo filtro de plano de contas.',
    REGRA_REALIZADO,
    REGRA_FORA_OPEX,
    ...(anoAnt === 2025
      ? ['Atenção com 2025: em alguns meses parte da folha foi paga fora do VIOS, então o realizado de 2025 pode estar abaixo do real.']
      : []),
  ]
  const conta: FenixLinha[] =
    i.yoy == null
      ? [
          { rotulo: `Realizado ${ctx.periodo}`, valor: moeda(i.atual), numero: i.atual },
          { rotulo: `Realizado ${i.periodoAnterior}`, valor: moeda(i.anterior), numero: i.anterior, tipo: 'info', detalhe: 'sem base para comparar' },
        ]
      : [
          { rotulo: `Realizado ${ctx.periodo}`, valor: moeda(i.atual), numero: i.atual },
          { rotulo: `Realizado ${i.periodoAnterior}`, valor: moeda(i.anterior), numero: i.anterior, operador: '−' },
          { rotulo: 'Diferença', valor: moeda(dif), numero: dif, operador: '=', tipo: 'info' },
          { rotulo: `Realizado ${i.periodoAnterior}`, valor: moeda(i.anterior), numero: i.anterior, operador: '÷' },
          linhaTotal('Variação', i.yoy, formatPercent(i.yoy)),
        ]
  return {
    tela: `OPEX › ${ctx.ano}`,
    titulo: 'Vs. ano anterior',
    valor: i.yoy == null ? '—' : formatPercent(Math.abs(i.yoy)),
    resumo:
      i.yoy == null
        ? `Não há realizado em ${i.periodoAnterior}, então não dá para comparar.`
        : i.yoy > 0
          ? `O OPEX pago em ${ctx.periodo} ficou ${formatPercent(Math.abs(i.yoy))} acima do mesmo período de ${anoAnt}.`
          : i.yoy < 0
            ? `O OPEX pago em ${ctx.periodo} ficou ${formatPercent(Math.abs(i.yoy))} abaixo do mesmo período de ${anoAnt}.`
            : `O OPEX pago em ${ctx.periodo} ficou igual ao mesmo período de ${anoAnt}.`,
    formula: `Variação = (Realizado ${ctx.ano} − Realizado ${anoAnt}) ÷ Realizado ${anoAnt} × 100`,
    conta,
    filtros: [...filtrosOpex(ctx), { rotulo: 'Comparado com', valor: i.periodoAnterior }],
    regras,
    fonte: FONTE,
    fonteTecnica: `${FONTE_TECNICA} (chamado também para ${anoAnt}, com os mesmos meses)`,
  }
}

// ---------------------------------------------------------------------------
// Projeção de despesas fixas
// ---------------------------------------------------------------------------

const REGRA_FIXAS_GRUPOS = `Despesas fixas = grupos ${GRUPOS_FIXOS.join(', ')}.`

export function explicarOpexProjecaoFixas(i: {
  ctx: OpexFenixContexto
  /** Grupos fixos, na ordem do card. */
  fixas: readonly OpexGrupoRow[]
  /** Valor exibido (soma do projetado de cada grupo fixo). */
  total: number
}): FenixExplicacao {
  const { ctx } = i
  const restantes = Math.max(0, 12 - ctx.mesAtual)
  const linhas: FenixLinha[] = i.fixas.map((g, idx) => {
    const extra = g.projetado_ano - g.realizado_ytd - g.previsto_restante
    return {
      rotulo: g.grupo_conta,
      valor: moeda(g.projetado_ano),
      numero: g.projetado_ano,
      operador: idx === 0 ? undefined : '+',
      detalhe: `pago ${moeda(g.realizado_ytd)} + ${ctx.orcamentoImportado ? 'orçamento' : 'títulos VIOS'} dos meses seguintes ${moeda(g.previsto_restante)} + extrapolação ${moeda(extra)}`,
    }
  })
  return {
    tela: `OPEX › ${ctx.ano} › Projeção de despesas fixas`,
    titulo: 'Total projetado fixas',
    valor: moeda(i.total),
    resumo: `Quanto as despesas fixas devem somar em ${ctx.ano}, grupo a grupo: o que já foi pago, o que está previsto para os meses seguintes e a média do próprio grupo estendida até dezembro.`,
    formula: 'Projeção do grupo = pago no ano + previsto dos meses seguintes + (pago no ano ÷ meses decorridos × meses restantes)',
    conta: [
      ...linhas,
      linhaTotal('Total projetado fixas', i.total),
      ...notaCentavos(
        i.fixas.map((g) => g.projetado_ano),
        i.total,
      ),
    ],
    filtros: [
      { rotulo: 'Ano', valor: String(ctx.ano) },
      { rotulo: 'Meses decorridos', valor: String(ctx.mesAtual) },
      { rotulo: 'Meses restantes', valor: String(restantes) },
    ],
    regras: [
      REGRA_FIXAS_GRUPOS,
      `Pago no ano = realizado de janeiro até o mês atual. ${regraOrcamento(ctx.orcamentoImportado)}`,
      `Extrapolação = pago no ano ÷ ${ctx.mesAtual} meses decorridos × ${restantes} meses restantes. O mês em andamento conta como decorrido.`,
      'Os meses que faltam entram pelos dois caminhos somados: o previsto desses meses e a extrapolação da média do grupo.',
      'Ano encerrado ou ainda não iniciado não tem extrapolação.',
      ...regraPlanoFiltro(ctx),
    ],
    fonte: FONTE_ORCAMENTO,
    fonteTecnica: 'Supabase › opex_dashboard › grupos.projetado_ano (opex_extrapolacao_fixas_grupo, opex_grupo_fixo)',
    detalhe: 'Clique no card da projeção para abrir os grupos fixos.',
  }
}

/** "Média mensal global das fixas": média do pago em grupos fixos nos meses até o atual. */
export function explicarOpexMediaFixas(i: { ctx: OpexFenixContexto; media: number }): FenixExplicacao {
  const { ctx } = i
  const meses = (ctx.evolucao ?? []).filter((e) => e.mes <= ctx.mesAtual && e.projetado_fixas > 0)
  const soma = meses.reduce((s, e) => s + e.projetado_fixas, 0)
  const andamento = mesEmAndamento(ctx)
  const conta: FenixLinha[] =
    meses.length === 0
      ? [linhaTotal('Média mensal das fixas', i.media)]
      : [
          ...meses.map((e, idx) => ({
            rotulo: rotuloMes(ctx.ano, e.mes),
            valor: moeda(e.projetado_fixas),
            numero: e.projetado_fixas,
            operador: idx === 0 ? undefined : ('+' as const),
            detalhe: andamento === e.mes ? 'mês em andamento: pago até hoje' : undefined,
          })),
          { rotulo: 'Soma', valor: moeda(soma), numero: soma, tipo: 'info' },
          { rotulo: 'Meses com despesa fixa paga', valor: String(meses.length), numero: meses.length, operador: '÷' },
          linhaTotal('Média mensal das fixas', i.media),
        ]
  return {
    tela: `OPEX › ${ctx.ano} › Projeção de despesas fixas`,
    titulo: 'Média mensal global das fixas',
    valor: moeda(i.media),
    resumo: 'Média do que foi pago por mês nos grupos de despesas fixas, de janeiro até o mês atual.',
    formula: 'Média = soma do pago em fixas em cada mês ÷ meses com pagamento',
    conta,
    filtros: [{ rotulo: 'Ano', valor: String(ctx.ano) }],
    regras: [
      REGRA_FIXAS_GRUPOS,
      REGRA_REALIZADO,
      ...(andamento != null
        ? [`${rotuloMes(ctx.ano, andamento)} entra na média com o que já foi pago até hoje, o que puxa a média para baixo no começo do mês.`]
        : []),
      'É uma referência: a projeção de cada grupo usa a média do próprio grupo, não esta.',
      ...regraPlanoFiltro(ctx),
    ],
    fonte: FONTE,
    fonteTecnica: 'Supabase › opex_dashboard › kpis.media_mensal_fixas (opex_grupo_fixo)',
  }
}
