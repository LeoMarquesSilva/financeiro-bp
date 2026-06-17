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

/** Telefone plausível: BR local/com DDI ou internacional (E.164). */
export function isPlausiblePhoneDigits(raw: string | null | undefined): boolean {
  const d = parsePhoneDigits(raw ?? '')
  if (!d) return false
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
 * Usado apenas para entrada no formato brasileiro sem prefixo internacional.
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
 * Formata para exibição. BR recebe máscara (+55 (DD) NNNNN-NNNN); demais países, +DDI dígitos.
 */
export function formatPhoneMasked(raw: string | null | undefined): string {
  const d = parsePhoneDigits(raw ?? '')
  if (!d) return ''

  if (isBrazilWithDdi(d)) return formatBrazilWithDdi(d)

  if (isBrazilLocalDigits(d)) return formatBrazilLocalDigits(d)

  return `+${d}`
}

/**
 * Formata dígitos de JID WhatsApp usando DDD nas posições 2–3 após o DDI quando BR.
 */
export function formatPhoneFromWhatsappDigits(raw: string | null | undefined): string {
  const d = parsePhoneDigits(raw ?? '')
  if (!d || !isPlausiblePhoneDigits(d)) return ''

  if (d.startsWith('55') && d.length >= 12) {
    return formatBrazilWithDdi(d)
  }

  return formatPhoneMasked(d)
}

function maskBrazilOnChange(value: string): string {
  const local = extractLocalDigits(value)
  if (!local) {
    const digits = parsePhoneDigits(value)
    if (digits === '55' || digits === '5') return '+55 '
    return ''
  }
  return formatBrazilLocalDigits(local)
}

function maskInternationalOnChange(value: string): string {
  const digits = parsePhoneDigits(value)
  if (!digits) return value.trimStart().startsWith('+') ? '+' : ''

  if (digits.startsWith('55') && digits.length <= 13) {
    const brMasked = maskBrazilOnChange(`+${digits}`)
    if (brMasked) return brMasked
  }

  return `+${digits}`
}

/** Aplica máscara durante a digitação (BR ou internacional). */
export function maskPhoneOnChange(value: string): string {
  const trimmed = value.trimStart()

  if (trimmed.startsWith('+') || parsePhoneDigits(value).length > MAX_LOCAL_DIGITS) {
    return maskInternationalOnChange(value)
  }

  return maskBrazilOnChange(value)
}

/**
 * Valor para persistência: dígitos com DDI.
 * BR local (10–11 dígitos) recebe prefixo 55; demais países mantêm o DDI informado.
 */
export function parsePhoneForStorage(masked: string): string | null {
  const digits = parsePhoneDigits(masked)
  if (!digits) return null

  if (isBrazilLocalDigits(digits)) return `55${digits}`

  if (digits.length >= MIN_E164_DIGITS && digits.length <= MAX_E164_DIGITS) {
    return digits
  }

  return null
}
