import { parsePhoneNumberFromString } from 'libphonenumber-js'

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
export function isPossibleBrazilLocal(digits: string): boolean {
  if (digits.length !== 10 && digits.length !== 11) return false
  const ddd = Number.parseInt(digits.slice(0, 2), 10)
  return ddd >= 11 && ddd <= 99
}

/**
 * Normaliza para E.164 sem "+" (ex.: 34656349183, 5511999998888).
 * BR local (10/11 dígitos) prioriza +55 antes de interpretar como DDI estrangeiro.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const digits = cleanDigits(raw)
  if (!digits) return null

  // Evita 3588754584 ser lido como Finlândia (+358): trata como BR local primeiro.
  if (isPossibleBrazilLocal(digits)) {
    const asBr = tryParseE164Digits(`55${digits}`)
    if (asBr) return asBr
  }

  const candidates: string[] = [digits]

  if (digits.length === 10 || digits.length === 11) {
    candidates.push(`55${digits}`)
  }

  // Repara ex.: 5534656349183 → 34656349183 (55 + Espanha +34…)
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

export function phoneKeyFromE164(raw: string | null | undefined): string | null {
  const n = normalizePhoneE164(raw)
  if (!n) return null
  if (n.startsWith('55')) return brazilPhoneKey(n)
  return n
}

/** Chaves alternativas para cruzar telefone (cadastro, JID, menções). */
export function phoneLookupAliases(raw: string | null | undefined): string[] {
  const keys = new Set<string>()
  const rawDigits = cleanDigits(raw ?? '')
  if (rawDigits) keys.add(rawDigits)

  const e164 = normalizePhoneE164(raw)
  if (!e164) return [...keys]

  keys.add(e164)
  if (e164.startsWith('55') && e164.length >= 12) {
    keys.add(e164.slice(2))
    const pk = brazilPhoneKey(e164)
    if (pk) keys.add(pk)
  }

  return [...keys].filter(Boolean)
}

export function phonesMatchE164(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhoneE164(a)
  const nb = normalizePhoneE164(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.startsWith('55') && nb.startsWith('55')) {
    return brazilPhoneKey(na) === brazilPhoneKey(nb)
  }
  return false
}
