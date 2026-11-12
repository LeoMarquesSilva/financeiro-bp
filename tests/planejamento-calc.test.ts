import test from 'node:test'
import assert from 'node:assert/strict'
import { AREA_KEYS_2027, soma } from '../src/features/planejamento/utils/areasPlanejamento.ts'
import {
  aplicarAjusteReceita,
  estimarImpostoPelaTaxa,
  mePorAreaPlanejamento,
  montarBaseRealizada,
  projetarAno,
  totaisArea,
} from '../src/features/planejamento/utils/planejamentoBase.ts'
import {
  desdobrarCrescimento,
  linhasMetasOficiais,
  normalizarPremissas,
  premissasPadrao,
  simular,
} from '../src/features/planejamento/utils/planejamentoCalc.ts'
import {
  linhasMetasOperacionais,
  metaEfetivaArea,
  valoresJuridico,
} from '../src/features/planejamento/utils/indicadoresOperacionais.ts'
import type { PlanMargemRow, PlanOpexBlocosRow } from '../src/features/planejamento/types.ts'

function margemRow(area_key: string, mes: number, over: Partial<PlanMargemRow> = {}): PlanMargemRow {
  return {
    area_key,
    mes,
    receita_bruta: 100_000,
    base_nf: 50_000,
    aliquota: 16,
    aliquota_herdada: false,
    impostos: 8_000,
    desp_pessoas: 30_000,
    desp_demais: 10_000,
    desp_operacionais: 40_000,
    pct_controladoria: 10,
    origem_controladoria: 'legal_ops',
    desp_controladoria: 5_000,
    pessoas_reclassificadas: 0,
    ...over,
  }
}

function opexRow(mes: number): PlanOpexBlocosRow {
  return { mes, areas: 0, controladoria: 60_000, estrutura: 20_000, outros: 0, total: 0, pessoas_reclassificadas: 0, pessoas_sem_match: 0 }
}

function baseUmaArea(meses = 12, over: (m: number) => Partial<PlanMargemRow> = () => ({})) {
  const rows = Array.from({ length: meses }, (_, i) => margemRow('civel', i + 1, over(i + 1)))
  const opex = Array.from({ length: 12 }, (_, i) => opexRow(i + 1))
  return montarBaseRealizada(2026, rows, opex)
}

test('margem de contribuição = receita − imposto − pessoas − demais − Controladoria; % sobre a líquida', () => {
  const base = baseUmaArea()
  const t = totaisArea(base.areas.civel)
  assert.equal(t.receita, 1_200_000)
  assert.equal(t.margem, 12 * (100_000 - 8_000 - 30_000 - 10_000 - 5_000))
  assert.ok(Math.abs((t.margemPct ?? 0) - (t.margem / (t.receita - t.impostos)) * 100) < 1e-9)
})

