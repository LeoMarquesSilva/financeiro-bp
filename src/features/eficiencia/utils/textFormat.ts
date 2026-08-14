/** Remove envelope JSON de listas, ex.: `["PRAZO"]` → `PRAZO`. */
export function stripJsonArrayDecorators(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return trimmed
  // Tenta parse JSON array
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .join(', ')
      }
    } catch {
      // fallback regex abaixo
    }
  }
  return trimmed
    .replace(/^\[|\]$/g, '')
    .replace(/"/g, '')
    .replace(/\\/g, '')
    .replace(/,(?=\S)/g, ', ')
    .trim()
}

const SMALL_WORDS = new Set([
  'a',
  'as',
  'o',
  'os',
  'e',
  'de',
  'da',
  'das',
  'do',
  'dos',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'por',
  'para',
  'com',
  'sem',
  'vs',
])

/** Siglas mantidas em maiúsculas na PriMaiuscula. */
const ACRONYMS = new Set([
  'sla',
  'fatal',
  'pdi',
  'nps',
  'qtd',
  'ci',
  'cis',
  'kpi',
  'bi',
  'd1',
  'd+1',
  'd-1',
])

/** Title Case pt-BR (PriMaiuscula): primeira letra de cada palavra, artigos/preposições minúsculos. */
export function toPriMaiuscula(value: string | null | undefined): string {
  const cleaned = stripJsonArrayDecorators(value)
  if (!cleaned) return cleaned
  const words = cleaned
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+|[-/·•,;:()]+)/)
  let wordIndex = 0
  return words
    .map((token) => {
      if (!token || /^\s+$/.test(token) || /^[-/·•,;:()]+$/.test(token)) return token
      const isFirst = wordIndex === 0
      wordIndex += 1
      if (ACRONYMS.has(token)) return token.toLocaleUpperCase('pt-BR')
      if (!isFirst && SMALL_WORDS.has(token)) return token
      return token.charAt(0).toLocaleUpperCase('pt-BR') + token.slice(1)
    })
    .join('')
}
