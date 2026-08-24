import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clusterLabelSidesAreInverted,
  resolveClusterLabelSides,
  resolveClusteredLabelPlacement,
} from '../src/features/receita/utils/chartLabelPlacement.ts'

function side(cluster: { key: string; value: number }[], key: string) {
  return resolveClusterLabelSides(cluster).get(key)
}

test('abr: previsto 100% acima; recebido 100,37% abaixo — sem empilhar', () => {
  const cluster = [
    { key: 'recebido', value: 100.37 },
    { key: 'previsto', value: 100 },
    { key: 'inadimplencia', value: 14.18 },
  ]
  assert.equal(side(cluster, 'previsto'), 'above')
  assert.equal(side(cluster, 'recebido'), 'below')
  assert.equal(side(cluster, 'inadimplencia'), 'below')
  assert.equal(clusterLabelSidesAreInverted(cluster), false)
})

test('mai: 100% acima e 77,25% abaixo — valores distantes', () => {
  const cluster = [
    { key: 'previsto', value: 100 },
    { key: 'recebido', value: 77.25 },
    { key: 'inadimplencia', value: 6 },
  ]
  assert.equal(side(cluster, 'previsto'), 'above')
  assert.equal(side(cluster, 'recebido'), 'below')
  assert.equal(clusterLabelSidesAreInverted(cluster), false)
})

test('mar: ~95% vs 100% — previsto acima, recebido abaixo', () => {
  const cluster = [
    { key: 'previsto', value: 100 },
    { key: 'recebido', value: 95.06 },
  ]
  assert.equal(side(cluster, 'previsto'), 'above')
  assert.equal(side(cluster, 'recebido'), 'below')
})

test('jul sem meta: recebido 50,57% acima e previsto 35,12% abaixo', () => {
  const cluster = [
    { key: 'recebido', value: 50.57 },
    { key: 'previsto', value: 35.12 },
  ]
  assert.equal(side(cluster, 'recebido'), 'above')
  assert.equal(side(cluster, 'previsto'), 'below')
  assert.equal(clusterLabelSidesAreInverted(cluster), false)
})

test('área: par previsto × recebido — maior acima, menor abaixo (sem meta no cluster)', () => {
  const cluster = [
    { key: 'previsto', value: 176_246.63 },
    { key: 'recebido', value: 151_429.16 },
  ]
  assert.equal(side(cluster, 'previsto'), 'above')
  assert.equal(side(cluster, 'recebido'), 'below')
  assert.equal(clusterLabelSidesAreInverted(cluster), false)
})

test('jul com meta: 100% acima; recebido e previsto abaixo, recebido mais perto do ponto', () => {
  const cluster = [
    { key: 'meta', value: 100 },
    { key: 'recebido', value: 50.57 },
    { key: 'previsto', value: 35.12 },
    { key: 'inadimplencia', value: 6 },
  ]
  assert.equal(side(cluster, 'meta'), 'above')
  assert.equal(side(cluster, 'recebido'), 'below')
  assert.equal(side(cluster, 'previsto'), 'below')
  const recebido = resolveClusteredLabelPlacement(cluster, 'recebido', 12)
  const previsto = resolveClusteredLabelPlacement(cluster, 'previsto', 18)
  assert.ok((recebido?.offset ?? 0) < (previsto?.offset ?? 0))
  assert.equal(clusterLabelSidesAreInverted(cluster), false)
})
