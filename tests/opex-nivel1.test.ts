import test from 'node:test'
import assert from 'node:assert/strict'
import { agruparGruposPorNivel1, NIVEL1_FORA_DO_PLANO } from '../src/features/opex/utils/opexNivel1.ts'
import type { OpexGrupoDePara, OpexGrupoRow, OpexPlanoContaNivel } from '../src/features/opex/types/opex.types.ts'

const contas: OpexPlanoContaNivel[] = [
  { codigo: '5.0.00.000', nivel: 1, n1: 5, nome: 'DESPESAS GERAIS' },
  { codigo: '5.12.00.000', nivel: 2, n1: 5, nome: 'DESPESAS DE INFRAESTRUTURA' },
  { codigo: '8.0.00.000', nivel: 1, n1: 8, nome: 'DESPESAS COM PESSOAS' },
  { codigo: '8.1.00.000', nivel: 2, n1: 8, nome: 'REMUNERAÇÃO FIXA' },
  { codigo: '8.4.00.000', nivel: 2, n1: 8, nome: 'BENEFÍCIOS' },
]

function grupo(nome: string, realizado: number, extra: Partial<OpexGrupoRow> = {}): OpexGrupoRow {
  return {
    grupo_conta: nome,
    fixo: false,
    realizado_ytd: realizado,
    previsto_ano: realizado * 2,
    previsto_vios: 0,
    previsto_vios_futuro: 0,
    previsto_restante: 0,
    projetado_ano: 0,
    ...extra,
  }
}

test('agrupa grupos pelo nível 1 e soma os totais', () => {
  const blocos = agruparGruposPorNivel1(
    [grupo('BENEFÍCIOS', 10), grupo('DESPESAS DE INFRAESTRUTURA', 5), grupo('REMUNERAÇÃO FIXA', 100)],
    contas,
  )

  assert.deepEqual(
    blocos.map((b) => [b.nivel1.codigo, b.nivel1.nome, b.grupos.map((g) => g.grupo_conta)]),
    [
      [5, 'DESPESAS GERAIS', ['DESPESAS DE INFRAESTRUTURA']],
      [8, 'DESPESAS COM PESSOAS', ['BENEFÍCIOS', 'REMUNERAÇÃO FIXA']],
    ],
  )
  assert.equal(blocos[1].total.realizado_ytd, 110)
  assert.equal(blocos[1].total.previsto_ano, 220)
})

test('casa grafia com encoding quebrado do VIOS (REMUNERAÇãO)', () => {
  const [bloco] = agruparGruposPorNivel1([grupo('REMUNERAÇãO FIXA', 1)], contas)
  assert.equal(bloco.nivel1.nome, 'DESPESAS COM PESSOAS')
})

test('grupo do plano antigo usa o destino do De × Para', () => {
  const dePara: OpexGrupoDePara[] = [
    { id: '1', anoOrigem: 2025, nomeOrigem: 'Despesas com pessoal', anoDestino: 2026, nomeDestino: 'REMUNERAÇãO FIXA' },
  ]
  const [bloco] = agruparGruposPorNivel1([grupo('DESPESAS COM PESSOAL', 1, { aliases: ['Despesas com pessoal'] })], contas, dePara)
  assert.equal(bloco.nivel1.codigo, 8)
})

test('grupo sem correspondência vai para o fim, fora do plano', () => {
  const blocos = agruparGruposPorNivel1([grupo('JURÍDICAS', 50), grupo('BENEFÍCIOS', 1)], contas)
  assert.deepEqual(blocos.map((b) => b.nivel1), [{ codigo: 8, nome: 'DESPESAS COM PESSOAS' }, NIVEL1_FORA_DO_PLANO])
})
