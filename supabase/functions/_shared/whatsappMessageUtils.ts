/** Utilitários compartilhados entre webhook, sync e send. */

export function extractText(message: Record<string, unknown> | undefined, messageType?: string | null): string {
  if (!message) return labelForType(messageType)
  const m = message as Record<string, any>
  const inner = (m.ephemeralMessage?.message ?? m.viewOnceMessage?.message) as
    | Record<string, any>
    | undefined

  const text =
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    inner?.conversation ??
    inner?.extendedTextMessage?.text ??
    inner?.imageMessage?.caption ??
    inner?.videoMessage?.caption ??
    inner?.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.templateMessage?.hydratedTemplate?.hydratedContentText ??
    m.ephemeralMessage?.message?.conversation ??
    m.viewOnceMessage?.message?.conversation ??
    ''

  if (String(text).trim()) return String(text).trim()
  if (m.documentMessage?.fileName) return `📄 ${m.documentMessage.fileName}`
  if (m.documentMessage) return '📄 Documento'
  if (m.imageMessage) return '📷 Imagem'
  if (m.videoMessage) return '🎬 Vídeo'
  if (m.audioMessage) return '🎤 Áudio'
  if (m.stickerMessage) return '🎨 Figurinha'
  if (m.contactMessage?.displayName) return `👤 ${m.contactMessage.displayName}`
  if (m.contactMessage) return '👤 Contato'
  if (m.contactsArrayMessage) return '👥 Contatos'
  if (m.locationMessage) return '📍 Localização'
  if (m.reactionMessage?.text) return `${m.reactionMessage.text} (reação)`
  if (m.reactionMessage) return 'Reação'
  return labelForType(messageType)
}

function labelForType(messageType?: string | null): string {
  switch (messageType) {
    case 'imageMessage':
      return '📷 Imagem'
    case 'videoMessage':
      return '🎬 Vídeo'
    case 'audioMessage':
      return '🎤 Áudio'
    case 'documentMessage':
      return '📄 Documento'
    case 'stickerMessage':
      return '🎨 Figurinha'
    case 'contactMessage':
    case 'contactsArrayMessage':
      return '👤 Contato'
    case 'locationMessage':
      return '📍 Localização'
    case 'reactionMessage':
      return 'Reação'
    default:
      return ''
  }
}

export interface MediaMeta {
  mimetype?: string
  fileName?: string
  seconds?: number
  caption?: string
  ptt?: boolean
  cachedAt?: string
}

export function extractMediaMeta(
  message: Record<string, unknown> | undefined,
  messageType?: string | null,
): MediaMeta | null {
  if (!message) return null
  const m = message as Record<string, any>
  const tipo = messageType ?? ''

  const inner = (m.ephemeralMessage?.message ?? m.viewOnceMessage?.message) as
    | Record<string, any>
    | undefined

  if (tipo === 'imageMessage' || m.imageMessage || inner?.imageMessage) {
    const img = m.imageMessage ?? inner?.imageMessage
    return img
      ? { mimetype: img.mimetype, caption: img.caption, fileName: img.fileName }
      : null
  }
  if (tipo === 'videoMessage' || m.videoMessage || inner?.videoMessage) {
    const v = m.videoMessage ?? inner?.videoMessage
    return v ? { mimetype: v.mimetype, caption: v.caption, seconds: v.seconds } : null
  }
  if (tipo === 'audioMessage' || m.audioMessage) {
    const a = m.audioMessage
    return a
      ? { mimetype: a.mimetype, seconds: a.seconds, ptt: a.ptt }
      : null
  }
  if (tipo === 'documentMessage' || m.documentMessage || inner?.documentMessage) {
    const d = m.documentMessage ?? inner?.documentMessage
    return d
      ? { mimetype: d.mimetype, fileName: d.fileName, caption: d.caption }
      : null
  }
  if (tipo === 'stickerMessage' || m.stickerMessage) {
    const s = m.stickerMessage
    return s ? { mimetype: s.mimetype } : null
  }
  return null
}

export function extractReactionTo(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null
  const m = message as Record<string, any>
  return m.reactionMessage?.key?.id ?? null
}

export function mapStatus(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') {
    const map: Record<number, string> = {
      0: 'ERROR',
      1: 'PENDING',
      2: 'SERVER_ACK',
      3: 'DELIVERY_ACK',
      4: 'READ',
      5: 'PLAYED',
    }
    return map[raw] ?? String(raw)
  }
  return String(raw)
}

export function canonicalJid(jid: string): string {
  const [user, domain] = jid.split('@')
  const base = (user ?? '').split(':')[0]
  return domain ? `${base}@${domain}` : base
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us')
}

export function isValidWhatsappRemoteJid(jid: string | null | undefined): boolean {
  if (!jid?.includes('@')) return false
  const canonical = canonicalJid(jid)
  return (
    canonical.endsWith('@s.whatsapp.net') ||
    canonical.endsWith('@g.us') ||
    canonical.includes('@lid')
  )
}

function normalizePhoneDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (!d) return null
  d = d.replace(/^0+/, '')
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d
  return d.length >= 12 ? d : null
}

/** Extrai telefone canônico a partir de remoteJidAlt (Evolution/Baileys). Ignora @lid. */
export function phoneFromJidAlt(alt: string | null | undefined): string | null {
  if (!alt?.trim()) return null
  const canonical = canonicalJid(alt.trim())
  if (canonical.includes('@lid')) return null
  const user = canonical.split('@')[0]
  return user && /^\d+$/.test(user) ? user : null
}

export function isLidJid(jid: string | null | undefined): boolean {
  return !!jid && jid.includes('@lid')
}

/** Resolve JID de contato da Evolution (remoteJid/telefone), ignorando id interno. */
export function resolveEvolutionContactJid(c: Record<string, unknown>): string | null {
  for (const field of ['remoteJid', 'jid']) {
    const raw = c[field] as string | undefined
    if (!raw || raw === 'status@broadcast') continue
    const canonical = canonicalJid(raw)
    if (isValidWhatsappRemoteJid(canonical)) return canonical
  }
  for (const field of ['phoneNumber', 'phone', 'number']) {
    const raw = c[field] as string | undefined
    if (!raw) continue
    const digits = normalizePhoneDigits(String(raw))
    if (digits) return `${digits}@s.whatsapp.net`
  }
  return null
}

export function isInternalBusinessName(name: string | null | undefined): boolean {
  const raw = (name ?? '').trim()
  if (!raw) return false
  const n = raw.toLowerCase()
  if (n.includes('financeiro bp') || n.includes('selores')) return true
  if (n.includes('comitê de inadimplência') || n.includes('comite de inadimplencia')) return true
  return (
    n.includes('bismarchi') &&
    (n.includes('pires') || n.includes('sociedade') || n.includes('advogados') || n.includes('financeiro'))
  )
}

/** Nome inválido para exibição (só dígitos, rótulos genéricos, etc.). */
export function isUsableEvolutionContactName(name: string | null | undefined): boolean {
  const raw = (name ?? '').trim()
  if (!raw) return false
  if (/^\d+$/.test(raw)) return false
  if (isInternalBusinessName(raw)) return false
  const n = raw.toLowerCase()
  if (n === 'você' || n === 'voce' || n === 'you') return false
  return true
}

/**
 * Nome salvo na agenda do celular (contato cadastrado).
 * Baileys/Evolution: `name`, `verifiedName`; às vezes `contactName` / `saveName`.
 */
export function extractAgendaName(c: Record<string, unknown>): string | null {
  const raw = (c.name ?? c.contactName ?? c.saveName ?? c.verifiedName ?? null) as string | null
  const name = raw?.trim()
  return name && isUsableEvolutionContactName(name) ? name : null
}

/**
 * Nome de perfil WhatsApp (o que a pessoa definiu no app) — não é o da agenda.
 * Mensagens e Evolution costumam expor em `pushName` / `notify`.
 */
export function extractProfileName(c: Record<string, unknown>): string | null {
  const raw = (c.pushName ?? c.notify ?? c.profileName ?? null) as string | null
  const name = raw?.trim()
  return name && isUsableEvolutionContactName(name) ? name : null
}

/** Melhor nome disponível: agenda primeiro, perfil como fallback. */
export function pickContactPushName(c: Record<string, unknown>): string | null {
  return extractAgendaName(c) ?? extractProfileName(c)
}

/**
 * Decide se deve gravar `push_name` no banco.
 * Agenda sempre pode sobrescrever; perfil só preenche quando ainda não há nome.
 */
export function resolvePushNameForUpdate(
  existing: string | null | undefined,
  incoming: Record<string, unknown>,
): string | null {
  const agenda = extractAgendaName(incoming)
  if (agenda) return agenda
  const profile = extractProfileName(incoming)
  if (!profile) return null
  if (!existing?.trim() || !isUsableEvolutionContactName(existing)) return profile
  return null
}

export interface ReactionEntry {
  emoji: string
  fromMe?: boolean
  pushName?: string | null
}

export function mergeReaction(
  existing: ReactionEntry[] | null | undefined,
  emoji: string,
  fromMe: boolean,
  pushName?: string | null,
): ReactionEntry[] {
  const list = [...(existing ?? [])]
  const idx = list.findIndex((r) => r.fromMe === fromMe)
  if (!emoji) {
    if (idx >= 0) list.splice(idx, 1)
    return list
  }
  const entry: ReactionEntry = { emoji, fromMe, pushName: pushName ?? null }
  if (idx >= 0) list[idx] = entry
  else list.push(entry)
  return list
}
