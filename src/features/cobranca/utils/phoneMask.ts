import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'
import { normalizePhoneE164 } from './normalizePhoneE164'

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

/**
 * Formata para exibição usando a mesma normalização aplicada no envio.
 * Isso impede que um telefone BR sem DDI (ex.: 19 3846-7736) seja exibido
 * como se o primeiro dígito fosse um DDI internacional (ex.: +1).
 */
export function formatPhoneMasked(raw: string | null | undefined): string {
  const normalizedDisplay = formatPhoneDisplay(raw)
  if (normalizedDisplay) return normalizedDisplay

  // Fallback para entrada parcial/incompleta, que ainda não pode ser normalizada.
  const d = parsePhoneDigits(raw ?? '')
  if (!d) return ''

  if (isBrazilWithDdi(d)) return formatBrazilWithDdi(d)
  if (isBrazilLocalDigits(d)) return formatBrazilLocalDigits(d)
  return `+${d}`
}

/** Formata telefone BR para exibição na UI (DDD + número completo, preserva 9º dígito). */
export function formatBrazilDisplayPhone(raw: string | null | undefined): string | null {
  let d = parsePhoneDigits(raw ?? '')
  if (!d) return null
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length < 10 || d.length > 11) return null
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  return null
}

/**
 * Formata telefone para exibição: BR nacional ou internacional (libphonenumber).
 * Nunca trunca dígitos — usa E.164 completo.
 */
export function formatPhoneDisplay(raw: string | null | undefined): string | null {
  const e164 = normalizePhoneE164(raw)
  if (!e164) return null

  try {
    const phone = parsePhoneNumberFromString(`+${e164}`)
    if (phone?.isValid()) {
      if (phone.country === 'BR') {
        const br = formatBrazilDisplayPhone(e164)
        if (br) return br
      }
      return phone.formatInternational()
    }
  } catch {
    // fallback abaixo
  }

  const br = formatBrazilDisplayPhone(e164)
  if (br) return br
  return `+${e164}`
}

/** Formata dígitos de JID WhatsApp. */
export function formatPhoneFromWhatsappDigits(raw: string | null | undefined): string {
  return formatPhoneDisplay(raw) ?? ''
}

/** @deprecated Use PhoneInputCountry — mantido para compatibilidade pontual. */
export function maskPhoneOnChange(value: string): string {
  return formatPhoneMasked(value)
}

/** Valor para persistência: dígitos com DDI (E.164 sem +). */
export function parsePhoneForStorage(raw: string): string | null {
  return normalizePhoneE164(raw)
}
