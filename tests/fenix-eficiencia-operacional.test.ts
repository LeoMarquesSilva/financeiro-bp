import test from 'node:test'
import assert from 'node:assert/strict'
import {
  descreverFiltroMes,
  explicarContagem,
  explicarDesenvolvimento,
  explicarEfetividadeCobranca,
  explicarEficDesvio,
  explicarGestaoPdi,
  explicarIniciativas,
  explicarInadimplencia,
  explicarMarketing,
  explicarNps,
  explicarRazao,
  explicarReceitaBruta,
  explicarTurnover,
  modoReceitaBruta,
  periodoMesesTexto,
} from '../src/features/eficiencia/fenix/eficienciaOperacionalFenix.ts'
import type { FenixExplicacao, FenixLinha } from '../src/shared/fenix/fenix.types.ts'

/** 11/11/2026: jan–out fechados, nov em andamento. */
const HOJE = new Date(2026, 10, 11, 12)

const totais = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'total')
const infos = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'info')
const linha = (conta: FenixLinha[] | undefined, rotulo: string) =>
  (conta ?? []).find((l) => l.rotulo === rotulo)
const regra = (exp: FenixExplicacao, trecho: string | RegExp) =>
  (exp.regras ?? []).some((r) => (typeof trecho === 'string' ? r.includes(trecho) : trecho.test(r)))
const quase = (a: number | undefined, b: number, casas = 6) =>
  assert.ok(a != null && Math.abs(a - b) < 10 ** -casas, `${a} ≠ ${b}`)
const serializavel = (exp: FenixExplicacao) => assert.deepEqual(JSON.parse(JSON.stringify(exp)), exp)

test('Período: descreve cada tipo de filtro de meses', () => {
  assert.equal(descreverFiltroMes(2026, null, HOJE), 'ano inteiro (2026)')
  assert.equal(
    descreverFiltroMes(2026, 'resultado', HOJE),
    'Resultado: Jun–Out/2026 (meses fechados desde junho)',
  )
  assert.equal(descreverFiltroMes(2026, 'resultado_ytd', HOJE), 'Resultado do ano: Jan–Out/2026 (meses fechados)')
  assert.equal(descreverFiltroMes(2026, [3, 4, 5], HOJE), 'Mar–Mai/2026')
  assert.equal(descreverFiltroMes(2026, [3, 5, 7], HOJE), 'Mar, Mai e Jul/2026')
  assert.match(descreverFiltroMes(2026, 'semana_passada', HOJE), /^Semana passada \(06\/11–12\/11\)$/)
  assert.equal(
    descreverFiltroMes(2026, { tipo: 'dia', de: '2026-11-03', ate: '2026-11-05' }, HOJE),
    'dias 03/11/2026 – 05/11/2026',
  )
  assert.equal(periodoMesesTexto(2026, [9]), 'Set/2026')
})

test('SLA Protocolo Gestão a Vista: D-1 ÷ total = %, abertura por mês fecha e período é jun→mês atual', () => {
  const meses = [
    { mes: 6, ok: 400, total: 450 },
    { mes: 7, ok: 380, total: 420 },
    { mes: 11, ok: 120, total: 130 },
  ]
  const ok = 900
  const total = 1000
  const exp = explicarRazao({
    indicador: 'sla_protocolo',
    ano: 2026,
    escopo: 'gestao_a_vista',
    area: null,
    responsavel: 'Fulana de Tal',
    ok,
    total,
    pct: (ok / total) * 100,
    meses,
    meta: 85,
    hoje: HOJE,
  })
  assert.equal(exp.tela, 'Eficiência › SLA Protocolo')
  assert.equal(exp.valor, '90,00%')
  const [num, den, res] = exp.conta ?? []
  assert.equal(num?.numero, 900)
  assert.equal(den?.operador, '÷')
  assert.equal(den?.numero, 1000)
  assert.equal(res?.tipo, 'total')
  quase(res?.numero, ((num?.numero ?? 0) / (den?.numero ?? 1)) * 100)
  assert.equal(linha(exp.conta, 'FATAL')?.numero, 100)
  const porMes = infos(exp.conta).filter((l) => /\/26$/.test(l.rotulo))
  assert.deepEqual(porMes.map((l) => l.rotulo), ['Jun/26', 'Jul/26', 'Nov/26'])
  assert.equal(porMes[0]?.detalhe, '400 de 450')
  assert.deepEqual(exp.filtros?.find((f) => f.rotulo === 'Período (fixo)')?.valor, 'Jun–Nov/2026')
  assert.match(exp.filtros?.find((f) => f.rotulo === 'Responsável')?.valor ?? '', /não se aplica/)
  assert.ok(regra(exp, '18h05'))
  assert.ok(regra(exp, 'excludente'))
  assert.ok(regra(exp, 'onboarding'))
  assert.ok(regra(exp, 'filtro de responsável não muda este card'))
  assert.ok(regra(exp, 'último mês do período (85,00%)'))
  serializavel(exp)
})

