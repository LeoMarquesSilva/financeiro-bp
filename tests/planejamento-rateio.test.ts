import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dividirIgual, normalizarPct, somaPct, validarRateio, valorPorArea } from '../src/features/planejamento/utils/rateioTitulo.ts'

test('rateio do título: dividir igualmente soma exatamente 100 com 2 casas', () => {
  const r = dividirIgual(['civel', 'insolvencia', 'trabalhista'])
  assert.deepEqual(r.map((l) => l.pct), [33.33, 33.33, 33.34])
  assert.equal(somaPct(r), 100)
  assert.deepEqual(validarRateio(r), { ok: true })
  assert.deepEqual(dividirIgual([]), [])
})

test('rateio do título: valida soma, área repetida, área vazia e % fora do intervalo', () => {
  assert.deepEqual(validarRateio([]), { ok: true }, 'lista vazia apaga o rateio')
  const falta = validarRateio([{ area_key: 'civel', pct: 60 }, { area_key: 'insolvencia', pct: 30 }])
  assert.equal(falta.ok, false)
  assert.match(!falta.ok ? falta.motivo : '', /Falta distribuir 10%/)
  const passou = validarRateio([{ area_key: 'civel', pct: 60 }, { area_key: 'insolvencia', pct: 50 }])
  assert.match(!passou.ok ? passou.motivo : '', /Passou 10%/)
  assert.equal(validarRateio([{ area_key: 'civel', pct: 50 }, { area_key: 'civel', pct: 50 }]).ok, false)
  assert.equal(validarRateio([{ area_key: '', pct: 100 }]).ok, false)
  assert.equal(validarRateio([{ area_key: 'civel', pct: 0 }, { area_key: 'insolvencia', pct: 100 }]).ok, false)
  // 0,1 + 0,2 em ponto flutuante não pode reprovar a soma.
  assert.equal(validarRateio([{ area_key: 'civel', pct: 0.1 }, { area_key: 'insolvencia', pct: 0.2 }, { area_key: 'contratos', pct: 99.7 }]).ok, true)
})

test('rateio do título: valor por área e normalização do %', () => {
  assert.deepEqual(valorPorArea(224_790.42, [{ area_key: 'civel', pct: 60 }, { area_key: 'insolvencia', pct: 40 }]).map((v) => Math.round(v * 100) / 100), [134_874.25, 89_916.17])
  assert.equal(normalizarPct(33.3333), 33.33)
  assert.equal(normalizarPct(120), 100)
  assert.equal(normalizarPct(-5), 0)
  assert.equal(normalizarPct(Number.NaN), 0)
})
