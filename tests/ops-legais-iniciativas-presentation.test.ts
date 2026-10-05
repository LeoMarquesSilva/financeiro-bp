import test from 'node:test'
import assert from 'node:assert/strict'
import { filtrarSubtarefasPorResponsavel, formatIniciativasBi, projetoCategoriaPresentation, resumirSubtarefasResponsaveis, subtarefasRealizadasDaVisao } from '../src/features/eficiencia/utils/opsLegaisProjetoPresentation.ts'
import type { OpsLegaisIniciativasPainel, OpsLegaisIniciativasProjeto, OpsLegaisIniciativasSubtarefa } from '../src/features/eficiencia/types/eficiencia.types.ts'

const tarefa = (id: string, responsavel: string, status = 'concluido', data: string | null = '2026-10-02'): OpsLegaisIniciativasSubtarefa => ({ id, nome: id, responsavel, status, data })
const projeto = (subtarefas: OpsLegaisIniciativasSubtarefa[]): OpsLegaisIniciativasProjeto => ({ id: 'p1', nome: 'Painel de BI', url: null, tipo: 'Projetos', extensao: 'bi', responsavel: 'Gestor', data: null, subtarefas, total_sub: subtarefas.length, sub_concluidas: subtarefas.filter(s => s.status === 'concluido').length })
const painel = (): OpsLegaisIniciativasPainel => ({ projetos_em_andamento: 0, tarefas_sob_em_andamento: 0, subtarefas_concluidas_periodo: 0, semana_inicio: '2026-09-28', semana_fim: '2026-10-04', concluidos: [], andamento: [], semana: [] })

test('mantém BI em maiúsculo nos tipos e títulos sem alterar outras palavras', () => {
  assert.equal(formatIniciativasBi('Painel de bi / Bi (BI), biblioteca e biometria'), 'Painel de BI / BI (BI), biblioteca e biometria')
  assert.deepEqual(projetoCategoriaPresentation('bi'), { label: 'BI', icon: 'bi' })
  assert.equal(projetoCategoriaPresentation('painel_bi').label, 'painel BI')
})

test('conta tarefas únicas, atribui compartilhadas a cada pessoa e separa sem responsável', () => {
  const rows = [tarefa('1', 'João Souza'), tarefa('2', 'JOAO SOUZA, Ana Lima'), tarefa('2', 'JOAO SOUZA, Ana Lima'), tarefa('3', ''), tarefa('4', 'Ana Lima')]
  const resumo = resumirSubtarefasResponsaveis(rows)
  assert.equal(resumo.total, 4)
  assert.equal(resumo.compartilhadas, 1)
  assert.deepEqual(resumo.responsaveis, [
    { nome: 'Ana Lima', total: 2, semResponsavel: false },
    { nome: 'João Souza', total: 2, semResponsavel: false },
    { nome: 'Sem responsável', total: 1, semResponsavel: true },
  ])
})

test('unifica nome e e-mail da mesma pessoa sem contar duas vezes na mesma tarefa', () => {
  const rows = [tarefa('1', 'ana@example.com, Ana Lima'), tarefa('2', 'Ana Lima')]
  const resumo = resumirSubtarefasResponsaveis(rows, nome => nome === 'ana@example.com' ? 'Ana Lima' : nome)
  assert.equal(resumo.compartilhadas, 0)
  assert.deepEqual(resumo.responsaveis, [{ nome: 'Ana Lima', total: 2, semResponsavel: false }])
})

test('considera só concluídas e respeita a lista de projetos da visão', () => {
  const base = painel()
  base.concluidos = [projeto([tarefa('1', 'Ana'), tarefa('2', 'Ana', 'in progress'), tarefa('3', 'Ana', 'fechados')])]
  base.andamento = [projeto([tarefa('4', 'Bruno'), tarefa('5', 'Bruno', 'backlog')])]
  assert.deepEqual(subtarefasRealizadasDaVisao(base, 'concluidos').map(t => t.id), ['1'])
  assert.deepEqual(subtarefasRealizadasDaVisao(base, 'andamento').map(t => t.id), ['4'])
  assert.deepEqual(subtarefasRealizadasDaVisao(undefined, 'concluidos'), [])
})

test('na semana conta subtarefas individuais sem contar o projeto pai', () => {
  const base = painel()
  base.semana = [
    { id: 'pai', nome: 'Projeto', url: null, tipo: 'Projeto', pai_titulo: '', responsavel: 'Gestor', data: '2026-10-02' },
    { id: '1', nome: 'Entrega', url: null, tipo: 'Subtarefa', pai_titulo: 'Projeto', responsavel: 'Ana', data: '2026-10-02' },
  ]
  base.semana_por_tarefa = [projeto([tarefa('antiga', 'Gestor', 'concluido', '2026-09-20')])]
  assert.deepEqual(subtarefasRealizadasDaVisao(base, 'semana').map(t => t.id), ['1'])
})

test('payload semanal agregado exclui datas fora da semana e inclui os dois limites', () => {
  const base = painel()
  base.semana_por_tarefa = [projeto([
    tarefa('antes', 'Ana', 'concluido', '2026-09-27'),
    tarefa('inicio', 'Ana', 'concluido', '2026-09-28'),
    tarefa('fim', 'Bruno', 'concluido', '2026-10-04'),
    tarefa('depois', 'Bruno', 'concluido', '2026-10-05'),
    tarefa('sem-data', 'Bruno', 'concluido', null),
  ])]
  assert.deepEqual(subtarefasRealizadasDaVisao(base, 'semana').map(t => t.id), ['inicio', 'fim'])
})


test('filtro de pessoa preserva compartilhadas, exclui outras pessoas e não faz match parcial', () => {
  const rows=[tarefa('1','Ana Lima'), tarefa('2','Ana Lima, Bruno Costa'), tarefa('3','Bruno Costa'), tarefa('4','Ana Lima Souza'), tarefa('5','')]
  assert.deepEqual(filtrarSubtarefasPorResponsavel(rows,'ANA LIMA').map(t=>t.id), ['1','2'])
  assert.deepEqual(filtrarSubtarefasPorResponsavel(rows,'').map(t=>t.id), ['5'])
  assert.deepEqual(filtrarSubtarefasPorResponsavel(rows,null), rows)
  assert.equal(rows.length,5)
})

test('filtro por responsável usa a identidade resolvida para nomes e e-mails', () => {
  const rows=[tarefa('1','ana@example.com'),tarefa('2','Ana Lima'),tarefa('3','Bruno Costa')]
  const resolve = nome => nome === 'ana@example.com' ? 'Ana Lima' : nome
  assert.deepEqual(filtrarSubtarefasPorResponsavel(rows,'Ana Lima',resolve).map(t=>t.id),['1','2'])
})
