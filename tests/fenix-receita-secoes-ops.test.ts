import test from 'node:test'
import assert from 'node:assert/strict'
import {
  explicarCaixaLinhaDre,
  explicarCaixaReceita,
  explicarCaixaResultado,
  explicarCaixaSaida,
  explicarGestaoBatimento,
  explicarGestaoInadimplencia,
  explicarGestaoMeta,
  explicarInadConcentracao,
  explicarInadReducao,
  explicarInadResultadoPct,
  explicarInadResultadoValor,
  explicarInadTop5,
  type GestaoVistaFenixContexto,
  type InadimplenciaFenixContexto,
  type ResultadoCaixaFenixContexto,
} from '../src/features/receita/fenix/receitaSecoesFenix.ts'
import { buildCascataResultado, somarResultadoCaixa } from '../src/features/receita/utils/receitaResultadoCaixa.ts'
import {
  explicarTimesheetGrupos,
  explicarTimesheetHoras,
  explicarTimesheetLancamentos,
  explicarTimesheetResponsaveis,
  type TimesheetFenixRecorte,
} from '../src/features/timesheet/fenix/timesheetFenix.ts'
import {
  explicarMarketingAlcance,
  explicarMarketingEngajamento,
  explicarMarketingPautas,
  explicarMarketingPostagens,
  type MarketingFenixContexto,
} from '../src/features/operacoes-legais/fenix/marketingFenix.ts'
import type { FenixExplicacao, FenixLinha } from '../src/shared/fenix/fenix.types.ts'
import type {
  GestaoVistaMesRow,
  GestaoVistaResumo,
  ReceitaResultadoCaixaMesRow,
} from '../src/features/receita/types/receita.types.ts'

/** 11/11/2026: jan–out fechados, nov em andamento, dez futuro. */
const HOJE = new Date(2026, 10, 11)
const META = 1_428_571.43

const parcelas = (conta: FenixLinha[] | undefined) =>
  (conta ?? []).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
/** Soma em centavos respeitando o sinal de "−" (como a tela lê a conta). */
const somaCentavos = (linhas: FenixLinha[]) =>
  linhas.reduce((s, l) => s + (l.operador === '−' ? -1 : 1) * Math.round((l.numero ?? 0) * 100), 0)
/** Parcelas que formam o primeiro total da conta (as linhas antes dele). */
const antesDoTotal = (conta: FenixLinha[] | undefined) => {
  const linhas = conta ?? []
  const fim = linhas.findIndex((l) => l.tipo === 'total')
  return parcelas(fim < 0 ? linhas : linhas.slice(0, fim))
}
const totais = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'total')
const infos = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'info')
const temRegra = (e: FenixExplicacao, trecho: string | RegExp) =>
  (e.regras ?? []).some((r) => (typeof trecho === 'string' ? r.includes(trecho) : trecho.test(r)))
const serializavel = (e: FenixExplicacao) => {
  const json = JSON.stringify(e)
  assert.equal(JSON.stringify(JSON.parse(json)), json)
}

// ---------------------------------------------------------------------------
// Gestão à vista
// ---------------------------------------------------------------------------

const MESES_META = [6, 7, 8, 9, 10, 11]
const RECEBIDO: Record<number, number> = { 6: 1_200_000.1, 7: 1_350_000.2, 8: 990_500.3, 9: 1_500_000, 10: 1_100_000, 11: 400_000.05 }
const PREVISTO: Record<number, number> = { 6: 1_300_000, 7: 1_400_000, 8: 1_250_000, 9: 1_450_000, 10: 1_380_000, 11: 1_500_000 }
const PREVISTO_NOV_CORTE = 610_000

function mesesGestao(): GestaoVistaMesRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    return {
      mes,
      mesLabel: String(mes),
      meta: mes >= 6 ? META : null,
      previsto: PREVISTO[mes] ?? 800_000,
      recebido: mes <= 11 ? (RECEBIDO[mes] ?? 700_000) : null,
      pctMeta: null,
      pctPrevisto: null,
      inadimplencia: null,
      inadimplenciaPct: null,
      congelado: mes <= 10,
    }
  })
}

