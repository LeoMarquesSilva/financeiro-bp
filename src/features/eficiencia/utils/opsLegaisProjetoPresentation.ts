import type { OpsLegaisIniciativasPainel } from '../types/eficiencia.types'

export type ProjetoCategoriaIcon = 'saas' | 'automation' | 'process' | 'agent' | 'web' | 'integration' | 'software' | 'bi' | 'other'

/** Preserve the acronym without changing the rest of FORJAI's text. */
export function formatIniciativasBi(value: string): string {
  return value.replace(/\bbi\b/gi, 'BI')
}

const CATEGORIAS: Record<string, { label: string; icon: ProjetoCategoriaIcon }> = {
  saas: { label: 'SaaS', icon: 'saas' },
  software_as_a_service: { label: 'SaaS', icon: 'saas' },
  automation: { label: 'Automação', icon: 'automation' },
  automacao: { label: 'Automação', icon: 'automation' },
  process_improvement: { label: 'Melhoria de processo', icon: 'process' },
  melhoria_de_processo: { label: 'Melhoria de processo', icon: 'process' },
  ai_agent: { label: 'Agente de IA', icon: 'agent' },
  website: { label: 'Website', icon: 'web' },
  integration: { label: 'Integração', icon: 'integration' },
  integracao: { label: 'Integração', icon: 'integration' },
  internal_tool: { label: 'Ferramenta interna', icon: 'software' },
  software: { label: 'Software', icon: 'software' },
  bi: { label: 'BI', icon: 'bi' },
  business_intelligence: { label: 'BI', icon: 'bi' },
  other: { label: 'Outro', icon: 'other' },
}

export function projetoCategoriaPresentation(value: string | null | undefined) {
  const raw = value?.trim() ?? ''
  const key = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s-]+/g, '_')
  const known = CATEGORIAS[key]
  if (known) return known
  // Preserve categories introduced by FORJAI instead of assigning a guessed type.
  return { label: raw ? formatIniciativasBi(raw.replace(/[_-]+/g, ' ')) : 'Não informado', icon: 'other' as const }
}

export type IniciativaSubtarefaRealizada = { id: string; responsavel: string }

export function filtrarSubtarefasPorResponsavel<T extends IniciativaSubtarefaRealizada>(
  subtarefas: readonly T[],
  responsavel: string | null,
  resolveNome: (nome: string) => string = (nome) => nome,
): T[] {
  if (responsavel === null) return [...subtarefas]
  const normalize = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ')
  return subtarefas.filter((tarefa) => {
    const nomes = splitIniciativasResponsaveis(tarefa.responsavel)
    if (responsavel === '') return !nomes.length
    return nomes.some((nome) => normalize(resolveNome(nome)) === normalize(responsavel))
  })
}

export function subtarefasRealizadasDaVisao(
  painel: OpsLegaisIniciativasPainel | undefined,
  view: 'concluidos' | 'semana' | 'andamento',
): IniciativaSubtarefaRealizada[] {
  if (!painel) return []
  if (view === 'semana') {
    const individuais = painel.semana.filter((item) => item.tipo === 'Subtarefa')
    if (individuais.length) return individuais
    return (painel.semana_por_tarefa ?? []).flatMap((projeto) => projeto.subtarefas).filter((tarefa) => {
      if (tarefa.status !== 'concluido') return false
      if (!painel.semana_inicio || !painel.semana_fim) return true
      return Boolean(tarefa.data && tarefa.data >= painel.semana_inicio && tarefa.data <= painel.semana_fim)
    })
  }
  return painel[view].flatMap((projeto) => projeto.subtarefas).filter((tarefa) => tarefa.status === 'concluido')
}

export function resumirSubtarefasResponsaveis(
  subtarefas: readonly IniciativaSubtarefaRealizada[],
  resolveNome: (nome: string) => string = (nome) => nome,
) {
  const byPessoa = new Map<string, { nome: string; total: number }>()
  const seen = new Set<string>()
  let compartilhadas = 0
  const normalize = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ')
  for (const subtarefa of subtarefas) {
    if (seen.has(subtarefa.id)) continue
    seen.add(subtarefa.id)
    const pessoas = new Map<string, string>()
    for (const nome of splitIniciativasResponsaveis(subtarefa.responsavel)) {
      const displayNome = resolveNome(nome)
      pessoas.set(normalize(displayNome), displayNome)
    }
    if (!pessoas.size) pessoas.set('', 'Sem responsável')
    if (pessoas.size > 1) compartilhadas += 1
    for (const [key, nome] of pessoas) {
      const prev = byPessoa.get(key)
      byPessoa.set(key, { nome: prev?.nome ?? nome, total: (prev?.total ?? 0) + 1 })
    }
  }
  return {
    total: seen.size,
    compartilhadas,
    responsaveis: [...byPessoa.entries()].sort(([keyA, a], [keyB, b]) => {
      if (!keyA) return 1
      if (!keyB) return -1
      return b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')
    }).map(([key, pessoa]) => ({ ...pessoa, semResponsavel: !key })),
  }
}

/** FORJAI serializes task assignees as comma-separated names. */
export function splitIniciativasResponsaveis(value: string | null | undefined): string[] {
  const seen = new Set<string>()
  return (value ?? '').split(/[,;|\n]+/).map((nome) => nome.trim()).filter((nome) => {
    if (!nome) return false
    const key = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
