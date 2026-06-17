import { parsePhoneForStorage, parsePhoneDigits, isPlausiblePhoneDigits } from './phoneMask'

/**
 * Normaliza telefone para dígitos E.164 (sem +), formato Evolution/WhatsApp.
 * BR local recebe DDI 55; internacional mantém o DDI informado.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const stored = parsePhoneForStorage(raw)
  if (stored) return stored
  const digits = parsePhoneDigits(raw)
  if (digits.length >= 8 && digits.length <= 15 && isPlausiblePhoneDigits(digits)) {
    return digits
  }
  return null
}

function brazilPhoneKey(digits: string): string | null {
  let d = digits
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length < 8) return null
  if (d.length >= 10) return d.slice(0, 2) + d.slice(-8)
  return d.slice(-8)
}

/**
 * Chave comparável: BR usa DDD+8 dígitos (9º dígito); internacional usa E.164 completo.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw)
  if (!n) return null
  if (n.startsWith('55')) return brazilPhoneKey(n)
  return n
}

/** Compara telefones normalizados (BR tolerante ao 9º dígito). */
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

/** Converte telefone normalizado para remoteJid do WhatsApp. */
export function phoneToRemoteJid(phone: string): string {
  const n = normalizePhone(phone)
  return n ? `${n}@s.whatsapp.net` : ''
}

/**
 * Remove o sufixo de dispositivo (:NN) de um JID, preservando o domínio.
 * Ex.: "553592366669:68@s.whatsapp.net" -> "553592366669@s.whatsapp.net"
 */
export function canonicalJid(jid: string): string {
  const [user, domain] = jid.split('@')
  const base = (user ?? '').split(':')[0]
  return domain ? `${base}@${domain}` : base
}

/** Extrai mensagem de erro legível de invoke de Edge Function. */
export async function parseEdgeFunctionError(error: unknown): Promise<string> {
  if (!error || typeof error !== 'object') return 'Erro desconhecido'
  const err = error as { message?: string; context?: Response }
  if (err.context && typeof err.context.json === 'function') {
    try {
      const body = await err.context.json()
      if (body?.error && typeof body.error === 'string') return body.error
      if (typeof body === 'string') return body
    } catch {
      // ignore
    }
  }
  return err.message ?? 'Erro na Edge Function'
}
