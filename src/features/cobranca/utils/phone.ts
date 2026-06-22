import {
  normalizePhoneE164,
  phoneKeyFromE164,
  phonesMatchE164,
} from './normalizePhoneE164'

/** @alias normalizePhoneE164 */
export function normalizePhone(raw: string | null | undefined): string | null {
  return normalizePhoneE164(raw)
}

export function phoneKey(raw: string | null | undefined): string | null {
  return phoneKeyFromE164(raw)
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return phonesMatchE164(a, b)
}

/** Converte telefone normalizado para remoteJid do WhatsApp. */
export function phoneToRemoteJid(phone: string): string {
  const n = normalizePhoneE164(phone)
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
