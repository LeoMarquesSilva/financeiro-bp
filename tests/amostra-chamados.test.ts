import test from 'node:test'
import assert from 'node:assert/strict'
import { JUSTIFICATIVA_ONBOARDING } from '../src/features/eficiencia/utils/onboardingExclusoes.ts'
import {
  computarAmostraExcludentes,
  parseCiFromChamadoTitle,
  selecionarAmostraExcludentes,
  type FatalExcludenteRow,
} from '../src/features/eficiencia/utils/amostraChamados.ts'

function row(partial: Partial<FatalExcludenteRow> & Pick<FatalExcludenteRow, 'ci'>): FatalExcludenteRow {
  return {
    area: 'Cível',
    grupoCliente: 'Grupo',
    tarefa: 'Protocolar',
    tarefaPai: 'Prazo',
    nroCnj: '0000000-00.2026.8.26.0100',
    responsavel: 'Fulano',
    dataParaConclusao: '2026-08-01',
    conclusaoCompleta: '2026-08-02T10:00:00',
    justificativa: 'DILAÇÃO DE PRAZO',
    atrasoDias: 1,
    ...partial,
  }
}

function cis(n: number, start = 1): FatalExcludenteRow[] {
  return Array.from({ length: n }, (_, i) => row({ ci: String(start + i) }))
}

test('parseia CI do título do chamado', () => {
  assert.equal(
    parseCiFromChamadoTitle(
      '[EVIDÊNCIA SLA FATAL] Protocolo 000 – CI 11995 – Extrutech',
    ),
    '11995',
  )
  assert.equal(parseCiFromChamadoTitle('sem ci'), null)
})

test('primeira amostra sorteia ~30% do estrato', () => {
  const detalhes = selecionarAmostraExcludentes(cis(10))
  const amostra = detalhes.filter((d) => d.naAmostra).map((d) => d.ci)
  assert.deepEqual(amostra, ['1', '2', '3'])
})

test('chamados já abertos não saem e o restante não é resorteado', () => {
  const rows = cis(10)
  const { detalhes } = computarAmostraExcludentes(rows, [], new Set(['1', '2', '3']))
  const amostra = detalhes.filter((d) => d.naAmostra).map((d) => d.ci)
  assert.deepEqual(amostra, ['1', '2', '3'])
  assert.equal(detalhes.length, 10)
})

test('itens novos recebem 30% sem mexer na amostra travada', () => {
  const atuais = cis(10)
  const persistidos = atuais.map((r, i) => ({
    ci: r.ci,
    naAmostra: i < 3,
    snapshot: r,
  }))
  const comNovos = [...atuais, ...cis(10, 11)]
  const { detalhes } = computarAmostraExcludentes(comNovos, persistidos, new Set())
  const amostra = detalhes.filter((d) => d.naAmostra).map((d) => d.ci)
  assert.deepEqual(amostra, ['1', '2', '3', '11', '12', '13'])
})

test('onboarding com chamado aberto permanece na amostra', () => {
  const rows = [
    row({ ci: '9', justificativa: JUSTIFICATIVA_ONBOARDING }),
    row({ ci: '10' }),
  ]
  const { detalhes } = computarAmostraExcludentes(rows, [], new Set(['9']))
  const item = detalhes.find((d) => d.ci === '9')
  assert.equal(item?.naAmostra, true)
  assert.equal(detalhes.filter((d) => d.ci === '10' && d.naAmostra).length, 0)
})
