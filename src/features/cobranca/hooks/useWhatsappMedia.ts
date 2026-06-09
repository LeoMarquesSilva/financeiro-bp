import { useCallback, useEffect, useRef, useState } from 'react'
import { whatsappService } from '../services/whatsappService'

interface Options {
  /** Carrega ao entrar na área visível (lazy). Imagens/figurinhas. */
  autoLoad?: boolean
}

export function useWhatsappMedia(
  remoteJid: string,
  messageId: string | null | undefined,
  options: Options = {},
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(() =>
    messageId ? whatsappService.getCachedMediaDataUrl(remoteJid, messageId) : null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [mimetype, setMimetype] = useState<string | null>(null)
  const startedRef = useRef(false)

  const load = useCallback(async () => {
    if (!messageId || startedRef.current) return
    const cached = whatsappService.getCachedMediaDataUrl(remoteJid, messageId)
    if (cached) {
      setSrc(cached)
      return
    }
    startedRef.current = true
    setLoading(true)
    setError(false)
    try {
      const result = await whatsappService.fetchMediaQueued(remoteJid, messageId)
      const dataUrl = whatsappService.cacheMediaDataUrl(
        remoteJid,
        messageId,
        result.base64,
        result.mimetype,
      )
      setSrc(dataUrl)
      setFileName(result.fileName)
      setMimetype(result.mimetype)
    } catch {
      startedRef.current = false
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [messageId, remoteJid])

  useEffect(() => {
    if (!options.autoLoad || !messageId || src) return
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void load()
          observer.disconnect()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [options.autoLoad, messageId, load, src])

  return { containerRef, src, loading, error, fileName, mimetype, load }
}
