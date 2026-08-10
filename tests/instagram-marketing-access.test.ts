import test from 'node:test'
import assert from 'node:assert/strict'
import { canManageInstagramMarketing } from '../src/features/operacoes-legais/marketing/marketingAccess.ts'

test('permite gestão apenas a admin ativo ou área Marketing ativa', () => {
  assert.equal(canManageInstagramMarketing({ role: 'admin', area: 'Financeiro', isActive: true }), true)
  assert.equal(canManageInstagramMarketing({ role: null, area: 'Marketing', isActive: true }), true)
  assert.equal(canManageInstagramMarketing({ role: 'comite', area: 'Contratos', isActive: true }), false)
  assert.equal(canManageInstagramMarketing({ role: 'admin', area: 'Marketing', isActive: false }), false)
})
