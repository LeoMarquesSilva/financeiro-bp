import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularDemonstrativo, dlGestorPorArea, totalDemonstrativo } from '../src/features/dl/utils/dlCalc.ts'
import type { DlGestor, DlGestorAreaMes, DlMesRow } from '../src/features/dl/types/dl.types.ts'

const linha = (area_key: string, mes: number, over: Partial<DlMesRow> = {}): DlMesRow => ({
  area_key,
  mes,
  receita_bruta: 100_000,
  impostos: 10_000,
  desp_operacionais: 30_000,
  desp_controladoria: 5_000,
  desp_indiretas: 15_000,
  profissionais: 5,
  pct_controladoria: 10,
  parametro_herdado: false,
  socios_prolabore: 120_000,
  ...over,
})

const gestor = (id: string, area_key: string): DlGestor => ({
  id,
  ano: 2026,
  area_key,
  nome: 'Gestor',
  pct: 5,
  mes_inicio: 1,
  mes_fim: 12,
})

test('cascata do DL: líquida, margem e resultado', () => {
  const [m] = calcularDemonstrativo([linha('civel', 6)], ['civel'], [6], [])
  assert.equal(m.receita_liquida, 90_000)
  assert.equal(m.margem, 55_000)
  assert.equal(m.resultado, 40_000)
  assert.ok(Math.abs(m.margem_pct - 55_000 / 90_000) < 1e-9)
})

test('DL do gestor vem do banco e é ligado à área pelo gestor', () => {
  const dl = dlGestorPorArea(
    [gestor('g1', 'civel'), gestor('g2', 'trabalhista')],
    [
      { gestor_id: 'g1', mes: 6, clientes: 40, liquido_clientes: 100, resultado_clientes: 50, dl: 2_000 },
      { gestor_id: 'g2', mes: 6, clientes: 30, liquido_clientes: 100, resultado_clientes: -10, dl: 0 },
      { gestor_id: 'removido', mes: 6, clientes: 1, liquido_clientes: 1, resultado_clientes: 1, dl: 999 },
    ],
  )
  assert.deepEqual(dl, [
    { area_key: 'civel', mes: 6, dl: 2_000 },
    { area_key: 'trabalhista', mes: 6, dl: 0 },
  ])
})

test('DL geral soma os gestores das áreas selecionadas no mês', () => {
  const rows = [linha('civel', 6), linha('trabalhista', 6, { receita_bruta: 20_000, impostos: 0 })]
  const dl: DlGestorAreaMes[] = [
    { area_key: 'civel', mes: 6, dl: 2_000 },
    { area_key: 'civel', mes: 7, dl: 500 },
    { area_key: 'trabalhista', mes: 6, dl: 300 },
  ]
  const [geral] = calcularDemonstrativo(rows, ['civel', 'trabalhista'], [6], dl)
  assert.equal(geral.dl_gestor, 2_300)
  assert.equal(geral.resultado, 10_000)
  const [civel] = calcularDemonstrativo(rows, ['civel'], [6], dl)
  assert.equal(civel.dl_gestor, 2_000)
})

test('total do período soma meses e recalcula a margem', () => {
  const dl: DlGestorAreaMes[] = [
    { area_key: 'civel', mes: 1, dl: 2_000 },
    { area_key: 'civel', mes: 2, dl: 2_000 },
  ]
  const meses = calcularDemonstrativo([linha('civel', 1), linha('civel', 2)], ['civel'], [1, 2], dl)
  const t = totalDemonstrativo(meses)
  assert.equal(t.receita_bruta, 200_000)
  assert.equal(t.resultado, 80_000)
  assert.equal(t.dl_gestor, 4_000)
  assert.equal(t.profissionais, 5)
})
