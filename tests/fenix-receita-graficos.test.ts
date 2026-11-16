import test from 'node:test'
import assert from 'node:assert/strict'
import {
  explicarGraficoAcumulado,
  explicarGraficoColunas,
  explicarGraficoComparativo,
  explicarGraficoComparativoAreaLinha,
  explicarGraficoComparativoPorArea,
  explicarGraficoOpex,
  type AcumuladoFenixContexto,
  type ColunasFenixContexto,
  type ComparativoFenixContexto,
  type ComparativoPonto,
} from '../src/features/receita/fenix/receitaGraficosFenix.ts'
import type { FenixExplicacao, FenixLinha, FenixPontoGrafico } from '../src/shared/fenix/fenix.types.ts'
import type {
  ReceitaAcumuladoChartPoint,
  ReceitaColunasChartPoint,
  ReceitaMesRow,
} from '../src/features/receita/types/receita.types.ts'
import { formatCurrency, formatPercent } from '../src/shared/utils/format.ts'

/** 11/11/2026: jan–out fechados, nov em andamento, dez futuro. */
const HOJE = new Date(2026, 10, 11)
const META = 1_428_571.43

const ponto = (indice: number, serie: string | null = null): FenixPontoGrafico => ({ indice, rotulo: null, serie })
const linha = (e: FenixExplicacao, rotulo: string) => e.conta?.find((l) => l.rotulo === rotulo)
/** Parcelas antes do primeiro total, com o sinal do operador. */
const antesDoTotal = (conta: FenixLinha[] | undefined) => {
  const linhas = conta ?? []
  const fim = linhas.findIndex((l) => l.tipo === 'total')
  return (fim < 0 ? linhas : linhas.slice(0, fim)).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
}
const somaCentavos = (linhas: FenixLinha[]) =>
  linhas.reduce((s, l) => s + (l.operador === '−' ? -1 : 1) * Math.round((l.numero ?? 0) * 100), 0)
const total = (e: FenixExplicacao) => e.conta?.find((l) => l.tipo === 'total')
const serializavel = (e: FenixExplicacao) => {
  const json = JSON.stringify(e)
  assert.equal(JSON.stringify(JSON.parse(json)), json)
}

/** Linhas como as do dashboard: meta a partir de jun, nov e dez com ajuste do que faltou. */
function rows(): ReceitaMesRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const temMeta = mes >= 6
    return {
      mes,
      mesLabel: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][i]!,
      meta: temMeta ? META + (mes >= 11 ? 61_234.56 : 0) : 0,
      metaBase: temMeta ? META : 0,
      projetadoBaseAbril: 1_173_008.66,
      projetadoReal: 1_250_000,
      recebido: mes <= 11 ? 1_000_000 + mes * 10_000.25 : 0,
      previsto: 1_300_000 + mes * 1_000,
      encargos: 0,
    }
  })
}

/** Igual ao `rawChartData` do componente (R$). */
function comparativoReais(r = rows()): ComparativoPonto[] {
  return r.map((x) => ({
    mes: x.mes,
    mesLabel: x.mesLabel,
    meta: x.meta > 0 ? x.meta : null,
    projetadoBaseAbril: x.projetadoBaseAbril,
    projetadoReal: x.projetadoReal,
    recebido: x.mes <= 11 ? x.recebido : null,
    previsto: x.previsto,
    inadimplencia: x.mes <= 10 ? 90_000 + x.mes : null,
    inadimplenciaPct: x.mes <= 10 ? 7.25 : null,
  }))
}

function ctxComparativo(extra: Partial<ComparativoFenixContexto> = {}): ComparativoFenixContexto {
  const base = comparativoReais()
  return {
    ano: 2026,
    rows: rows(),
    data: base,
    baseReais: base,
    percentMode: false,
    resultadoMode: false,
    visiveis: ['meta', 'recebido', 'previsto', 'inadimplencia'],
    hoje: HOJE,
    ...extra,
  }
}

