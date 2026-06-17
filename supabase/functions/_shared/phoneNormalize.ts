/**
 * Normalização E.164 (dígitos com DDI, sem +) para Edge Functions.
 * BR local (10–11 dígitos) recebe prefixo 55; demais países mantêm o DDI informado.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, '')
  if (digits.length === 0) return null
  digits = digits.replace(/^0+/, '')

  // Já inclui DDI (internacional ou BR completo).
  if (digits.length >= 12) return digits

  // BR: DDD + número sem DDI.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`

  // Internacional curto (ex.: EUA +1 = 11 dígitos totais).
  if (digits.length >= 8 && digits.length <= 15) return digits

  return null
}

/** Chave BR tolerante ao 9º dígito (DDD + 8 últimos). */
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
