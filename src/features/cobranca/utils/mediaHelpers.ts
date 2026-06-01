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
