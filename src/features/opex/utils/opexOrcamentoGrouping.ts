import type { OpexOrcamentoLinha } from '../types/opex.types'
import { departamentoLabel as formatDepartamentoLabel } from './departamentoLabel'

const DESC_FORN_SEP = ' · '

export type FornecedorDescricaoParsed = {
  fornecedor: string
  descricaoDetalhe: string
}

/** Separa fornecedor e descrição conforme importação SIOE (desc · forn). */
export function parseFornecedorDescricao(l: OpexOrcamentoLinha): FornecedorDescricaoParsed {
  const raw = l.descricao.trim()
  const sepIdx = raw.lastIndexOf(DESC_FORN_SEP)
  if (sepIdx >= 0) {
    const descricaoDetalhe = raw.slice(0, sepIdx).trim()
    const fornecedor = raw.slice(sepIdx + DESC_FORN_SEP.length).trim()
    return {
      fornecedor: fornecedor || 'Sem fornecedor',
      descricaoDetalhe: descricaoDetalhe || l.titulo_ref.trim() || 'Sem descrição',
    }
  }
  return {
    fornecedor: raw || l.titulo_ref.trim() || 'Sem fornecedor',
    descricaoDetalhe: l.titulo_ref.trim() || 'Sem descrição',
  }
}

/** Monta descricao no formato hierárquico (detalhe · fornecedor). */
export function montarDescricaoOrcamento(descricaoDetalhe: string, fornecedor: string): string {
  const desc = descricaoDetalhe.trim()
  const forn = fornecedor.trim()
  if (desc && forn && forn !== 'Sem fornecedor') {
    return `${desc}${DESC_FORN_SEP}${forn}`
  }
  if (forn && forn !== 'Sem fornecedor') return forn
  return desc
}

/** Atualiza o texto exibido na hierarquia, preservando fornecedor no campo descricao. */
export function reconstruirDescricaoOrcamento(
  linha: OpexOrcamentoLinha,
  novaDescricaoDetalhe: string,
): string {
  const { fornecedor } = parseFornecedorDescricao(linha)
  return montarDescricaoOrcamento(novaDescricaoDetalhe, fornecedor) || linha.descricao.trim()
}

export function departamentoOrcamentoLabel(l: OpexOrcamentoLinha): string {
  const raw = l.departamento.trim() || 'Sem departamento'
  return formatDepartamentoLabel(raw)
}

export type PlanoContasResumo = {
  grupoConta: string
  total: number
  linhas: OpexOrcamentoLinha[]
  qtdMicro: number
}

export type PlanoMicroResumo = {
  planoMicro: string
  total: number
  linhas: OpexOrcamentoLinha[]
  qtdFornecedores: number
}

export type FornecedorResumo = {
  fornecedor: string
  total: number
  linhas: OpexOrcamentoLinha[]
  qtdDepartamentos: number
}

export type DepartamentoOrcamentoResumo = {
  departamento: string
  total: number
  linhas: OpexOrcamentoLinha[]
  qtdDescricoes: number
}

export type DescricaoOrcamentoResumo = {
  descricao: string
  total: number
  linhas: OpexOrcamentoLinha[]
  qtdMeses: number
}

function sortLinhasOrcamento(linhas: OpexOrcamentoLinha[]): OpexOrcamentoLinha[] {
  return [...linhas].sort(
    (a, b) =>
      a.mes - b.mes ||
      a.descricao.localeCompare(b.descricao, 'pt-BR') ||
      a.titulo_ref.localeCompare(b.titulo_ref, 'pt-BR'),
  )
}

function linhasNoMes(linhas: OpexOrcamentoLinha[], mesFiltro: number | null): OpexOrcamentoLinha[] {
  if (mesFiltro == null) return linhas
  return linhas.filter((l) => l.mes === mesFiltro)
}

export function orcamentoPathKey(...parts: string[]): string {
  return parts.join('::')
}

export function descricaoLinhaLabel(l: OpexOrcamentoLinha): string {
  return parseFornecedorDescricao(l).descricaoDetalhe
}

/** Referência VIOS (ex.: "CI 11911") — não vira nível próprio na hierarquia. */
export function isCiOrcamentoReferencia(text: string): boolean {
  return /^CI\s*\d+/i.test(text.trim())
}

export function partitionDescricoesOrcamento(descricoes: DescricaoOrcamentoResumo[]): {
  descricoesNormais: DescricaoOrcamentoResumo[]
  linhasCiFlat: OpexOrcamentoLinha[]
} {
  const descricoesNormais: DescricaoOrcamentoResumo[] = []
  const linhasCiFlat: OpexOrcamentoLinha[] = []
  for (const desc of descricoes) {
    if (isCiOrcamentoReferencia(desc.descricao)) {
      linhasCiFlat.push(...desc.linhas)
    } else {
      descricoesNormais.push(desc)
    }
  }
  linhasCiFlat.sort((a, b) => a.mes - b.mes || a.titulo_ref.localeCompare(b.titulo_ref, 'pt-BR'))
  return { descricoesNormais, linhasCiFlat }
}

