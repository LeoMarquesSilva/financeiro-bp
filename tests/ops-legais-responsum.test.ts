import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { responsumScore, responsumTicketPresentation, type ResponsumTicket } from '../supabase/functions/_shared/opsLegaisResponsum.ts'
import { defaultResponsumAvaliacaoFilters, filterResponsumAvaliacoes, filterResponsumPendentes, flattenResponsumPendentes, responsumElapsedLabel, responsumElapsedMinutes } from '../src/features/eficiencia/utils/opsLegaisResponsumPresentation.ts'
import type { OpsLegaisResponsumAvaliacao } from '../src/features/eficiencia/types/eficiencia.types.ts'

const ticket = (extra: Partial<ResponsumTicket> = {}): ResponsumTicket => ({
  id: 'ticket', title: 'Acesso ao BI', status: 'in_progress', service_score: null,
  created_by: 'requester', created_by_name: 'Ana', assigned_to: 'owner', assigned_to_name: 'Bruno',
  created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-02T12:00:00Z',
  started_at: null, reopened_at: null, assigned_at: null, resolved_at: null,
  category: 'access', subcategory: 'account', priority: 'high', comment: null,
  feedback_submitted_at: null, evidencia_enviada: null, ...extra,
  request_fulfilled: extra.request_fulfilled ?? null, not_fulfilled_reason: extra.not_fulfilled_reason ?? null,
})
const catalogs = [
  [{ id: 'category', key: 'access', label: 'Acessos', tag_id: 'tag' }],
  [{ category_id: 'category', key: 'account', label: 'Conta' }, { category_id: 'other-category', key: 'account', label: 'Não usar' }],
  [{ id: 'tag', label: 'Tecnologia' }],
] as const
const present = (value = ticket(), author: string | null = 'requester', date = '2026-10-03T12:00:00Z', system = false) => responsumTicketPresentation(value, { id: 'msg', ticket_id: 'ticket', user_id: author, created_at: date, is_system: system }, [...catalogs[0]], [...catalogs[1]], [...catalogs[2]])

test('usa IDs, não o papel genérico user, para identificar quem precisa responder', () => {
  assert.equal(present().waiting_for, 'equipe')
  assert.equal(present(ticket(), 'owner').waiting_for, 'solicitante')
  assert.equal(present(ticket(), 'third-party').waiting_for, 'indefinido')
  assert.equal(present(ticket({ assigned_to: 'requester' })).waiting_for, 'indefinido')
  assert.equal(present(ticket(), null).waiting_for, 'indefinido')
  assert.equal(present().waiting_since, '2026-10-03T12:00:00Z')
})

test('reabertura e mensagens do sistema não cobram resposta com base em um ciclo antigo', () => {
  const reopened = ticket({ reopened_at: '2026-10-04T12:00:00Z' })
  assert.equal(present(reopened, 'owner').waiting_for, 'equipe')
  assert.equal(present(reopened, 'owner').waiting_since, reopened.reopened_at)
  assert.equal(present(ticket(), 'owner', '2026-10-03T12:00:00Z', true).waiting_for, 'equipe')
})

test('evidência SLA diferencia envio pelo Jurídico de análise pela equipe', () => {
  assert.equal(present(ticket({ title: '[EVIDÊNCIA SLA FATAL] CI 12', evidencia_enviada: false })).waiting_for, 'solicitante')
  assert.equal(present(ticket({ title: '[EVIDÊNCIA SLA FATAL] CI 12', evidencia_enviada: true })).waiting_for, 'equipe')
})

test('resolve categoria, subcategoria e frente sem confundir chaves iguais em categorias distintas', () => {
  const item = present()
  assert.equal(item.category, 'Acessos')
  assert.equal(item.subcategory, 'Conta')
  assert.equal(item.frente, 'Tecnologia')
  assert.equal(item.last_activity_at, '2026-10-03T12:00:00Z')
  assert.equal(present(ticket({ updated_at: '2026-10-05T12:00:00Z' })).last_activity_at, '2026-10-03T12:00:00Z')
  assert.equal(present(ticket({ category: 'new_category', subcategory: null })).category, 'new category')
})

