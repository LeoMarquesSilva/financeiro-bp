import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularAreaMe,
  calcularGapMeta,
  horizonteMe,
  montarMesAMes,
  novaReceitaCorrespondeGrupo,
  proximoAjusteAoClicar,
  valorNovaReceitaPorMes,
  type ReceitaMeItemPrevisto,
} from '../src/features/receita/utils/receitaMeCalc.ts'
import type { ReceitaMeAjuste, ReceitaMeNovaReceita } from '../src/features/receita/types/receitaMe.types.ts'

const MESES = [10, 11, 12]

function prev(grupo: string, mes: number, valor: number, extra: Partial<ReceitaMeItemPrevisto> = {}) {
  return { areaKey: 'trabalhista', grupo, mes, valor, pago: false, vencido: false, ...extra }
}

function ajuste(grupo: string, mes: number, tipo: ReceitaMeAjuste['tipo'], valor_marcado: number): ReceitaMeAjuste {
  return {
    id: `${grupo}-${mes}`,
    ano: 2026,
    area_key: 'trabalhista',
    grupo,
    mes,
    tipo,
    valor_marcado,
    motivo: null,
    updated_at: null,
    updated_by: null,
  }
}

function nova(overrides: Partial<ReceitaMeNovaReceita>): ReceitaMeNovaReceita {
  return {
    id: 'nr1',
    ano: 2026,
    area_key: 'trabalhista',
    nome: 'Lead',
    grupo_cliente: null,
    origem: 'lead',
    tipo_receita: null,
    recorrencia: 'mensal',
    mes_inicio: 11,
    mes_fim: 12,
    valor: 1000,
    chance: 'media',
    observacao: null,
    meses_baixados: [],
    updated_at: null,
    updated_by: null,
    ...overrides,
  }
}

function base(over: Partial<Parameters<typeof calcularAreaMe>[0]> = {}) {
  return calcularAreaMe({
    areaKey: 'trabalhista',
    meses: MESES,
    mesCorrente: 10,
    previstos: [],
    recebidos: [],
    ajustes: [],
    novasReceitas: [],
    vistos: [],
    confirmada: false,
    ...over,
  })
}

test('ME soma recebido do mês corrente, aberto e novas receitas sem contar pago em dobro', () => {
  const r = base({
    previstos: [
      prev('Grupo A', 10, 1000, { pago: true }),
      prev('Grupo A', 11, 1000),
      prev('Grupo A', 12, 1000),
      prev('Outra área', 11, 5000, { areaKey: 'civel' }),
    ],
    recebidos: [{ areaKey: 'trabalhista', grupo: 'Grupo A', valor: 1000 }],
    novasReceitas: [nova({})],
  })
  assert.equal(r.recebido, 1000)
  assert.equal(r.aberto, 2000)
  assert.deepEqual(r.mePorMes, { 10: 1000, 11: 2000, 12: 2000 })
  assert.equal(r.meTotal, 5000)
})

test('vencido no mês corrente fica fora por padrão; vai_pagar e nao_paga invertem', () => {
  const previstos = [prev('Grupo A', 10, 800, { vencido: true }), prev('Grupo A', 10, 200)]
  const padrao = base({ previstos })
  assert.equal(padrao.linhas[0].celulas[10].estado, 'em_atraso')
  assert.equal(padrao.mePorMes[10], 200)
  assert.equal(padrao.fora, 800)

  const vai = base({ previstos, ajustes: [ajuste('Grupo A', 10, 'vai_pagar', 1000)] })
  assert.equal(vai.mePorMes[10], 1000)

  const nao = base({ previstos, ajustes: [ajuste('Grupo A', 10, 'nao_paga', 1000)] })
  assert.equal(nao.mePorMes[10], 0)
  assert.equal(nao.fora, 1000)
})

test('marcar não paga não muda a ordem das linhas', () => {
  const previstos = [prev('Grupo Grande', 11, 5000), prev('Grupo Pequeno', 11, 1000)]
  const antes = base({ previstos }).linhas.map((l) => l.grupo)
  const depois = base({ previstos, ajustes: [ajuste('Grupo Grande', 11, 'nao_paga', 5000)] }).linhas.map((l) => l.grupo)
  assert.deepEqual(depois, antes)
})