test('Comparativo (R$): mês apontado mostra cada série como no tooltip, na mesma ordem', () => {
  const c = ctxComparativo()
  const p = c.data[10]! // nov
  const e = explicarGraficoComparativo(c, ponto(10))
  assert.equal(e.titulo, 'Comparativo mensal · Nov/26')
  const series = (e.conta ?? []).filter((l) => (l.tipo ?? 'parcela') === 'parcela').map((l) => l.rotulo)
  assert.deepEqual(series, ['Recebido', 'Previsto', 'Meta'])
  assert.equal(linha(e, 'Recebido')?.valor, formatCurrency(p.recebido!))
  assert.equal(linha(e, 'Previsto')?.valor, formatCurrency(p.previsto!))
  assert.equal(linha(e, 'Meta')?.valor, formatCurrency(p.meta!))
  assert.match(linha(e, 'Meta')?.detalhe ?? '', /meta original R\$\s1\.428\.571,43 \+ R\$\s61\.234,56 do que faltou/)
  assert.match(linha(e, 'Recebido')?.detalhe ?? '', /em andamento/)
  // Inadimplência de nov ainda não congelada: explica por que não tem ponto.
  assert.equal(linha(e, 'Inadimplência')?.valor, '—')
  assert.match(linha(e, 'Inadimplência')?.detalhe ?? '', /não congelado/)
  assert.ok(e.regras?.some((r) => r.startsWith('Meta: meta mensal')))
  assert.ok(!e.regras?.some((r) => r.startsWith('Proj. real')), 'série desligada não entra nas regras')
  serializavel(e)
})

test('Comparativo (R$): inadimplência congelada traz o % sobre o previsto; série sob o mouse vira o valor', () => {
  const c = ctxComparativo()
  const e = explicarGraficoComparativo(c, ponto(6, 'inadimplencia'))
  assert.equal(e.titulo, 'Comparativo mensal · Jul/26')
  assert.equal(e.valor, formatCurrency(90_007))
  // O previsto atual do mês não é a base do % congelado: o texto mostra as duas bases.
  assert.match(linha(e, 'Inadimplência')?.detalhe ?? '', /7,25% gravado no congelamento/)
  assert.equal(e.filtros?.find((f) => f.rotulo === 'Série sob o mouse')?.valor, 'Inadimplência')

  // Quando o previsto atual ainda é a base do congelamento, o texto é o simples.
  const dados = c.data.map((p) => (p.mes === 7 ? { ...p, previsto: (p.inadimplencia ?? 0) / 0.0725 } : p))
  const igual = explicarGraficoComparativo({ ...c, data: dados }, ponto(6, 'inadimplencia'))
  assert.match(linha(igual, 'Inadimplência')?.detalhe ?? '', /7,25% do previsto do mês/)
})

test('Comparativo (% da meta): valor em % e a conta em R$ ÷ meta; mês sem meta usa o previsto', () => {
  const base = comparativoReais()
  const data: ComparativoPonto[] = base.map((p) => {
    const b = p.meta && p.meta > 0 ? p.meta : (p.previsto ?? 0)
    return {
      ...p,
      meta: p.meta ? 100 : null,
      recebido: p.recebido != null ? (p.recebido / b) * 100 : null,
      previsto: ((p.previsto ?? 0) / b) * 100,
      projetadoBaseAbril: ((p.projetadoBaseAbril ?? 0) / b) * 100,
      projetadoReal: ((p.projetadoReal ?? 0) / b) * 100,
      inadimplencia: p.inadimplenciaPct ?? null,
    }
  })
  const c = ctxComparativo({ data, baseReais: base, percentMode: true })
  const jun = explicarGraficoComparativo(c, ponto(5))
  assert.equal(jun.titulo, 'Comparativo mensal (% da meta) · Jun/26')
  assert.equal(linha(jun, 'Recebido (% meta)')?.valor, formatPercent(data[5]!.recebido!))
  assert.match(linha(jun, 'Recebido (% meta)')?.detalhe ?? '', /÷ meta R\$/)
  assert.equal(linha(jun, 'Meta (100%)')?.valor, '100,00%')
  const mar = explicarGraficoComparativo(c, ponto(2))
  assert.match(linha(mar, 'Recebido (% meta)')?.detalhe ?? '', /mês sem meta/)
  assert.ok(mar.regras?.some((r) => r.includes('usa o previsto como 100%')))
})

