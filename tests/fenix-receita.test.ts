import test from 'node:test'
import assert from 'node:assert/strict'
import {
  explicarMeComposicao,
  explicarMeGap,
  explicarMeMeta,
  explicarReceitaAtingimento,
  explicarReceitaMetaAcumulada,
  explicarReceitaPrevisto,
  explicarReceitaRecebido,
  periodoMeses,
  type ReceitaMeFenixContexto,
} from '../src/features/receita/fenix/receitaFenix.ts'
import { calcularGapMeta, montarMesAMes } from '../src/features/receita/utils/receitaMeCalc.ts'
import type { FenixLinha } from '../src/shared/fenix/fenix.types.ts'
import type { ReceitaMesRow } from '../src/features/receita/types/receita.types.ts'

/** 11/11/2026: jan–out fechados, nov em andamento, dez futuro. */
const HOJE = new Date(2026, 10, 11)
const META = 1_000_000

function rows(): ReceitaMesRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const temMeta = mes >= 6
    return {
      mes,
      mesLabel: String(mes),
      meta: temMeta ? META + (mes >= 11 ? 50_000 : 0) : 0,
      metaBase: temMeta ? META : 0,
      projetadoBaseAbril: 0,
      projetadoReal: 0,
      recebido: mes <= 11 ? 100_000 * mes : 0,
      previsto: 200_000,
      encargos: mes === 3 ? 1_500 : 0,
    }
  })
}

const parcelas = (conta: FenixLinha[] | undefined) =>
  (conta ?? []).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
const soma = (linhas: FenixLinha[]) => linhas.reduce((s, l) => s + (l.numero ?? 0), 0)
const totais = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'total')

test('Recebido: meses até o atual, soma das parcelas = total do card', () => {
  const r = rows()
  const total = r.filter((x) => x.mes <= 11).reduce((s, x) => s + x.recebido, 0)
  const exp = explicarReceitaRecebido({ ano: 2026, rows: r, total, periodo: 'Jan–Nov/2026', hoje: HOJE })
  const p = parcelas(exp.conta)
  assert.equal(p.length, 11)
  assert.equal(soma(p), total)
  assert.equal(totais(exp.conta)[0]?.numero, total)
  assert.match(p[10]?.detalhe ?? '', /em andamento/)
  assert.ok(exp.regras?.some((x) => x.includes('sucumbência') && x.includes('advocatícios')))
})

test('Previsto: inclui mês futuro e avisa que são títulos já lançados', () => {
  const r = rows()
  const exp = explicarReceitaPrevisto({ ano: 2026, rows: r, total: 2_400_000, periodo: 'Jan–Dez/2026', hoje: HOJE })
  const p = parcelas(exp.conta)
  assert.equal(p.length, 12)
  assert.equal(soma(p), 2_400_000)
  assert.match(p[11]?.detalhe ?? '', /futuro/)
})

test('Meta acumulada: meta mensal × meses com meta, e mostra a meta ajustada do mês atual em diante', () => {
  const exp = explicarReceitaMetaAcumulada({ ano: 2026, rows: rows(), metaAnual: 7 * META, metaMensal: META + 50_000, hoje: HOJE })
  assert.equal(exp.conta?.[0]?.numero, META)
  assert.equal(exp.conta?.[1]?.numero, 7)
  assert.equal(exp.conta?.[1]?.operador, '×')
  assert.equal(totais(exp.conta)[0]?.numero, 7 * META)
  const info = (exp.conta ?? []).filter((l) => l.tipo === 'info')
  assert.deepEqual(info.map((l) => l.rotulo), ['Meta ajustada de Nov/26', 'Meta ajustada de Dez/26'])
  assert.match(info[0]?.detalhe ?? '', /do que faltou antes/)
  assert.ok(exp.regras?.some((x) => x.includes('Jan–Mai/2026')))
})

test('Atingimento: recebido dos meses com meta ÷ meta do ano', () => {
  const r = rows()
  const recebidoAcumulado = [6, 7, 8, 9, 10, 11].reduce((s, m) => s + 100_000 * m, 0)
  const exp = explicarReceitaAtingimento({
    ano: 2026,
    rows: r,
    recebidoAcumulado,
    metaAnual: 7 * META,
    pct: (recebidoAcumulado / (7 * META)) * 100,
    mesesSelecionados: [6, 7, 8, 9, 10, 11],
    mesesMetaDecorridos: [6, 7, 8, 9, 10, 11],
    hoje: HOJE,
  })
  const p = parcelas(exp.conta)
  assert.equal(soma(p.filter((l) => l.operador !== '÷')), recebidoAcumulado)
  assert.equal(exp.conta?.find((l) => l.operador === '÷')?.numero, 7 * META)
  assert.ok(exp.regras?.some((x) => x.startsWith('O divisor é a meta do ano inteiro')))
  assert.ok(!exp.regras?.some((x) => x.includes('escolhidos à mão')))
  const ref = exp.conta?.find((l) => l.rotulo.startsWith('Referência'))
  assert.equal(ref?.numero, 6 * META)
})