test('projeção 2026: receita pela ME, imposto pela taxa efetiva, custos repetem o último mês fechado', () => {
  const base = baseUmaArea(10, (m) => (m === 10 ? { desp_pessoas: 33_000 } : {}))
  const me = mePorAreaPlanejamento({ civel: { 11: 120_000, 12: 90_000 } }, base, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  const p = projetarAno(base, 10, me)
  assert.equal(p.areas.civel.receita[10], 120_000)
  assert.equal(p.areas.civel.receita[11], 90_000)
  assert.ok(Math.abs(p.areas.civel.impostos[10] - 120_000 * 0.08) < 1e-6)
  assert.equal(p.areas.civel.pessoas[10], 33_000)
  assert.equal(p.areas.civel.pessoas[11], 33_000)
  assert.deepEqual(p.projetado.slice(9), [false, true, true])
})

test('ME de "outras" vai toda para Tributário: Distressed Deals está encerrada e não recebe ME', () => {
  const rows = [margemRow('add', 1, { receita_bruta: 300 }), margemRow('tributario', 1, { receita_bruta: 100 })]
  const base = montarBaseRealizada(2026, rows, [])
  const me = mePorAreaPlanejamento({ outras: { 11: 1000 } }, base, [1])
  assert.equal(me.add[11] ?? 0, 0)
  assert.equal(me.tributario[11], 1000)
})

test('imposto 2025 estimado pela taxa efetiva de 2026 da área', () => {
  const b26 = baseUmaArea()
  const b25 = montarBaseRealizada(2025, [margemRow('civel', 1, { receita_bruta: 50_000, impostos: 0 })], [])
  const est = estimarImpostoPelaTaxa(b25, b26, [1, 2, 3])
  assert.ok(est.impostoEstimado)
  assert.ok(Math.abs(est.areas.civel.impostos[0] - 50_000 * 0.08) < 1e-6)
  assert.equal(est.areas.civel.impostosNf[0], 0)
})

test('ajuste provisório da receita 2025 soma por área e no sem área, e o imposto estimado segue a receita ajustada', () => {
  const b26 = baseUmaArea()
  const b25 = montarBaseRealizada(
    2025,
    [margemRow('civel', 9, { receita_bruta: 50_000, impostos: 0 }), margemRow('sem_area', 9, { receita_bruta: 4_000 })],
    [],
  )
  const fonte = 'controle'
  const ajustada = aplicarAjusteReceita(b25, [
    { mes: 9, area_key: 'civel', valor: 195_700, fonte },
    { mes: 9, area_key: 'insolvencia', valor: -10_000, fonte },
    { mes: 9, area_key: 'sem_area', valor: -1_000, fonte },
  ])
  assert.equal(ajustada.areas.civel.receita[8], 245_700)
  assert.equal(ajustada.areas.insolvencia.receita[8], -10_000)
  assert.equal(ajustada.semArea[8], 3_000)
  assert.equal(ajustada.ajusteReceita?.total[8], 184_700)
  assert.equal(b25.areas.civel.receita[8], 50_000, 'não altera a base original')
  const est = estimarImpostoPelaTaxa(ajustada, b26, [1, 2, 3])
  assert.ok(Math.abs(est.areas.civel.impostos[8] - 245_700 * 0.08) < 1e-6)
  assert.ok(est.ajusteReceita, 'o ajuste continua marcado depois de estimar o imposto')
  assert.equal(aplicarAjusteReceita(b25, []).ajusteReceita, null)
})

test('simulador: crescimento, receita nova, sazonalidade, alíquota, reajuste e contratações', () => {
  const base = baseUmaArea(12, (m) => ({ receita_bruta: m === 12 ? 200_000 : 100_000 }))
  const pad = premissasPadrao({ aliquotaPct: 10, inadimplenciaMetaPct: 10 })
  const prem = normalizarPremissas(
    {
      escritorio: { aliquotaPct: 10, reajustePct: 5, mesReajuste: 7, inadimplenciaMetaPct: 10, distribuicao: 'sazonal' },
      areas: { civel: { crescimentoPct: 10, receitaNova: 130_000, contratacoes: 2, custoContratacao: 10_000, mesInicioContratacao: 4 } },
    },
    pad,
  )
  const r = simular(base, prem)
  const a = r.areas.civel
  const baseAno = 1_300_000
  assert.equal(a.receitaBaseAno, baseAno)
  assert.ok(Math.abs(a.receitaAno - (baseAno * 1.1 + 130_000)) < 1e-6)
  // Dezembro pesa 2/13 da receita 2026.
  assert.ok(Math.abs(a.receita[11] - a.receitaAno * (200_000 / baseAno)) < 1e-6)
  assert.ok(Math.abs(soma(a.receita) - a.receitaAno) < 1e-6)
  assert.ok(Math.abs(a.impostos[0] - a.receita[0] * 0.1) < 1e-6)
  assert.equal(a.pessoas[0], 30_000)
  assert.equal(a.pessoas[3], 30_000 + 20_000)
  assert.ok(Math.abs(a.pessoas[6] - (30_000 * 1.05 + 20_000)) < 1e-6)
  // Faturamento necessário com 10% de inadimplência.
  assert.ok(Math.abs(r.escritorio.faturamentoNecessarioAno - r.escritorio.receitaAno / 0.9) < 1e-6)
  // Resultado = margens − estrutura − Controladoria não rateada (60 mil − 5 mil rateado).
  assert.ok(Math.abs(r.escritorio.resultado[0] - (r.escritorio.margem[0] - 20_000 - 55_000)) < 1e-6)
})

test('distribuição linear divide a receita do ano em 12 partes iguais', () => {
  const base = baseUmaArea(12, (m) => ({ receita_bruta: m * 1000 }))
  const prem = premissasPadrao({ aliquotaPct: 0, inadimplenciaMetaPct: 0 })
  prem.escritorio.distribuicao = 'linear'
  const r = simular(base, prem)
  assert.ok(Math.abs(r.areas.civel.receita[0] - r.areas.civel.receita[11]) < 1e-6)
})

test('premissas salvas incompletas são completadas com o padrão', () => {
  const pad = premissasPadrao({ aliquotaPct: 6, inadimplenciaMetaPct: 10 })
  const p = normalizarPremissas({ areas: { civel: { crescimentoPct: '12' } }, operacionais: { sla_protocolo: { escritorio: 90, areas: { Cível: '' } } } }, pad)
  assert.equal(p.areas.civel.crescimentoPct, 12)
  assert.equal(p.areas.trabalhista.crescimentoPct, null, 'área sem % salvo fica no automático')
  assert.equal(p.escritorio.crescimentoReceitaPct, null, 'cenário antigo com % por área: sem meta do escritório')
  assert.equal(normalizarPremissas({}, pad).escritorio.crescimentoReceitaPct, 0)
  assert.equal(p.escritorio.aliquotaPct, 6)
  assert.equal(p.operacionais.sla_protocolo.escritorio, 90)
  assert.equal(p.operacionais.sla_protocolo.areas['Cível'], null)
})

test('metas oficiais: 12 meses × áreas ativas (sem Distressed Deals), e metas operacionais do escritório e por área', () => {
  const base = baseUmaArea()
  const r = simular(base, premissasPadrao({ aliquotaPct: 10, inadimplenciaMetaPct: 8 }))
  const linhas = linhasMetasOficiais(r, 8)
  assert.equal(linhas.length, 12 * AREA_KEYS_2027.length)
  assert.ok(!linhas.some((l) => l.area_key === 'add'))
  const ops = linhasMetasOperacionais({ sla_protocolo: { escritorio: 90, areas: { 'Cível': 92, Trabalhista: null } } })
  assert.deepEqual(
    ops.map((l) => [l.indicador, l.area_key, l.meta]),
    [
      ['sla_protocolo', null, 90],
      ['sla_protocolo', 'Cível', 92],
    ],
  )
  assert.equal(metaEfetivaArea({ escritorio: 90, areas: { 'Cível': 92 } }, 'Trabalhista'), 90)
  assert.equal(metaEfetivaArea({ escritorio: 90, areas: { 'Cível': 92 } }, 'Cível'), 92)
})

test('indicadores jurídicos: acumulado é a soma das razões, não a média dos meses', () => {
  const v = valoresJuridico({
    slaProtocolo: [
      { mes: 1, qtd_d1: 9, qtd_fatal: 1, qtd_total: 10, pct_eficiencia: 90, meta: 85 },
      { mes: 2, qtd_d1: 50, qtd_fatal: 50, qtd_total: 100, pct_eficiencia: 50, meta: 85 },
    ],
    eficienciaProtocolo: [],
    agendamento: [],
    slaVistagemRisco: [],
    slaVistagemComum: [],
    treinamentos: { minutos_lancados: 1680, pessoas_ativas: 2, meta_minutos: 1680, pct_atingimento: 100 },
    treinamentosMensal: [],
    turnover: null,
    gestaoPdiMensal: [],
  })
  assert.equal(v.sla_protocolo?.mensal[0], 90)
  assert.ok(Math.abs((v.sla_protocolo?.acumulado ?? 0) - (59 / 110) * 100) < 1e-9)
  assert.equal(v.desenvolvimento_equipe?.acumulado, 840)
  assert.equal(v.retencao?.acumulado, null)
})

test('área encerrada (Distressed Deals) não tem projeção em 2027; com meta de 0% as automáticas cobrem a receita dela', () => {
  const rows = [margemRow('add', 1, { receita_bruta: 50_000 }), margemRow('civel', 1, { receita_bruta: 100_000 })]
  const base = montarBaseRealizada(2026, rows, [])
  const p = premissasPadrao({ aliquotaPct: 10, inadimplenciaMetaPct: 10 })
  p.areas.add.crescimentoPct = 50
  p.areas.add.receitaNova = 1_000
  const r = simular(base, p)
  assert.equal(r.areas.add.receitaAno, 0)
  assert.equal(soma(r.areas.add.margem), 0)
  assert.equal(r.areas.add.receitaBaseAno, 50_000)
  assert.equal(r.escritorio.receitaBaseAno, 150_000)
  // Meta de 0%: o escritório mantém 150 mil, então o Cível (automático) cresce 50%.
  assert.ok(Math.abs(r.escritorio.receitaAno - 150_000) < 1e-6)
  assert.ok(Math.abs((r.areas.civel.crescimentoOrganicoPct ?? 0) - 50) < 1e-9)
  // Sem meta do escritório (cenário antigo), o total é a soma das áreas.
  p.escritorio.crescimentoReceitaPct = null
  assert.equal(simular(base, p).escritorio.receitaAno, 100_000)
})

test('desdobramento: automáticas crescem o mesmo % e fecham a meta; sem automática, mostra a diferença', () => {
  const rows = [
    margemRow('civel', 1, { receita_bruta: 100_000 }),
    margemRow('trabalhista', 1, { receita_bruta: 300_000 }),
    margemRow('insolvencia', 1, { receita_bruta: 600_000 }),
  ]
  const base = montarBaseRealizada(2026, rows, [])
  const p = premissasPadrao({ aliquotaPct: 10, inadimplenciaMetaPct: 10 })
  p.escritorio.crescimentoReceitaPct = 10
  p.areas.insolvencia.crescimentoPct = 20
  p.areas.civel.receitaNova = 10_000
  const d = desdobrarCrescimento(base, p)
  assert.equal(d.metaReceita, 1_100_000)
  // Insolvência fixa em 720 mil; Cível e Trabalhista (400 mil de base + 10 mil de receita nova) fecham 380 mil.
  assert.ok(Math.abs(d.crescimentoAutomaticoPct - ((380_000 - 10_000) / 400_000 - 1) * 100) < 1e-9)
  assert.deepEqual(d.areasAutomaticas.filter((k) => ['civel', 'trabalhista', 'insolvencia'].includes(k)), ['trabalhista', 'civel'])
  assert.ok(Math.abs(d.diferenca) < 1e-6)
  const r = simular(base, p)
  assert.ok(Math.abs(r.escritorio.receitaAno - 1_100_000) < 1e-6)
  assert.equal(r.areas.insolvencia.automatico, false)
  assert.equal(r.areas.civel.automatico, true)
  // Todas fixadas: a soma não fecha e a diferença aparece.
  for (const k of AREA_KEYS_2027) p.areas[k].crescimentoPct = 0
  const d2 = desdobrarCrescimento(base, p)
  assert.equal(d2.areasAutomaticas.length, 0)
  assert.ok(Math.abs(d2.diferenca - (1_010_000 - 1_100_000)) < 1e-6)
})

test('pessoas: várias contratações por área, reajuste e ajustes na equipe atual; ponte soma o custo 2027', () => {
  const base = baseUmaArea()
  const pad = premissasPadrao({ aliquotaPct: 10, inadimplenciaMetaPct: 10 })
  const p = normalizarPremissas(
    {
      escritorio: { reajustePct: 5, mesReajuste: 5 },
      areas: {
        civel: {
          variacaoPessoasPct: -10,
          contratacoes: [
            { descricao: 'Advogado pleno', qtd: 2, custoMensal: 9_000, mesInicio: 3 },
            { descricao: 'Estagiário', qtd: 1, custoMensal: 2_000, mesInicio: 8 },
          ],
        },
      },
    },
    pad,
  )
  const a = simular(base, p).areas.civel
  assert.equal(a.novasPessoas[1], 0)
  assert.equal(a.novasPessoas[2], 2)
  assert.equal(a.novasPessoas[11], 3)
  assert.equal(a.contratacoes[7], 20_000)
  assert.ok(Math.abs(a.pessoas[0] - 27_000) < 1e-9)
  assert.ok(Math.abs(a.pessoas[5] - (27_000 * 1.05 + 18_000)) < 1e-9)
  const ponte = a.pontePessoas
  assert.equal(ponte.base, 360_000)
  assert.ok(Math.abs(ponte.ajustes + 36_000) < 1e-9)
  assert.ok(Math.abs(ponte.reajuste - 27_000 * 0.05 * 8) < 1e-9)
  assert.equal(ponte.contratacoes, 18_000 * 10 + 2_000 * 5)
  assert.ok(Math.abs(ponte.base + ponte.ajustes + ponte.reajuste + ponte.contratacoes - soma(a.pessoas)) < 1e-6)
  // Formato antigo (uma contratação por área) vira uma linha da lista.
  const antigo = normalizarPremissas({ areas: { civel: { contratacoes: 2, custoContratacao: 10_000, mesInicioContratacao: 4 } } }, pad)
  assert.deepEqual(antigo.areas.civel.contratacoes, [{ descricao: '', qtd: 2, custoMensal: 10_000, mesInicio: 4 }])
})
