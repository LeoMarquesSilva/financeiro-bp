import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOpexInsights,
  insightUsaCompromissoVios,
  variacaoGrupo,
  variacaoMesInsight,
} from '../src/features/opex/utils/opexInsights.ts'
import { mergeGruposEncoding, opexGrupoChave } from '../src/features/opex/utils/opexGrupoNome.ts'
import type { OpexGrupoRow, OpexMesRow } from '../src/features/opex/types/opex.types.ts'

function mes(partial: Partial<OpexMesRow> & Pick<OpexMesRow, 'mes'>): OpexMesRow {
  return {
    mesLabel: String(partial.mes),
    previsto: 0,
    previsto_vios: 0,
    realizado: 0,
    projetado_fixas: 0,
    variacao: 0,
    ...partial,
  }
}

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

test('grafias ÇãO e ÇÃO do mesmo grupo viram uma categoria', () => {
  const grupos: OpexGrupoRow[] = [
    {
      grupo_conta: 'REMUNERAÇãO FIXA',
      fixo: true,
      realizado_ytd: 3_626_371.89,
      previsto_ano: 5_640_000,
      previsto_vios: 4_586_371.89,
      previsto_vios_futuro: 960_000,
      previsto_restante: 1_880_000,
      projetado_ano: 0,
    },
    {
      grupo_conta: 'REMUNERAÇÃO FIXA',
      fixo: true,
      realizado_ytd: 30_000,
      previsto_ano: 0,
      previsto_vios: 600_000,
      previsto_vios_futuro: 480_000,
      previsto_restante: 0,
      projetado_ano: 0,
    },
  ]
  assert.equal(opexGrupoChave(grupos[0].grupo_conta), opexGrupoChave(grupos[1].grupo_conta))
  const unidos = mergeGruposEncoding(grupos)
  assert.equal(unidos.length, 1)
  assert.equal(unidos[0].grupo_conta, 'REMUNERAÇÃO FIXA')
  const insights = buildOpexInsights(unidos, [], true)
  assert.equal(insights.maioresEstouros.some((g) => g.nome.includes('REMUNERA')), false)
  assert.equal(insights.maioresEconomias.some((g) => g.nome.includes('REMUNERA')), true)
  assert.ok(insights.maioresEconomias[0]!.variacao < 0)
})

test('mês futuro no ano usa VIOS vs orçado, não realizado zero', () => {
  const dezembro = mes({
    mes: 12,
    mesLabel: 'dez',
    previsto: 765_207.97,
    previsto_vios: 755_677.92,
    realizado: 0,
    variacao: -765_207.97,
  })
  const julho = mes({
    mes: 7,
    mesLabel: 'jul',
    previsto: 659_027.48,
    previsto_vios: 813_372.59,
    realizado: 821_106.51,
    variacao: 162_079.03,
  })
  assert.ok(Math.abs(variacaoMesInsight(dezembro, 9, true) + 9_530.05) < 0.01)
  assert.ok(Math.abs(variacaoMesInsight(julho, 9, true) - 162_079.03) < 0.01)

  const noAno = buildOpexInsights([], [julho, dezembro], true, 9, [])
  assert.equal(noAno.mesMaisPressionado?.mes, 7)
  assert.equal(noAno.mesMaisFolgado, null)

  const soFuturo = buildOpexInsights([], [julho, dezembro], true, 9, [12])
  assert.equal(soFuturo.mesMaisFolgado?.mes, 12)
  assert.ok(Math.abs((soFuturo.mesMaisFolgado?.variacao ?? 0) + 9_530.05) < 0.01)
})

test('filtro de mês passado não usa dezembro como folga', () => {
  const junho = mes({
    mes: 6,
    mesLabel: 'jun',
    previsto: 664_987.48,
    previsto_vios: 809_290.79,
    realizado: 799_093.67,
    variacao: 134_106.19,
  })
  const dezembro = mes({
    mes: 12,
    mesLabel: 'dez',
    previsto: 765_207.97,
    previsto_vios: 755_677.92,
    realizado: 0,
    variacao: -765_207.97,
  })
  const insights = buildOpexInsights([], [junho, dezembro], false, 9, [6])
  assert.equal(insights.mesMaisFolgado, null)
  assert.equal(insights.mesMaisPressionado?.mes, 6)
})
