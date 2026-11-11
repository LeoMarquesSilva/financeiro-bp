import test from 'node:test'
import assert from 'node:assert/strict'
import {
  explicarFuncionariosAtivos,
  explicarGestaoPdiAptas,
  explicarGestaoPdiDesvios,
  explicarGestaoPdiGestaoVista,
  explicarGestaoPdiPeriodo,
  explicarInadimplenciaIndice,
  explicarInadimplenciaSaldo,
  explicarNps,
  explicarNpsDimensao,
  explicarNpsGrupo,
  explicarOpsTreinamentoCategoria,
  explicarReceitaBrutaPct,
  explicarReceitaBrutaRecebido,
  explicarRetencao,
  explicarSaidasVoluntarias,
  explicarTreinamentoPessoa,
  explicarTreinamentosAtivos,
  explicarTreinamentosDesenvolvimento,
  explicarTreinamentosHoras,
  modoReceitaBruta,
  periodoMeses,
  rotuloPeriodoEficiencia,
  TELA_EFICIENCIA_PESSOAS,
  type DesenvolvimentoFenixCtx,
  type GestaoPdiFenixCtx,
  type RetencaoFenixCtx,
} from '../src/features/eficiencia/fenix/eficienciaPessoasFinanceiroFenix.ts'
import type { FenixExplicacao, FenixLinha } from '../src/shared/fenix/fenix.types.ts'
import type { GestaoVistaMesRow, ReceitaMesRow } from '../src/features/receita/types/receita.types.ts'
import type { NpsKpi } from '../src/features/eficiencia/utils/npsCalc.ts'

/** 11/11/2026: jan–out fechados, nov em andamento, dez futuro. */
const HOJE = new Date(2026, 10, 11)
const META = 14 * 60

/**
 * Refaz a memória de cálculo linha a linha e confere cada total.
 * Parcela sem operador começa uma conta nova; total cujo detalhe começa com "× 100" é percentual;
 * total "arredondado" aceita diferença de até 0,5.
 */
function verificaConta(exp: FenixExplicacao) {
  let acc: number | null = null
  let totais = 0
  for (const l of exp.conta ?? []) {
    if (l.tipo === 'info') continue
    const n = l.numero ?? 0
    if (l.tipo === 'total') {
      totais += 1
      if (acc != null) {
        const pct = (l.detalhe ?? '').startsWith('× 100')
        const calc = pct ? acc * 100 : acc
        const tol = (l.detalhe ?? '').includes('arredondado') ? 0.5 : pct ? 0.01 : 0.005
        assert.ok(
          Math.abs(calc - n) <= tol,
          `${exp.titulo} › ${l.rotulo}: conta dá ${calc}, total mostra ${n}`,
        )
      }
      acc = n
      continue
    }
    switch (l.operador) {
      case undefined:
        acc = n
        break
      case '+':
        acc = (acc ?? 0) + n
        break
      case '−':
        acc = (acc ?? 0) - n
        break
      case '×':
        acc = (acc ?? 0) * n
        break
      case '÷':
        acc = (acc ?? 0) / n
        break
      default:
        break
    }
  }
  assert.ok(totais > 0, `${exp.titulo}: sem linha de total`)
}

const parcelas = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => (l.tipo ?? 'parcela') === 'parcela')
const totais = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'total')
const infos = (conta: FenixLinha[] | undefined) => (conta ?? []).filter((l) => l.tipo === 'info')
const temRegra = (exp: FenixExplicacao, re: RegExp) => (exp.regras ?? []).some((r) => re.test(r))
/** Intl.NumberFormat usa espaço não separável depois de "R$". */
const semNbsp = (v: string) => v.replace(/\u00a0/g, ' ')

// ---------------------------------------------------------------------------
// Desenvolvimento Equipe
// ---------------------------------------------------------------------------

function equipe() {
  return [
    { colaborador: 'ANA SOUZA', minutos: 900, metaMinutos: META, admissao: '2020-03-01' },
    { colaborador: 'BRUNO LIMA', minutos: 300, metaMinutos: META, admissao: '2019-01-10' },
    { colaborador: 'CARLA DIAS', minutos: 0, metaMinutos: META, admissao: '2021-05-01' },
    // Admitida em 20/03/2026 → abril em diante = 9 meses → 630 min.
    { colaborador: 'DORA MELO', minutos: 120, metaMinutos: 630, admissao: '2026-03-20' },
  ]
}