function resumoGestao(): GestaoVistaResumo {
  const recebido = MESES_META.reduce((s, m) => s + RECEBIDO[m]!, 0)
  const previsto = MESES_META.reduce((s, m) => s + (m === 11 ? PREVISTO_NOV_CORTE : PREVISTO[m]!), 0)
  const metaAcumulada = META * 7
  return {
    metaAcumulada,
    previstoAcumulado: previsto,
    recebidoAcumulado: recebido,
    recebidoAtingimento: recebido,
    pctMeta: Math.round((recebido / metaAcumulada) * 10000) / 100,
    inadimplenciaPeriodo: 0,
    inadimplenciaPctPeriodo: null,
    inadimplenciaVencidoAno: 812_345.67,
    inadimplenciaVencidoPctAno: Math.round((812_345.67 / previsto) * 10000) / 100,
    periodoAnoLabel: 'Jun–Nov/2026',
    periodoAnualLabel: 'Jun–Dez/2026',
    periodoLabel: 'Jun–Nov/2026',
    periodoMetaLabel: 'Jun–Nov/2026',
    periodoMetaAnualLabel: 'Jun–Dez/2026',
    mesesNoPeriodo: [1, 2, 3, 4, 5, ...MESES_META],
    mesesMetaNoPeriodo: MESES_META,
    mesesMetaAno: [...MESES_META, 12],
  }
}

function ctxGestao(extra: Partial<GestaoVistaFenixContexto> = {}): GestaoVistaFenixContexto {
  return {
    ano: 2026,
    resumo: resumoGestao(),
    meses: mesesGestao(),
    previstoCortePorMes: new Map([[11, PREVISTO_NOV_CORTE]]),
    inadPorMes: [
      { mes: 6, valor: 100_000 },
      { mes: 7, valor: 150_000.5 },
      { mes: 8, valor: 120_000.17 },
      { mes: 9, valor: 200_000 },
      { mes: 10, valor: 180_000 },
      { mes: 11, valor: 62_345 },
    ],
    hoje: HOJE,
    ...extra,
  }
}

test('Gestão › Meta: recebido mês a mês fecha com o card e divide pela meta do ano inteiro', () => {
  const c = ctxGestao()
  const e = explicarGestaoMeta(c)
  const p = antesDoTotal(e.conta)
  assert.equal(p.length, 6)
  assert.equal(somaCentavos(p), Math.round(c.resumo.recebidoAtingimento * 100))
  const [recebido, atingimento] = totais(e.conta)
  assert.equal(recebido?.numero, c.resumo.recebidoAtingimento)
  assert.equal(atingimento?.numero, c.resumo.pctMeta)
  assert.equal(e.valor, 'R$ 6.540.500,65')
  assert.match(p[5]?.detalhe ?? '', /em andamento/)
  assert.ok(!infos(e.conta).some((l) => l.rotulo === 'Diferença de arredondamento'))
  assert.ok(infos(e.conta).some((l) => l.rotulo === 'Faltam para a meta'))
  assert.ok(temRegra(e, 'meta original'))
  assert.ok(temRegra(e, 'Jun–Dez/2026'))
  serializavel(e)
})

test('Gestão › Meta por área: cita a contribuição e o departamento', () => {
  const e = explicarGestaoMeta(ctxGestao({ area: { label: 'Cível', pct: 18.5 } }))
  assert.match(e.titulo, /\(Cível\)/)
  assert.ok(temRegra(e, '18,5% da meta do escritório'))
  assert.ok(temRegra(e, 'departamento Cível'))
})

test('Gestão › Recebido × previsto: mês em andamento usa o previsto cortado em ontem', () => {
  const c = ctxGestao()
  const pct = Math.round((c.resumo.recebidoAcumulado / c.resumo.previstoAcumulado) * 10000) / 100
  const e = explicarGestaoBatimento({ ...c, pct })
  assert.equal(somaCentavos(antesDoTotal(e.conta)), Math.round(c.resumo.recebidoAcumulado * 100))
  const divisor = e.conta?.find((l) => l.operador === '÷')
  assert.equal(divisor?.numero, c.resumo.previstoAcumulado)
  assert.equal(totais(e.conta).at(-1)?.numero, pct)
  const prevNov = infos(e.conta).find((l) => l.rotulo === 'Previsto Nov/26')
  assert.equal(prevNov?.numero, PREVISTO_NOV_CORTE)
  assert.match(prevNov?.detalhe ?? '', /até 10\/11/)
  const prevMeses = infos(e.conta).filter((l) => l.rotulo.startsWith('Previsto '))
  assert.equal(somaCentavos(prevMeses), Math.round(c.resumo.previstoAcumulado * 100))
  assert.ok(!infos(e.conta).some((l) => l.rotulo === 'Diferença de arredondamento'))
  assert.ok(temRegra(e, 'até ontem'))
})