export function planosContasDasLinhas(linhas: OpexOrcamentoLinha[]): PlanoContasResumo[] {
  const map = new Map<string, OpexOrcamentoLinha[]>()
  for (const l of linhas) {
    const bucket = map.get(l.grupo_conta)
    if (bucket) bucket.push(l)
    else map.set(l.grupo_conta, [l])
  }
  return Array.from(map.entries())
    .map(([grupoConta, grupoLinhas]) => ({
      grupoConta,
      total: grupoLinhas.reduce((s, item) => s + item.valor, 0),
      linhas: sortLinhasOrcamento(grupoLinhas),
      qtdMicro: new Set(grupoLinhas.map((item) => item.plano_contas)).size,
    }))
    .sort((a, b) => b.total - a.total || a.grupoConta.localeCompare(b.grupoConta, 'pt-BR'))
}

export function planosMicroDoGrupo(
  linhas: OpexOrcamentoLinha[],
  mesFiltro: number | null,
): PlanoMicroResumo[] {
  const map = new Map<string, OpexOrcamentoLinha[]>()
  for (const l of linhasNoMes(linhas, mesFiltro)) {
    const bucket = map.get(l.plano_contas)
    if (bucket) bucket.push(l)
    else map.set(l.plano_contas, [l])
  }
  return Array.from(map.entries())
    .map(([planoMicro, microLinhas]) => ({
      planoMicro,
      total: microLinhas.reduce((s, item) => s + item.valor, 0),
      linhas: sortLinhasOrcamento(microLinhas),
      qtdFornecedores: new Set(microLinhas.map((item) => parseFornecedorDescricao(item).fornecedor)).size,
    }))
    .sort((a, b) => b.total - a.total || a.planoMicro.localeCompare(b.planoMicro, 'pt-BR'))
}

export function fornecedoresDoPlanoMicro(
  linhas: OpexOrcamentoLinha[],
  mesFiltro: number | null,
): FornecedorResumo[] {
  const map = new Map<string, OpexOrcamentoLinha[]>()
  for (const l of linhasNoMes(linhas, mesFiltro)) {
    const { fornecedor } = parseFornecedorDescricao(l)
    const bucket = map.get(fornecedor)
    if (bucket) bucket.push(l)
    else map.set(fornecedor, [l])
  }
  return Array.from(map.entries())
    .map(([fornecedor, fornLinhas]) => ({
      fornecedor,
      total: fornLinhas.reduce((s, item) => s + item.valor, 0),
      linhas: sortLinhasOrcamento(fornLinhas),
      qtdDepartamentos: new Set(fornLinhas.map((item) => departamentoOrcamentoLabel(item))).size,
    }))
    .sort((a, b) => b.total - a.total || a.fornecedor.localeCompare(b.fornecedor, 'pt-BR'))
}

export function departamentosDoFornecedor(
  linhas: OpexOrcamentoLinha[],
  mesFiltro: number | null,
): DepartamentoOrcamentoResumo[] {
  const map = new Map<string, OpexOrcamentoLinha[]>()
  for (const l of linhasNoMes(linhas, mesFiltro)) {
    const departamento = departamentoOrcamentoLabel(l)
    const bucket = map.get(departamento)
    if (bucket) bucket.push(l)
    else map.set(departamento, [l])
  }
  return Array.from(map.entries())
    .map(([departamento, deptLinhas]) => ({
      departamento,
      total: deptLinhas.reduce((s, item) => s + item.valor, 0),
      linhas: sortLinhasOrcamento(deptLinhas),
      qtdDescricoes: new Set(
        deptLinhas
          .filter((item) => !isCiOrcamentoReferencia(descricaoLinhaLabel(item)))
          .map((item) => `${descricaoLinhaLabel(item)}\0${item.titulo_ref}`),
      ).size,
    }))
    .sort((a, b) => b.total - a.total || a.departamento.localeCompare(b.departamento, 'pt-BR'))
}

export function linhasPorDescricao(linhas: OpexOrcamentoLinha[]): DescricaoOrcamentoResumo[] {
  const map = new Map<string, { linhas: OpexOrcamentoLinha[]; meses: Set<number> }>()
  for (const l of linhas) {
    const key = `${descricaoLinhaLabel(l)}\0${l.titulo_ref}`
    const cur = map.get(key)
    if (cur) {
      cur.linhas.push(l)
      cur.meses.add(l.mes)
    } else {
      map.set(key, { linhas: [l], meses: new Set([l.mes]) })
    }
  }
  return Array.from(map.values())
    .map(({ linhas: descLinhas, meses }) => ({
      descricao: descricaoLinhaLabel(descLinhas[0]!),
      total: descLinhas.reduce((s, item) => s + item.valor, 0),
      linhas: descLinhas.sort((a, b) => a.mes - b.mes),
      qtdMeses: meses.size,
    }))
    .sort((a, b) => b.total - a.total || a.descricao.localeCompare(b.descricao, 'pt-BR'))
}

export function countPlanosContasUnicos(linhas: OpexOrcamentoLinha[]): number {
  return new Set(linhas.map((l) => l.grupo_conta)).size
}

export function countPlanosMicroUnicos(linhas: OpexOrcamentoLinha[]): number {
  return new Set(linhas.map((l) => l.plano_contas)).size
}

export function countFornecedoresUnicos(linhas: OpexOrcamentoLinha[]): number {
  return new Set(linhas.map((l) => parseFornecedorDescricao(l).fornecedor)).size
}

export function countDepartamentosUnicos(linhas: OpexOrcamentoLinha[]): number {
  return new Set(linhas.map((l) => departamentoOrcamentoLabel(l))).size
}