test('Comparativo: clique fora de um mês (ou índice inválido) explica o gráfico inteiro', () => {
  const c = ctxComparativo({ resultadoMode: true, apresentacao: true })
  for (const p of [null, ponto(99)]) {
    const e = explicarGraficoComparativo(c, p)
    assert.equal(e.titulo, 'Comparativo mensal')
    assert.equal(e.valor, 'Jan–Dez/2026')
    assert.equal(e.conta, undefined)
    assert.ok(e.regras?.some((r) => r.startsWith('Recebido:')))
    assert.ok(e.regras?.some((r) => r.startsWith('Modo Resultado')))
    assert.equal(e.filtros?.find((f) => f.rotulo === 'Contexto')?.valor, 'Apresentação (Bloco Composição)')
  }
})

test('Comparativo › por área: gap = recebido − meta da área; total das barras confere com a tabela', () => {
  const data = [
    { key: 'civel', label: 'Cível', pct: 20, meta: 300_000, metaGlobal: 2_000_000, recebido: 250_000.5, gap: -49_999.5, pctAtingido: 83.33, pctMetaGlobal: 12.5 },
    { key: 'trabalhista', label: 'Trabalhista', pct: 30, meta: 450_000, metaGlobal: 3_000_000, recebido: 500_000, gap: 50_000, pctAtingido: 111.11, pctMetaGlobal: 16.67 },
  ]
  const c = { ano: 2026, data, periodo: 'nov / 2026', tributario: 12_345.67, semDepartamento: 0, resultadoMode: false }
  const e = explicarGraficoComparativoPorArea(c, ponto(0))
  assert.equal(e.titulo, 'Meta vs. recebido por área · Cível · nov / 2026')
  assert.equal(somaCentavos(antesDoTotal(e.conta)), Math.round(data[0]!.gap * 100))
  assert.equal(total(e)?.valor, `−${formatCurrency(49_999.5)}`)
  assert.match(linha(e, 'Meta da área')?.detalhe ?? '', /20% de R\$\s1\.500\.000,00/)

  const todo = explicarGraficoComparativoPorArea({ ...c, semDepartamento: 9_000 }, null)
  const soma = 250_000.5 + 500_000 + 12_345.67
  assert.equal(somaCentavos(antesDoTotal(todo.conta)), Math.round(soma * 100))
  assert.equal(total(todo)?.numero, soma)
  assert.ok(linha(todo, 'Recebido sem departamento'))
})

test('Comparativo › área escolhida: meta = % da meta do escritório; inadimplência "não congelado"', () => {
  const r = rows()
  const data = r.map((x) => ({
    mes: x.mes,
    mesLabel: x.mesLabel,
    meta: x.meta > 0 ? (x.meta * 25) / 100 : null,
    previsto: 300_000,
    recebido: x.mes <= 11 ? 250_000 : null,
    inadimplencia: x.mes <= 10 ? 20_000 : null,
    inadimplenciaPct: x.mes <= 10 ? 6.67 : null,
  }))
  const c = { ano: 2026, area: { label: 'Cível', pct: 25 }, data, rows: r, periodo: 'Acumulado 2026', resultadoMode: false, hoje: HOJE }
  const nov = explicarGraficoComparativoAreaLinha(c, ponto(10))
  assert.equal(nov.titulo, 'Comparativo mensal — Cível · Nov/26')
  assert.equal(linha(nov, 'Meta da área')?.valor, formatCurrency(data[10]!.meta!))
  assert.match(linha(nov, 'Meta da área')?.detalhe ?? '', /25% de/)
  assert.equal(linha(nov, 'Inadimplência')?.valor, 'não congelado')
  const out = explicarGraficoComparativoAreaLinha(c, ponto(9))
  assert.equal(linha(out, '% inadimplência')?.valor, '6,67%')
  assert.ok(out.regras?.some((x) => x.includes('calculada na hora')))
})

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------