test('Gestão › Inad. vencida: parcelas mensais = total; regra do pago depois e meta de 10%', () => {
  const c = ctxGestao()
  const e = explicarGestaoInadimplencia(c)
  const p = antesDoTotal(e.conta)
  assert.equal(p.length, 6)
  assert.equal(somaCentavos(p), Math.round(c.resumo.inadimplenciaVencidoAno * 100))
  assert.equal(totais(e.conta).at(-1)?.numero, c.resumo.inadimplenciaVencidoPctAno)
  const meta = infos(e.conta).find((l) => l.rotulo === 'Meta (teto)')
  assert.equal(meta?.numero, 10)
  assert.ok(temRegra(e, 'pago depois do mês'))
  assert.ok(temRegra(e, 'ativos e inativos'))
  assert.ok(temRegra(e, 'só entram os meses com meta que já começaram'))
})

// ---------------------------------------------------------------------------
// Inadimplência
// ---------------------------------------------------------------------------

const CTX_INAD: InadimplenciaFenixContexto = { ano: 2026, mesInicio: 1, mesFim: 11, areaLabel: null, hoje: HOJE }
const GRUPOS = [
  { nome: 'Grupo A', valor: 500_000.11 },
  { nome: 'Grupo B', valor: 300_000.22 },
  { nome: 'Grupo C', valor: 120_000 },
  { nome: 'Grupo D', valor: 90_500.5 },
  { nome: 'Grupo E', valor: 60_000 },
  { nome: 'Grupo F', valor: 30_000.33 },
  { nome: 'Grupo G', valor: 10_000 },
  { nome: 'Grupo H', valor: 999.99 },
]
const VALOR_INAD = GRUPOS.reduce((s, g) => s + g.valor, 0)

test('Inadimplência › Resultado R$: 5 maiores + demais grupos = total do card', () => {
  const e = explicarInadResultadoValor(CTX_INAD, { valor: VALOR_INAD, grupos: GRUPOS })
  const p = parcelas(e.conta)
  assert.equal(p.length, 6)
  assert.equal(p[5]?.rotulo, 'Demais 3 grupos')
  assert.equal(somaCentavos(p), Math.round(VALOR_INAD * 100))
  assert.equal(totais(e.conta)[0]?.numero, VALOR_INAD)
  assert.ok(!infos(e.conta).some((l) => l.rotulo === 'Diferença de arredondamento'))
  assert.ok(temRegra(e, 'ativos e inativos'))
  assert.ok(temRegra(e, 'não abate a dívida de outro grupo'))
  assert.ok(temRegra(e, 'Desconto concedido'))
  assert.equal(e.filtros?.find((f) => f.rotulo === 'Período')?.valor, 'Jan–Nov/2026')
  serializavel(e)
})

test('Inadimplência › Resultado R$ ajustado: conta os grupos retirados à mão', () => {
  const usados = GRUPOS.slice(0, 6)
  const valor = usados.reduce((s, g) => s + g.valor, 0)
  const e = explicarInadResultadoValor(CTX_INAD, { valor, grupos: usados, gruposExcluidos: 2, ajustado: true })
  assert.equal(somaCentavos(parcelas(e.conta)), Math.round(valor * 100))
  assert.ok(temRegra(e, '2 grupos foram retirados'))
})

test('Inadimplência › Resultado R$ sem lista: mostra o total e avisa', () => {
  const e = explicarInadResultadoValor(CTX_INAD, { valor: 123.45, grupos: [] })
  assert.equal(totais(e.conta)[0]?.numero, 123.45)
  assert.ok(infos(e.conta).some((l) => l.rotulo === 'Lista por grupo'))
})