test('Atingimento: seleção manual de meses aparece nas regras', () => {
  const exp = explicarReceitaAtingimento({
    ano: 2026,
    rows: rows(),
    recebidoAcumulado: 1_700_000,
    metaAnual: 7 * META,
    pct: 24.29,
    mesesSelecionados: [8, 9],
    mesesMetaDecorridos: [6, 7, 8, 9, 10, 11],
    hoje: HOJE,
  })
  assert.ok(exp.regras?.some((x) => x.includes('escolhidos à mão') && x.includes('Ago/26, Set/26')))
})

function ctxMe(over: Partial<ReceitaMeFenixContexto> = {}): ReceitaMeFenixContexto {
  const linhas = montarMesAMes({
    mesesMeta: [6, 7, 8, 9, 10, 11, 12],
    metaPorMes: { 6: 100, 7: 100, 8: 100, 9: 100, 10: 100, 11: 120, 12: 120 },
    metaBasePorMes: { 6: 100, 7: 100, 8: 100, 9: 100, 10: 100, 11: 100, 12: 100 },
    realizadoPorMes: { 6: 90, 7: 80, 8: 100, 9: 95, 10: 85 },
    mePorMes: { 11: 110, 12: 105 },
    mesesHorizonte: [11, 12],
  })
  return {
    ano: 2026,
    escopo: 'Trabalhista',
    pctArea: 15.33,
    linhas,
    gap: calcularGapMeta(linhas),
    composicao: { recebido: 40, aberto: 200, fora: 30, foraAtraso: 20, foraNaoPaga: 10, novas: 5, potencial: 8, me: 215 },
    periodoMeta: 'Jun/26–Dez/26',
    periodoMe: 'Nov/26–Dez/26',
    mesCorrente: 11,
    ...over,
  }
}

test('ME meta da área: meta original por mês somada, com a meta do escritório como referência', () => {
  const c = ctxMe()
  const exp = explicarMeMeta(c)
  assert.equal(soma(parcelas(exp.conta)), 700)
  assert.equal(totais(exp.conta)[0]?.numero, c.gap.metaTotal)
  assert.match(exp.resumo, /15,33%/)
  assert.ok(exp.regras?.some((x) => x.includes('Insolvência 46,85%')))
})

test('ME meta da área: avisa quando as linhas arredondadas não somam o total exibido', () => {
  const base = 1_428_571.43 * 0.4685
  const linhas = montarMesAMes({
    mesesMeta: [6, 7, 8, 9, 10, 11, 12],
    metaPorMes: Object.fromEntries([6, 7, 8, 9, 10, 11, 12].map((m) => [m, base])),
    realizadoPorMes: {},
    mePorMes: {},
    mesesHorizonte: [11, 12],
  })
  const exp = explicarMeMeta(ctxMe({ linhas, gap: calcularGapMeta(linhas) }))
  const nota = exp.conta?.find((l) => l.rotulo === 'Frações de centavo')
  assert.equal(nota?.tipo, 'info')
  assert.equal(nota?.valor, 'R$ 0,03')
  assert.match(nota?.detalhe ?? '', /4\.684\.999,97/)

  assert.ok(!explicarMeMeta(ctxMe()).conta?.some((l) => l.rotulo === 'Frações de centavo'))
})

test('ME composição: fecha com a ME e sinaliza arredondamento quando sobra diferença', () => {
  const exata = explicarMeComposicao(ctxMe())
  assert.ok(!exata.conta?.some((l) => l.rotulo === 'Arredondamento'))
  assert.equal(totais(exata.conta)[0]?.numero, 215)

  const comDif = explicarMeComposicao(ctxMe({ composicao: { ...ctxMe().composicao, me: 214.5 } }))
  const arred = comDif.conta?.find((l) => l.rotulo === 'Arredondamento')
  assert.equal(arred?.numero, -0.5)
  assert.equal(arred?.operador, '−')
  assert.equal(arred?.valor, 'R$ 0,50')
  assert.match(arred?.detalhe ?? '', /até R\$ 1/)

  const centavo = explicarMeComposicao(ctxMe({ composicao: { ...ctxMe().composicao, me: 214.99 } }))
  const linhaCentavo = centavo.conta?.find((l) => l.rotulo === 'Arredondamento')
  assert.equal(linhaCentavo?.valor, 'R$ 0,01')
  assert.match(linhaCentavo?.detalhe ?? '', /centavos/)
  assert.ok(comDif.conta?.some((l) => l.rotulo === 'Potencial com chance baixa' && l.tipo === 'info'))
})

test('ME gap: mostra a sobra quando a projeção passa da meta', () => {
  const c = ctxMe()
  const exp = explicarMeGap({ ...c, gap: { ...c.gap, gap: -50, projecao: c.gap.metaTotal + 50 } })
  assert.equal(exp.valor, 'R$ 0,00')
  assert.ok(exp.conta?.some((l) => l.rotulo.startsWith('Sobra')))
})

test('periodoMeses usa o mesmo formato dos cards', () => {
  assert.equal(periodoMeses(2026, [6, 7, 8, 9, 10, 11, 12]), 'Jun–Dez/2026')
  assert.equal(periodoMeses(2026, [3]), 'Mar/2026')
})