test('mantém nota zero como avaliação e rejeita notas ausentes ou inválidas', () => {
  assert.equal(responsumScore(0), 0)
  assert.equal(responsumScore('8'), 8)
  for (const value of [null, '', '  ', 'NaN', -1, 11]) assert.equal(responsumScore(value), null)
})

test('lista normal e SLA preservam todos os chamados, inclusive sem responsável, e deduplicam IDs', () => {
  const item = present()
  const groups = [
    { nome: 'Bruno', qtd_aberto: 1, qtd_andamento: 0, is_sla_fatal: false, tickets: [item] },
    { nome: 'SLA', qtd_aberto: 1, qtd_andamento: 0, is_sla_fatal: true, tickets: [], pessoas_sla: [{ nome: 'Ana', qtd: 2, tickets: [item, { ...item, id: 'sla', assigned_to_name: undefined }] }] },
    { nome: 'Sem responsável', qtd_aberto: 1, qtd_andamento: 0, is_sla_fatal: false, tickets: [{ ...item, id: 'unassigned', assigned_to_name: null }] },
  ]
  const flat = flattenResponsumPendentes(groups)
  assert.deepEqual(flat.map(t => t.id), ['ticket', 'sla', 'unassigned'])
  assert.equal(flat[1].assigned_to_name, 'Ana')
  assert.equal(flat[2].assigned_to_name, 'Sem responsável')
})

test('filtros se combinam e a ordem usa última movimentação, não só abertura', () => {
  const rows = [present(), { ...present(), id: 'older', title: 'Certificado', last_activity_at: '2026-10-01T12:00:00Z', waiting_for: 'solicitante' as const }]
  const filters = { waiting: 'todos', frente: '', owner: '', query: '' }
  assert.deepEqual(filterResponsumPendentes(rows, filters).map(t => t.id), ['older', 'ticket'])
  assert.equal(filterResponsumPendentes(rows, { ...filters, waiting: 'equipe', frente: 'Tecnologia', owner: 'Bruno', query: 'acessos' }).length, 1)
  assert.equal(filterResponsumPendentes(rows, { ...filters, waiting: 'solicitante', query: 'bi' }).length, 0)
})

test('tempos tratam datas ausentes, futuras e intervalos em minutos, horas e dias', () => {
  const now = Date.parse('2026-10-05T12:00:00Z')
  assert.equal(responsumElapsedMinutes('2026-10-04T10:30:00Z', now), 1530)
  assert.equal(responsumElapsedLabel(1530), '1 dia e 1 h')
  assert.equal(responsumElapsedLabel(61), '1 h 1 min')
  assert.equal(responsumElapsedMinutes('2026-10-06T12:00:00Z', now), 0)
  assert.equal(responsumElapsedMinutes('invalid', now), null)
  assert.equal(responsumElapsedLabel(null), 'Tempo não informado')
})

const evaluation = (extra: Partial<OpsLegaisResponsumAvaliacao> = {}): OpsLegaisResponsumAvaliacao => ({
  id: 'evaluation', title: 'Orientação contratual', status: 'resolved', created_at: '2026-01-01T12:00:00Z',
  feedback_at: '2026-10-01T12:00:00Z', score: 8, request_fulfilled: true, comment: 'Comentário reservado',
  assigned_to_name: 'Responsável reservado', created_by_name: 'Avaliador reservado',
  not_fulfilled_reason: 'Motivo reservado', category: 'Jurídico', subcategory: 'Contratos', frente: 'Consultoria', ...extra,
})