test('Inadimplência › Resultado R$ por área: regra de rateio por departamento', () => {
  const e = explicarInadResultadoValor({ ...CTX_INAD, areaLabel: 'Trabalhista' }, { valor: VALOR_INAD, grupos: GRUPOS })
  assert.ok(temRegra(e, 'proporção do que foi faturado para cada departamento'))
  assert.match(e.fonteTecnica ?? '', /grupo_departamento_periodo/)
})

test('Inadimplência › Resultado %: saldo ÷ previsto do período; avisa do mês em andamento', () => {
  const previstoPorMes = Array.from({ length: 11 }, (_, i) => ({ mes: i + 1, valor: 1_000_000 + i * 10_000 }))
  const previsto = previstoPorMes.reduce((s, m) => s + m.valor, 0)
  const pct = Math.round((VALOR_INAD / previsto) * 10000) / 100
  const e = explicarInadResultadoPct(CTX_INAD, { valor: VALOR_INAD, pct, previstoPorMes })
  assert.equal(e.conta?.[0]?.numero, VALOR_INAD)
  assert.equal(e.conta?.[1]?.operador, '÷')
  assert.equal(e.conta?.[1]?.numero, previsto)
  assert.equal(totais(e.conta)[0]?.numero, pct)
  assert.equal(infos(e.conta).length, 11)
  assert.match(infos(e.conta)[10]?.detalhe ?? '', /ainda vai vencer/)
  assert.ok(temRegra(e, 'previsto entra cheio'))
})

test('Inadimplência › 5 maiores e concentração: só ativos no topo, bases diferentes', () => {
  const top5 = GRUPOS.slice(0, 5).map((g) => ({ cliente: g.nome, valor: g.valor }))
  const totalTop = top5.reduce((s, g) => s + g.valor, 0)
  const e = explicarInadTop5(CTX_INAD, { top5, total: totalTop })
  assert.equal(somaCentavos(parcelas(e.conta)), Math.round(totalTop * 100))
  assert.ok(temRegra(e, 'só com clientes ativos'))

  const pct = Math.round((totalTop / VALOR_INAD) * 10000) / 100
  const c = explicarInadConcentracao(CTX_INAD, { top5Total: totalTop, valor: VALOR_INAD, pct })
  assert.equal(c.conta?.[0]?.numero, totalTop)
  assert.equal(c.conta?.[1]?.numero, VALOR_INAD)
  assert.equal(totais(c.conta)[0]?.numero, pct)
  assert.ok(temRegra(c, 'bases são diferentes'))
})

test('Inadimplência › Destaque: (1º mês − último) ÷ 1º mês', () => {
  const e = explicarInadReducao(CTX_INAD, {
    primeiro: { mes: 1, valor: 800_000 },
    ultimo: { mes: 11, valor: 200_000 },
    pct: 75,
  })
  const [reducao, pct] = totais(e.conta)
  assert.equal(reducao?.numero, 600_000)
  assert.equal(pct?.numero, 75)
  assert.match(e.titulo, /Jan\/26 → Nov\/26/)
  assert.ok(temRegra(e, 'primeiro e o último mês'))
})

// ---------------------------------------------------------------------------
// Custos e resultado de caixa
// ---------------------------------------------------------------------------

function rowsCaixa(): ReceitaResultadoCaixaMesRow[] {
  const out: ReceitaResultadoCaixaMesRow[] = []
  for (const ano of [2025, 2026]) {
    for (let mes = 1; mes <= 12; mes++) {
      const f = ano === 2026 ? 1.1 : 1
      out.push({
        ano,
        mes,
        receita: Math.round(1_000_000.37 * f * 100) / 100,
        opex: Math.round(600_000.11 * f * 100) / 100,
        distribuicao: mes % 3 === 0 ? 150_000 : 0,
        investimentos: 20_000.5,
        financeiro: 5_000,
        deducoes: 1_234.56,
        repasses: 8_000,
        transferencias: mes === 5 ? 50_000 : 0,
      })
    }
  }
  return out
}

function ctxCaixa(): ResultadoCaixaFenixContexto {
  const rows = rowsCaixa()
  return {
    ano: 2026,
    mesIni: 1,
    mesFim: 11,
    parcial: true,
    rows,
    atual: somarResultadoCaixa(rows, 2026, 1, 11),
    anterior: somarResultadoCaixa(rows, 2025, 1, 11),
  }
}

