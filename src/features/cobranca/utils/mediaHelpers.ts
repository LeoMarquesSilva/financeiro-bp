export function base64ToDataUrl(base64: string, mimetype: string): string {
  const clean = base64.includes('base64,') ? base64.split('base64,')[1] : base64
  return `data:${mimetype};base64,${clean}`
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.includes('base64,') ? result.split('base64,')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.includes('base64,') ? result.split('base64,')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export const MEDIA_TIPOS = new Set([
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
])

export function isMediaTipo(tipo: string | null | undefined): boolean {
  return !!tipo && MEDIA_TIPOS.has(tipo)
}

export function mediatypeFromFile(file: File): 'image' | 'video' | 'document' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'document'
}

/** Tipos aceitos no anexo do composer (envio). */
export const COMPOSER_FILE_ACCEPT =
  'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.rar,.odt,.ods,.odp,.7z'

export function documentTypeLabel(mimetype: string | null | undefined): string {
  const m = (mimetype ?? '').toLowerCase()
  if (!m) return 'Documento'
  if (m.includes('pdf')) return 'PDF'
  if (m.includes('word') || m.includes('msword')) return 'Word'
  if (m.includes('sheet') || m.includes('excel')) return 'Excel'
  if (m.includes('presentation') || m.includes('powerpoint')) return 'PowerPoint'
  if (m.includes('csv')) return 'CSV'
  if (m.startsWith('image/')) return 'Imagem'
  if (m.startsWith('video/')) return 'Vídeo'
  if (m.includes('zip') || m.includes('rar') || m.includes('7z')) return 'Arquivo compactado'
  if (m.includes('text/plain')) return 'Texto'
  return 'Documento'
}

export function isImageMimetype(mimetype: string | null | undefined): boolean {
  return (mimetype ?? '').startsWith('image/')
}

/** Resolve metadados do documento (DB ou raw da Evolution). */
export function resolveDocumentMeta(message: {
  media_meta?: { fileName?: string; mimetype?: string; caption?: string } | null
  raw?: Record<string, unknown> | null
}): { fileName: string; mimetype: string; caption?: string } {
  const meta = message.media_meta
  const raw = message.raw as Record<string, any> | null
  const inner = raw?.message?.ephemeralMessage?.message ?? raw?.message?.viewOnceMessage?.message
  const doc = raw?.message?.documentMessage ?? inner?.documentMessage
  return {
    fileName: (meta?.fileName ?? doc?.fileName ?? 'arquivo') as string,
    mimetype: (meta?.mimetype ?? doc?.mimetype ?? 'application/octet-stream') as string,
    caption: (meta?.caption ?? doc?.caption) as string | undefined,
  }
}
