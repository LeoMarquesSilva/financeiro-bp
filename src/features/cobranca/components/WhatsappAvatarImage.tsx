import { useEffect, useRef, useState } from 'react'
import { AvatarImage } from '@/components/ui/avatar'
import { whatsappService } from '../services/whatsappService'
import { isDirectAvatarUrl } from '../utils/whatsappAvatar'

interface Props {
  src?: string | null
  alt: string
  remoteJid?: string
  fetchIfNeeded?: boolean
  lazy?: boolean
}

function needsProxyFetch(
  src: string | null | undefined,
  fetchIfNeeded: boolean,
  remoteJid?: string,
): boolean {
  if (!fetchIfNeeded || !remoteJid) return false
  return !isDirectAvatarUrl(src)
}

export function WhatsappAvatarImage({
  src,
  alt,
  remoteJid,
  fetchIfNeeded = false,
  lazy = false,
}: Props) {
  const observerRef = useRef<HTMLSpanElement>(null)
  const identity = remoteJid ?? src ?? alt

  const directSrc = isDirectAvatarUrl(src) ? src!.trim() : null
  const [proxySrc, setProxySrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(!lazy)

  // Troca de conversa: limpa estado anterior (evita avatar “grudado”).
  useEffect(() => {
    setFailed(false)
    setProxySrc(null)
    setVisible(!lazy)

    if (!needsProxyFetch(src, fetchIfNeeded, remoteJid) || !remoteJid) return

    const cached = whatsappService.getCachedAvatarDataUrl(remoteJid)
    if (cached) setProxySrc(cached)
  }, [identity, src, fetchIfNeeded, remoteJid, lazy])

  useEffect(() => {
    if (!lazy || !fetchIfNeeded) {
      setVisible(true)
      return
    }
    const el = observerRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true)
      },
      { rootMargin: '120px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [lazy, fetchIfNeeded, identity])

  useEffect(() => {
    if (
      !visible ||
      failed ||
      proxySrc ||
      directSrc ||
      !needsProxyFetch(src, fetchIfNeeded, remoteJid) ||
      !remoteJid
    ) {
      return
    }

    let cancelled = false
    const jidAtFetch = remoteJid
    whatsappService
      .fetchAvatarDataUrl(remoteJid)
      .then((dataUrl) => {
        if (cancelled || jidAtFetch !== remoteJid) return
        if (dataUrl) setProxySrc(dataUrl)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [visible, failed, proxySrc, directSrc, src, fetchIfNeeded, remoteJid, identity])

  const displaySrc = directSrc ?? proxySrc
  const showObserver = lazy && fetchIfNeeded && !displaySrc && !failed

  return (
    <>
      {showObserver && (
        <span ref={observerRef} className="pointer-events-none absolute inset-0" aria-hidden />
      )}
      {displaySrc && !failed && (
        <AvatarImage
          key={identity}
          src={displaySrc}
          alt={alt}
          onError={() => setFailed(true)}
        />
      )}
    </>
  )
}
