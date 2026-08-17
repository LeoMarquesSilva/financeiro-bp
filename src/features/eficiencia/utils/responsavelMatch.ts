import type { EficienciaTabId } from '../config/eficienciaTabs'
import type { RacionalIndicador } from '../types/eficiencia.types'
import { EFICIENCIA_NOME_ALIASES_CHAVE } from '../constants'

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von'])

/** Espelha `eficiencia_nome_chave` no SQL (Ex Func + unaccent). */
export function stripExFuncPrefix(nome: string): string {
  return nome.replace(/^ex\s+func\.?\s+/i, '').trim()
}

export function stripAcentoNome(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Chave estável (sem acento, maiúscula) + aliases AD. Igual ao SQL. */
export function normalizeResponsavelChave(nome: string): string {
  const key = stripAcentoNome(stripExFuncPrefix(nome))
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

/** Palavras do nome original (com acento), sem partículas. */
export function responsavelTokensOriginais(nome: string): string[] {
  return stripExFuncPrefix(nome)
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[%*,()]/g, '').trim())
    .filter((t) => t.length > 2 && !PARTICULAS.has(t.toLowerCase()))
}

/** Token mais longo — âncora de ILIKE (evita AND de tokens sem acento). */
export function ancoraNomeResponsavel(nome: string): string | null {
  const tokens = responsavelTokensOriginais(nome)
  if (tokens.length === 0) return null
  return tokens.reduce((a, b) => (b.length >= a.length ? b : a))
}

/**
 * Ranking de desvio com recorte de pessoa.
 * Se o ranking só traz quem desviou e o match falhar por grafia, usa `fallback`.
 * Qtd 0 → lista vazia (mensagem “nenhum desvio”, não barra invisível).
 */
export function rankingDesvioFiltrado<T extends Record<string, unknown>>(
  rows: T[],
  getNome: (row: T) => string | null | undefined,
  responsavel: string | null | undefined,
  fallback: T | null = null,
): T[] {
  if (!responsavel?.trim()) return rows
  const hit = filtrarPorResponsavel(rows, getNome, responsavel)
  if (hit.length > 0) {
    return hit.map((r) => ({ ...r, pct_do_total: 100 }))
  }
  if (!fallback) return []
  const qtd = Number(
    fallback.qtd_inconsistencia ??
      fallback.qtd_fatal ??
      fallback.qtd_desvio ??
      fallback.fora_prazo ??
      fallback.qtd ??
      0,
  )
  if (!Number.isFinite(qtd) || qtd <= 0) return []
  return [{ ...fallback, pct_do_total: 100 }]
}

export function emptyLabelDesvioResponsavel(
  responsavel: string | null | undefined,
  temAtividade: boolean,
  semDados = 'Sem dados no período.',
): string {
  if (responsavel?.trim() && temAtividade) return 'Nenhum desvio no período.'
  return semDados
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
