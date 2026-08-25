import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CLUSTER_LABEL_PIXEL_GAP,
  chartLabelBoxHeight,
  clusterLabelBoxesOverlap,
  clusterLabelSidesAreInverted,
  layoutClusterLabelPixels,
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

test('mai sem meta: previsto acima; recebido e inadimplência abaixo, inad mais longe', () => {
  const cluster = [
    { key: 'previsto', value: 67_550.37 },
    { key: 'recebido', value: 48_332.92 },
    { key: 'inadimplencia', value: 20_850.04 },
  ]
  const recebido = resolveClusteredLabelPlacement(cluster, 'recebido', 14, {
    sameSideStep: 34,
    pinBelow: ['inadimplencia'],
  })
  const previsto = resolveClusteredLabelPlacement(cluster, 'previsto', 16, {
    sameSideStep: 34,
    pinBelow: ['inadimplencia'],
  })
  const inad = resolveClusteredLabelPlacement(cluster, 'inadimplencia', 22, {
    sameSideStep: 34,
    pinBelow: ['inadimplencia'],
  })
  assert.equal(previsto?.position, 'above')
  assert.equal(recebido?.position, 'below')
  assert.equal(inad?.position, 'below')
  assert.ok((inad?.offset ?? 0) >= (recebido?.offset ?? 0) + 34)
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

test('pixel: 3 rótulos próximos (mar da área) — ordem Meta/Previsto/Recebido/Inad', () => {
  const cluster = [
    { key: 'previsto', value: 9285.04, boxHeight: chartLabelBoxHeight() },
    { key: 'recebido', value: 2492.81, boxHeight: chartLabelBoxHeight() },
    {
      key: 'inadimplencia',
      value: 1800,
      boxHeight: chartLabelBoxHeight('12,30%'),
    },
  ]
  const layout = layoutClusterLabelPixels(cluster, 80_000)
  assert.equal(layout.size, 3)
  assert.equal(clusterLabelBoxesOverlap(layout.values()), false)
  const prev = layout.get('previsto')
  const rec = layout.get('recebido')
  const inad = layout.get('inadimplencia')
  assert.ok(prev && rec && inad)
  assert.ok(prev.boxTop < rec.boxTop)
  assert.ok(rec.boxTop < inad.boxTop)
})

test('pixel: ignora zero e não deixa caixas encavalar no fundo do eixo', () => {
  const cluster = [
    { key: 'previsto', value: 7200, boxHeight: chartLabelBoxHeight() },
    { key: 'recebido', value: 0, boxHeight: chartLabelBoxHeight() },
    { key: 'inadimplencia', value: 2100, boxHeight: chartLabelBoxHeight('8,00%') },
  ]
  const layout = layoutClusterLabelPixels(cluster, 80_000)
  assert.equal(layout.has('recebido'), false)
  assert.equal(layout.size, 2)
  assert.equal(clusterLabelBoxesOverlap(layout.values()), false)
  for (const box of layout.values()) {
    assert.ok(box.boxTop >= 4)
  }
})

test('pixel: valores distantes no eixo ficam em grupos separados', () => {
  const cluster = [
    { key: 'previsto', value: 78_000, boxHeight: chartLabelBoxHeight() },
    { key: 'recebido', value: 2_400, boxHeight: chartLabelBoxHeight() },
  ]
  const layout = layoutClusterLabelPixels(cluster, 80_000)
  assert.equal(layout.size, 2)
  assert.equal(clusterLabelBoxesOverlap(layout.values()), false)
  assert.ok(layout.get('previsto')!.boxTop < layout.get('recebido')!.boxTop)
})

test('pixel: mesmos cy (jan da área) — recebido acima da inad, sem overlap', () => {
  const cluster = [
    { key: 'recebido', value: 137.39, boxHeight: chartLabelBoxHeight(), pointY: 248 },
    {
      key: 'inadimplencia',
      value: 1_900,
      boxHeight: chartLabelBoxHeight('12,30%'),
      pointY: 247,
    },
  ]
  const layout = layoutClusterLabelPixels(cluster, 60_000, undefined, {
    minY: 4,
    maxY: 252,
  })
  assert.equal(layout.size, 2)
  assert.equal(clusterLabelBoxesOverlap(layout.values()), false)
  const rec = layout.get('recebido')!
  const inad = layout.get('inadimplencia')!
  assert.ok(rec.boxTop < inad.boxTop)
  assert.ok(inad.boxTop >= rec.boxTop + rec.boxHeight + CLUSTER_LABEL_PIXEL_GAP - 0.01)
})

test('pixel: 3 rótulos no fundo (mar) com cy real não se sobrepõem', () => {
  const cluster = [
    { key: 'previsto', value: 9285.04, boxHeight: chartLabelBoxHeight(), pointY: 230 },
    { key: 'recebido', value: 2492.61, boxHeight: chartLabelBoxHeight(), pointY: 246 },
    {
      key: 'inadimplencia',
      value: 1800,
      boxHeight: chartLabelBoxHeight('19,40%'),
      pointY: 248,
    },
  ]
  const layout = layoutClusterLabelPixels(cluster, 60_000, undefined, {
    minY: 4,
    maxY: 252,
  })
  assert.equal(layout.size, 3)
  assert.equal(clusterLabelBoxesOverlap(layout.values()), false)
  assert.ok(layout.get('previsto')!.boxTop < layout.get('recebido')!.boxTop)
  assert.ok(layout.get('recebido')!.boxTop < layout.get('inadimplencia')!.boxTop)
})

test('pixel: recebido maior que previsto — previsto continua acima (ordem das camadas)', () => {
  const cluster = [
    { key: 'previsto', value: 61_797.3, boxHeight: chartLabelBoxHeight(), pointY: 160 },
    { key: 'recebido', value: 66_026.15, boxHeight: chartLabelBoxHeight(), pointY: 152 },
  ]
  const layout = layoutClusterLabelPixels(cluster, 160_000, undefined, {
    minY: 4,
    maxY: 252,
  })
  assert.equal(clusterLabelBoxesOverlap(layout.values()), false)
  assert.ok(layout.get('previsto')!.boxTop < layout.get('recebido')!.boxTop)
})

test('pixel: pontos no fundo usam o espaço em branco acima', () => {
  const cluster = [
    { key: 'previsto', value: 5501, boxHeight: 13, pointY: 240 },
    { key: 'recebido', value: 137, boxHeight: 13, pointY: 248 },
    { key: 'inadimplencia', value: 4293, boxHeight: 25, pointY: 242 },
  ]
  const layout = layoutClusterLabelPixels(cluster, 160_000, undefined, {
    minY: 4,
    maxY: 252,
  })
  assert.equal(clusterLabelBoxesOverlap(layout.values()), false)
  assert.ok(layout.get('previsto')!.boxTop < layout.get('recebido')!.boxTop)
  assert.ok(layout.get('recebido')!.boxTop < layout.get('inadimplencia')!.boxTop)
  assert.ok(
    layout.get('previsto')!.boxTop < 160,
    'previsto deve subir para o espaço vazio, não ficar no fundo',
  )
})