test('período da avaliação inclui dias inteiros de São Paulo e não usa a abertura como substituta', () => {
  const rows = [
    evaluation({ id: 'before', feedback_at: '2026-10-01T02:59:59Z' }),
    evaluation({ id: 'start', feedback_at: '2026-10-01T03:00:00Z' }),
    evaluation({ id: 'end', feedback_at: '2026-10-02T02:59:59Z' }),
    evaluation({ id: 'after', feedback_at: '2026-10-02T03:00:00Z' }),
    evaluation({ id: 'missing', feedback_at: null, created_at: '2026-10-01T12:00:00Z' }),
    evaluation({ id: 'invalid', feedback_at: 'invalid' }),
  ]
  const filters = { ...defaultResponsumAvaliacaoFilters, from: '2026-10-01', to: '2026-10-01' }
  assert.deepEqual(filterResponsumAvaliacoes(rows, filters).map(t => t.id), ['end', 'start'])
  assert.equal(filterResponsumAvaliacoes(rows, { ...filters, from: '2026-10-02' }).length, 0)
  assert.equal(filterResponsumAvaliacoes(rows, { ...filters, from: '' }).length, 3)
  assert.equal(filterResponsumAvaliacoes(rows, { ...filters, to: '' }).length, 3)
  assert.equal(filterResponsumAvaliacoes(rows, defaultResponsumAvaliacaoFilters).length, 6)
})

test('filtros de avaliações combinam nota, atendimento, frente e busca sem pesquisar dados pessoais ocultos', () => {
  const rows = [
    evaluation({ id: 'zero', score: 0, request_fulfilled: false }),
    evaluation({ id: 'regular', score: 6, frente: 'Tecnologia', request_fulfilled: null }),
    evaluation({ id: 'neutral', score: 7 }),
    evaluation({ id: 'high-failed', score: 9, request_fulfilled: false }),
    evaluation({ id: 'high-fulfilled', score: 10, request_fulfilled: true }),
    evaluation({ id: 'no-score', score: null, request_fulfilled: false }),
  ]
  const filters = defaultResponsumAvaliacaoFilters
  assert.equal(filterResponsumAvaliacoes(rows, filters).length, 5)
  assert.deepEqual(filterResponsumAvaliacoes(rows, { ...filters, score: 'ruim', fulfillment: 'nao-atendida', frente: 'Consultoria', query: 'juridico' }).map(t => t.id), ['zero'])
  assert.deepEqual(filterResponsumAvaliacoes(rows, { ...filters, score: 'alta' }).map(t => t.id), ['high-failed'])
  assert.deepEqual(filterResponsumAvaliacoes(rows, { ...filters, score: 'sem-nota' }).map(t => t.id), ['no-score'])
  assert.deepEqual(filterResponsumAvaliacoes(rows, { ...filters, fulfillment: 'nao-informado' }).map(t => t.id), ['regular'])
  assert.equal(filterResponsumAvaliacoes(rows, { ...filters, score: 'regular', fulfillment: 'atendida' }).length, 0)
  for (const query of ['Responsável reservado', 'Avaliador reservado', 'Comentário reservado', 'Motivo reservado']) {
    assert.equal(filterResponsumAvaliacoes(rows, { ...filters, query }).length, 0)
  }
})

test('ordenação mantém avaliações sem data ou sem nota ao final e não altera os dados originais', () => {
  const rows = [
    evaluation({ id: 'missing', feedback_at: null, score: null, request_fulfilled: false }),
    evaluation({ id: 'recent', feedback_at: '2026-10-05T12:00:00Z', score: 8 }),
    evaluation({ id: 'old', feedback_at: '2026-09-01T12:00:00Z', score: 0 }),
  ]
  const original = rows.map(t => t.id)
  assert.deepEqual(filterResponsumAvaliacoes(rows, defaultResponsumAvaliacaoFilters).map(t => t.id), ['recent', 'old', 'missing'])
  assert.deepEqual(filterResponsumAvaliacoes(rows, { ...defaultResponsumAvaliacaoFilters, sort: 'antigas' }).map(t => t.id), ['old', 'recent', 'missing'])
  assert.deepEqual(filterResponsumAvaliacoes(rows, { ...defaultResponsumAvaliacaoFilters, sort: 'menor-nota' }).map(t => t.id), ['old', 'recent', 'missing'])
  assert.deepEqual(rows.map(t => t.id), original)
})

