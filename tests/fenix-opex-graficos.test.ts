import test from 'node:test'
import assert from 'node:assert/strict'
import {
  explicarGraficoOpexDepartamentos,
  explicarGraficoOpexDetalhe,
  explicarGraficoOpexMensal,
  explicarGraficoOpexOrcamento,
  type OpexDetalheBarra,
  type OpexGraficoDepartamentosContexto,
  type OpexGraficoDetalheContexto,
  type OpexGraficoMensalContexto,
  type OpexMensalPonto,
} from '../src/features/opex/fenix/opexGraficosFenix.ts'
import type { FenixExplicacao, FenixLinha, FenixPontoGrafico } from '../src/shared/fenix/fenix.types.ts'
import { formatCurrency } from '../src/shared/utils/format.ts'

/** 11/11/2026: jan–out fechados, nov em andamento, dez futuro. */
const HOJE = new Date(2026, 10, 11)

const ponto = (indice: number, serie: string | null = null): FenixPontoGrafico => ({ indice, rotulo: null, serie })
const linha = (e: FenixExplicacao, rotulo: string) => e.conta?.find((l) => l.rotulo === rotulo)
const total = (e: FenixExplicacao) => e.conta?.find((l) => l.tipo === 'total')
/** Parcelas antes do primeiro total, com o sinal do operador. */
const antesDoTotal = (conta: FenixLinha[] | undefined) => {
  const linhas = conta ?? []
  const fim = linhas.findIndex((l) => l.tipo === 'total')
  return (fim < 0 ? linhas : linhas.slice(0, fim)).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
}
const somaCentavos = (linhas: FenixLinha[]) =>
  linhas.reduce((s, l) => s + (l.operador === '−' ? -1 : 1) * Math.round((l.numero ?? 0) * 100), 0)
const fecha = (e: FenixExplicacao) =>
  assert.equal(somaCentavos(antesDoTotal(e.conta)), Math.round((total(e)?.numero ?? NaN) * 100))
const serializavel = (e: FenixExplicacao) => {
  const json = JSON.stringify(e)
  assert.equal(JSON.stringify(JSON.parse(json)), json)
}

// ---------------------------------------------------------------------------
// Orçamento x realizado mensal
// ---------------------------------------------------------------------------

const mensal: OpexMensalPonto[] = Array.from({ length: 12 }, (_, i) => {
  const mes = i + 1
  return {
    mes,
    mesLabel: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][i]!,
    previsto: 1_000_000 + mes * 1_000.33,
    previsto_vios: 950_000,
    realizado: mes <= 11 ? 980_000 + mes * 2_000.17 : 0,
    projetado_fixas: mes <= 11 ? 600_000 : 610_500.5,
    variacao: 0,
    projetado_fixas_chart: mes > 11 ? 610_500.5 : null,
    ativo: true,
  }
})
const ctxMensal: OpexGraficoMensalContexto = {
  ctx: { ano: 2026, mesAtual: 11, mesesFiltro: [], orcamentoImportado: true, planoFiltro: { gruposExcluidos: [], planosExcluidos: [] }, hoje: HOJE },
  data: mensal,
}

test('Gráfico mensal › mês: realizado − orçamento fecha e mostra as séries do tooltip', () => {
  const e = explicarGraficoOpexMensal(ctxMensal, ponto(2))
  const mar = mensal[2]!
  fecha(e)
  assert.equal(total(e)?.numero, mar.realizado - mar.previsto)
  assert.equal(linha(e, 'Realizado')?.valor, formatCurrency(mar.realizado))
  assert.equal(linha(e, 'Orçamento')?.valor, formatCurrency(mar.previsto))
  assert.equal(linha(e, 'Previsto VIOS (fora do gráfico)')?.numero, mar.previsto_vios)
  assert.equal(linha(e, 'Projeção fixas'), undefined)
  assert.equal(e.valor, formatCurrency(mar.realizado))
  assert.ok(e.regras?.some((r) => r.includes('data de pagamento')))
  serializavel(e)
})

test('Gráfico mensal › série sob o mouse, mês em andamento e mês futuro com projeção', () => {
  const nov = explicarGraficoOpexMensal(ctxMensal, ponto(10, 'previsto'))
  assert.equal(nov.valor, formatCurrency(mensal[10]!.previsto))
  assert.ok(nov.filtros?.some((f) => f.valor === 'Orçamento'))
  assert.match(linha(nov, 'Realizado')?.detalhe ?? '', /andamento/)
  assert.ok(nov.regras?.some((r) => r.includes('Nov/26') && r.includes('até hoje')))

  const dez = explicarGraficoOpexMensal(ctxMensal, ponto(11, 'projetado_fixas_chart'))
  assert.equal(linha(dez, 'Projeção fixas')?.numero, 610_500.5)
  assert.equal(dez.valor, formatCurrency(610_500.5))
  assert.match(linha(dez, 'Realizado')?.detalhe ?? '', /futuro/)
})