const SLICES = [
  { departamento: 'Cível', dataKey: 'rec_civel', color: '#000' },
  { departamento: 'Trabalhista', dataKey: 'rec_trabalhista', color: '#111' },
  { departamento: 'Contratos', dataKey: 'rec_contratos', color: '#222' },
]

function colunasReais(): ReceitaColunasChartPoint[] {
  return rows().map((r) => ({
    mes: r.mes,
    mesLabel: r.mesLabel,
    meta: r.meta,
    projetadoBaseAbril: r.projetadoBaseAbril,
    projetadoReal: r.projetadoReal,
    previsto: r.previsto,
    recebidoTotal: r.mes <= 11 ? 1_000_000 : null,
    rec_civel: r.mes <= 11 ? 333_333.33 : null,
    rec_trabalhista: r.mes <= 11 ? 333_333.33 : null,
    rec_contratos: r.mes <= 11 ? 330_000 : null,
  }))
}

function ctxColunas(extra: Partial<ColunasFenixContexto> = {}): ColunasFenixContexto {
  const base = colunasReais()
  return {
    ano: 2026,
    data: base,
    baseReais: base,
    slices: SLICES,
    rows: rows(),
    planoMode: false,
    percentMetaMode: false,
    porArea: true,
    mostrarRecebido: true,
    metricasVisiveis: ['meta', 'previsto'],
    hoje: HOJE,
    ...extra,
  }
}

test('Colunas (R$ por área): áreas somam o total; sem departamento, meta e atingido à parte', () => {
  const c = ctxColunas()
  const e = explicarGraficoColunas(c, ponto(9))
  assert.equal(e.titulo, 'Recebido por área · Out/26')
  const parcelas = antesDoTotal(e.conta)
  assert.deepEqual(parcelas.map((l) => l.rotulo), ['Cível', 'Trabalhista', 'Contratos'])
  const soma = 333_333.33 * 2 + 330_000
  assert.equal(somaCentavos(parcelas), Math.round(soma * 100))
  assert.equal(total(e)?.valor, formatCurrency(soma))
  assert.equal(linha(e, 'Recebido sem departamento')?.numero, 1_000_000 - soma)
  assert.equal(linha(e, 'Meta')?.valor, formatCurrency(META))
  assert.equal(linha(e, 'Previsto')?.valor, formatCurrency(1_310_000))
  assert.ok(linha(e, 'Atingido'))
  serializavel(e)
})

test('Colunas (consolidado): coluna = recebido oficial, legenda = soma das áreas', () => {
  const e = explicarGraficoColunas(ctxColunas({ porArea: false }), ponto(9))
  assert.equal(e.titulo, 'Recebido consolidado · Out/26')
  assert.equal(linha(e, 'Altura da coluna')?.numero, 1_000_000)
})

