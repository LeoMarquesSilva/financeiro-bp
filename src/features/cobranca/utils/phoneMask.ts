/** DDD + número (celular 9 dígitos ou fixo 8), sem DDI. */
const MAX_LOCAL_DIGITS = 11
const MIN_LOCAL_DIGITS = 10

export function parsePhoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Telefone BR plausível (10–11 dígitos locais, com ou sem DDI 55). */
export function isPlausiblePhoneDigits(raw: string | null | undefined): boolean {
  const d = parsePhoneDigits(raw ?? '')
  if (!d) return false
  const localLen = d.startsWith('55') && d.length > 2 ? d.length - 2 : d.length
  return localLen >= MIN_LOCAL_DIGITS && localLen <= MAX_LOCAL_DIGITS
}

function formatLocalPhoneParts(ddd: string, rest: string): string {
  if (rest.length === 0) return `+55 (${ddd})`
  if (rest.length <= 4) return `+55 (${ddd}) ${rest}`
  if (rest.length <= 8) {
    const part1 = rest.slice(0, 4)
    const part2 = rest.slice(4)
    return part2 ? `+55 (${ddd}) ${part1}-${part2}` : `+55 (${ddd}) ${part1}`
  }
  return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

/**
 * Extrai só a parte local (DDD + número), removendo DDI 55 quando presente.
 * Evita tratar "55" digitado no início como DDD durante a digitação.
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
 * Formata para exibição: +55 (DD) NNNNN-NNNN.
 * O DDI 55 é fixo na máscara; o usuário digita apenas DDD e número.
 */
export function formatPhoneMasked(raw: string | null | undefined): string {
  const local = extractLocalDigits(raw)
  if (!local) return ''

  if (local.length <= 2) {
    return `+55 (${local}`
  }

  return formatLocalPhoneParts(local.slice(0, 2), local.slice(2))
}

/**
 * Formata dígitos de JID WhatsApp (+55DDDN...) usando DDD nas posições 2–3 após o DDI.
 * Evita confundir DDD 53–59 com DDD 39–59 ao remover o prefixo "55".
 */
export function formatPhoneFromWhatsappDigits(raw: string | null | undefined): string {
  const d = parsePhoneDigits(raw ?? '')
  if (!d || !isPlausiblePhoneDigits(d)) return ''

  if (d.startsWith('55') && d.length >= 12) {
    return formatLocalPhoneParts(d.slice(2, 4), d.slice(4))
  }

  return formatPhoneMasked(d)
}

/** Aplica máscara durante a digitação. */
export function maskPhoneOnChange(value: string): string {
  const local = extractLocalDigits(value)
  if (!local) {
    const digits = parsePhoneDigits(value)
    if (digits === '55' || digits === '5') return '+55 '
    return ''
  }
  return formatPhoneMasked(local)
}

/** Valor para persistência: dígitos com DDI 55. */
export function parsePhoneForStorage(masked: string): string | null {
  const local = extractLocalDigits(masked)
  if (local.length < 10) return null
  return `55${local}`
}
