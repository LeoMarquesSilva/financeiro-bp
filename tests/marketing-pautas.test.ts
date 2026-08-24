import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMarketingPautas,
  compareMarketingPautaPeriods,
  computeMarketingPautaGoal,
  getMarketingPautaTiming,
  marketingPautasInRange,
  rankMarketingPautaDeliveries,
  summarizeMarketingPautas,
} from '../src/features/operacoes-legais/marketing/marketingPautas.ts'
import { resolveTaskAssignee } from '../scripts/sharepoint/transforms.mjs'

const MARKETING_TASK = 'MATERIAL MARKETING - REELS/POST/ARTIGO'

function row(overrides: Record<string, unknown>) {
  return {
    ci: 100,
    ci_processo: 51763,
    grupo_cliente: 'Grupo Área Trabalhista',
    cliente: 'Área Trabalhista',
    tarefa: MARKETING_TASK,
    tarefa_pai: null,
    status: 'Aberta',
    responsavel: null,
    usuario_conclusao: null,
    data_conclusao: null,
    data_para_conclusao: '2026-08-10',
    area_conclusao: null,
    ...overrides,
  }
}

test('monta a pauta e aponta protocolo aberto como gargalo atual', () => {
  const pautas = buildMarketingPautas([
    row({
      status: 'Concluída',
      usuario_conclusao: 'Ana Lima',
      data_conclusao: '2026-08-09',
    }),
    row({
      ci: 101,
      tarefa: '2. REVISAR',
      tarefa_pai: MARKETING_TASK,
      status: 'Concluída',
      usuario_conclusao: 'Revisora',
      data_conclusao: '2026-08-11',
      data_para_conclusao: '2026-08-11',
    }),
    row({
      ci: 102,
      tarefa: '3. PROTOCOLAR',
      tarefa_pai: MARKETING_TASK,
      data_para_conclusao: '2026-08-12',
    }),
  ], new Date('2026-08-21T12:00:00Z'))

  assert.equal(pautas.length, 1)
  assert.deepEqual(
    {
      id: pautas[0].id,
      responsavel: pautas[0].responsavel,
      area: pautas[0].area,
      stage: pautas[0].stage,
      currentDueDate: pautas[0].currentDueDate,
      isLate: pautas[0].isLate,
    },
    {
      id: 100,
      responsavel: 'Ana Lima',
      area: 'Trabalhista',
      stage: 'em_protocolo',
      currentDueDate: '2026-08-12',
      isLate: true,
    },
  )
})

test('preserva responsável da agenda em pauta aberta e não inventa nome ausente', () => {
  const [assigned, missing] = buildMarketingPautas([
    row({ ci: 200, responsavel: 'Bruno Reis' }),
    row({ ci: 300, ci_processo: 51980, cliente: 'Área Cível' }),
  ], new Date('2026-08-01T12:00:00Z'))

  assert.equal(assigned.responsavel, 'Bruno Reis')
  assert.equal(assigned.stage, 'aguardando_envio')
  assert.equal(missing.responsavel, null)
})

test('separa tempo parado na revisão do atraso contra o prazo', () => {
  const [pauta] = buildMarketingPautas([
    row({
      status: 'Concluída',
      responsavel: 'Autora',
      data_conclusao: '2026-08-15',
      data_para_conclusao: '2026-08-14',
    }),
    row({
      ci: 101,
      tarefa: '2. REVISAR',
      tarefa_pai: MARKETING_TASK,
      responsavel: 'Revisor',
      data_para_conclusao: '2026-08-18',
    }),
  ], new Date('2026-08-21T12:00:00Z'))

  assert.deepEqual(getMarketingPautaTiming(pauta, new Date('2026-08-21T12:00:00Z')), {
    stageElapsed: 'Em revisão há 6 dias',
    currentDeadline: 'Revisão atrasada há 3 dias',
    authorDelivery: 'Envio entregue com 1 dia de atraso',
  })
})