function ctxDesenv(over: Partial<DesenvolvimentoFenixCtx> = {}): DesenvolvimentoFenixCtx {
  const eq = equipe()
  const meta = eq.reduce((s, p) => s + p.metaMinutos, 0)
  const minutos = eq.reduce((s, p) => s + p.minutos, 0)
  return {
    ano: 2026,
    area: null,
    periodo: 'Ano inteiro (2026)',
    recortePeriodo: false,
    responsavel: null,
    pessoa: null,
    minutos,
    metaMinutos: meta,
    pct: (minutos / meta) * 100,
    pctEquipe: null,
    pessoasAtivas: eq.length,
    equipe: eq,
    somadas: eq,
    ...over,
  }
}

test('Desenvolvimento: horas ÷ meta fecha com o card e a meta é a soma das metas individuais', () => {
  const c = ctxDesenv()
  const exp = explicarTreinamentosDesenvolvimento(c)
  verificaConta(exp)
  assert.equal(exp.tela, TELA_EFICIENCIA_PESSOAS.desenvolvimento)
  assert.equal(exp.valor, '41,90%')
  const comp = infos(exp.conta)
  assert.match(comp[0]?.rotulo ?? '', /3 pessoas × 14h/)
  assert.match(comp[1]?.rotulo ?? '', /proporcional: 1 pessoa/)
  assert.match(comp[1]?.detalhe ?? '', /Dora Melo \(9 meses\)/)
  assert.equal(comp.reduce((s, l) => s + (l.numero ?? 0), 0), c.metaMinutos)
  assert.ok(temRegra(exp, /menos Tributário/))
  assert.ok(temRegra(exp, /Coordenador Ops\. Legais/))
  assert.ok(temRegra(exp, /dia 15/))
  assert.ok(temRegra(exp, /Transferência/))
})

test('Desenvolvimento com pessoa única: meta individual e comparação com a equipe', () => {
  const dora = equipe()[3]
  const exp = explicarTreinamentosDesenvolvimento(
    ctxDesenv({ responsavel: 'Dora', pessoa: dora, minutos: 120, metaMinutos: 630, pct: (120 / 630) * 100, pctEquipe: 41.9, pessoasAtivas: 1 }),
  )
  verificaConta(exp)
  const meta = infos(exp.conta).find((l) => l.rotulo.startsWith('Meta = 14h'))
  assert.equal(meta?.rotulo, 'Meta = 14h × 9 meses ÷ 12')
  assert.match(meta?.detalhe ?? '', /20\/03\/2026/)
  assert.ok(infos(exp.conta).some((l) => l.rotulo === 'Equipe (ano inteiro)'))
  assert.ok(exp.filtros?.some((f) => f.rotulo === 'Pessoa' && f.valor === 'Dora Melo'))
})

test('Horas (ano inteiro): por pessoa + lançamentos repetidos = total do card', () => {
  const c = ctxDesenv()
  const somaPessoas = c.equipe.reduce((s, p) => s + p.minutos, 0)
  const exp = explicarTreinamentosHoras({ ...c, minutos: somaPessoas + 60 })
  verificaConta(exp)
  assert.equal(exp.valor, '23:00h')
  const dup = parcelas(exp.conta).find((l) => l.rotulo.includes('repetidos'))
  assert.equal(dup?.numero, 60)
  assert.ok(infos(exp.conta).some((l) => l.rotulo === '1 pessoa sem horas no período'))
})

test('Horas com recorte de período: muitas pessoas viram "Demais" e a conta fecha', () => {
  const muitas = Array.from({ length: 20 }, (_, i) => ({ colaborador: `PESSOA ${i + 1}`, minutos: (i + 1) * 30, metaMinutos: META }))
  const total = muitas.reduce((s, p) => s + p.minutos, 0)
  const exp = explicarTreinamentosHoras(
    ctxDesenv({ recortePeriodo: true, periodo: 'Out/2026', equipe: muitas, somadas: muitas, minutos: total }),
  )
  verificaConta(exp)
  const p = parcelas(exp.conta)
  assert.equal(p.length, 13)
  assert.equal(p[12]?.rotulo, 'Demais 8 pessoas')
  assert.ok(temRegra(exp, /meta continua a do ano inteiro/))
  assert.ok(temRegra(exp, /conta uma vez/))
})