test('Abertura por mês só aparece quando fecha com o total do card', () => {
  const exp = explicarRazao({
    indicador: 'eficiencia_protocolo',
    ano: 2026,
    escopo: 'periodo',
    mesFiltro: [6, 7],
    origem: 'mensal',
    ok: 50,
    total: 60,
    pct: (50 / 60) * 100,
    meses: [
      { mes: 6, ok: 20, total: 25 },
      { mes: 7, ok: 20, total: 25 },
    ],
    hoje: HOJE,
  })
  assert.equal(infos(exp.conta).filter((l) => /\/26$/.test(l.rotulo)).length, 0)
  assert.ok(regra(exp, 'não é a média dos percentuais'))
})

test('Período com semana/dias e responsável: regras dizem de onde veio a conta', () => {
  const exp = explicarRazao({
    indicador: 'sla_vistagem_risco',
    ano: 2026,
    escopo: 'periodo',
    area: 'Cível',
    mesFiltro: 'semana_passada',
    origem: 'periodo_curto',
    responsavel: 'Fulana de Tal',
    ok: 47,
    total: 50,
    pct: 94,
    hoje: HOJE,
  })
  assert.match(exp.resumo, /Semana passada/)
  assert.match(exp.resumo, /área Cível/)
  assert.ok(regra(exp, 'semana ou por dias'))
  assert.ok(regra(exp, 'quem vistou a publicação é Fulana de Tal'))
  assert.ok(regra(exp, '12h do próximo dia útil'))
  assert.ok(regra(exp, 'diferente de "Não"'))
  assert.equal(totais(exp.conta)[0]?.numero, 94)
})

test('Indisponível e Contratos sem casos', () => {
  const ops = explicarRazao({
    indicador: 'sla_ciencia_agendamentos',
    ano: 2026,
    escopo: 'periodo',
    area: 'Operações Legais',
    ok: 0,
    total: 0,
    pct: null,
    indisponivel: 'Não se aplica a Operações Legais.',
    hoje: HOJE,
  })
  assert.equal(ops.valor, '—')
  assert.equal(ops.resumo, 'Não se aplica a Operações Legais.')
  assert.equal(ops.conta, undefined)

  const contratos = explicarRazao({
    indicador: 'sla_vistagem_risco',
    ano: 2026,
    escopo: 'overview',
    area: 'Contratos',
    mesFiltro: null,
    ok: 0,
    total: 0,
    pct: 100,
    valor: '100.00%',
    contratosSemCasos: true,
    hoje: HOJE,
  })
  assert.equal(contratos.valor, '100.00%')
  assert.equal(totais(contratos.conta)[0]?.numero, 100)
  assert.ok(regra(contratos, 'Contratos sem nenhuma publicação de risco'))
})

