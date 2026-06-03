import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { whatsappService } from '../services/whatsappService'
import { base64ToDataUrl } from '../utils/mediaHelpers'
import { WhatsappFormattedText } from './WhatsappFormattedText'
import type { WhatsappMensagemRow } from '@/lib/database.types'

interface Props {
  message: WhatsappMensagemRow
  remoteJid: string
  fromMe?: boolean
}

function MediaCaption({ text, fromMe }: { text: string; fromMe?: boolean }) {
  return (
    <p className="whitespace-pre-wrap text-sm">
      <WhatsappFormattedText text={text} fromMe={fromMe} />
    </p>
  )
}

export function WhatsappMessageMedia({ message, remoteJid, fromMe }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const tipo = message.tipo ?? ''
  const fileName = message.media_meta?.fileName ?? 'arquivo'
  const caption = message.media_meta?.caption

  const load = async () => {
    if (!message.message_id || src) return
    setLoading(true)
    setError(false)
    try {
      const { base64, mimetype } = await whatsappService.fetchMedia(remoteJid, message.message_id)
      setSrc(base64ToDataUrl(base64, mimetype || 'application/octet-stream'))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (tipo === 'documentMessage') {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-slate-200/50 bg-black/5 px-3 py-2 text-left text-sm hover:bg-black/10"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FileText className="h-5 w-5 shrink-0" />
          )}
          <span className="truncate">{fileName}</span>
        </button>
        {src && (
          <Button variant="outline" size="sm" className="w-fit gap-1" asChild>
            <a href={src} download={fileName}>
              <Download className="h-3 w-3" />
              Baixar
            </a>
          </Button>
        )}
        {error && <span className="text-xs opacity-70">Não foi possível carregar o documento.</span>}
        {caption && <MediaCaption text={caption} fromMe={fromMe} />}
      </div>
    )
  }

  if (tipo === 'videoMessage') {
    return (
      <div className="flex flex-col gap-2">
        {!src && !loading && (
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-black/10 px-4 py-3 text-sm hover:bg-black/20"
          >
            ▶ Reproduzir vídeo
          </button>
        )}
        {loading && <Loader2 className="h-6 w-6 animate-spin" />}
        {src && <video controls src={src} className="max-h-64 max-w-full rounded-lg" />}
        {error && <span className="text-xs opacity-70">Erro ao carregar vídeo.</span>}
        {caption && <MediaCaption text={caption} fromMe={fromMe} />}
      </div>
    )
  }

  if (tipo === 'stickerMessage') {
    if (loading) return <Loader2 className="h-8 w-8 animate-spin" />
    if (error || !src) {
      return (
        <button type="button" onClick={load} className="text-sm underline opacity-80">
          🎨 Carregar figurinha
        </button>
      )
    }
    return <img src={src} alt="Figurinha" className="max-h-32 max-w-[128px] object-contain" />
  }

  // imageMessage
  if (loading) return <Loader2 className="h-8 w-8 animate-spin" />
  if (error || !src) {
    return (
      <button type="button" onClick={load} className="text-sm underline opacity-80">
        📷 Carregar imagem
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="block overflow-hidden rounded-lg">
            <img src={src} alt="" className="max-h-64 max-w-full cursor-zoom-in object-cover" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <img src={src} alt="" className="max-h-[85vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
      {caption && <MediaCaption text={caption} fromMe={fromMe} />}
    </div>
  )
}
