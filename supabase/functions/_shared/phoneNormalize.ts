import { parsePhoneNumberFromString } from 'npm:libphonenumber-js@1.12.9'

function cleanDigits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '')
}

function tryParseE164Digits(digits: string): string | null {
  if (!digits) return null
  try {
    const phone = parsePhoneNumberFromString(`+${digits}`)
    if (phone?.isValid()) return phone.number.replace('+', '')
  } catch {
    // ignore
  }
  return null
}

/** DDD brasileiro plausível (11–99) com 8 ou 9 dígitos locais. */
function isPossibleBrazilLocal(digits: string): boolean {
  if (digits.length !== 10 && digits.length !== 11) return false
  const ddd = Number.parseInt(digits.slice(0, 2), 10)
  return ddd >= 11 && ddd <= 99
}

/**
 * Normaliza para E.164 sem "+" (ex.: 34656349183, 5511999998888).
 * BR local (10/11 dígitos) prioriza +55 antes de interpretar como DDI estrangeiro.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const digits = cleanDigits(raw)
  if (!digits) return null

  if (isPossibleBrazilLocal(digits)) {
    const asBr = tryParseE164Digits(`55${digits}`)
    if (asBr) return asBr
  }

  const candidates: string[] = [digits]

  if (digits.length === 10 || digits.length === 11) {
    candidates.push(`55${digits}`)
  }

  if (digits.startsWith('55') && digits.length > 2) {
    candidates.push(digits.slice(2))
  }

  const seen = new Set<string>()
  for (const c of candidates) {
    if (seen.has(c)) continue
    seen.add(c)
    const parsed = tryParseE164Digits(c)
    if (parsed) return parsed
  }

  if (digits.length >= 8 && digits.length <= 15) return digits
  return null
}

function brazilPhoneKey(digits: string): string | null {
  let d = digits
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length < 8) return null
  if (d.length >= 10) return d.slice(0, 2) + d.slice(-8)
  return d.slice(-8)
}

export function phoneKey(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw)
  if (!n) return null
  if (n.startsWith('55')) return brazilPhoneKey(n)
  return n
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.startsWith('55') && nb.startsWith('55')) {
    return brazilPhoneKey(na) === brazilPhoneKey(nb)
  }
  return false
}