test('Colaboradores ativos: meta cheia + proporcional = card', () => {
  const exp = explicarTreinamentosAtivos(ctxDesenv())
  verificaConta(exp)
  assert.equal(exp.valor, '4')
  assert.deepEqual(parcelas(exp.conta).map((l) => l.numero), [3, 1])
})

test('Card por pessoa: lançamentos únicos somam as horas e o % usa a meta proporcional', () => {
  const exp = explicarTreinamentoPessoa({
    tela: TELA_EFICIENCIA_PESSOAS.desenvolvimento,
    ano: 2026,
    periodo: 'Ano inteiro (2026)',
    colaborador: 'Dora Melo',
    minutos: 120,
    metaMinutos: 630,
    admissao: '2026-03-20',
    itens: [
      { colaborador: 'DORA MELO', treinamento: 'LGPD', data: '2026-05-10', duracao_minutos: 60 },
      { colaborador: 'DORA MELO', treinamento: 'LGPD', data: '2026-05-10', duracao_minutos: 60, duplicado: true },
      { colaborador: 'DORA MELO', treinamento: 'Excel', data: '2026-04-02', duracao_minutos: 60 },
    ],
  })
  verificaConta(exp)
  assert.equal(exp.valor, '19,05%')
  assert.deepEqual(parcelas(exp.conta).slice(0, 2).map((l) => l.rotulo), ['Excel', 'LGPD'])
  assert.ok(infos(exp.conta).some((l) => l.rotulo === '1 lançamento repetido'))
  assert.ok(infos(exp.conta).some((l) => l.rotulo === 'Faltam para a meta' && l.valor === '8h 30min'))
})

test('Card por pessoa acima da meta mostra "Meta atingida" e o % real na conta', () => {
  const exp = explicarTreinamentoPessoa({
    tela: TELA_EFICIENCIA_PESSOAS.desenvolvimento,
    ano: 2026,
    colaborador: 'Ana Souza',
    minutos: 900,
    metaMinutos: META,
    itens: [{ treinamento: 'Oratória', data: '2026-02-01', duracao_minutos: 900 }],
  })
  verificaConta(exp)
  assert.equal(exp.valor, 'Meta atingida')
  assert.equal(totais(exp.conta).at(-1)?.valor, '107,14%')
})

test('Card sem meta (Capacitação para Liderança) mostra só as horas', () => {
  const exp = explicarTreinamentoPessoa({
    tela: TELA_EFICIENCIA_PESSOAS.opsTreinamentos,
    ano: 2026,
    colaborador: 'Eva',
    minutos: 90,
    metaMinutos: null,
    badge: 'Equipe',
    itens: [{ treinamento: 'Liderança I', data: '2026-06-01', duracao_minutos: 90 }],
    regras: ['Não conta na meta de nenhuma categoria; o card mostra só as horas.'],
  })
  verificaConta(exp)
  assert.equal(exp.valor, '1h 30min')
  assert.ok(temRegra(exp, /Não conta na meta/))
})

// ---------------------------------------------------------------------------
// Operações Legais › Desenvolvimento Contínuo
// ---------------------------------------------------------------------------

const opsPessoas = [
  { colaborador: 'Ana', minutos: 900, metaMinutos: META },
  { colaborador: 'Bia', minutos: 200, metaMinutos: 420 },
  { colaborador: 'Caio', minutos: 0, metaMinutos: META },
]
const opsBase = {
  ano: 2026,
  categoria: 'Equipe' as const,
  visaoPessoas: false,
  qtdPessoas: 3,
  minutos: 1100,
  metaMinutos: 2100,
  pctAtingimento: 52.38,
  pctProjetado: 60.95,
  mostraProjecao: true,
  qtdMetaAtingida: 1,
  pctPessoasMeta: 33.33,
  pessoas: opsPessoas,
  sessoesFuturas: [{ duracao_minutos: 60 }],
}