test('Overview Acum. do SLA Protocolo usa a menor meta; célula do mês usa a meta do mês', () => {
  const acum = explicarRazao({
    indicador: 'sla_protocolo',
    ano: 2025,
    escopo: 'overview',
    tela: 'Eficiência › Overview',
    mesFiltro: null,
    ok: 80,
    total: 100,
    pct: 80,
    valor: '80.00%',
    meta: 70,
    hoje: HOJE,
  })
  assert.equal(acum.titulo, 'SLA de Protocolo · Acum.')
  assert.ok(regra(acum, 'menor meta'))
  assert.match(acum.detalhe ?? '', /Racional/)

  const mes = explicarRazao({
    indicador: 'sla_protocolo',
    ano: 2025,
    escopo: 'mes',
    mes: 3,
    tela: 'Eficiência › Overview',
    ok: 7,
    total: 10,
    pct: 70,
    valor: '70.00%',
    meta: 70,
    hoje: HOJE,
  })
  assert.equal(mes.titulo, 'SLA de Protocolo · Mar/25')
  assert.ok(regra(mes, 'meta do próprio mês (70,00%)'))
  quase(totais(mes.conta)[0]?.numero, 70)
})

test('Contagem FATAL: total − D-1 = FATAL, excludentes à parte', () => {
  const exp = explicarContagem({
    indicador: 'sla_protocolo',
    ano: 2026,
    titulo: 'FATAL no período selecionado',
    mesFiltro: [9, 10],
    origem: 'mensal',
    mostra: 'nok',
    ok: 1700,
    total: 1834,
    excludentes: 12,
    hoje: HOJE,
  })
  assert.equal(exp.valor, '134')
  const [t, d1, fatal] = exp.conta ?? []
  assert.equal(t?.numero, 1834)
  assert.equal(d1?.operador, '−')
  assert.equal(fatal?.numero, (t?.numero ?? 0) - (d1?.numero ?? 0))
  assert.equal(fatal?.tipo, 'total')
  assert.equal(linha(exp.conta, 'Excludentes (fora da conta)')?.numero, 12)
})

test('Contagem de publicações: no prazo + depois do prazo = total', () => {
  const exp = explicarContagem({
    indicador: 'sla_vistagem_normal',
    ano: 2026,
    titulo: 'Publicações no período selecionado',
    mostra: 'total',
    ok: 950,
    total: 1000,
    hoje: HOJE,
  })
  const [a, b, c] = exp.conta ?? []
  assert.equal((a?.numero ?? 0) + (b?.numero ?? 0), c?.numero)
  assert.equal(exp.valor, '1000')
  assert.ok(regra(exp, 'Trabalhista'))
})

test('Operações Legais › SLA Protocolo: card Eficiência x Desvio', () => {
  const exp = explicarEficDesvio({
    indicador: 'ops_legais_sla_protocolo',
    ano: 2026,
    mesFiltro: null,
    origem: 'mensal',
    ok: 980,
    nok: 20,
    meses: [
      { mes: 1, ok: 480, total: 490 },
      { mes: 2, ok: 500, total: 510 },
    ],
    hoje: HOJE,
  })
  assert.equal(exp.tela, 'Operações Legais › SLA Protocolo')
  assert.equal(exp.valor, '98,00%')
  quase(totais(exp.conta)[0]?.numero, 98)
  assert.ok(regra(exp, 'EFICIÊNCIA OPERACIONAL = SIM'))
  assert.ok(regra(exp, 'somam 100%'))
  assert.equal(exp.filtros?.some((f) => f.rotulo === 'Área'), false)
  assert.equal(infos(exp.conta).filter((l) => /\/26$/.test(l.rotulo)).length, 2)
})

test('Cadastro de Ops: regras da controladoria e da adesão', () => {
  const exp = explicarEficDesvio({
    indicador: 'ops_legais_cadastro',
    ano: 2026,
    mesFiltro: [10],
    origem: 'mensal',
    ok: 95,
    nok: 5,
    hoje: HOJE,
  })
  assert.ok(regra(exp, 'SEM ADESÃO'))
  assert.ok(regra(exp, 'Isadora, Maria, Marina e Natalia'))
  assert.ok(regra(exp, 'Abertura de Pasta Com Agendamentos'))
})

