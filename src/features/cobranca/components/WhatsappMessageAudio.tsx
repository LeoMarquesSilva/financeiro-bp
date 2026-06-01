import { useState } from 'react'
import { Loader2, Mic, Play } from 'lucide-react'
import { whatsappService } from '../services/whatsappService'
import { base64ToDataUrl } from '../utils/mediaHelpers'
import type { WhatsappMensagemRow } from '@/lib/database.types'

interface Props {
  message: WhatsappMensagemRow
  remoteJid: string
}

export function WhatsappMessageAudio({ message, remoteJid }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const seconds = message.media_meta?.seconds
  const ptt = message.media_meta?.ptt

  const load = async () => {
    if (!message.message_id || src || loading) return
    setLoading(true)
    setError(false)
    try {
      const { base64, mimetype } = await whatsappService.fetchMedia(remoteJid, message.message_id)
      setSrc(base64ToDataUrl(base64, mimetype || 'audio/ogg'))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1 text-sm opacity-80">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando áudio…
      </div>
    )
  }

  if (error || !src) {
    return (
      <button
        type="button"
        onClick={load}
        className="flex items-center gap-2 py-1 text-sm hover:opacity-90"
      >
        <Play className="h-4 w-4" />
        <Mic className="h-4 w-4" />
        {ptt ? 'Reproduzir nota de voz' : 'Reproduzir áudio'}
        {seconds ? ` (${seconds}s)` : ''}
      </button>
    )
  }

  return (
    <div className="flex min-w-[200px] flex-col gap-1">
      <audio controls src={src} className="max-w-full" preload="metadata" />
      {seconds != null && (
        <span className="text-[10px] opacity-70">{ptt ? 'Nota de voz' : 'Áudio'} · {seconds}s</span>
      )}
    </div>
  )
}
