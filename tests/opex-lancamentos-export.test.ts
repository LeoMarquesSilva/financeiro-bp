import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOpexExportWorkbook,
  filtrarOrcamentoExport,
  linhaLancamentoExcel,
  mesCompetenciaLabel,
  nomeArquivoOpexExport,
  ordenarLancamentos,
} from '../src/features/opex/utils/opexLancamentosExport.ts'
import { mesNoPainelOpex } from '../src/features/opex/utils/opexPeriodo.ts'
import type { OpexLancamentoRow, OpexOrcamentoLinha } from '../src/features/opex/types/opex.types.ts'
import { OPEX_PLANO_FILTRO_VAZIO, planoFiltroChave } from '../src/features/opex/utils/opexPlanoFiltro.ts'

function lancamento(partial: Partial<OpexLancamentoRow> & Pick<OpexLancamentoRow, 'ci_item'>): OpexLancamentoRow {
  return {
    mes_vencimento: 1,
    mes_pagamento: 1,
    grupo_conta: 'DESPESAS ADMINISTRATIVAS',
    plano_contas: 'Aluguel',
    conta_numero: '3.1',
    fixo: true,
    ci_titulo: 10,
    nro_titulo: '100',
    descricao: 'Aluguel sala',
    fornecedor: 'Imobiliária',
    departamento: 'Cível',
    situacao_titulo: 'Pago',
    data_vencimento: '2026-01-10',
    data_pagamento: '2026-01-12',
    valor_previsto_vios: 100,
    valor_realizado: 80,
    ...partial,
  }
}

function orcamento(partial: Partial<OpexOrcamentoLinha> & Pick<OpexOrcamentoLinha, 'id' | 'mes'>): OpexOrcamentoLinha {
  return {
    ano: 2026,
    grupo_conta: 'DESPESAS ADMINISTRATIVAS',
    plano_contas: 'Aluguel',
    conta_numero: '3.1',
    titulo_ref: '100',
    descricao: 'Sala · Imobiliária',
    departamento: 'Cível',
    valor: 90,
    fixo: true,
    ...partial,
  }
}

test('recorte sem filtro de mês segue o ano até o mês atual', () => {
  assert.equal(mesNoPainelOpex(9, [], 9), true)
  assert.equal(mesNoPainelOpex(10, [], 9), false)
  assert.equal(mesNoPainelOpex(10, [10], 9), true)
  assert.equal(mesNoPainelOpex(3, [], 0), true)
})

test('lançamento separa plano e subplano e o mês de competência', () => {
  const row = linhaLancamentoExcel(
    lancamento({ grupo_conta: 'DESPESAS DE T.I.', plano_contas: 'Software', mes_vencimento: 9, mes_pagamento: null }),
    2026,
  )
  assert.equal(row.Plano, 'DESPESAS DE T.I.')
  assert.equal(row.Subplano, 'Software')
  assert.notEqual(row.Plano, row.Subplano)
  assert.equal(row['Mês vencimento'], '09 - Setembro')
  assert.equal(row['Mês pagamento'], '')
  assert.equal(mesCompetenciaLabel(1), '01 - Janeiro')
})

test('orçamento do período respeita mês e subplano oculto', () => {
  const linhas = [
    orcamento({ id: 'a', mes: 9, valor: 10 }),
    orcamento({ id: 'b', mes: 10, valor: 20 }),
    orcamento({ id: 'c', mes: 9, plano_contas: 'Limpeza', valor: 5 }),
  ]
  const filtro = {
    ...OPEX_PLANO_FILTRO_VAZIO,
    planosExcluidos: [planoFiltroChave('DESPESAS ADMINISTRATIVAS', 'Limpeza')],
  }
  const visiveis = filtrarOrcamentoExport(linhas, [], 9, filtro)
  assert.deepEqual(
    visiveis.map((linha) => linha.id),
    ['a'],
  )
})

test('planilha traz uma linha por lançamento, ordenada por plano e subplano', async () => {
  const lancamentos = ordenarLancamentos([
    lancamento({ ci_item: 2, grupo_conta: 'B', plano_contas: 'Z', valor_realizado: 30, valor_previsto_vios: 40 }),
    lancamento({ ci_item: 1, grupo_conta: 'A', plano_contas: 'M', valor_realizado: 70, valor_previsto_vios: 60 }),
  ])
  const wb = await buildOpexExportWorkbook({
    ano: 2026,
    periodoLabel: 'jan–set / 2026',
    planoFiltroAtivo: false,
    lancamentos,
    orcamento: [orcamento({ id: 'a', mes: 1, valor: 15.5 })],
  })

  assert.deepEqual(wb.worksheets.map((ws) => ws.name), ['Lançamentos', 'Orçamento', 'Conferência'])
  const aba = wb.getWorksheet('Lançamentos')
  assert.ok(aba)
  assert.equal(aba.getRow(1).getCell(1).value, 'Plano')
  assert.equal(aba.getRow(1).getCell(2).value, 'Subplano')
  assert.equal(aba.getRow(2).getCell(1).value, 'A')
  assert.equal(aba.getRow(2).getCell(2).value, 'M')
  assert.equal(aba.getRow(3).getCell(1).value, 'B')
  const total = aba.getRow(4).getCell(18).value
  assert.ok(total && typeof total === 'object' && 'formula' in total)
  assert.equal((total as { formula: string }).formula, 'SUBTOTAL(109,R2:R3)')
  assert.match(nomeArquivoOpexExport('jan–set / 2026'), /^opex-lancamentos-jan-set-2026\.xlsx$/)

  const conferencia = wb.getWorksheet('Conferência')
  assert.equal(conferencia?.getRow(5).getCell(2).value, 100)
  assert.equal(conferencia?.getRow(8).getCell(2).value, 15.5)
})
