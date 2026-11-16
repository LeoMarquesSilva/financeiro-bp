import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumoInadimplencia } from '../src/features/planejamento/utils/inadimplenciaResumo.ts'

const linha = (mes: number, area: string, inad: number, previsto: number) => ({
  mes,
  area_key: area,
  inadimplencia: inad,
  previsto_mes: previsto,
  congelado: true,
})

test('inadimplência: média no fechamento ponderada pelo previsto, média simples e em aberto hoje', () => {
  const mensal = [
    linha(1, 'civel', 100, 1000),
    linha(1, 'insolvencia', 200, 1000), // jan: 300 / 1000 = 30%
    linha(2, 'civel', 100, 3000), // fev: 100 / 3000 ≈ 3,33%
    linha(3, 'civel', 999, 1000), // mês ainda aberto: fora
  ]
  const periodo = [
    { area_key: 'escritorio', inadimplencia: 200, previsto: 4000, mes_fim: 2 },
    { area_key: 'civel', inadimplencia: 150, previsto: 4000, mes_fim: 2 },
  ]
  const r = resumoInadimplencia(mensal, periodo, 2)
  assert.deepEqual(r.meses, [1, 2])
  assert.equal(r.inadimplenciaFechamento, 400)
  assert.equal(r.previsto, 4000)
  assert.equal(r.mediaFechamentoPct, 10)
  assert.ok(Math.abs((r.mediaSimplesPct ?? 0) - (30 + 100 / 30) / 2) < 1e-9)
  assert.equal(r.emAbertoHojePct, 5)
  assert.equal(r.emAbertoHoje, 200)
})

test('inadimplência: sem dados devolve nulos', () => {
  const r = resumoInadimplencia(undefined, undefined, 10)
  assert.equal(r.mediaFechamentoPct, null)
  assert.equal(r.mediaSimplesPct, null)
  assert.equal(r.emAbertoHojePct, null)
  assert.deepEqual(r.meses, [])
})