test('Custos › Receita Bruta: meses somam o card e compara com o ano anterior', () => {
  const c = ctxCaixa()
  const e = explicarCaixaReceita(c)
  const p = parcelas(e.conta)
  assert.equal(p.length, 11)
  assert.equal(somaCentavos(p), Math.round(c.atual.receita * 100))
  assert.equal(totais(e.conta)[0]?.numero, c.atual.receita)
  assert.match(p[10]?.detalhe ?? '', /em andamento/)
  assert.ok(infos(e.conta).some((l) => l.rotulo.startsWith('Variação vs 2025')))
  assert.equal(e.tela, 'Receita › Custos e resultado')
  assert.ok(temRegra(e, 'data de pagamento'))
})

test('Custos › resultados da cascata fecham com a linha da tabela', () => {
  const c = ctxCaixa()
  const cascata = buildCascataResultado(c.atual, c.anterior)
  for (const key of ['resultado_operacional', 'fluxo_caixa_livre', 'geracao_caixa_liquida'] as const) {
    const linha = cascata.find((l) => l.key === key)!
    const e = explicarCaixaResultado(c, linha)
    assert.equal(somaCentavos(parcelas(e.conta)), Math.round(linha.atual * 100), key)
    assert.equal(totais(e.conta)[0]?.numero, linha.atual, key)
    assert.ok(infos(e.conta).some((l) => l.rotulo === linha.margem), key)
    assert.ok(temRegra(e, 'Repasses a terceiros'), key)
  }
  const gcl = explicarCaixaResultado(c, cascata.find((l) => l.key === 'geracao_caixa_liquida')!)
  assert.equal(parcelas(gcl.conta).length, 6)
  assert.equal(parcelas(gcl.conta)[5]?.rotulo, 'Distribuição de lucros aos sócios')
  assert.equal(parcelas(gcl.conta)[5]?.operador, '−')
  serializavel(gcl)
})

test('Custos › saídas fora do OPEX e linhas da DRE', () => {
  const c = { ...ctxCaixa(), tela: 'DL › Custos e resultado' }
  const t = explicarCaixaSaida(c, 'transferencias')
  assert.equal(totais(t.conta)[0]?.numero, 50_000)
  assert.ok(temRegra(t, 'Fica fora da conta do resultado'))
  assert.equal(t.tela, 'DL › Custos e resultado')
  const d = explicarCaixaSaida(c, 'distribuicao')
  assert.equal(somaCentavos(parcelas(d.conta)), Math.round(c.atual.distribuicao * 100))
  assert.ok(temRegra(d, 'Geração de Caixa Líquida'))
  const cascata = buildCascataResultado(c.atual, c.anterior)
  for (const l of cascata) {
    const e = explicarCaixaLinhaDre(c, l)
    assert.equal(totais(e.conta)[0]?.numero, l.atual, l.key)
  }
})

// ---------------------------------------------------------------------------
// Timesheet
// ---------------------------------------------------------------------------

const RECORTE_TODAS: TimesheetFenixRecorte = {
  ano: 2026,
  areaLabel: 'Todas as áreas',
  areas: ['Cível', 'Contratos', 'Insolvência', 'Cível | Insolvência', 'Recuperação de Crédito', 'Trabalhista'],
  podeFiltrarAreas: true,
  meses: null,
  responsavel: null,
}

test('Timesheet › Horas: minutos por mês somam o card em H:MM', () => {
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, minutos: i < 10 ? 60_000 + i * 7 : 0 }))
  const minutos = porMes.reduce((s, m) => s + m.minutos, 0)
  const e = explicarTimesheetHoras(RECORTE_TODAS, { minutos, porMes })
  const p = parcelas(e.conta)
  assert.equal(p.length, 10)
  assert.equal(p.reduce((s, l) => s + (l.numero ?? 0), 0), minutos)
  assert.equal(totais(e.conta)[0]?.numero, minutos)
  assert.equal(e.valor, '10.005:15')
  assert.ok(!infos(e.conta).some((l) => l.rotulo === 'Diferença'))
  assert.ok(temRegra(e, 'áreas jurídicas do VIOS'))
  assert.ok(temRegra(e, 'minuto mais próximo'))
  serializavel(e)
})