test('contrato mantém notas até 8 e não atendidas com nota alta ou ausente, sem inferir atendimento pela nota', async () => {
  const tables = {
    app_c009c0e4f1_tickets: [
      ticket(),
      ticket({ id: 'older-low', status: 'resolved', created_at: '2025-01-01T12:00:00Z', service_score: 8, feedback_submitted_at: '2025-01-03T12:00:00Z', comment: 'Feedback' }),
      ticket({ id: 'zero', status: 'resolved', service_score: 0 }),
      ticket({ id: 'good', status: 'resolved', service_score: 9, request_fulfilled: false, not_fulfilled_reason: 'O problema continua.' }),
      ticket({ id: 'good-fulfilled', status: 'resolved', service_score: 9, request_fulfilled: true }),
      ticket({ id: 'no-score-unfulfilled', status: 'resolved', service_score: null, request_fulfilled: false }),
      ticket({ id: 'no-owner', assigned_to: null, assigned_to_name: null, status: 'open' }),
      ticket({ id: 'sla', title: '[EVIDÊNCIA SLA FATAL] CI 12', evidencia_enviada: false }),
    ],
    app_c009c0e4f1_chat_messages: [{ id: 'msg', ticket_id: 'ticket', user_id: 'requester', created_at: '2026-10-03T12:00:00Z', is_system: false }],
    app_c009c0e4f1_categories: catalogs[0],
    app_c009c0e4f1_subcategories: catalogs[1],
    app_c009c0e4f1_tags: catalogs[2],
  }
  let handler: (req: Request) => Promise<Response>
  const selects: string[] = []
  const client = { from(table: string) {
    let ids: string[] | null = null
    return {
      select(columns: string) { selects.push(columns); return this },
      order() { return this },
      in(_column: string, values: string[]) { ids = values; return this },
      or() { return this },
      async range(from: number, to: number) {
        const rows = tables[table] ?? []
        return { data: rows.filter(row => !ids || ids.includes(row.ticket_id)).slice(from, to + 1), error: null }
      },
    }
  } }
  const source = fs.readFileSync(new URL('../supabase/functions/ops-legais-responsum/index.ts', import.meta.url), 'utf8').replace(/^import .*$/gm, '')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  vm.runInNewContext(code, { Request, Response, Date, console, responsumScore, responsumTicketPresentation, createClient: () => client, Deno: { env: { get: () => 'fixture' }, serve: callback => { handler = callback } } })
  const response = await handler!(new Request('https://fixture.local', { method: 'POST', body: JSON.stringify({ inicio: '2026-01-01', fim: '2027-01-01' }) }))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.tickets.total, 7)
  assert.equal(result.tickets.em_atendimento, 3)
  assert.equal(result.tickets.resolvidos, 4)
  assert.deepEqual(result.avaliacoes_atencao.map(t => t.id).sort(), ['good', 'no-score-unfulfilled', 'older-low', 'zero'])
  assert.equal(result.avaliacoes_atencao.find(t => t.id === 'good').not_fulfilled_reason, 'O problema continua.')
  assert.equal(result.avaliacoes_atencao.find(t => t.id === 'no-score-unfulfilled').score, null)
  assert.equal(result.avaliacoes_atencao.find(t => t.id === 'zero').request_fulfilled, null)
  const pending = flattenResponsumPendentes(result.pendentes)
  assert.equal(pending.length, 3)
  assert.equal(pending.find(t => t.id === 'ticket')?.waiting_for, 'equipe')
  assert.equal(pending.find(t => t.id === 'sla')?.waiting_for, 'solicitante')
  assert.equal(pending.find(t => t.id === 'no-owner')?.assigned_to_name, 'Sem responsável')
  assert.ok(selects.includes('id,ticket_id,user_id,created_at,is_system'))
  assert.ok(!selects.includes('*'))
})
