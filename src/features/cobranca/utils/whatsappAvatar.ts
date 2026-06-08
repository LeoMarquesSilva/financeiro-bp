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