test('Ops categoria (visão Equipe): horas ÷ meta da categoria e projeção com agendados', () => {
  const exp = explicarOpsTreinamentoCategoria(opsBase)
  verificaConta(exp)
  assert.equal(exp.tela, TELA_EFICIENCIA_PESSOAS.opsTreinamentos)
  assert.equal(exp.valor, '52,38%')
  assert.ok(infos(exp.conta).some((l) => l.rotulo === 'Projeção c/ agendados' && l.valor === '60,95%'))
  assert.ok(temRegra(exp, /Coordenador Ops\. Legais/))
})

test('Ops categoria (visão Pessoas): quem bateu a meta ÷ pessoas da categoria', () => {
  const exp = explicarOpsTreinamentoCategoria({ ...opsBase, visaoPessoas: true })
  verificaConta(exp)
  assert.equal(exp.valor, '33,33%')
  assert.deepEqual(parcelas(exp.conta).map((l) => l.numero), [1, 3])
})

test('Ops Gerente: total de horas = soma por gerente, sem meta', () => {
  const exp = explicarOpsTreinamentoCategoria({
    ...opsBase,
    categoria: 'Gerente',
    qtdPessoas: 2,
    minutos: 150,
    metaMinutos: null,
    pctAtingimento: null,
    pctProjetado: null,
    mostraProjecao: false,
    pessoas: [
      { colaborador: 'Gil', minutos: 90, metaMinutos: null },
      { colaborador: 'Hugo', minutos: 60, metaMinutos: null },
    ],
  })
  verificaConta(exp)
  assert.equal(exp.valor, '2h 30min')
  assert.ok(temRegra(exp, /não tem meta/))
})

// ---------------------------------------------------------------------------
// Retenção de Talentos
// ---------------------------------------------------------------------------

function ctxRetencao(over: Partial<RetencaoFenixCtx> = {}): RetencaoFenixCtx {
  return {
    ano: 2026,
    area: null,
    funcionariosAtivos: 85,
    saidasVoluntarias: 3,
    pctRetencao: 96.47,
    metaMinima: 90,
    desligamentos: [
      { tipo_desligamento: 'Voluntário' },
      { tipo_desligamento: 'Involuntário' },
      { tipo_desligamento: 'Voluntário' },
      { tipo_desligamento: 'Transferência' },
      { tipo_desligamento: 'Voluntário' },
    ],
    qtdListaAtivos: 83,
    hoje: HOJE,
    ...over,
  }
}

test('Retenção: 100% − taxa de saída voluntária = card', () => {
  const exp = explicarRetencao(ctxRetencao())
  verificaConta(exp)
  assert.equal(exp.valor, '96,47%')
  assert.equal(parcelas(exp.conta)[1]?.valor, '3,53%')
  assert.match(parcelas(exp.conta)[1]?.detalhe ?? '', /3 saídas voluntárias ÷ 85/)
  assert.ok(temRegra(exp, /"Voluntário"/))
  assert.ok(temRegra(exp, /ativo hoje/))
})

test('Saídas voluntárias: só o tipo Voluntário conta; os demais aparecem como informação', () => {
  const exp = explicarSaidasVoluntarias(ctxRetencao())
  verificaConta(exp)
  assert.equal(exp.valor, '3')
  assert.deepEqual(
    infos(exp.conta).map((l) => `${l.rotulo}:${l.valor}`),
    ['Involuntário:1', 'Transferência:1'],
  )
})

test('Funcionários ativos: avisa quando a lista de nomes tem outra quantidade', () => {
  const exp = explicarFuncionariosAtivos(ctxRetencao())
  verificaConta(exp)
  assert.equal(exp.valor, '85')
  assert.ok(infos(exp.conta).some((l) => l.valor === '83'))
  assert.ok(infos(exp.conta).some((l) => l.rotulo === 'Registros com desligamento em 2026' && l.valor === '5'))
})

// ---------------------------------------------------------------------------
// Gestão de PDI
// ---------------------------------------------------------------------------