test('Colunas (% da meta): parcelas em % com nota de arredondamento quando não fecham', () => {
  const base = colunasReais().map((p) => ({ ...p, rec_civel: 476_190.48, rec_trabalhista: 476_190.48, rec_contratos: 476_190.47 }))
  const data = base.map((p) => {
    const meta = Number(p.meta) || 0
    if (meta <= 0) return { ...p }
    return {
      ...p,
      meta: 100,
      previsto: (Number(p.previsto) / meta) * 100,
      projetadoBaseAbril: (Number(p.projetadoBaseAbril) / meta) * 100,
      projetadoReal: (Number(p.projetadoReal) / meta) * 100,
      recebidoTotal: p.recebidoTotal != null ? (Number(p.recebidoTotal) / meta) * 100 : null,
      rec_civel: (476_190.48 / meta) * 100,
      rec_trabalhista: (476_190.48 / meta) * 100,
      rec_contratos: (476_190.47 / meta) * 100,
    }
  })
  const c = ctxColunas({ data, baseReais: base, percentMetaMode: true, metricasVisiveis: ['previsto'] })
  const e = explicarGraficoColunas(c, ponto(6))
  assert.equal(e.titulo, 'Recebido por área (% da meta) · Jul/26')
  const parcelas = antesDoTotal(e.conta)
  assert.equal(parcelas.length, 3)
  assert.match(parcelas[0]?.valor ?? '', /%$/)
  assert.match(parcelas[0]?.detalhe ?? '', /÷ meta R\$/)
  assert.ok(linha(e, 'Arredondamento'), 'nota quando 33,33% × 3 não dá 100,00%')
  // Mês sem meta continua em R$ no gráfico em %.
  const mar = explicarGraficoColunas(c, ponto(2))
  assert.match(total(mar)?.valor ?? '', /^R\$/)
  assert.ok(linha(mar, 'Mês sem meta'))
})

test('Colunas: área escolhida e gráfico inteiro', () => {
  const base = colunasReais().map((p) => ({ ...p, meta: Number(p.meta) * 0.2, previsto: 260_000 }))
  const c = ctxColunas({ data: base, baseReais: base, slices: [SLICES[0]!], area: { label: 'Cível', pct: 20 } })
  const e = explicarGraficoColunas(c, ponto(6))
  assert.equal(e.titulo, 'Cível · Jul/26')
  assert.equal(linha(e, 'Recebido da área')?.numero, 333_333.33)
  assert.match(linha(e, 'Previsto')?.detalhe ?? '', /Cível/)
  const todo = explicarGraficoColunas(c, null)
  assert.equal(todo.titulo, 'Cível')
  assert.equal(todo.valor, 'Jan–Dez/2026')
})

// ---------------------------------------------------------------------------
// Acumulado
// ---------------------------------------------------------------------------

/** Mesma regra de buildAcumuladoChartData / metaAcumuladaPorMes. */
function acumuladoReais(r = rows()): ReceitaAcumuladoChartPoint[] {
  let rec = 0
  let prev = 0
  let metaBaseCum = 0
  let recFechado = 0
  let restante = 0
  return r.map((x) => {
    const temMeta = x.metaBase > 0
    const futuro = x.mes > 11
    let meta = 0
    if (temMeta) {
      metaBaseCum += x.metaBase
      if (x.mes < 11) {
        recFechado += x.recebido
        restante = 0
        meta = metaBaseCum
      } else {
        restante += x.meta
        meta = recFechado + restante
      }
      if (!futuro) rec += x.recebido
      prev += x.previsto
    }
    return {
      mes: x.mes,
      mesLabel: x.mesLabel,
      recebidoAcumulado: futuro ? null : rec,
      previstoAcumulado: prev,
      metaAcumulada: meta,
    }
  })
}

function ctxAcumulado(extra: Partial<AcumuladoFenixContexto> = {}): AcumuladoFenixContexto {
  const base = acumuladoReais()
  return {
    ano: 2026,
    rows: rows(),
    data: base,
    baseReais: base,
    percentMode: false,
    porArea: false,
    slices: [],
    visiveis: ['recebidoAcumulado', 'previstoAcumulado', 'metaAcumulada'],
    hoje: HOJE,
    ...extra,
  }
}

