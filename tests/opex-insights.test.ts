import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOpexInsights,
  insightUsaCompromissoVios,
  variacaoGrupo,
} from '../src/features/opex/utils/opexInsights.ts'
import type { OpexGrupoRow } from '../src/features/opex/types/opex.types.ts'

test('ano inteiro e filtro com mês futuro usam compromisso VIOS', () => {
  assert.equal(insightUsaCompromissoVios([], 9), true)
  assert.equal(insightUsaCompromissoVios([10, 11], 9), true)
  assert.equal(insightUsaCompromissoVios([9, 10], 9), true)
})

test('meses já passados (e o mês atual) comparam como está hoje', () => {
  assert.equal(insightUsaCompromissoVios([1, 2, 3, 4, 5, 6, 7, 8], 9), false)
  assert.equal(insightUsaCompromissoVios([6], 9), false)
  assert.equal(insightUsaCompromissoVios([9], 9), false)
})

test('insight do ano soma realizado + VIOS a vencer contra o orçado', () => {
  const grupos: OpexGrupoRow[] = [
    {
      grupo_conta: 'REMUNERAÇÃO FIXA',
      fixo: true,
      realizado_ytd: 3_626_371.89,
      previsto_ano: 5_640_000,
      previsto_vios: 4_586_371.89,
      previsto_vios_futuro: 960_000,
      previsto_restante: 1_880_000,
      projetado_ano: 0,
    },
  ]
  const insights = buildOpexInsights(grupos, [], true)
  assert.ok(Math.abs((insights.maioresEconomias[0]?.compromisso ?? 0) - 4_586_371.89) < 0.01)
  assert.ok(insights.maioresEconomias[0]!.variacao > -2_013_628.12)
  assert.ok(insights.maioresEconomias[0]!.variacao < -1_000_000)
})

test('filtro de meses passados não inventa economia contra o orçamento do ano', () => {
  const grupos: OpexGrupoRow[] = [
    {
      grupo_conta: 'REMUNERAÇÃO FIXA',
      fixo: true,
      realizado_ytd: 3_626_371.89,
      previsto_ano: 3_760_000,
      previsto_vios: 3_626_371.89,
      previsto_vios_futuro: 0,
      previsto_restante: 0,
      projetado_ano: 0,
    },
  ]
  const insights = buildOpexInsights(grupos, [], false)
  assert.equal(insights.maioresEconomias[0]?.compromisso, 3_626_371.89)
  assert.ok(Math.abs(insights.maioresEconomias[0]!.variacao + 133_628.11) < 0.01)
})

test('tabela no ano usa a mesma variação dos cards (pago + VIOS)', () => {
  const grupo: OpexGrupoRow = {
    grupo_conta: 'REMUNERAÇÃO FIXA',
    fixo: true,
    realizado_ytd: 3_626_371.89,
    previsto_ano: 5_640_000,
    previsto_vios: 4_586_371.89,
    previsto_vios_futuro: 960_000,
    previsto_restante: 1_880_000,
    projetado_ano: 0,
  }
  assert.ok(Math.abs(variacaoGrupo(grupo, true) + 1_053_628.11) < 0.01)
  assert.ok(Math.abs(variacaoGrupo(grupo, false) + 2_013_628.11) < 0.01)
})
