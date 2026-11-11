import test from 'node:test'
import assert from 'node:assert/strict'
import { explicarGraficoTimesheetMes } from '../src/features/timesheet/fenix/timesheetGraficosFenix.ts'
import type { TimesheetFenixRecorte } from '../src/features/timesheet/fenix/timesheetFenix.ts'
import {
  explicarGraficoConta,
  explicarGraficoFormato,
  explicarGraficoTendencia,
} from '../src/features/operacoes-legais/fenix/marketingGraficosFenix.ts'
import type { MarketingFenixContexto } from '../src/features/operacoes-legais/fenix/marketingFenix.ts'
import type { FenixExplicacao, FenixLinha, FenixPontoGrafico } from '../src/shared/fenix/fenix.types.ts'

const ponto = (indice: number): FenixPontoGrafico => ({ indice, rotulo: null, serie: null })
const linha = (e: FenixExplicacao, rotulo: string) => e.conta?.find((l) => l.rotulo === rotulo)
const total = (e: FenixExplicacao) => e.conta?.find((l) => l.tipo === 'total')
const antesDoTotal = (conta: FenixLinha[] | undefined) => {
  const linhas = conta ?? []
  const fim = linhas.findIndex((l) => l.tipo === 'total')
  return (fim < 0 ? linhas : linhas.slice(0, fim)).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
}
const soma = (linhas: FenixLinha[]) => linhas.reduce((s, l) => s + (l.numero ?? 0), 0)
const serializavel = (e: FenixExplicacao) => {
  const json = JSON.stringify(e)
  assert.equal(JSON.stringify(JSON.parse(json)), json)
}

// ---------------------------------------------------------------------------
// Timesheet › Horas por mês
// ---------------------------------------------------------------------------