test('Gráfico mensal › clique fora de um mês explica o ano: meses somam o realizado', () => {
  const e = explicarGraficoOpexMensal(ctxMensal, null)
  fecha(e)
  const soma = mensal.reduce((s, m) => s + m.realizado, 0)
  assert.equal(antesDoTotal(e.conta).length, 11)
  assert.equal(Math.round((total(e)?.numero ?? 0) * 100), Math.round(soma * 100))
  assert.equal(
    Math.round((linha(e, 'Orçamento 2026 (12 meses)')?.numero ?? 0) * 100),
    Math.round(mensal.reduce((s, m) => s + m.previsto, 0) * 100),
  )
  assert.match(linha(e, 'Projeção fixas por mês')?.detalhe ?? '', /Dez\/26/)
  // Índice fora do array também cai na visão do gráfico inteiro.
  assert.equal(explicarGraficoOpexMensal(ctxMensal, ponto(40)).titulo, e.titulo)
})

// ---------------------------------------------------------------------------
// Detalhe por grupo / plano
// ---------------------------------------------------------------------------

const barra = (key: string, previsto: number, realizado: number, projetado = 0, anterior = 0): OpexDetalheBarra => ({
  key,
  label: key,
  previsto,
  realizado,
  projetado,
  realizadoTotal: realizado + projetado,
  realizadoAnterior: anterior,
  variacao: realizado + projetado - previsto,
  variacaoYoY: realizado + projetado - anterior,
})

const ctxDetalhe = (over: Partial<OpexGraficoDetalheContexto> = {}): OpexGraficoDetalheContexto => ({
  ctx: { ano: 2026, mesAtual: 11, orcamentoImportado: true, planoFiltro: { gruposExcluidos: [], planosExcluidos: [] }, hoje: HOJE },
  data: [barra('REMUNERAÇÃO FIXA', 5_000_000, 4_400_000.11, 400_000.01, 4_000_000), barra('MARKETING', 300_000, 250_000.5)],
  periodo: 'ano',
  grupo: null,
  compararAnoAnterior: false,
  mostrarProjecao: true,
  ...over,
})

test('Detalhe › grupo no ano: realizado + projetado − orçamento = variação', () => {
  const e = explicarGraficoOpexDetalhe(ctxDetalhe(), ponto(0))
  fecha(e)
  const b = ctxDetalhe().data[0]!
  assert.equal(total(e)?.numero, b.variacao)
  assert.match(linha(e, 'Projetado até dezembro')?.detalhe ?? '', /÷ 11 × 1 meses restantes/)
  assert.equal(linha(e, 'Realizado + projetado (número no fim da barra)')?.numero, b.realizadoTotal)
  assert.ok(e.regras?.some((r) => r.includes('grupos fixos') && r.includes('não soma o orçamento')))
  serializavel(e)
})

test('Detalhe › mês sem projeção e comparação com o ano anterior', () => {
  const mes = explicarGraficoOpexDetalhe(ctxDetalhe({ periodo: 3, mostrarProjecao: false }), ponto(1))
  fecha(mes)
  assert.equal(linha(mes, 'Projetado até dezembro'), undefined)
  assert.ok(mes.regras?.some((r) => r.includes('Mar/2026')))

  const yoy = explicarGraficoOpexDetalhe(ctxDetalhe({ compararAnoAnterior: true }), ponto(0, 'realizadoAnterior'))
  fecha(yoy)
  const b = ctxDetalhe().data[0]!
  assert.equal(total(yoy)?.numero, b.variacaoYoY)
  assert.ok(yoy.filtros?.some((f) => f.valor === 'Realizado 2025'))
  assert.ok(yoy.regras?.some((r) => r.includes('De-Para')))
  assert.ok(yoy.regras?.some((r) => r.includes('2025') && r.includes('folha')))
})

test('Detalhe › gráfico inteiro: barras somam o realizado; aviso do orçamento por plano', () => {
  const e = explicarGraficoOpexDetalhe(ctxDetalhe(), null)
  fecha(e)
  assert.equal(antesDoTotal(e.conta).length, 2)
  const planos = explicarGraficoOpexDetalhe(
    ctxDetalhe({
      grupo: 'MARKETING',
      ctx: { ano: 2026, mesAtual: 11, orcamentoImportado: true, planoFiltro: { gruposExcluidos: [], planosExcluidos: ['MARKETING|EVENTOS'] }, hoje: HOJE },
    }),
    null,
  )
  assert.ok(planos.regras?.some((r) => r.includes('orçamento não aplica o filtro')))
  assert.match(planos.titulo, /MARKETING · planos/)
})

// ---------------------------------------------------------------------------
// Custos por área / departamento
// ---------------------------------------------------------------------------

