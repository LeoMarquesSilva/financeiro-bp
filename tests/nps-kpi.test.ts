import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeNpsSummary,
  pickNpsCampaignForYear,
  npsZona,
} from '../src/features/eficiencia/utils/npsCalc.ts'

test('NPS clássico: 64 promotores e 2 neutros em 66 respostas = 97', () => {
  const scores = [...Array(64).fill(10), 8, 7]
  const summary = computeNpsSummary(scores)
  assert.equal(summary.total, 66)
  assert.equal(summary.promoters, 64)
  assert.equal(summary.passives, 2)
  assert.equal(summary.detractors, 0)
  assert.equal(summary.nps, 97)
})

test('sem respostas o NPS fica vazio', () => {
  assert.equal(computeNpsSummary([]).nps, null)
})

test('escolhe a campanha do ano e ignora outro exercício', () => {
  const campaigns = [
    {
      id: '2025',
      name: 'NPS 2025',
      status: 'closed' as const,
      startsAt: '2025-08-01T00:00:00.000Z',
    },
    {
      id: '2026',
      name: 'NPS 2026',
      status: 'active' as const,
      startsAt: '2026-08-05T00:00:00.000Z',
    },
  ]
  assert.equal(pickNpsCampaignForYear(campaigns, 2026)?.id, '2026')
  assert.equal(pickNpsCampaignForYear(campaigns, 2025)?.id, '2025')
  assert.equal(pickNpsCampaignForYear(campaigns, 2024), null)
})

test('97 está na zona de excelência (meta 85)', () => {
  assert.equal(npsZona(97), 'Zona de Excelência')
  assert.equal(npsZona(85), 'Zona de Excelência')
  assert.equal(npsZona(null), null)
})
