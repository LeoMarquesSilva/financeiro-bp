/** Máximo de dígitos: DDI 55 + DDD (2) + número (9). */
const MAX_DIGITS_BR = 13

export function parsePhoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Formata telefone para exibição: +DDI (DD) NNNNN-NNNN (celular) ou +DDI (DD) NNNN-NNNN (fixo).
 * Assume Brasil (DDI 55) quando o usuário informa só DDD + número.
 */
export function formatPhoneMasked(raw: string | null | undefined): string {
  let d = parsePhoneDigits(raw ?? '')
  if (!d) return ''

  if (d.length <= 11 && !d.startsWith('55')) {
    d = '55' + d
  }

  let ddi = '55'
  if (d.startsWith('55') && d.length >= 12) {
    ddi = '55'
    d = d.slice(2)
  } else if (d.length > 11) {
    ddi = d.slice(0, d.length - 11)
    d = d.slice(ddi.length)
  }

  d = d.slice(0, 11)

  if (d.length === 0) return `+${ddi}`
  if (d.length <= 2) return `+${ddi} (${d}`

  const ddd = d.slice(0, 2)
  const rest = d.slice(2)

  if (rest.length === 0) return `+${ddi} (${ddd})`
  if (rest.length <= 4) return `+${ddi} (${ddd}) ${rest}`

  if (rest.length <= 8) {
    const part1 = rest.slice(0, 4)
    const part2 = rest.slice(4)
    return part2 ? `+${ddi} (${ddd}) ${part1}-${part2}` : `+${ddi} (${ddd}) ${part1}`
  }

  return `+${ddi} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

/** Aplica máscara durante a digitação (limita dígitos). */
export function maskPhoneOnChange(value: string): string {
  const digits = parsePhoneDigits(value).slice(0, MAX_DIGITS_BR)
  return formatPhoneMasked(digits)
}

/** Valor para persistência: apenas dígitos, com DDI 55 quando for número local BR. */
export function parsePhoneForStorage(masked: string): string | null {
  const d = parsePhoneDigits(masked)
  if (!d) return null
  const withDdi = d.length <= 11 && !d.startsWith('55') ? '55' + d : d
  return withDdi.length >= 10 ? withDdi : null
}