const fatias = [
  { departamento: 'Cível', label: 'Cível', dataKey: 'd_civel' },
  { departamento: 'Facilities', label: 'Facilities', dataKey: 'd_facilities' },
  { departamento: 'T.I.', label: 'T.I.', dataKey: 'd_ti' },
]
const dadosDept = Array.from({ length: 12 }, (_, i) => {
  const mes = i + 1
  const civel = mes <= 11 ? 10_000.333 : 0
  const fac = mes <= 11 ? 20_000.333 : 0
  const ti = mes === 3 ? 0 : mes <= 11 ? 5_000 : 0
  return { mes, mesLabel: String(mes), ativo: true, d_civel: civel, d_facilities: fac, d_ti: ti, total: civel + fac + ti }
})
const ctxDept: OpexGraficoDepartamentosContexto = {
  ano: 2026,
  mesAtual: 11,
  mesesFiltro: [],
  metric: 'realizado',
  somenteFixas: false,
  fatias,
  ocultas: ['Marketing'],
  data: dadosDept,
  total: dadosDept.reduce((s, d) => s + d.total, 0),
  hoje: HOJE,
}

test('Departamentos › mês: áreas somam o total do tooltip, com nota de arredondamento', () => {
  const e = explicarGraficoOpexDepartamentos(ctxDept, ponto(2))
  const p = antesDoTotal(e.conta)
  assert.equal(p.length, 2)
  assert.equal(e.valor, formatCurrency(dadosDept[2]!.total))
  assert.equal(linha(e, 'Áreas sem valor no mês')?.numero, 1)
  // 10.000,33 + 20.000,33 = 30.000,66 na tela; o exato é 30.000,666 → R$ 30.000,67.
  const nota = linha(e, 'Arredondamento')
  assert.ok(nota)
  assert.equal(somaCentavos(p) + Math.round((nota.numero ?? 0) * 100), Math.round(dadosDept[2]!.total * 100))
  assert.ok(e.regras?.some((r) => r.includes('inclui investimentos')))
  assert.ok(e.regras?.some((r) => r.includes('Marketing')))
  serializavel(e)
})

test('Departamentos › previsto é VIOS por vencimento, e o gráfico inteiro soma por área', () => {
  const prev = explicarGraficoOpexDepartamentos({ ...ctxDept, metric: 'previsto' }, ponto(0))
  assert.ok(prev.regras?.some((r) => r.includes('não é o orçamento congelado')))
  const todo = explicarGraficoOpexDepartamentos(ctxDept, null)
  const p = antesDoTotal(todo.conta)
  assert.deepEqual(p.map((l) => l.rotulo), ['Cível', 'Facilities', 'T.I.'])
  const nota = linha(todo, 'Arredondamento')
  assert.equal(
    somaCentavos(p) + Math.round((nota?.numero ?? 0) * 100),
    Math.round(ctxDept.total * 100),
  )
})

// ---------------------------------------------------------------------------
// Distribuição mensal do orçamento
// ---------------------------------------------------------------------------

test('Orçamento › mês: grupos somam o ponto, com "Demais" quando passam de 10', () => {
  const linhas = Array.from({ length: 14 }, (_, i) => ({
    mes: 5,
    grupo_conta: `GRUPO ${String(i + 1).padStart(2, '0')}`,
    plano_contas: 'PLANO',
    valor: 1_000 * (i + 1),
  }))
  linhas.push({ mes: 6, grupo_conta: 'GRUPO 01', plano_contas: 'PLANO', valor: 777 })
  const data = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    label: String(i + 1),
    total: linhas.filter((l) => l.mes === i + 1).reduce((s, l) => s + l.valor, 0),
  }))
  const e = explicarGraficoOpexOrcamento({ ano: 2026, linhas, data, mesSelecionado: null, busca: 'aluguel' }, ponto(4))
  fecha(e)
  const p = antesDoTotal(e.conta)
  assert.equal(p.length, 10)
  assert.equal(p[9]?.rotulo, 'Demais 5 grupos')
  assert.equal(e.valor, formatCurrency(data[4]!.total))
  assert.ok(e.regras?.some((r) => r.includes('"aluguel"')))

  const doGrupo = explicarGraficoOpexOrcamento(
    { ano: 2026, linhas: linhas.filter((l) => l.grupo_conta === 'GRUPO 01'), data, grupo: 'GRUPO 01', mesSelecionado: null },
    ponto(5),
  )
  assert.equal(antesDoTotal(doGrupo.conta)[0]?.rotulo, 'PLANO')

  const todo = explicarGraficoOpexOrcamento({ ano: 2026, linhas, data, mesSelecionado: null }, null)
  fecha(todo)
  assert.equal(antesDoTotal(todo.conta).length, 2)
  serializavel(todo)
})