function ctxPdi(over: Partial<GestaoPdiFenixCtx> = {}): GestaoPdiFenixCtx {
  const meses = [
    { mes: 6, elegiveis: 20, aptas: 20, desvios: 0, pct_aptas: 100 },
    { mes: 7, elegiveis: 18, aptas: 15, desvios: 3, pct_aptas: 83.33 },
    { mes: 8, elegiveis: 19, aptas: 17, desvios: 2, pct_aptas: 89.47 },
  ]
  const aptas = 52
  const eleg = 57
  return {
    tela: TELA_EFICIENCIA_PESSOAS.pdi,
    ano: 2026,
    area: null,
    periodo: 'Jun–Ago/2026',
    meses,
    pct: Math.round((aptas / eleg) * 10000) / 100,
    aptas,
    desvios: 5,
    pessoa: null,
    ...over,
  }
}

test('PDI: aptas somadas ÷ avaliações somadas (não é média), junho é base', () => {
  const exp = explicarGestaoPdiPeriodo(ctxPdi())
  verificaConta(exp)
  assert.equal(exp.valor, '91,23%')
  assert.match(parcelas(exp.conta)[0]?.detalhe ?? '', /junho é a base/)
  assert.equal(parcelas(exp.conta)[1]?.valor, '15 de 18')
  assert.ok(temRegra(exp, /não é média/))
  assert.ok(temRegra(exp, /evidência de execução = "Sim"/))
  assert.ok(temRegra(exp, /licença-maternidade/))
  const gv = explicarGestaoPdiGestaoVista(ctxPdi())
  assert.ok(temRegra(gv, /sem olhar o filtro de meses nem o de pessoa/))
})

test('PDI aptas e desvios: soma mês a mês = card', () => {
  const aptas = explicarGestaoPdiAptas(ctxPdi())
  const desvios = explicarGestaoPdiDesvios(ctxPdi())
  verificaConta(aptas)
  verificaConta(desvios)
  assert.equal(aptas.valor, '52')
  assert.equal(desvios.valor, '5')
})

test('PDI com filtro de pessoa: aptas ÷ (aptas + desvios) da pessoa', () => {
  const exp = explicarGestaoPdiPeriodo(ctxPdi({ pessoa: 'Ana Souza', aptas: 2, desvios: 1, pct: 66.67 }))
  verificaConta(exp)
  assert.equal(parcelas(exp.conta)[1]?.numero, 3)
  assert.ok(exp.filtros?.some((f) => f.rotulo === 'Pessoa'))
})

// ---------------------------------------------------------------------------
// NPS
// ---------------------------------------------------------------------------

const kpi: NpsKpi = {
  total: 33,
  promoters: 17,
  passives: 12,
  detractors: 4,
  nps: 39,
  campaignId: 'c1',
  campaignName: 'NPS 2026',
  campaignStatus: 'active',
  dimensions: { recommend: 8.4, availability: 8.7, communication: 8.1, innovation: 7.2, technical: 9 },
}

test('NPS: promotores + neutros + detratores = respostas; % promotores − % detratores, arredondado', () => {
  const exp = explicarNps({ ano: 2026, kpi })
  verificaConta(exp)
  assert.equal(exp.valor, '39,00%')
  assert.deepEqual(totais(exp.conta).map((l) => l.numero), [33, 39])
  assert.match(totais(exp.conta)[1]?.detalhe ?? '', /39,39, arredondado para 39/)
  assert.ok(infos(exp.conta).some((l) => l.valor === 'Zona de Aperfeiçoamento'))
  assert.ok(temRegra(exp, /9 e 10 = promotor, 7 e 8 = neutro, 0 a 6 = detrator/))
})

test('NPS: grupos e dimensões', () => {
  const det = explicarNpsGrupo({ ano: 2026, kpi }, 'detratores')
  verificaConta(det)
  assert.equal(det.valor, '4')
  assert.equal(infos(det.conta)[0]?.valor, '12,12%')
  const dim = explicarNpsDimensao({ ano: 2026, kpi }, 'technical')
  verificaConta(dim)
  assert.equal(dim.valor, '9,0')
  const fora = explicarNps({ ano: 2026, kpi: { ...kpi, total: 0, promoters: 0, passives: 0, detractors: 0, nps: null, unavailable: true } })
  assert.equal(fora.valor, '—')
  assert.match(infos(fora.conta)[0]?.detalhe ?? '', /indisponível/)
})