const RECORTE: TimesheetFenixRecorte = {
  ano: 2026,
  areaLabel: 'Todas as áreas',
  areas: ['Cível', 'Contratos', 'Insolvência', 'Cível | Insolvência', 'Recuperação de Crédito', 'Trabalhista'],
  podeFiltrarAreas: true,
  meses: null,
  responsavel: null,
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Igual ao `data` do TimesheetMesChart: 12 meses, zero onde não há lançamento. */
function dataTimesheet() {
  return MESES.map((mes, i) => ({
    mes,
    minutos: i < 11 ? 30_000 + i * 61 : 0,
    lancamentos: i < 11 ? 400 + i : 0,
  }))
}

test('Timesheet › Horas por mês: barra apontada mostra horas e lançamentos como no tooltip', () => {
  const data = dataTimesheet()
  const totalMinutos = data.reduce((s, d) => s + d.minutos, 0)
  const totalLancamentos = data.reduce((s, d) => s + d.lancamentos, 0)
  const e = explicarGraficoTimesheetMes({ recorte: RECORTE, data, totalMinutos, totalLancamentos }, ponto(9))
  assert.equal(e.titulo, 'Horas por mês · Out/26')
  assert.equal(linha(e, 'Horas')?.valor, '509:09') // 30.549 min
  assert.equal(linha(e, 'Lançamentos')?.valor, '409 lançamentos')
  assert.match(linha(e, 'Parte das horas do recorte')?.detalhe ?? '', /card Horas/)
  assert.ok(e.regras?.some((r) => r.includes('áreas jurídicas do VIOS')))
  assert.equal(e.filtros?.find((f) => f.rotulo === 'Mês apontado')?.valor, 'Out/26')
  serializavel(e)
})

test('Timesheet › Horas por mês: gráfico inteiro soma os meses no card Horas', () => {
  const data = dataTimesheet()
  const totalMinutos = data.reduce((s, d) => s + d.minutos, 0)
  const totalLancamentos = data.reduce((s, d) => s + d.lancamentos, 0)
  const recorte = { ...RECORTE, meses: [10, 11] }
  const e = explicarGraficoTimesheetMes({ recorte, data, totalMinutos, totalLancamentos }, null)
  const parcelas = antesDoTotal(e.conta)
  assert.equal(parcelas.length, 11)
  assert.equal(soma(parcelas), totalMinutos)
  assert.equal(total(e)?.numero, totalMinutos)
  assert.ok(!linha(e, 'Diferença'))
  assert.ok(e.regras?.some((r) => r.includes('aparecem zerados')))
  // Total diferente das barras: avisa.
  const dif = explicarGraficoTimesheetMes({ recorte, data, totalMinutos: totalMinutos + 5, totalLancamentos }, null)
  assert.equal(linha(dif, 'Diferença')?.numero, 5)
})

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

const CTX: MarketingFenixContexto = {
  range: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' },
  rangeMeta: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' },
  comparacao: '31 de ago. de 2026 a 30 de set. de 2026',
}

test('Marketing › Tendência: ponto mostra alcance e engajamento do tooltip; gráfico inteiro soma o alcance', () => {
  const data = [
    { label: '02 de out.', reach: 1_200, engagementRate: (60 / 1_200) * 100, posts: 1, interactions: 60 },
    { label: '09 de out.', reach: 3_400, engagementRate: (102 / 3_400) * 100, posts: 2, interactions: 102 },
    { label: '20 de out.', reach: 800, engagementRate: (40 / 800) * 100, posts: 1, interactions: 40 },
  ]
  const meta = 15_000 / (365.2425 / 12)
  const c = { contexto: CTX, data, agrupamento: 'dia' as const, metaPorPonto: meta }
  const e = explicarGraficoTendencia(c, ponto(1))
  assert.equal(e.titulo, 'Tendência de performance · 09 de out.')
  assert.equal(linha(e, 'Alcance')?.valor, (3_400).toLocaleString('pt-BR'))
  assert.equal(linha(e, 'Engajamento')?.valor, `${((102 / 3_400) * 100).toFixed(2)}%`)
  assert.match(linha(e, 'Engajamento')?.detalhe ?? '', /102 interações ÷ 3\.400/)
  assert.equal(linha(e, 'Meta (linha tracejada)')?.numero, meta)
  assert.ok(e.regras?.some((r) => r.includes('meta diária')))

  const todo = explicarGraficoTendencia(c, null)
  const parcelas = antesDoTotal(todo.conta)
  assert.equal(soma(parcelas), 5_400)
  assert.equal(total(todo)?.numero, 5_400)
  assert.equal(linha(todo, 'Publicações')?.numero, 4)
  assert.equal(linha(todo, 'Engajamento do período')?.numero, (202 / 5_400) * 100)
  serializavel(todo)
})

test('Marketing › Por formato: formatos somam as publicações do período', () => {
  const data = [
    { format: 'Reels', posts: 5, engagementRate: 4.2, reach: 10_000, interactions: 420 },
    { format: 'Carrossel', posts: 3, engagementRate: 3, reach: 5_000, interactions: 150 },
    { format: 'Imagem única', posts: 1, engagementRate: 2, reach: 1_000, interactions: 20 },
  ]
  const e = explicarGraficoFormato({ contexto: CTX, data }, ponto(0))
  assert.equal(e.titulo, 'Volume e engajamento por formato · Reels')
  assert.equal(linha(e, 'Publicações')?.valor, '5')
  assert.equal(linha(e, 'Taxa de engajamento')?.valor, '4.20%')
  assert.match(linha(e, 'Publicações')?.detalhe ?? '', /das 9 publicações/)
  const todo = explicarGraficoFormato({ contexto: CTX, data }, null)
  assert.equal(soma(antesDoTotal(todo.conta)), 9)
  assert.equal(total(todo)?.numero, 9)
})

test('Marketing › Tendência da conta: dia mostra os 3 números do tooltip; gráfico inteiro dá a média do card', () => {
  const data = [
    { date: '2026-10-01', reach: 500, views: 900, total_interactions: 30, likes: 20, comments: 5 },
    { date: '2026-10-02', reach: 700, views: 1_100, total_interactions: 50 },
    { date: '2026-10-03', reach: 300, views: 400, total_interactions: 10 },
  ]
  const e = explicarGraficoConta({ contexto: CTX, data }, ponto(0))
  assert.equal(e.titulo, 'Tendência da conta · 01/10/2026')
  assert.deepEqual(
    (e.conta ?? []).filter((l) => (l.tipo ?? 'parcela') === 'parcela').map((l) => [l.rotulo, l.valor]),
    [['Alcance diário', '500'], ['Visualizações', '900'], ['Interações', '30']],
  )
  assert.equal(linha(e, 'Curtidas')?.numero, 20)
  const todo = explicarGraficoConta({ contexto: CTX, data }, null)
  assert.equal(todo.valor, '3 dias')
  assert.equal(total(todo)?.numero, 500)
  assert.equal(total(todo)?.valor, new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(500))
  assert.ok(todo.regras?.some((r) => r.includes('mesma pessoa de novo')))
})