test('Acumulado (R$): recebido de jun até o mês soma o valor da barra; meta acumulada explicada', () => {
  const c = ctxAcumulado()
  const p = c.data[10]!
  const e = explicarGraficoAcumulado(c, ponto(10))
  assert.equal(e.titulo, 'Valores acumulados · Nov/26')
  const parcelas = antesDoTotal(e.conta)
  assert.equal(parcelas.length, 6)
  assert.equal(somaCentavos(parcelas), Math.round(Number(p.recebidoAcumulado) * 100))
  assert.equal(total(e)?.numero, p.recebidoAcumulado)
  assert.equal(linha(e, 'Previsto acumulado')?.valor, formatCurrency(p.previstoAcumulado))
  assert.equal(linha(e, 'Meta acumulada')?.valor, formatCurrency(p.metaAcumulada))
  assert.match(linha(e, 'Meta acumulada')?.detalhe ?? '', /recebido dos meses fechados/)
  const set = explicarGraficoAcumulado(c, ponto(8))
  assert.match(linha(set, 'Meta acumulada')?.detalhe ?? '', /soma da meta original de Jun–Set\/2026/)
  const dez = explicarGraficoAcumulado(c, ponto(11))
  assert.equal(linha(dez, 'Recebido acumulado')?.valor, '—')
  serializavel(e)
})

test('Acumulado (% por área): áreas somam o total da legenda', () => {
  const base = acumuladoReais()
  const areas = [
    { departamento: 'Cível', dataKey: 'rec_civel', color: '#000' },
    { departamento: 'Trabalhista', dataKey: 'rec_trabalhista', color: '#111' },
  ]
  const data = base.map((p) => {
    const meta = p.metaAcumulada
    if (meta <= 0) return { ...p, recebidoAcumulado: null, previstoAcumulado: 0, metaAcumulada: 0, rec_civel: null, rec_trabalhista: null }
    const civ = (Number(p.recebidoAcumulado ?? 0) * 0.40001) / meta * 100
    const trab = (Number(p.recebidoAcumulado ?? 0) * 0.59999) / meta * 100
    return { ...p, rec_civel: civ, rec_trabalhista: trab, recebidoAcumulado: civ + trab, previstoAcumulado: (p.previstoAcumulado / meta) * 100, metaAcumulada: 100 }
  })
  const c = ctxAcumulado({ data, baseReais: base, percentMode: true, porArea: true, slices: areas, visiveis: ['recebidoAcumulado', 'previstoAcumulado'] })
  const e = explicarGraficoAcumulado(c, ponto(7))
  assert.equal(e.titulo, 'Atingimento acumulado por área (% da meta) · Ago/26')
  const parcelas = antesDoTotal(e.conta)
  assert.deepEqual(parcelas.map((l) => l.rotulo), ['Trabalhista', 'Cível'])
  assert.equal(total(e)?.numero, Number(data[7]!.rec_civel) + Number(data[7]!.rec_trabalhista))
  assert.equal(e.valor, formatPercent(Number(data[7]!.recebidoAcumulado)))
  assert.match(linha(e, 'Previsto acumulado (% da meta)')?.detalhe ?? '', /÷ meta acumulada/)
})

// ---------------------------------------------------------------------------
// Custos › OPEX mês a mês
// ---------------------------------------------------------------------------

test('OPEX mês a mês: mês = atual − ano anterior; gráfico inteiro soma o cabeçalho', () => {
  const data = [
    { mes: 9, label: 'set', anterior: 500_000, atual: 550_000.1, varPct: 10.00002 },
    { mes: 10, label: 'out', anterior: 520_000, atual: 510_000, varPct: ((510_000 - 520_000) / 520_000) * 100 },
    { mes: 11, label: 'nov*', anterior: 530_000, atual: 200_000, varPct: ((200_000 - 530_000) / 530_000) * 100 },
  ]
  const c = { ano: 2026, data, totalAtual: 1_260_000.1, totalAnterior: 1_550_000, parcial: true }
  const e = explicarGraficoOpex(c, ponto(2))
  assert.equal(e.titulo, 'OPEX mês a mês · Nov/26')
  assert.equal(total(e)?.numero, 200_000 - 530_000)
  assert.ok(e.regras?.some((r) => r.includes('(*)')))
  const todo = explicarGraficoOpex(c, null)
  assert.equal(somaCentavos(antesDoTotal(todo.conta)), Math.round(1_260_000.1 * 100))
  assert.equal(total(todo)?.numero, 1_260_000.1)
  assert.equal(todo.tela, 'Receita › Custos e resultado')
})