// ---------------------------------------------------------------------------
// Receita Bruta
// ---------------------------------------------------------------------------

function receitaRows(): ReceitaMesRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const temMeta = mes >= 6
    return {
      mes,
      mesLabel: String(mes),
      meta: temMeta ? 1_000_000 + (mes >= 11 ? 50_000 : 0) : 0,
      metaBase: temMeta ? 1_000_000 : 0,
      projetadoBaseAbril: 0,
      projetadoReal: 0,
      recebido: mes <= 11 ? 900_000 + mes * 1000 : 0,
      previsto: 0,
      encargos: 0,
    }
  })
}

function gestaoMeses(rows: ReceitaMesRow[]): GestaoVistaMesRow[] {
  return rows.map((r) => {
    const recebido = r.mes <= 11 ? r.recebido : null
    const meta = r.meta > 0 ? r.meta : null
    return {
      mes: r.mes,
      mesLabel: r.mesLabel,
      meta,
      previsto: r.previsto,
      recebido,
      pctMeta: recebido != null && meta ? Math.round((recebido / meta) * 10000) / 100 : null,
      pctPrevisto: null,
      inadimplencia: null,
      inadimplenciaPct: null,
      congelado: false,
    }
  })
}

test('Receita Bruta (ano inteiro): recebido jun→hoje ÷ meta do ano inteiro', () => {
  const rows = receitaRows()
  const meses = gestaoMeses(rows)
  const recebido = rows.filter((r) => r.mes >= 6 && r.mes <= 11).reduce((s, r) => s + r.recebido, 0)
  const meta = 7_000_000
  const { modo, meses: mesesConta } = modoReceitaBruta(null, 2026, meses)
  assert.equal(modo, 'ano')
  const exp = explicarReceitaBrutaPct({
    ano: 2026,
    escopo: 'periodo',
    pct: (recebido / meta) * 100,
    recebido,
    meta,
    modo,
    mesesConta,
    meses,
    rows,
    periodo: 'Ano inteiro (2026)',
    hoje: HOJE,
  })
  verificaConta(exp)
  assert.equal(parcelas(exp.conta).filter((l) => l.operador !== '÷').length, 6)
  assert.match(parcelas(exp.conta).find((l) => l.operador === '÷')?.detalhe ?? '', /× 7 meses/)
  assert.match(parcelas(exp.conta)[5]?.detalhe ?? '', /em andamento/)
  assert.ok(temRegra(exp, /meta do ano inteiro \(Jun–Dez\/2026\)/))
})

test('Receita Bruta (Gestão a Vista, vários meses): soma recebido ÷ soma da meta ajustada', () => {
  const rows = receitaRows()
  const meses = gestaoMeses(rows)
  const filtro = [6, 7, 8, 9, 10, 11]
  const { modo, meses: mesesConta } = modoReceitaBruta(filtro, 2026, meses)
  assert.equal(modo, 'meses')
  const escopo = meses.filter((m) => mesesConta.includes(m.mes))
  const recebido = escopo.reduce((s, m) => s + (m.recebido ?? 0), 0)
  const meta = escopo.reduce((s, m) => s + (m.meta ?? 0), 0)
  const exp = explicarReceitaBrutaPct({
    ano: 2026,
    escopo: 'gestao_vista',
    pct: (recebido / meta) * 100,
    recebido,
    meta,
    modo,
    mesesConta,
    meses,
    rows,
    periodo: 'Ano inteiro (2026)',
    hoje: HOJE,
  })
  verificaConta(exp)
  assert.ok(temRegra(exp, /meta ajustada/))
  assert.ok(temRegra(exp, /sem olhar o filtro de meses/))
  assert.equal(exp.filtros?.find((f) => f.rotulo === 'Meses (fixo)')?.valor, 'Jun–Nov/2026')
})

