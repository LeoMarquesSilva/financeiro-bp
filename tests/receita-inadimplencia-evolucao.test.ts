import test from 'node:test'
import assert from 'node:assert/strict'
import type {
  ReceitaInadimplenciaDashboard,
  ReceitaInadimplenciaEvolucaoMes,
  ReceitaInadimplenciaGrupoMes,
} from '../src/features/receita/types/receitaInadimplencia.types.ts'
import {
  aplicarSelecaoGrupos,
  valorExibicaoEvolucao,
} from '../src/features/receita/utils/receitaInadimplenciaCalc.ts'

const janCongelado: ReceitaInadimplenciaEvolucaoMes = {
  mes: 1,
  mes_label: 'JAN',
  valor: 394_154.63,
  valor_calculado: 394_561.73,
  valor_congelado: 405_640.63,
  previsto: 1_158_973.23,
  pct: 34.01,
  pct_congelado: 35,
  congelado: true,
}

function dashboardCom(evolucao: ReceitaInadimplenciaEvolucaoMes[]): ReceitaInadimplenciaDashboard {
  return {
    ano: 2026,
    mes_inicio: 1,
    mes_fim: 1,
    mes_max_disponivel: 9,
    periodo_label: 'JAN',
    valor_total_periodo: 0,
    pct_periodo: 0,
    top5: [],
    top5_total: 0,
    top5_pct: 0,
    evolucao,
    destaque_reducao_pct: null,
  }
}

test('evolução de mês congelado usa o snapshot oficial, não o recálculo ao vivo', () => {
  const exibicao = valorExibicaoEvolucao({
    ...janCongelado,
    ajustado: true,
    valor: 394_154.63,
    pct: 34.01,
  })
  assert.equal(exibicao.valor, 405_640.63)
  assert.equal(exibicao.pct, 35)
})

test('seleção salva de grupos não substitui a célula congelada da evolução', () => {
  const grupos: ReceitaInadimplenciaGrupoMes[] = [
    {
      grupo_cliente: 'Grupo Metalcasty',
      faturado: 52_924.99,
      recebido: 15_251.16,
      inadimplencia: 37_673.83,
      qtd_clientes: 1,
      qtd_clientes_inad: 1,
    },
    {
      grupo_cliente: 'Grupo Loren Sid',
      faturado: 11_486.2,
      recebido: 11_486.2,
      inadimplencia: 0,
      qtd_clientes: 1,
      qtd_clientes_inad: 0,
    },
  ]
  const aplicado = aplicarSelecaoGrupos(
    dashboardCom([janCongelado]),
    { 1: grupos },
    { 1: new Set(['Grupo Metalcasty', 'Grupo Loren Sid']) },
  )
  const jan = aplicado.evolucao[0]
  assert.equal(jan.ajustado, undefined)
  assert.equal(jan.valor_congelado, 405_640.63)
  const exibicao = valorExibicaoEvolucao(jan)
  assert.equal(exibicao.valor, 405_640.63)
  assert.equal(exibicao.pct, 35)
})

test('mês corrente ainda recalcula a evolução pela seleção de grupos', () => {
  const corrente: ReceitaInadimplenciaEvolucaoMes = {
    mes: 9,
    mes_label: 'SET',
    valor: 10_000,
    valor_calculado: 10_000,
    previsto: 100_000,
    pct: 10,
    congelado: false,
  }
  const grupos: ReceitaInadimplenciaGrupoMes[] = [
    {
      grupo_cliente: 'Grupo A',
      faturado: 8_000,
      recebido: 0,
      inadimplencia: 8_000,
      qtd_clientes: 1,
      qtd_clientes_inad: 1,
    },
    {
      grupo_cliente: 'Grupo B',
      faturado: 2_000,
      recebido: 0,
      inadimplencia: 2_000,
      qtd_clientes: 1,
      qtd_clientes_inad: 1,
    },
  ]
  const aplicado = aplicarSelecaoGrupos(
    dashboardCom([corrente]),
    { 9: grupos },
    { 9: new Set(['Grupo A']) },
  )
  const set = aplicado.evolucao[0]
  assert.equal(set.ajustado, true)
  assert.equal(set.valor, 8_000)
  const exibicao = valorExibicaoEvolucao(set)
  assert.equal(exibicao.valor, 8_000)
})