test('Desenvolvimento: meses somam as horas do período e dividem pela meta do ano', () => {
  const meses = [
    { mes: 9, minutos: 600 },
    { mes: 10, minutos: 900 },
  ]
  const minutos = 1500
  const meta = 84_000
  const pctV = (minutos / meta) * 100
  const exp = explicarDesenvolvimento({
    tela: 'Eficiência › Overview',
    ano: 2026,
    area: null,
    mesFiltro: [9, 10],
    modo: 'meses',
    minutos,
    metaMinutos: meta,
    pessoas: 100,
    pct: pctV,
    valor: '25:00 (1,79%)',
    meses,
  })
  const [set, out, soma, metaL, atingimento] = exp.conta ?? []
  assert.equal((set?.numero ?? 0) + (out?.numero ?? 0), soma?.numero)
  assert.equal(soma?.valor, '25:00')
  assert.equal(metaL?.valor, '1400:00')
  quase(atingimento?.numero, ((soma?.numero ?? 0) / (metaL?.numero ?? 1)) * 100)
  assert.ok(regra(exp, '14h por pessoa'))
  assert.ok(regra(exp, 'Tributário fica fora'))
})

test('Retenção: 100% − saídas voluntárias ÷ ativos', () => {
  const exp = explicarTurnover({
    tela: 'Eficiência › Overview',
    ano: 2026,
    area: null,
    foco: 'retencao',
    ativos: 200,
    saidas: 9,
    pctRetencao: 95.5,
    meta: 90,
  })
  const taxa = linha(exp.conta, 'Taxa de saída voluntária')
  quase(taxa?.numero, (9 / 200) * 100)
  quase(totais(exp.conta)[0]?.numero, 100 - (taxa?.numero ?? 0))
  assert.equal(exp.valor, '95,50%')
  assert.ok(regra(exp, 'Voluntário'))

  const ativos = explicarTurnover({
    tela: 'Operações Legais › Retenção de Talentos',
    ano: 2026,
    area: 'Operações Legais',
    foco: 'ativos',
    ativos: 30,
    saidas: 1,
    pctRetencao: 96.67,
    meta: 90,
  })
  assert.equal(ativos.valor, '30')
  assert.equal(totais(ativos.conta)[0]?.numero, 30)
})

test('Gestão de PDI: soma das aptas ÷ soma das elegíveis', () => {
  const meses = [
    { mes: 6, aptas: 10, elegiveis: 10 },
    { mes: 7, aptas: 7, elegiveis: 9 },
  ]
  const pctV = Math.round((17 / 19) * 10000) / 100
  const exp = explicarGestaoPdi({
    tela: 'Eficiência › Overview',
    ano: 2026,
    area: null,
    mesFiltro: null,
    meses,
    pct: pctV,
    valor: '89,47%',
    hoje: HOJE,
  })
  assert.equal(linha(exp.conta, 'Pessoas aptas')?.numero, 17)
  assert.equal(linha(exp.conta, 'Pessoas elegíveis')?.numero, 19)
  assert.equal(totais(exp.conta)[0]?.numero, pctV)
  assert.equal(linha(exp.conta, 'Jun/26')?.detalhe, 'junho: base, todos aptos')
  assert.ok(regra(exp, '1:1'))
})

test('Receita Bruta e Inadimplência no Overview', () => {
  assert.equal(modoReceitaBruta(null), 'ano')
  assert.equal(modoReceitaBruta([10]), 'mes')
  assert.equal(modoReceitaBruta([9, 10]), 'meses')
  assert.equal(modoReceitaBruta('resultado'), 'meses')

  const rb = explicarReceitaBruta({
    ano: 2026,
    mesFiltro: null,
    recebido: 4_000_000,
    meta: 7_000_000,
    pct: (4 / 7) * 100,
    valor: '57.14%',
    hoje: HOJE,
  })
  const [rec, meta, res] = rb.conta ?? []
  quase(res?.numero, ((rec?.numero ?? 0) / (meta?.numero ?? 1)) * 100)
  assert.ok(regra(rb, 'meta do ano inteiro'))
  assert.ok(regra(rb, 'filtro de área'))

  const inad = explicarInadimplencia({
    ano: 2026,
    mesFiltro: null,
    meses: [6, 7, 8, 9, 10, 11],
    inadimplencia: 120_000,
    previsto: 1_500_000,
    pct: 8,
    valor: '8.00%',
    hoje: HOJE,
  })
  const [v, p, r] = inad.conta ?? []
  quase(r?.numero, ((v?.numero ?? 0) / (p?.numero ?? 1)) * 100)
  assert.match(inad.resumo, /Jun–Nov\/2026/)
  assert.ok(regra(inad, 'no máximo 10,00%'))
})