test('chance baixa vira potencial e meses baixados deixam de contar', () => {
  const r = base({
    novasReceitas: [
      nova({ id: 'a', chance: 'baixa', recorrencia: 'pontual', mes_inicio: 12, mes_fim: 12, valor: 500 }),
      nova({ id: 'b', meses_baixados: [11] }),
    ],
  })
  assert.equal(r.potencial, 500)
  assert.deepEqual(r.novasPorMes, { 10: 0, 11: 0, 12: 1000 })
})

test('estimativa de mês já fechado some do horizonte', () => {
  assert.deepEqual(valorNovaReceitaPorMes(nova({ mes_inicio: 9, mes_fim: 12 }), MESES), { 10: 1000, 11: 1000, 12: 1000 })
})

test('novidades só depois de confirmar: título novo, pagamento e duplicidade', () => {
  const previstos = [prev('Grupo A', 11, 1000), prev('Grupo Nova Era', 12, 1500), prev('Grupo B', 11, 300)]
  const vistos = [{ ano: 2026, area_key: 'trabalhista', grupo: 'Grupo A', mes: 11, valor_visto: 1000 }]
  const semConfirmar = base({ previstos, vistos })
  assert.equal(semConfirmar.novidades.length, 0)

  const r = base({
    previstos,
    vistos,
    confirmada: true,
    ajustes: [ajuste('Grupo B', 11, 'nao_paga', 900)],
    novasReceitas: [nova({ id: 'nr-era', nome: 'Acordo Nova Era', recorrencia: 'pontual', mes_inicio: 12, mes_fim: 12 })],
  })
  const novo = r.novidades.filter((n) => n.tipo === 'novo')
  assert.deepEqual(novo.map((n) => n.grupo).sort(), ['Grupo B', 'Grupo Nova Era'])
  const era = novo.find((n) => n.grupo === 'Grupo Nova Era')
  assert.ok(era && era.tipo === 'novo' && era.duplicidade?.novaReceitaId === 'nr-era')
  const pagou = r.novidades.find((n) => n.tipo === 'pagou')
  assert.ok(pagou && pagou.tipo === 'pagou' && pagou.reducao === 600 && pagou.abertoAtual === 300)
})

test('correspondência de nome ignora "Grupo" e acentos', () => {
  assert.equal(novaReceitaCorrespondeGrupo({ nome: 'Metalúrgica São José', grupo_cliente: null }, 'Grupo Metalurgica Sao Jose'), true)
  assert.equal(novaReceitaCorrespondeGrupo({ nome: 'Lead', grupo_cliente: null }, 'Grupo Spel'), false)
})

test('ciclo de clique na célula', () => {
  assert.equal(proximoAjusteAoClicar('conta'), 'nao_paga')
  assert.equal(proximoAjusteAoClicar('nao_paga'), null)
  assert.equal(proximoAjusteAoClicar('em_atraso'), 'vai_pagar')
  assert.equal(proximoAjusteAoClicar('vai_pagar'), 'nao_paga')
  assert.equal(proximoAjusteAoClicar('quitado'), 'ignorar')
})

test('horizonte vai do mês corrente a dezembro', () => {
  assert.deepEqual(horizonteMe(2026, new Date(2026, 9, 21)), { meses: [10, 11, 12], mesCorrente: 10 })
  assert.deepEqual(horizonteMe(2025, new Date(2026, 9, 21)), { meses: [], mesCorrente: null })
})

test('mês a mês e gap usam realizado nos fechados e ME nos abertos', () => {
  const meta = 1_428_571.43
  const linhas = montarMesAMes({
    mesesMeta: [6, 7, 8, 9, 10, 11, 12],
    metaPorMes: { 6: meta, 7: meta, 8: meta, 9: meta, 10: meta, 11: meta, 12: meta },
    realizadoPorMes: { 6: 1_000_000, 7: 1_000_000, 8: 1_000_000, 9: 1_000_000 },
    mePorMes: { 10: 1_200_000, 11: 1_100_000, 12: 1_100_000 },
    mesesHorizonte: [10, 11, 12],
  })
  assert.equal(linhas[0].base, 'realizado')
  assert.equal(linhas[4].base, 'me')
  const gap = calcularGapMeta(linhas)
  assert.equal(Math.round(gap.projecao), 7_400_000)
  assert.equal(Math.round(gap.gap), 2_600_000)
  assert.equal(gap.mesesAbertos, 3)
  assert.equal(Math.round(gap.necessarioPorMes), 2_000_000)
})
