import { canonicalJid, phoneToRemoteJid, normalizePhone } from './phone'
import { isGroupJid, isLidJid } from './jid'

/** JID utilizável na edge function whatsapp-avatar (telefone @s.whatsapp.net). */
export function normalizeAvatarRemoteJid(remoteJid: string | null | undefined): string | null {
  if (!remoteJid?.trim()) return null
  const raw = remoteJid.trim()
  if (isLidJid(raw) || isGroupJid(raw)) return null
  if (raw.includes('@s.whatsapp.net')) return canonicalJid(raw)
  const fromPhone = phoneToRemoteJid(raw)
  if (fromPhone) return canonicalJid(fromPhone)
  const e164 = normalizePhone(raw)
  if (e164) return `${e164}@s.whatsapp.net`
  return null
}

/** URLs do CDN do WhatsApp expiram e retornam 403/404 no browser. */
export function isWhatsappCdnUrl(src: string | null | undefined): boolean {
  if (!src) return false
  try {
    const host = new URL(src).hostname.toLowerCase()
    return host === 'pps.whatsapp.net' || host.endsWith('.whatsapp.net')
  } catch {
    return src.includes('whatsapp.net')
  }
}

/** URL utilizável diretamente no `<img>` (não é CDN temporário do WhatsApp). */
export function isDirectAvatarUrl(src: string | null | undefined): boolean {
  if (!src?.trim()) return false
  if (src.startsWith('data:')) return true
  return !isWhatsappCdnUrl(src)
}
