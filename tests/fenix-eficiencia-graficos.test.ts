import test from 'node:test'
import assert from 'node:assert/strict'
import {
  explicarDesenvolvimentoAcumuladoNoMes,
  explicarGraficoEvolucao,
  explicarGraficoGestaoPdi,
  explicarGraficoInadimplencia,
  explicarGraficoRazao,
  explicarGraficoRazaoSimples,
  explicarGraficoReceitaBruta,
  explicarIniciativasAcumuladoNoMes,
  explicarRanking,
  explicarRankingIndicador,
  explicarSerieUnificada,
  melhorPonto,
  metaDaLinha,
  type RankingBarraFenix,
} from '../src/features/eficiencia/fenix/eficienciaGraficosFenix.ts'
import type { FenixExplicacao, FenixLinha, FenixPontoGrafico } from '../src/shared/fenix/fenix.types.ts'
import type { GestaoVistaMesRow, ReceitaMesRow } from '../src/features/receita/types/receita.types.ts'

const HOJE = new Date(2026, 10, 11, 12)
const ponto = (indice: number, rotulo: string | null = null): FenixPontoGrafico => ({ indice, rotulo, serie: 'valor' })

const totais = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'total')
const linha = (conta: FenixLinha[] | undefined, rotulo: string) => (conta ?? []).find((l) => l.rotulo === rotulo)
const regra = (exp: FenixExplicacao, trecho: string) => (exp.regras ?? []).some((r) => r.includes(trecho))
const quase = (a: number | undefined, b: number) => assert.ok(a != null && Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`)
const serializavel = (exp: FenixExplicacao) => assert.deepEqual(JSON.parse(JSON.stringify(exp)), exp)

const dataSla = [
  { mes: 9, valor: 90, meta: 85 },
  { mes: 10, valor: 80, meta: 85 },
  { mes: 11, valor: 95, meta: 85 },
]
const mesesSla = [
  { mes: 9, ok: 180, total: 200, meta: 85 },
  { mes: 10, ok: 160, total: 200, meta: 85 },
  { mes: 11, ok: 95, total: 100, meta: 85 },
]

test('Meta da linha e selo "Melhor mês" seguem o gráfico', () => {
  assert.equal(metaDaLinha(dataSla, null), 85)
  assert.equal(metaDaLinha(dataSla, 98), 98)
  assert.deepEqual(melhorPonto(dataSla), { indice: 2, valor: 95 })
  assert.equal(melhorPonto([{ mes: 1, valor: 50 }]), null)
  // Empate: o mais recente.
  assert.equal(melhorPonto([{ mes: 1, valor: 70 }, { mes: 2, valor: 70 }])?.indice, 1)
})

test('SLA Protocolo: ponto do mês = D-1 ÷ total do mês, valor do tooltip e meta da linha', () => {
  const exp = explicarGraficoRazao(
    {
      indicador: 'sla_protocolo',
      titulo: 'SLA de Protocolo (D-1 vs FATAL)',
      ano: 2026,
      area: 'Cível',
      mesFiltro: null,
      data: dataSla,
      metaFixa: 85,
      meses: mesesSla,
      hoje: HOJE,
    },
    ponto(1, 'Out'),
  )
  assert.equal(exp.titulo, 'SLA de Protocolo (D-1 vs FATAL) · Out/26')
  assert.equal(exp.valor, '80,00%')
  const [ok, total, res] = exp.conta ?? []
  assert.equal(ok?.numero, 160)
  assert.equal(total?.numero, 200)
  quase(res?.numero, ((ok?.numero ?? 0) / (total?.numero ?? 1)) * 100)
  const meta = linha(exp.conta, 'Meta da linha')
  assert.equal(meta?.numero, 85)
  assert.match(meta?.detalhe ?? '', /vermelho/)
  assert.equal(exp.filtros?.[0]?.valor, 'SLA de Protocolo (D-1 vs FATAL)')
  assert.equal(exp.filtros?.[1]?.valor, 'Out/26')
  assert.ok(regra(exp, '18h05'))
  serializavel(exp)
})

test('Linha inteira (clique fora de um ponto): todos os pontos, selo e meta', () => {
  const exp = explicarGraficoRazao(
    {
      indicador: 'sla_vistagem_risco',
      titulo: 'SLA de Vistagem D+1 — Demanda de Risco',
      ano: 2026,
      mesFiltro: null,
      data: dataSla,
      metaFixa: 98,
      meses: mesesSla,
      hoje: HOJE,
    },
    null,
  )
  assert.equal(exp.valor, 'Set–Nov/2026')
  assert.deepEqual(
    (exp.conta ?? []).slice(0, 3).map((l) => l.valor),
    ['90,00%', '80,00%', '95,00%'],
  )
  assert.equal(linha(exp.conta, 'Selo "Melhor mês"')?.valor, 'Nov/26 · 95,00%')
  assert.equal(linha(exp.conta, 'Meta (linha tracejada)')?.numero, 98)
  // índice fora do array também cai na linha inteira
  const fora = explicarGraficoRazao(
    { indicador: 'sla_protocolo', titulo: 'SLA', ano: 2026, mesFiltro: null, data: dataSla, meses: mesesSla, hoje: HOJE },
    ponto(9),
  )
  assert.equal(fora.titulo, 'SLA')
})

test('Ponto diário: SLA Protocolo tem D-1 do dia; demais só o total do dia', () => {
  const data = [{ mes: 3, valor: 75, label: '03' }, { mes: 4, valor: 100, label: '04' }]
  const sla = explicarGraficoRazao(
    {
      indicador: 'sla_protocolo',
      titulo: 'SLA',
      ano: 2026,
      mesFiltro: [11],
      granularidade: 'dia',
      mesDia: 11,
      data,
      metaFixa: 85,
      dias: [{ dia: 3, ok: 3, total: 4 }, { dia: 4, ok: 2, total: 2 }],
      hoje: HOJE,
    },
    ponto(0),
  )
  assert.equal(sla.titulo, 'SLA · 03/11/2026')
  assert.equal(sla.conta?.[0]?.numero, 3)
  assert.equal(sla.conta?.[1]?.numero, 4)

  const efi = explicarGraficoRazao(
    {
      indicador: 'eficiencia_protocolo',
      titulo: 'Eficiência de Protocolo',
      ano: 2026,
      mesFiltro: [11],
      granularidade: 'dia',
      mesDia: 11,
      data,
      metaFixa: 95,
      dias: [{ dia: 3, total: 4 }],
      hoje: HOJE,
    },
    ponto(0),
  )
  assert.equal(linha(efi.conta, 'Pedidos de protocolo')?.numero, 4)
  assert.equal(totais(efi.conta)[0]?.numero, 75)
})

test('Responsável: ponto sem quantidades explica de onde vem e não inventa a conta', () => {
  const exp = explicarGraficoRazao(
    {
      indicador: 'sla_ciencia_agendamentos',
      titulo: 'Agendamento / Ciência D+1',
      ano: 2026,
      mesFiltro: null,
      responsavel: 'Fulana de Tal',
      data: [{ mes: 10, valor: 88.5 }],
      metaFixa: 95,
      meses: [{ mes: 10, ok: 1, total: 1 }],
      hoje: HOJE,
    },
    ponto(0),
  )
  assert.equal(exp.valor, '88,50%')
  assert.equal(totais(exp.conta).length, 1)
  assert.match(totais(exp.conta)[0]?.detalhe ?? '', /Racional/)
  assert.ok(regra(exp, 'quem concluiu a tarefa é Fulana de Tal'))
})

test('Operações Legais com semana/dias: o ponto único usa os totais do período', () => {
  const exp = explicarGraficoRazao(
    {
      indicador: 'ops_legais_sla_protocolo',
      titulo: 'SLA PROTOCOLO',
      ano: 2026,
      mesFiltro: 'semana_passada',
      data: [{ mes: 1, valor: 97.5, label: 'Semana passada (06/11–12/11)' }],
      metaFixa: 98,
      periodoCurto: { ok: 39, total: 40 },
      hoje: HOJE,
    },
    ponto(0),
  )
  assert.equal(exp.tela, 'Operações Legais › SLA Protocolo')
  assert.equal(exp.titulo, 'SLA PROTOCOLO · Semana passada (06/11–12/11)')
  assert.equal(exp.conta?.[0]?.numero, 39)
  assert.equal(exp.conta?.[1]?.numero, 40)
  assert.ok(regra(exp, 'semana ou por dias'))
})

test('Financeiro de Ops: antecipação no prazo ÷ concluídos; fechamento manual sinalizado', () => {
  const ant = explicarGraficoRazaoSimples(
    {
      tipo: 'antecipacao',
      tela: 'Operações Legais › Financeiro',
      titulo: 'Antecipação de Faturamento',
      ano: 2026,
      mesFiltro: null,
      data: [{ mes: 7, valor: 96 }],
      metaFixa: 98,
      meses: [{ mes: 7, ok: 48, total: 50 }],
      hoje: HOJE,
    },
    ponto(0),
  )
  const [ok, total, res] = ant.conta ?? []
  quase(res?.numero, ((ok?.numero ?? 0) / (total?.numero ?? 1)) * 100)
  assert.ok(regra(ant, 'REALIZAR FATURAMENTO'))

  const fech = explicarGraficoRazaoSimples(
    {
      tipo: 'fechamento',
      tela: 'Operações Legais › Financeiro',
      titulo: 'Fechamento',
      ano: 2026,
      mesFiltro: null,
      data: [{ mes: 6, valor: 0 }],
      metaFixa: 100,
      meses: [{ mes: 6, ok: 0, total: 1 }],
      hoje: HOJE,
    },
    ponto(0),
  )
  assert.equal(linha(fech.conta, 'Origem do mês')?.valor, 'histórico manual')
})

test('Gestão de PDI, Receita Bruta e Inadimplência: ponto do mês reaproveita a conta do card', () => {
  const pdi = explicarGraficoGestaoPdi(
    {
      tela: 'Eficiência › Gestão de PDI',
      ano: 2026,
      area: null,
      mesFiltro: null,
      data: [{ mes: 7, valor: 77.78, meta: 100 }],
      meses: [{ mes: 7, elegiveis: 9, aptas: 7, desvios: 2, pct_aptas: 77.78 }],
      hoje: HOJE,
    },
    ponto(0),
  )
  assert.equal(pdi.valor, '77,78%')
  assert.equal(linha(pdi.conta, 'Aptas')?.numero, 7)
  assert.equal(totais(pdi.conta).at(-1)?.numero, 77.78)

  const meses: GestaoVistaMesRow[] = [
    { mes: 10, mesLabel: 'out', meta: 1_000_000, previsto: 1_200_000, recebido: 900_000, pctMeta: 90, pctPrevisto: 75, inadimplencia: 80_000, inadimplenciaPct: 6.67, congelado: true },
  ]
  const rows: ReceitaMesRow[] = []
  const rb = explicarGraficoReceitaBruta(
    { tela: 'Eficiência › Receita Bruta', ano: 2026, mesFiltro: null, data: [{ mes: 10, valor: 90, meta: 100 }], meses, rows, metaFixa: 100, hoje: HOJE },
    ponto(0),
  )
  assert.equal(rb.valor, '90,00%')
  const rec = linha(rb.conta, 'Recebido em Out/26')
  const met = linha(rb.conta, 'Meta ajustada do mês')
  quase(totais(rb.conta).at(-1)?.numero, ((rec?.numero ?? 0) / (met?.numero ?? 1)) * 100)

  const inad = explicarGraficoInadimplencia(
    { tela: 'Eficiência › Índice de Inadimplência', ano: 2026, mesFiltro: null, data: [{ mes: 10, valor: 6.67 }], meses, hoje: HOJE },
    ponto(0),
  )
  assert.equal(inad.valor, '6,67%')
  assert.equal(linha(inad.conta, 'Saldo inadimplente no fechamento')?.numero, 80_000)
  const inteira = explicarGraficoInadimplencia(
    { tela: 'x', ano: 2026, mesFiltro: null, data: [{ mes: 9, valor: 5 }, { mes: 10, valor: 6.67 }], meses, hoje: HOJE },
    null,
  )
  assert.ok(regra(inteira, 'menor é melhor'))
})

const barras: RankingBarraFenix[] = [
  { rotulo: 'Ana', valor: 6, valorTexto: '6', posicao: 1, qtd: 6, pctDoTotal: 60 },
  { rotulo: 'Bruno', valor: 3, valorTexto: '3', posicao: 2, qtd: 3, pctDoTotal: 30 },
  { rotulo: 'Carla', valor: 1, valorTexto: '1', posicao: 3, qtd: 1, pctDoTotal: 10 },
]

test('Ranking: barra = qtd ÷ soma das barras = % do total; sem ponto soma tudo', () => {
  const exp = explicarRankingIndicador(
    {
      indicador: 'sla_protocolo',
      dimensao: 'responsavel',
      titulo: 'Qtd Desvio Responsáveis',
      ano: 2026,
      area: null,
      mesFiltro: [10],
      barras,
      hoje: HOJE,
    },
    ponto(1, 'Bruno'),
  )
  assert.equal(exp.titulo, 'Qtd Desvio Responsáveis · Bruno')
  assert.equal(exp.valor, '3')
  const [qtd, tot, pctL] = exp.conta ?? []
  assert.equal(qtd?.numero, 3)
  assert.equal(tot?.numero, 10)
  quase(pctL?.numero, ((qtd?.numero ?? 0) / (tot?.numero ?? 1)) * 100)
  assert.equal(linha(exp.conta, 'Posição')?.valor, '2º de 3')
  assert.ok(regra(exp, 'quem concluiu a tarefa'))
  assert.ok(regra(exp, 'meses inteiros'))

  const tudo = explicarRanking(
    {
      tela: 't',
      titulo: 'r',
      ano: 2026,
      area: null,
      mesFiltro: null,
      oQue: 'Desvios',
      dimensao: 'grupo',
      barras,
      regras: [],
      fonte: 'f',
      fonteTecnica: 'ft',
      hoje: HOJE,
    },
    null,
  )
  const parcelas = (tudo.conta ?? []).filter((l) => l.tipo !== 'total')
  assert.equal(parcelas.reduce((s, l) => s + (l.numero ?? 0), 0), totais(tudo.conta)[0]?.numero)
  serializavel(tudo)
})

test('Ranking com % calculado sobre outra base mostra a diferença', () => {
  const exp = explicarRankingIndicador(
    {
      indicador: 'sla_vistagem_normal',
      dimensao: 'responsavel',
      titulo: '% Desvio Responsável',
      ano: 2026,
      area: null,
      mesFiltro: null,
      responsavel: 'Ana',
      barras: [{ rotulo: 'Ana', valor: 100, valorTexto: '100,00%', posicao: 1, qtd: 6, pctDoTotal: 100 }],
      hoje: HOJE,
    },
    ponto(0),
  )
  assert.equal(exp.valor, '100,00%')
  assert.ok(regra(exp, 'vira 100%'))
  assert.ok(regra(exp, 'sem data de vistagem'))
})

test('Mini-linhas do Overview de Ops: ponto reaproveita a célula; acumulados fecham', () => {
  const serie = {
    titulo: 'SLA Protocolo',
    metaLabel: 'Meta 98,00%',
    yKind: 'pct' as const,
    meta: 98,
    pontos: [{ label: 'Out', valor: 97, rotulo: '97,00%' }],
  }
  const base: FenixExplicacao = { tela: 'x', titulo: 'célula', valor: '97,00%', resumo: 'r', conta: [{ rotulo: 'c', valor: '1', numero: 1 }] }
  const exp = explicarSerieUnificada(
    { tela: 'Operações Legais › Overview', ano: 2026, mesFiltro: null, serie, resumo: 'r', explicarPonto: () => base, hoje: HOJE },
    ponto(0),
  )
  assert.equal(exp.titulo, 'SLA Protocolo · Out')
  assert.equal(exp.valor, '97,00%')
  assert.match(linha(exp.conta, 'Meta da linha')?.detalhe ?? '', /vermelho/)

  const dev = explicarDesenvolvimentoAcumuladoNoMes({
    tela: 'Operações Legais › Overview',
    ano: 2026,
    mes: 10,
    parcelas: [{ mes: 9, minutos: 120 }, { mes: 10, minutos: 90 }],
    metaMinutos: 840,
    metaLabel: 'Meta: 14h',
  })
  assert.equal(totais(dev.conta)[0]?.numero, 210)
  assert.equal(dev.valor, '3:30')

  const ini = explicarIniciativasAcumuladoNoMes({
    tela: 'Operações Legais › Overview',
    ano: 2026,
    mes: 5,
    meses: [{ mes: 2, qtd: 1 }, { mes: 5, qtd: 2 }, { mes: 8, qtd: 4 }],
    meta: 24,
  })
  assert.equal(ini.valor, '3')
  assert.equal(totais(ini.conta)[0]?.numero, 3)
})

test('Evolução genérica: ponto sem base própria mostra o valor do tooltip', () => {
  const exp = explicarGraficoEvolucao(
    { tela: 't', titulo: 'G', ano: 2026, data: [{ mes: 1, valor: 50 }], metaFixa: 40, resumo: 'r' },
    ponto(0),
  )
  assert.equal(exp.valor, '50,00%')
  assert.match(linha(exp.conta, 'Meta da linha')?.detalhe ?? '', /verde/)
})
