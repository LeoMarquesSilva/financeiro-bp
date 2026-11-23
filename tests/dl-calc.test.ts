import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularDemonstrativo, dlGestorPorArea, dlGestorTabela, totalDemonstrativo } from '../src/features/dl/utils/dlCalc.ts'
import type { DlGestor, DlGestorAreaMes, DlGestorMes, DlMesRow } from '../src/features/dl/types/dl.types.ts'

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
  liberacao_recursos: 0,
  aliquota: 16.0587,
  aliquota_herdada: false,
  origem_profissionais: 'cadastro_rh',
  origem_controladoria: 'legal_ops',
  fechado: false,
  ...over,
})

const gm = (gestor_id: string, mes: number, dl: number, over: Partial<DlGestorMes> = {}): DlGestorMes => ({
  gestor_id,
  mes,
  clientes: 10,
  liquido_clientes: 100,
  resultado_clientes: 50,
  dl,
  dl_calculado: dl,
  ajuste: 0,
  fechado: false,
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
      gm('g1', 6, 2_000),
      gm('g2', 6, 0, { resultado_clientes: -10 }),
      gm('removido', 6, 999),
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

test('Liberação de Recursos soma à parte e entra no total', () => {
  const rows = [linha('rec_credito', 9, { liberacao_recursos: 18_000 }), linha('civel', 9)]
  const [m] = calcularDemonstrativo(rows, ['rec_credito', 'civel'], [9], [])
  assert.equal(m.liberacao_recursos, 18_000)
  assert.equal(m.receita_bruta, 200_000)
  assert.equal(totalDemonstrativo([m]).liberacao_recursos, 18_000)
})

test('mês fechado e alíquota herdada sobem para o demonstrativo', () => {
  const rows = [linha('civel', 8, { fechado: true }), linha('civel', 9, { aliquota_herdada: true })]
  const [ago, set] = calcularDemonstrativo(rows, ['civel'], [8, 9], [])
  assert.equal(ago.fechado, true)
  assert.equal(ago.aliquota_herdada, false)
  assert.equal(set.fechado, false)
  assert.equal(set.aliquota_herdada, true)
})

test('tabela de gestores: valor a pagar com ajuste e mês fora da vigência', () => {
  const g = { ...gestor('g1', 'rec_credito'), mes_inicio: 8 }
  const [linha1] = dlGestorTabela(
    [g],
    [gm('g1', 8, 0, { fechado: true }), gm('g1', 9, 1_094, { dl_calculado: 1_205, ajuste: -111 })],
    [7, 8, 9],
  )
  assert.equal(linha1!.meses[0], null)
  assert.equal(linha1!.meses[1]!.fechado, true)
  assert.equal(linha1!.meses[2]!.ajuste, -111)
  assert.equal(linha1!.total, 1_094)
})

test('gestor que saiu ou mudou de área só aparece nos meses de vigência', () => {
  const saiu = { ...gestor('g1', 'insolvencia'), mes_fim: 7 }
  const mudou = { ...gestor('g2', 'trabalhista'), mes_inicio: 6, mes_fim: 7 }
  const ativo = gestor('g3', 'civel')
  const so_out = dlGestorTabela([saiu, mudou, ativo], [gm('g3', 10, 500)], [10])
  assert.deepEqual(so_out.map((l) => l.gestor.id), ['g3'])
  const jun_out = dlGestorTabela([saiu, mudou, ativo], [], [6, 7, 8, 9, 10])
  assert.deepEqual(jun_out.map((l) => l.gestor.id), ['g1', 'g2', 'g3'])
})
