import {
  EFICIENCIA_META_TREINAMENTO_MINUTOS,
  isTreinamentoLideranca,
  resolveOpsTreinamentoCategoria,
  type OpsTreinamentoCategoria,
} from '../constants'
import type { TreinamentoItemRow } from '../types/eficiencia.types'

export type OpsTurnoverAtivo = {
  nome: string
  cargo: string | null
}

export type OpsTreinamentoPessoaDetalhe = {
  colaborador: string
  cargo: string | null
  categoria: OpsTreinamentoCategoria
  minutos: number
  minutosLideranca: number
}

export type OpsTreinamentoCategoriaResumo = {
  categoria: OpsTreinamentoCategoria
  qtdPessoas: number
  minutos: number
  metaMinutos: number | null
  pctAtingimento: number | null
  horasLabel: string
}

function normalizeNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
}

function formatHorasMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${h}h ${String(m).padStart(2, '0')}min`
}

/** Consolida presença + headcount Ops Legais nas 3 categorias do BI. */
export function buildOpsTreinamentosCategorias(
  ativos: OpsTurnoverAtivo[],
  itens: TreinamentoItemRow[],
): {
  resumos: OpsTreinamentoCategoriaResumo[]
  pessoas: OpsTreinamentoPessoaDetalhe[]
  equipeEmLideranca: OpsTreinamentoPessoaDetalhe[]
} {
  const pessoasMap = new Map<string, OpsTreinamentoPessoaDetalhe>()

  for (const a of ativos) {
    const key = normalizeNome(a.nome)
    if (!key) continue
    const categoria = resolveOpsTreinamentoCategoria(a.cargo)
    pessoasMap.set(key, {
      colaborador: a.nome,
      cargo: a.cargo,
      categoria,
      minutos: 0,
      minutosLideranca: 0,
    })
  }

  for (const item of itens) {
    const key = normalizeNome(item.colaborador)
    if (!key) continue
    const pessoa = pessoasMap.get(key)
    if (!pessoa) continue
    const min = Number(item.duracao_minutos ?? 0)
    if (!Number.isFinite(min) || min <= 0) continue
    const lider = isTreinamentoLideranca(item.treinamento)
    if (lider) pessoa.minutosLideranca += min
    // Conta todos os treinamentos da pessoa (BI Ops não tem tabela ministrados
    // sincronizada — filtrar só por nome "Liderança" omitia Coordenadores como Samuel).
    pessoa.minutos += min
  }

  const pessoas = [...pessoasMap.values()].sort((a, b) => b.minutos - a.minutos)

  const categorias: OpsTreinamentoCategoria[] = ['Equipe', 'Liderança', 'Gerente']
  const resumos = categorias.map((categoria) => {
    const grupo = pessoas.filter((p) => p.categoria === categoria)
    const qtdPessoas = grupo.length
    const minutos = grupo.reduce((s, p) => s + p.minutos, 0)
    const temMeta = categoria !== 'Gerente'
    const metaMinutos = temMeta ? qtdPessoas * EFICIENCIA_META_TREINAMENTO_MINUTOS : null
    const pctAtingimento =
      temMeta && metaMinutos && metaMinutos > 0
        ? Math.round((minutos / metaMinutos) * 10000) / 100
        : null
    return {
      categoria,
      qtdPessoas,
      minutos,
      metaMinutos,
      pctAtingimento,
      horasLabel: formatHorasMinutos(minutos),
    }
  })

  const equipeEmLideranca = pessoas
    .filter((p) => p.categoria === 'Equipe' && p.minutosLideranca > 0)
    .map((p) => ({ ...p, minutos: p.minutosLideranca }))
    .sort((a, b) => b.minutos - a.minutos)

  return { resumos, pessoas, equipeEmLideranca }
}