test('NPS: (promotores − detratores) ÷ respostas, arredondado', () => {
  const exp = explicarNps({
    ano: 2026,
    nps: 69,
    promotores: 30,
    neutros: 6,
    detratores: 3,
    total: 39,
    campanha: 'NPS 2026',
    valor: '69,00%',
  })
  const saldo = linha(exp.conta, 'Saldo')
  const respostas = linha(exp.conta, 'Respostas')
  assert.equal(saldo?.numero, 27)
  assert.equal(Math.round(((saldo?.numero ?? 0) / (respostas?.numero ?? 1)) * 100), totais(exp.conta)[0]?.numero)
  assert.equal(
    (linha(exp.conta, 'Promotores (nota 9 ou 10)')?.numero ?? 0) +
      (linha(exp.conta, 'Neutros (nota 7 ou 8)')?.numero ?? 0) +
      (linha(exp.conta, 'Detratores (nota 0 a 6)')?.numero ?? 0),
    respostas?.numero,
  )
})

test('Iniciativas e Marketing (Operações Legais › Overview)', () => {
  const ini = explicarIniciativas({
    ano: 2026,
    mesFiltro: null,
    meses: [
      { mes: 3, qtd: 2 },
      { mes: 5, qtd: 4 },
      { mes: 8, qtd: 0 },
    ],
    pct: 25,
    valor: '25,00%',
    hoje: HOJE,
  })
  const entregas = linha(ini.conta, 'Entregas no período')
  assert.equal(entregas?.numero, 6)
  assert.equal(linha(ini.conta, 'Meta do ano')?.numero, 24)
  quase(linha(ini.conta, 'Iniciativas')?.numero, ((entregas?.numero ?? 0) / 24) * 100)

  const pautas = explicarMarketing({
    tipo: 'pautas',
    ano: 2026,
    mesFiltro: null,
    meses: [
      { mes: 1, valor: 8 },
      { mes: 2, valor: 12 },
    ],
    divisor: 120,
    resultado: (20 / 120) * 100,
    valor: '16,67%',
    meta: 10,
    hoje: HOJE,
  })
  assert.equal(linha(pautas.conta, 'Pautas no período')?.numero, 20)
  assert.equal(linha(pautas.conta, 'Meta do período')?.numero, 120)

  const eng = explicarMarketing({
    tipo: 'engajamento',
    ano: 2026,
    mesFiltro: null,
    meses: [
      { mes: 1, valor: 3 },
      { mes: 2, valor: 4 },
    ],
    divisor: 2,
    resultado: 3.5,
    valor: '3,50%',
    meta: 3.5,
    hoje: HOJE,
  })
  quase(
    totais(eng.conta).at(-1)?.numero,
    (linha(eng.conta, 'Soma do engajamento mensal')?.numero ?? 0) /
      (linha(eng.conta, 'Meses com post')?.numero ?? 1),
  )
})

test('Efetividade na Cobrança: cobrados ÷ títulos e composição do total', () => {
  const p = explicarEfetividadeCobranca({
    ano: 2026,
    escopo: 'periodo',
    mesFiltro: [10],
    total: 40,
    cobrados: 38,
    pct: 95,
    valor: '95,00%',
    hoje: HOJE,
  })
  quase(totais(p.conta)[0]?.numero, (38 / 40) * 100)
  const t = explicarEfetividadeCobranca({
    ano: 2026,
    escopo: 'titulos',
    mesFiltro: [10],
    total: 40,
    cobrados: 38,
    pct: 95,
    valor: '40',
    hoje: HOJE,
  })
  const [a, b, c] = t.conta ?? []
  assert.equal((a?.numero ?? 0) + (b?.numero ?? 0), c?.numero)
})
