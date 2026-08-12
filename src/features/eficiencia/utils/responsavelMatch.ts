import type { EficienciaTabId } from '../config/eficienciaTabs'
import type { RacionalIndicador } from '../types/eficiencia.types'
import { EFICIENCIA_NOME_ALIASES_CHAVE } from '../constants'

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von'])

/** Chave estável (sem acento, maiúscula) + aliases AD. */
export function normalizeResponsavelChave(nome: string): string {
  const key = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
  return EFICIENCIA_NOME_ALIASES_CHAVE[key] ?? key
}

/** Tokens úteis para match / filtro SQL (ignora partículas curtas). */
export function significantResponsavelTokens(nome: string): string[] {
  return normalizeResponsavelChave(nome)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !PARTICULAS.has(t.toLowerCase()))
}

/**
 * Match tolerante entre nome do filtro e nome da base/ranking
 * (ex.: "Ex Func Maria Silva" ↔ "Maria Silva").
 */
export function nomesResponsavelMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const rawA = typeof a === 'string' ? a.trim() : ''
  const rawB = typeof b === 'string' ? b.trim() : ''
  if (!rawA || !rawB) return false

  const ka = normalizeResponsavelChave(rawA)
  const kb = normalizeResponsavelChave(rawB)
  if (ka === kb) return true
  if (ka.includes(kb) || kb.includes(ka)) return true

  const ta = significantResponsavelTokens(rawA)
  const tb = significantResponsavelTokens(rawB)
  if (ta.length === 0 || tb.length === 0) return false
  if (ta[0] !== tb[0]) return false
  const aInB = ta.every((t) => kb.includes(t))
  const bInA = tb.every((t) => ka.includes(t))
  return aInB || bInA
}

export function filtrarPorResponsavel<T>(
  rows: T[],
  getNome: (row: T) => string | null | undefined,
  responsavel: string | null | undefined,
): T[] {
  if (!responsavel?.trim()) return rows
  return rows.filter((row) => nomesResponsavelMatch(getNome(row), responsavel))
}

/** Coluna de pessoa no racional por indicador. */
export const RACIONAL_COLUNA_RESPONSAVEL: Partial<Record<RacionalIndicador, string>> = {
  sla_protocolo: 'usuario_conclusao',
  eficiencia_protocolo: 'criado_por',
  sla_ciencia_agendamentos: 'usuario_conclusao',
  sla_vistagem_risco: 'vistado_por',
  sla_vistagem_normal: 'vistado_por',
  desenvolvimento_equipe: 'colaborador',
  retencao_talentos: 'nome',
  gestao_pdi: 'colaborador',
  ops_legais_sla_protocolo: 'protocolado_por',
  ops_legais_eficiencia_protocolo: 'protocolado_por',
  ops_legais_pub_analise: 'agendado_por',
  ops_legais_pub_agendamento: 'agendado_por',
  ops_legais_cadastro: 'agendado_por',
  ops_legais_iniciativas: 'responsavel',
}

/** Abas do Jurídico que aceitam recorte por responsável. */
export const EFICIENCIA_TABS_COM_RESPONSAVEL = new Set<EficienciaTabId>([
  'sla-protocolo',
  'eficiencia-protocolo',
  'sla-ciencia-agendamentos',
  'sla-vistagem-risco',
  'sla-vistagem-normal',
  'desenvolvimento-equipe',
  'retencao-talentos',
  'gestao-pdi',
])