test('Timesheet › Lançamentos, Responsáveis e Grupos; recorte travado na área', () => {
  const travado: TimesheetFenixRecorte = { ...RECORTE_TODAS, areaLabel: 'Trabalhista', areas: ['Trabalhista'], podeFiltrarAreas: false, meses: [10, 11], responsavel: 'Fulana' }
  const porMes = [{ mes: 10, lancamentos: 120 }, { mes: 11, lancamentos: 30 }]
  const l = explicarTimesheetLancamentos(travado, { lancamentos: 150, porMes })
  assert.equal(parcelas(l.conta).reduce((s, x) => s + (x.numero ?? 0), 0), 150)
  assert.ok(temRegra(l, 'só as horas da sua área'))
  assert.ok(temRegra(l, 'Só lançamentos de Fulana'))
  assert.equal(l.filtros?.find((f) => f.rotulo === 'Meses')?.valor, 'Out/26, Nov/26')
  const r = explicarTimesheetResponsaveis(travado, { valor: 12 })
  assert.equal(totais(r.conta)[0]?.numero, 12)
  assert.ok(temRegra(r, 'sem responsável'))
  const g = explicarTimesheetGrupos(travado, { valor: 40 })
  assert.equal(g.valor, '40')
  assert.ok(temRegra(g, 'sem grupo de cliente'))
})

// ---------------------------------------------------------------------------
// Operações legais › Marketing
// ---------------------------------------------------------------------------

const CTX_MKT: MarketingFenixContexto = {
  range: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' },
  rangeMeta: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' },
  comparacao: '30 de set. de 2026 a 30 de set. de 2026',
}

test('Marketing › Alcance: soma dos posts ÷ meta de 15 mil por mês', () => {
  const e = explicarMarketingAlcance(CTX_MKT, { valor: 12_345, posts: 9, meta: 15_000, anterior: 10_000, variacao: 23.45 })
  assert.equal(e.conta?.[0]?.numero, 12_345)
  assert.equal(e.conta?.[1]?.numero, 15_000)
  assert.equal(totais(e.conta)[0]?.numero, (12_345 / 15_000) * 100)
  assert.match(infos(e.conta).find((l) => l.rotulo === 'Meta usada')?.detalhe ?? '', /× 1 mês/)
  assert.equal(e.filtros?.[0]?.valor, '01/10/2026 a 31/10/2026')
  assert.ok(temRegra(e, 'Stories ficam fora'))
  serializavel(e)
})

test('Marketing › Engajamento: interações ÷ alcance; meta fixa de 3,5%', () => {
  const valor = (420 / 12_000) * 100
  const e = explicarMarketingEngajamento(CTX_MKT, { valor, interacoes: 420, alcance: 12_000, posts: 9, anterior: 2.8, variacao: 25 })
  assert.equal(e.conta?.[0]?.numero, 420)
  assert.equal(e.conta?.[1]?.operador, '÷')
  assert.equal(totais(e.conta)[0]?.numero, valor)
  assert.equal(e.valor, '3,5%')
  assert.ok(temRegra(e, 'Não é a média das taxas'))
})

test('Marketing › Postagens por formato somam o card; Pautas pela tarefa principal', () => {
  const porFormato = [{ formato: 'Reels', posts: 5 }, { formato: 'Carrossel', posts: 3 }, { formato: 'Imagem única', posts: 1 }]
  const e = explicarMarketingPostagens(CTX_MKT, { valor: 9, meta: 12, porFormato, anterior: 7, variacao: (2 / 7) * 100 })
  const p = parcelas(e.conta).filter((l) => l.rotulo !== 'Meta do período')
  assert.equal(p.reduce((s, l) => s + (l.numero ?? 0), 0), 9)
  assert.equal(infos(e.conta).find((l) => l.rotulo === 'Faltam para a meta')?.numero, 3)

  const semData: MarketingFenixContexto = { ...CTX_MKT, range: { from: null, to: null } }
  const pa = explicarMarketingPautas(semData, { valor: 37, meta: 10, anterior: 0, variacao: null })
  assert.equal(pa.conta?.[0]?.numero, 37)
  assert.ok(temRegra(pa, 'tarefa principal foi concluída'))
  assert.ok(temRegra(pa, 'Sem filtro de data'))
  assert.equal(infos(pa.conta).find((l) => l.rotulo.startsWith('Variação'))?.valor, 'sem base anterior')
})
