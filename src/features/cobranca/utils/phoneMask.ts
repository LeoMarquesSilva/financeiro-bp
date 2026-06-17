import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'

/** DDD + número (celular 9 dígitos ou fixo 8), sem DDI. */
const MAX_LOCAL_DIGITS = 11
const MIN_LOCAL_DIGITS = 10
const MIN_E164_DIGITS = 8
const MAX_E164_DIGITS = 15

export function parsePhoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function isBrazilLocalDigits(d: string): boolean {
  return d.length >= MIN_LOCAL_DIGITS && d.length <= MAX_LOCAL_DIGITS
}

function isBrazilWithDdi(d: string): boolean {
  return d.startsWith('55') && d.length >= 12 && d.length <= 13
}

function toE164(raw: string): string {
  const d = parsePhoneDigits(raw)
  return d ? `+${d}` : ''
}

/** Telefone plausível: validação libphonenumber ou fallback heurístico. */
export function isPlausiblePhoneDigits(raw: string | null | undefined): boolean {
  const e164 = toE164(raw ?? '')
  if (!e164) return false
  try {
    if (isValidPhoneNumber(e164)) return true
  } catch {
    // fallback abaixo
  }
  const d = parsePhoneDigits(raw ?? '')
  if (isBrazilLocalDigits(d)) return true
  if (isBrazilWithDdi(d)) return true
  return d.length >= MIN_E164_DIGITS && d.length <= MAX_E164_DIGITS
}

function formatBrazilLocalParts(ddd: string, rest: string): string {
  if (rest.length === 0) return `+55 (${ddd})`
  if (rest.length <= 4) return `+55 (${ddd}) ${rest}`
  if (rest.length <= 8) {
    const part1 = rest.slice(0, 4)
    const part2 = rest.slice(4)
    return part2 ? `+55 (${ddd}) ${part1}-${part2}` : `+55 (${ddd}) ${part1}`
  }
  return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

function formatBrazilLocalDigits(local: string): string {
  if (local.length <= 2) return `+55 (${local}`
  return formatBrazilLocalParts(local.slice(0, 2), local.slice(2))
}

function formatBrazilWithDdi(digits: string): string {
  return formatBrazilLocalParts(digits.slice(2, 4), digits.slice(4))
}

/**
 * Extrai só a parte local BR (DDD + número), removendo DDI 55 quando presente.
 */
export function extractLocalDigits(raw: string | null | undefined): string {
  let d = parsePhoneDigits(raw ?? '')
  if (!d) return ''

  if (d === '55') return ''

  if (d.startsWith('55') && d.length > 2) {
    d = d.slice(2)
  }

  if (d.length > MAX_LOCAL_DIGITS) {
    d = d.slice(0, MAX_LOCAL_DIGITS)
  }

  return d
}

/** Formata para exibição (internacional quando possível). */
export function formatPhoneMasked(raw: string | null | undefined): string {
  const d = parsePhoneDigits(raw ?? '')
  if (!d) return ''

  try {
    const phone = parsePhoneNumberFromString(`+${d}`)
    if (phone) return phone.formatInternational()
  } catch {
    // fallback abaixo
  }

  if (isBrazilWithDdi(d)) return formatBrazilWithDdi(d)
  if (isBrazilLocalDigits(d)) return formatBrazilLocalDigits(d)
  return `+${d}`
}

/** Formata dígitos de JID WhatsApp. */
export function formatPhoneFromWhatsappDigits(raw: string | null | undefined): string {
  const d = parsePhoneDigits(raw ?? '')
  if (!d || !isPlausiblePhoneDigits(d)) return ''

  if (d.startsWith('55') && d.length >= 12) {
    return formatBrazilWithDdi(d)
  }

  return formatPhoneMasked(d)
}

/** @deprecated Use PhoneInputCountry — mantido para compatibilidade pontual. */
export function maskPhoneOnChange(value: string): string {
  return formatPhoneMasked(value)
}

/** Valor para persistência: dígitos com DDI (E.164 sem +). */
export function parsePhoneForStorage(raw: string): string | null {
  const digits = parsePhoneDigits(raw)
  if (!digits) return null

  const e164 = `+${digits}`
  try {
    const phone = parsePhoneNumberFromString(e164)
    if (phone?.isValid()) return phone.number.replace('+', '')
  } catch {
    // fallback abaixo
  }

  if (isBrazilLocalDigits(digits)) return `55${digits}`

  if (digits.length >= MIN_E164_DIGITS && digits.length <= MAX_E164_DIGITS) {
    return digits
  }

  return null
}
