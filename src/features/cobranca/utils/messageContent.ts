/** Extrai texto ou rótulo amigável de uma mensagem WhatsApp (Evolution/Baileys). */
export function extractMessageText(
  message: Record<string, unknown> | null | undefined,
  messageType?: string | null,
): string {
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
  if (m.protocolMessage) return ''

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
    case 'protocolMessage':
      return ''
    default:
      return ''
  }
}

/** Texto para exibir na UI (usa conteudo salvo ou re-parse do raw). */
export function displayMessageContent(row: {
  conteudo: string | null
  tipo?: string | null
  raw?: Record<string, unknown> | null
}): string {
  const saved = row.conteudo?.trim()
  if (saved) return saved

  const raw = row.raw as Record<string, any> | null
  const message = raw?.message as Record<string, unknown> | undefined
  const parsed = extractMessageText(message, row.tipo ?? (raw?.messageType as string | undefined))
  if (parsed) return parsed

  return '—'
}