test('descreve prazo de envio aberto sem inventar tempo de revisão', () => {
  const [pauta] = buildMarketingPautas([
    row({ responsavel: 'Autora', data_para_conclusao: '2026-08-18' }),
    row({
      ci: 101,
      tarefa: '2. REVISAR',
      tarefa_pai: MARKETING_TASK,
      responsavel: 'Revisor',
      data_para_conclusao: '2026-08-22',
    }),
  ], new Date('2026-08-21T12:00:00Z'))

  assert.deepEqual(getMarketingPautaTiming(pauta, new Date('2026-08-21T12:00:00Z')), {
    stageElapsed: null,
    currentDeadline: 'Envio atrasado há 3 dias',
    authorDelivery: null,
  })
})

test('mantém canceladas fora da meta e resume o funil do mês', () => {
  const pautas = buildMarketingPautas([
    row({ ci: 10, status: 'Concluída', usuario_conclusao: 'Ana', data_conclusao: '2026-08-08' }),
    row({ ci: 20, status: 'Concluída', usuario_conclusao: 'Ana', data_conclusao: '2026-07-08', data_para_conclusao: '2026-07-10' }),
    row({ ci: 30, status: 'Cancelada' }),
    row({ ci: 40, responsavel: 'Bruno' }),
  ], new Date('2026-08-21T12:00:00Z'))
  const summary = summarizeMarketingPautas(
    pautas,
    { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.999Z' },
    new Date('2026-08-21T12:00:00Z'),
  )

  assert.equal(summary.delivered, 1)
  assert.equal(summary.target, 10)
  assert.equal(summary.cancelled, 1)
  assert.equal(summary.stages.aguardando_envio, 1)
  assert.equal(summary.missingAssignee, 0)
})

test('remove pautas canceladas da lista operacional', () => {
  const pautas = buildMarketingPautas([
    row({ ci: 10, responsavel: 'Ana' }),
    row({ ci: 20, status: 'Cancelada' }),
  ])
  const visible = marketingPautasInRange(pautas, {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-31T23:59:59.999Z',
  })

  assert.deepEqual(visible.map((pauta) => pauta.id), [10])
})

test('calcula meta proporcional sem alterar a meta de mês e ano completos', () => {
  assert.equal(computeMarketingPautaGoal({
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-31T23:59:59.999Z',
  }), 10)
  assert.equal(computeMarketingPautaGoal({
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-12-31T23:59:59.999Z',
  }), 120)
  assert.equal(computeMarketingPautaGoal({
    from: '2026-08-17T00:00:00.000Z',
    to: '2026-08-23T23:59:59.999Z',
  }), 2.3)
})

test('compara entregas e ranqueia autores no período', () => {
  const pautas = buildMarketingPautas([
    row({ ci: 10, status: 'Concluída', usuario_conclusao: 'Ana', data_conclusao: '2026-08-08' }),
    row({ ci: 20, status: 'Concluída', usuario_conclusao: 'Ana', data_conclusao: '2026-08-18' }),
    row({ ci: 30, status: 'Concluída', usuario_conclusao: 'Bruno', data_conclusao: '2026-07-08', data_para_conclusao: '2026-07-10' }),
  ])
  const current = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.999Z' }
  const previous = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-31T23:59:59.999Z' }

  assert.deepEqual(compareMarketingPautaPeriods(pautas, current, previous), {
    current: 2,
    previous: 1,
    changePct: 100,
  })
  assert.deepEqual(rankMarketingPautaDeliveries(pautas, current), [
    { name: 'Ana', delivered: 2 },
  ])
})

test('resolve somente o responsável explícito exportado pela agenda', () => {
  assert.equal(resolveTaskAssignee({ Responsável: ' Ana Lima ' }), 'Ana Lima')
  assert.equal(resolveTaskAssignee({ 'Responsável pela tarefa': 'Bruno Reis' }), 'Bruno Reis')
  assert.equal(resolveTaskAssignee({ 'Usuário responsável': 'Carla Dias' }), 'Carla Dias')
  assert.equal(resolveTaskAssignee({ 'Usuário que concluiu a tarefa': 'Não usar' }), null)
})

test('preserva vínculo manual quando a exportação não informa responsável', () => {
  assert.equal(resolveTaskAssignee({}, 'Maria Heloiza Gois Ponce'), 'Maria Heloiza Gois Ponce')
  assert.equal(resolveTaskAssignee({ Responsável: 'Nova Pessoa' }, 'Pessoa Antiga'), 'Nova Pessoa')
})