test('Receita Bruta (um mês): recebido do mês ÷ meta ajustada, mostra a meta original', () => {
  const rows = receitaRows()
  const meses = gestaoMeses(rows)
  const nov = meses.find((m) => m.mes === 11)!
  const { modo, meses: mesesConta } = modoReceitaBruta([11], 2026, meses)
  const exp = explicarReceitaBrutaPct({
    ano: 2026,
    escopo: 'periodo',
    pct: nov.pctMeta,
    recebido: nov.recebido,
    meta: nov.meta,
    modo,
    mesesConta,
    meses,
    rows,
    periodo: 'Nov/2026',
    hoje: HOJE,
  })
  verificaConta(exp)
  assert.equal(modo, 'mes')
  assert.ok(infos(exp.conta).some((l) => l.rotulo === 'Meta original do mês' && l.numero === 1_000_000))
})

test('Recebido acumulado: soma dos meses = card (sem centavos no card)', () => {
  const meses = gestaoMeses(receitaRows()).filter((m) => m.mes >= 6)
  meses[0] = { ...meses[0], recebido: (meses[0].recebido ?? 0) + 0.4 }
  const totalCard = meses.reduce((s, m) => s + (m.recebido ?? 0), 0)
  const exp = explicarReceitaBrutaRecebido({ ano: 2026, meses, total: totalCard, periodo: 'Ano inteiro (2026)', hoje: HOJE })
  verificaConta(exp)
  assert.equal(semNbsp(exp.valor), 'R$ 5.451.000')
  assert.ok(infos(exp.conta).some((l) => l.rotulo === 'No card'))
  assert.ok(temRegra(exp, /Sem recebido: Dez\/2026/))
})

// ---------------------------------------------------------------------------
// Índice de Inadimplência
// ---------------------------------------------------------------------------

test('Inadimplência: saldo ao vivo ÷ previsto = card; meses não seguidos viram blocos', () => {
  const aoVivo = { valor: 123_456.78, previsto: 2_000_000, pct: 6.17 }
  const exp = explicarInadimplenciaIndice({ ano: 2026, escopo: 'periodo', meses: [6, 7, 10], aoVivo, periodo: 'Jun, Jul e Out/2026' })
  verificaConta(exp)
  assert.equal(exp.valor, '6,17%')
  assert.ok(temRegra(exp, /Jun–Jul\/2026; Out\/2026/))
  assert.ok(infos(exp.conta).some((l) => l.valor === 'máx. 10%' && l.detalhe === 'dentro da meta'))
  const saldo = explicarInadimplenciaSaldo({ ano: 2026, escopo: 'periodo', meses: [6, 7, 10], aoVivo, periodo: '' })
  verificaConta(saldo)
  assert.equal(semNbsp(saldo.valor), 'R$ 123.457')
})

// ---------------------------------------------------------------------------
// Rótulos de período
// ---------------------------------------------------------------------------

test('Rótulos de período', () => {
  assert.equal(periodoMeses(2026, [6, 7, 8]), 'Jun–Ago/2026')
  assert.equal(periodoMeses(2026, [6, 8]), 'Jun e Ago/2026')
  assert.equal(rotuloPeriodoEficiencia(null, 2026, HOJE), 'Ano inteiro (2026)')
  assert.equal(rotuloPeriodoEficiencia('resultado', 2026, HOJE), 'Resultado: Jun–Out/2026')
  assert.equal(rotuloPeriodoEficiencia([9], 2026, HOJE), 'Set/2026')
  assert.equal(rotuloPeriodoEficiencia({ tipo: 'dia', de: '2026-10-01', ate: '2026-10-15' }, 2026, HOJE), '01/10/2026 – 15/10/2026')
})

test('Explicações são serializáveis (viram contexto da IA)', () => {
  const exps = [
    explicarTreinamentosDesenvolvimento(ctxDesenv()),
    explicarRetencao(ctxRetencao()),
    explicarGestaoPdiPeriodo(ctxPdi()),
    explicarNps({ ano: 2026, kpi }),
  ]
  for (const e of exps) {
    const json = JSON.stringify(e)
    assert.equal(JSON.stringify(JSON.parse(json)), json)
    assert.ok((e.conta ?? []).every((l) => typeof l.valor === 'string'))
  }
})
