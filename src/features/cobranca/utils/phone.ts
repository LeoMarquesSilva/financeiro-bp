/** Normaliza telefone BR para dígitos com DDI 55 (formato Evolution). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, '')
  if (digits.length === 0) return null
  digits = digits.replace(/^0+/, '')
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = '55' + digits
  }
  return digits.length >= 10 ? digits : null
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

/**
 * Gera uma chave comparável de telefone: DDD + 8 últimos dígitos.
 * Resolve as diferenças entre o WhatsApp (com DDI 55, sem 9º dígito) e os
 * telefones cadastrados (sem DDI, com/sem 9º dígito). Retorna null se inválido.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  if (d.length < 8) return null
  if (d.length >= 10) {
    const ddd = d.slice(0, 2)
    return ddd + d.slice(-8)
  }
  return d.slice(-8)
}

/** Compara dois telefones por DDD + 8 últimos dígitos (tolerante a DDI/9º dígito). */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = phoneKey(a)
  const kb = phoneKey(b)
  return !!ka && ka === kb
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
